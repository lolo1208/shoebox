export type Base = 'hex' | 'dec' | 'oct' | 'bin';
export type BitWidth = 8 | 16 | 32 | 64;
export type BinaryOp = 'add' | 'sub' | 'mul' | 'div' | 'mod' | 'and' | 'or' | 'xor' | 'shl' | 'shr';

export const BASE_ORDER: Base[] = ['hex', 'dec', 'oct', 'bin'];

export const BASE_META: Record<Base, { radix: number; label: string; prefix: string }> = {
  hex: { radix: 16, label: 'HEX', prefix: '0x' },
  dec: { radix: 10, label: 'DEC', prefix: '' },
  oct: { radix: 8, label: 'OCT', prefix: '0o' },
  bin: { radix: 2, label: 'BIN', prefix: '0b' },
};

export const BIT_WIDTHS: BitWidth[] = [8, 16, 32, 64];

export const OP_SYMBOL: Record<BinaryOp, string> = {
  add: '+',
  sub: '\u2212',
  mul: '\u00d7',
  div: '\u00f7',
  mod: '%',
  and: 'AND',
  or: 'OR',
  xor: 'XOR',
  shl: '<<',
  shr: '>>',
};

/** 当前位宽的全 1 掩码 */
export const maskFor = (bits: BitWidth): bigint => (1n << BigInt(bits)) - 1n;

/** 将 BigInt 按补码截断为指定位宽的无符号值 */
export const wrap = (value: bigint, bits: BitWidth): bigint => value & maskFor(bits);

/** 将无符号值按补码解释为有符号值 */
export const toSigned = (value: bigint, bits: BitWidth): bigint => {
  const unsigned = wrap(value, bits);
  const signBit = 1n << BigInt(bits - 1);
  return unsigned >= signBit ? unsigned - (signBit << 1n) : unsigned;
};

const padTo = (text: string, length: number, char = '0'): string =>
  text.length >= length ? text : char.repeat(length - text.length) + text;

/** 从左侧起每 size 个字符插入分隔符 */
const groupFromLeft = (text: string, size: number, separator = ' '): string =>
  text.replace(new RegExp(`(.{${size}})(?=.)`, 'g'), `$1${separator}`);

/** 从右侧起每 size 个字符插入分隔符 */
const groupFromRight = (text: string, size: number, separator = ' '): string =>
  text.replace(new RegExp(`(.)(?=(.{${size}})+$)`, 'g'), `$1${separator}`);

export const displayDigitsOf = (base: Base, bits: BitWidth): number =>
  base === 'bin' ? bits : base === 'hex' ? Math.ceil(bits / 4) : 0;

/**
 * 按指定进制格式化显示值。
 * 二进制按半字节、十六进制按 4 位、八进制按 3 位分组。
 */
export const formatValue = (
  value: bigint,
  base: Base,
  bits: BitWidth,
  signed: boolean,
  grouped = true
): string => {
  const unsigned = wrap(value, bits);

  if (base === 'dec') {
    return (signed ? toSigned(unsigned, bits) : unsigned).toString(10);
  }

  if (base === 'bin') {
    if (!grouped) return padTo(unsigned.toString(2), bits);
    return groupFromLeft(padTo(unsigned.toString(2), bits), 4);
  }

  if (base === 'hex') {
    const raw = padTo(unsigned.toString(16).toUpperCase(), displayDigitsOf('hex', bits));
    return grouped ? groupFromLeft(raw, 4) : raw;
  }

  const raw = unsigned.toString(8);
  return grouped ? groupFromRight(raw, 3) : raw;
};

/** 便于复制的表示：带前缀且不含分隔符 */
export const formatForCopy = (value: bigint, base: Base, bits: BitWidth, signed: boolean): string => {
  const unsigned = wrap(value, bits);
  if (base === 'dec') return (signed ? toSigned(unsigned, bits) : unsigned).toString(10);
  const digits = formatValue(unsigned, base, bits, false, false);
  return `${BASE_META[base].prefix}${digits}`;
};

/** 解析指定进制的输入，无法解析时返回 null */
export const parseValue = (text: string, base: Base): bigint | null => {
  const cleaned = text.replace(/[\s_]/g, '').replace(/^0[xob]/i, '');
  if (!cleaned) return null;
  const allowed = base === 'hex' ? /^[0-9a-f]+$/i : base === 'oct' ? /^[0-7]+$/ : base === 'bin' ? /^[01]+$/ : /^[0-9]+$/;
  if (!allowed.test(cleaned)) return null;
  const prefixed = base === 'hex' ? `0x${cleaned}` : base === 'oct' ? `0o${cleaned}` : base === 'bin' ? `0b${cleaned}` : cleaned;
  try {
    return BigInt(prefixed);
  } catch {
    return null;
  }
};

export class DivideByZeroError extends Error {}

export const compute = (
  left: bigint,
  op: BinaryOp,
  right: bigint,
  bits: BitWidth,
  signed = false
): bigint => {
  const a = wrap(left, bits);
  const b = wrap(right, bits);
  switch (op) {
    case 'add':
      return wrap(a + b, bits);
    case 'sub':
      return wrap(a - b, bits);
    case 'mul':
      return wrap(a * b, bits);
    case 'div': {
      if (b === 0n) throw new DivideByZeroError();
      if (signed) return wrap(toSigned(a, bits) / toSigned(b, bits), bits);
      return wrap(a / b, bits);
    }
    case 'mod': {
      if (b === 0n) throw new DivideByZeroError();
      if (signed) return wrap(toSigned(a, bits) % toSigned(b, bits), bits);
      return wrap(a % b, bits);
    }
    case 'and':
      return wrap(a & b, bits);
    case 'or':
      return wrap(a | b, bits);
    case 'xor':
      return wrap(a ^ b, bits);
    case 'shl':
      if (b >= BigInt(bits)) return 0n;
      return wrap(a << b, bits);
    case 'shr':
      if (b >= BigInt(bits)) return 0n;
      return wrap(a >> b, bits);
    default:
      return a;
  }
};

export const bitCount = (value: bigint, bits: BitWidth): number => {
  let remaining = wrap(value, bits);
  let count = 0;
  while (remaining > 0n) {
    count += Number(remaining & 1n);
    remaining >>= 1n;
  }
  return count;
};

export const byteSwap = (value: bigint, bits: BitWidth): bigint => {
  const byteLength = bits / 8;
  let result = 0n;
  for (let index = 0; index < byteLength; index += 1) {
    const byte = (wrap(value, bits) >> BigInt(index * 8)) & 0xffn;
    result |= byte << BigInt((byteLength - 1 - index) * 8);
  }
  return wrap(result, bits);
};

export const rotate = (value: bigint, bits: BitWidth, amount: number): bigint => {
  const normalized = ((amount % bits) + bits) % bits;
  if (normalized === 0) return wrap(value, bits);
  const unsigned = wrap(value, bits);
  const width = BigInt(bits);
  const shift = BigInt(normalized);
  return wrap((unsigned << shift) | (unsigned >> (width - shift)), bits);
};
