/**
 * 基于 Web Crypto 的随机源。
 *
 * 所有取样都使用拒绝采样（rejection sampling）：先丢弃落在
 * `floor(2^32 / max) * max` 之后的高位区间，再做取模，
 * 从而避免直接 `% max` 带来的取模偏差（modulo bias）。
 */

/** 32 位无符号整数的取值空间 */
const UINT32_SPACE = 0x1_0000_0000;

/** 单次 getRandomValues 的上限（规范限制为 65536 字节） */
const MAX_BYTES_PER_CALL = 65536;

/** 取 [0, max) 内的均匀随机整数 */
export function randomIndex(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`randomIndex expects a positive integer, received ${max}`);
  }
  if (max === 1) return 0;

  const limit = Math.floor(UINT32_SPACE / max) * max;
  const sample = new Uint32Array(1);
  let value = 0;
  do {
    window.crypto.getRandomValues(sample);
    value = sample[0];
  } while (value >= limit);

  return value % max;
}

/** 取 length 字节密码学随机数据 */
export function randomBytes(length: number): Uint8Array {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`randomBytes expects a non-negative integer, received ${length}`);
  }

  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += MAX_BYTES_PER_CALL) {
    window.crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + MAX_BYTES_PER_CALL, length)));
  }
  return bytes;
}

/** 原地 Fisher–Yates 洗牌，每一种排列等概率出现 */
export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
