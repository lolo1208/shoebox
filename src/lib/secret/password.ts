/**
 * 字符型密码生成。
 *
 * 实现要点（对齐 VeraCrypt 一类密码/密钥生成器的做法，并补足其取模偏差问题）：
 *
 * 1. 随机源：Web Crypto CSPRNG（由操作系统熵池提供），与磁盘加密工具取熵的方式一致；
 * 2. 无偏取样：`randomIndex` 用拒绝采样，不会出现 `% 字符集大小` 带来的取模偏差；
 * 3. 分布均匀：「每类至少出现一次」这类组合约束不用「先塞一个再补足再洗牌」
 *    （那种做法会让不同字符的权重不再相等），而是对整个合法集合做拒绝采样，
 *    因此结果在合法空间上严格均匀；
 * 4. 熵可精确计算：分布均匀 ⇒ 熵 = log2(合法组合数)，由 combinations.ts 用 BigInt 计数，
 *    比 `长度 × log2(字符集大小)` 的估算更贴近实际（含覆盖约束、不重复约束）。
 */

import { buildCharset, type CharsetBuild } from './charset';
import { countSecretSpace, log2Exact } from './combinations';
import { clampInteger, PASSWORD_LENGTH, SECRET_COUNT } from './limits';
import { randomIndex, shuffleInPlace } from './random';
import type { GenerationResult, PasswordOptions, SecretError } from './types';

/**
 * 拒绝采样的尝试上限。
 * 常见参数下合法比例远高于 5%（例如 4 位覆盖 4 类约 7%），
 * 512 次仍未命中的概率低于 1e-11，仅作为极端参数的保险丝。
 */
const MAX_REJECTION_ATTEMPTS = 512;

interface PasswordSpace {
  charset: CharsetBuild;
  length: number;
  /** 字符不重复 */
  unique: boolean;
  /** 字符 → 所属类别下标，类别互不重叠，因此可以用单个 Map 表达 */
  classIndex: Map<string, number>;
  /** 需要覆盖的类别数量 */
  classCount: number;
  /** 每个类别过滤后的字符，供兜底构造使用 */
  classCharsets: string[];
}

function failure(error: SecretError, charsetSize: number, length: number): GenerationResult {
  return { secrets: [], error, bits: 0, charsetSize, length };
}

/** 独立取样：从字符集均匀取 length 个字符，允许重复 */
function sampleWithRepeats(charset: CharsetBuild, length: number): string {
  const chars = charset.characters;
  let text = '';
  for (let i = 0; i < length; i++) text += chars[randomIndex(chars.length)];
  return text;
}

/** 不重复取样：部分 Fisher–Yates，在全部 length-排列上均匀分布 */
function sampleUnique(charset: CharsetBuild, length: number): string {
  const pool = [...charset.characters];
  const picks: string[] = [];
  for (let i = 0; i < length; i++) {
    const j = i + randomIndex(pool.length - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
    picks.push(pool[i]);
  }
  return picks.join('');
}

/** 候选是否覆盖了每一个必选类别 */
function coversAllClasses(value: string, space: PasswordSpace): boolean {
  if (space.classCount === 0) return true;

  const covered = new Uint8Array(space.classCount);
  let remaining = space.classCount;
  for (const char of value) {
    const index = space.classIndex.get(char);
    if (index === undefined || covered[index]) continue;

    covered[index] = 1;
    remaining -= 1;
    if (remaining === 0) return true;
  }
  return false;
}

/**
 * 兜底构造：拒绝采样耗尽时按类别逐个放置再补足。
 * 该路径几乎不可能触发，只为「一定返回结果」而存在（分布不再严格均匀）。
 */
function placeClassesThenFill(space: PasswordSpace): string {
  const { charset, length, unique, classCharsets } = space;
  const pool = [...charset.characters];
  const picks: string[] = [];

  for (const classCharset of classCharsets) {
    const candidates = pool.filter((char) => classCharset.includes(char));
    if (candidates.length === 0) continue;

    const char = candidates[randomIndex(candidates.length)];
    picks.push(char);
    if (unique) pool.splice(pool.indexOf(char), 1);
  }

  while (picks.length < length && pool.length > 0) {
    const index = randomIndex(pool.length);
    picks.push(unique ? pool.splice(index, 1)[0] : pool[index]);
  }

  return shuffleInPlace(picks).join('');
}

function buildPassword(space: PasswordSpace): string {
  const sample = () => (space.unique ? sampleUnique(space.charset, space.length) : sampleWithRepeats(space.charset, space.length));

  if (space.classCount === 0) return sample();

  for (let attempt = 0; attempt < MAX_REJECTION_ATTEMPTS; attempt++) {
    const candidate = sample();
    if (coversAllClasses(candidate, space)) return candidate;
  }

  return placeClassesThenFill(space);
}

/** 批量生成密码；参数无解时以 `error` 返回，不抛异常 */
export function generatePasswordBatch(options: PasswordOptions): GenerationResult {
  const length = clampInteger(options.length, PASSWORD_LENGTH.min, PASSWORD_LENGTH.max);
  const count = clampInteger(options.count, SECRET_COUNT.min, SECRET_COUNT.max);
  const charset = buildCharset(options);
  const unique = !options.allowRepeats;

  if (charset.size === 0) {
    return failure({ code: 'no_character_class', params: {} }, 0, length);
  }

  const classSizes = charset.classCharsets.map((chars) => Array.from(chars).length);
  const spaceSize = countSecretSpace({
    charsetSize: charset.size,
    length,
    classSizes,
    requireEachClass: options.requireEachClass,
    unique,
  });

  if (spaceSize === 0n) {
    if (unique && length > charset.size) {
      return failure({ code: 'length_exceeds_charset', params: { max: charset.size } }, charset.size, length);
    }
    return failure({ code: 'length_below_class_count', params: { n: classSizes.length } }, charset.size, length);
  }

  const space: PasswordSpace = {
    charset,
    length,
    unique,
    classCount: options.requireEachClass ? charset.classCharsets.length : 0,
    classCharsets: charset.classCharsets,
    classIndex: new Map(
      charset.classCharsets.flatMap((chars, index) => Array.from(chars, (char) => [char, index] as const)),
    ),
  };

  const secrets = Array.from({ length: count }, () => buildPassword(space));

  return {
    secrets,
    error: null,
    // 分布均匀，因此熵就是合法空间的 log2 大小
    bits: log2Exact(spaceSize),
    charsetSize: charset.size,
    length,
  };
}
