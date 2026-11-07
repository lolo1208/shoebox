/**
 * 合法密码空间的计数。
 *
 * 取样在「满足策略约束的合法密码集合」上均匀分布（见 password.ts 的拒绝采样），
 * 所以熵就是 log2(合法组合数)，可以精确算出来。
 *
 * 全部用 BigInt 计算：像 89^128 这类数字远超 Number 的精度范围，
 * 而包容互斥需要把量级相近的大数相减，用浮点会直接丢掉有效位。
 */

/** 下降阶乘 P(n, k) = n × (n-1) × … × (n-k+1)，即不重复取样的排列数 */
export function fallingFactorial(n: number, k: number): bigint {
  if (k < 0 || n < k) return 0n;
  let result = 1n;
  for (let i = 0; i < k; i++) result *= BigInt(n - i);
  return result;
}

export interface SecretSpaceOptions {
  /** 参与取样的字符数 */
  charsetSize: number;
  /** 结果长度 */
  length: number;
  /** 每个「至少出现一次」的类别的字符数，类别之间互不重叠 */
  classSizes: number[];
  /** 是否要求每个类别至少出现一次 */
  requireEachClass: boolean;
  /** 字符是否不可重复 */
  unique: boolean;
}

/**
 * 合法结果的个数。
 * 返回 0n 表示当前参数无解（长度不够覆盖所有类别，或长度超过不重复字符集大小）。
 */
export function countSecretSpace({ charsetSize, length, classSizes, requireEachClass, unique }: SecretSpaceOptions): bigint {
  const sample = (available: number): bigint =>
    unique ? fallingFactorial(available, length) : available > 0 ? BigInt(available) ** BigInt(length) : 0n;

  if (!requireEachClass || classSizes.length === 0) return sample(charsetSize);

  // 包容互斥：逐个减去「缺少若干类别」的情况，符号由子集大小决定
  let valid = 0n;
  const subsets = 1 << classSizes.length;
  for (let mask = 0; mask < subsets; mask++) {
    let removed = 0;
    let picked = 0;
    for (let i = 0; i < classSizes.length; i++) {
      if (mask & (1 << i)) {
        removed += classSizes[i];
        picked += 1;
      }
    }
    const term = sample(charsetSize - removed);
    valid += picked % 2 === 0 ? term : -term;
  }

  return valid > 0n ? valid : 0n;
}

/** log2 精确换算：取 BigInt 高 53 位转浮点，再补回 2 的幂次 */
export function log2Exact(value: bigint): number {
  if (value <= 0n) return 0;

  const bits = value.toString(2).length;
  if (bits <= 53) return Math.log2(Number(value));

  const shift = BigInt(bits - 53);
  return Number(shift) + Math.log2(Number(value >> shift));
}
