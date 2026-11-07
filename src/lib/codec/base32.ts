/**
 * Base32 编解码（RFC 4648 §6 标准表 / §7 base32hex 扩展十六进制表）。
 * 解码忽略大小写与填充，并按字符集自动订正字母表。
 */

import { CodecError, type Base32Variant } from './types';

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32HEX_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUV';

const ENCODE_TABLES: Record<Base32Variant, string> = {
  rfc4648: RFC4648_ALPHABET,
  base32hex: BASE32HEX_ALPHABET,
};

/** 非法字符占位 */
const INVALID = 255;

function buildDecodeTable(alphabet: string): Uint8Array {
  const table = new Uint8Array(128).fill(INVALID);
  for (let i = 0; i < 32; i++) table[alphabet.charCodeAt(i)] = i;
  return table;
}

const DECODE_TABLES: Record<Base32Variant, Uint8Array> = {
  rfc4648: buildDecodeTable(RFC4648_ALPHABET),
  base32hex: buildDecodeTable(BASE32HEX_ALPHABET),
};

export interface Base32EncodeOptions {
  variant?: Base32Variant;
  /** 是否补齐 `=` 填充，Base32 每 5 字节补至 8 字符 */
  padding?: boolean;
  /** 输出是否使用小写字母 */
  lowercase?: boolean;
}

export interface Base32DecodeOptions {
  /** 首选字母表，仅在两套表都合法时生效 */
  variant?: Base32Variant;
}

/**
 * 字母表识别：`0 1 8 9` 只存在于 base32hex，`W X Y Z` 只存在于标准表。
 * 只命中其中一边时可直接判定；两边都不命中（A–V 与 2–7 的公共区）时
 * 两套字母表都合法，只能交给调用方指定的首选表。
 */
export function resolveBase32Variant(input: string, preferred: Base32Variant = 'rfc4648'): Base32Variant {
  const hexOnly = /[0189]/.test(input);
  const standardOnly = /[WXYZ]/.test(input);
  if (hexOnly && !standardOnly) return 'base32hex';
  if (standardOnly && !hexOnly) return 'rfc4648';
  return preferred;
}

/** 便捷封装：按形态猜测字母表，公共区回退到标准表 */
export function detectBase32Variant(input: string): Base32Variant {
  return resolveBase32Variant(input, 'rfc4648');
}

/** 字节编码为 Base32 文本 */
export function encodeBase32(bytes: Uint8Array, options: Base32EncodeOptions = {}): string {
  const alphabet = ENCODE_TABLES[options.variant ?? 'rfc4648'];
  const padding = options.padding ?? true;
  const chars: string[] = [];

  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      chars.push(alphabet[(buffer >> bits) & 0x1f]);
    }
  }

  // 剩余不足 5 位的部分左移补零
  if (bits > 0) chars.push(alphabet[(buffer << (5 - bits)) & 0x1f]);
  if (padding) {
    const remainder = chars.length % 8;
    if (remainder !== 0) chars.push(...new Array<string>(8 - remainder).fill('='));
  }

  const output = chars.join('');
  return options.lowercase ? output.toLowerCase() : output;
}

/**
 * Base32 文本解码为字节。
 * 忽略大小写、空白与填充；字母表按 `variant` 优先、再按字符集自动纠正。
 */
export function decodeBase32(input: string, options: Base32DecodeOptions = {}): Uint8Array {
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  const body = cleaned.replace(/=+$/, '');
  const variant = resolveBase32Variant(body, options.variant ?? 'rfc4648');
  const table = DECODE_TABLES[variant];

  const output = new Uint8Array(Math.floor((body.length * 5) / 8));
  let buffer = 0;
  let bits = 0;
  let written = 0;

  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i);
    const value = code < 128 ? table[code] : INVALID;
    if (value === INVALID) throw new CodecError('invalid_base32_char', { char: body[i], pos: i + 1 });

    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output[written++] = (buffer >> bits) & 0xff;
    }
  }

  // 尾部剩余 5 位以上说明多出一个不完整字符，长度非法
  if (bits >= 5) throw new CodecError('invalid_base32_length', { len: body.length });

  return output.subarray(0, written);
}
