/**
 * 密码字符集构建。
 *
 * 类别字符集是固定常量表；符号集有两种：常用的安全子集，以及
 * 全部 32 个 ASCII 标点（VeraCrypt 等磁盘加密工具的密码生成器采用后者的思路：
 * 字符空间越大，同等长度下熵越高，代价是部分符号需要转义）。
 *
 * `classCharsets` 单独保留每个类别过滤后的字符，供「每类至少出现一次」计数与校验使用。
 */

import { CHARACTER_CLASS_IDS, type CharacterClassId, type PasswordOptions, type SymbolSet } from './types';

/** 字母与数字类别；符号集随选项变化，见 SYMBOL_CHARSETS */
const BASE_CLASS_CHARSETS: Record<Exclude<CharacterClassId, 'symbols'>, string> = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
};

export const SYMBOL_CHARSETS: Record<SymbolSet, string> = {
  /** 去掉引号、反斜杠、反引号等手抄或命令行里容易出错的符号 */
  standard: '!@#$%^&*()-_=+[]{};:,.<>?/~',
  /** ASCII 可打印标点全集（RFC 20 / 各语言 `string.punctuation` 一致） */
  full: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
};

/** 视觉上容易看错的字符：数字 0/1、字母 O/o/l/I 与竖线 */
export const AMBIGUOUS_CHARACTERS = '0Oo1lI|';

export interface CharsetBuild {
  /** 参与随机的完整字符集（已去重） */
  characters: string[];
  /** 每个已选类别过滤后的字符，顺序与 CHARACTER_CLASS_IDS 一致 */
  classCharsets: string[];
  /** 字符集大小 */
  size: number;
}

function classCharacters(id: CharacterClassId, symbolSet: SymbolSet): string {
  return id === 'symbols' ? SYMBOL_CHARSETS[symbolSet] : BASE_CLASS_CHARSETS[id];
}

/** 按选项构建字符集；自定义字符由用户显式指定，不受易混淆过滤影响 */
export function buildCharset(options: PasswordOptions): CharsetBuild {
  const ambiguous = new Set(options.excludeAmbiguous ? Array.from(AMBIGUOUS_CHARACTERS) : []);
  const seen = new Set<string>();
  const characters: string[] = [];
  const classCharsets: string[] = [];

  const append = (chars: string[]) => {
    for (const char of chars) {
      if (seen.has(char)) continue;
      seen.add(char);
      characters.push(char);
    }
  };

  for (const id of CHARACTER_CLASS_IDS) {
    if (!options.classes[id]) continue;

    const chars = Array.from(classCharacters(id, options.symbolSet)).filter((char) => !ambiguous.has(char));
    if (chars.length === 0) continue;

    classCharsets.push(chars.join(''));
    append(chars);
  }

  append(Array.from(options.customCharacters));

  return { characters, classCharsets, size: characters.length };
}
