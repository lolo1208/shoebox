/**
 * Base64 编解码（RFC 4648 §4 标准表 / §5 URL Safe 表）。
 * 输入输出均以字节为单位，文本层由调用方做 UTF-8 转换。
 */

import { CodecError, type Base64Variant } from './types';

const STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const URL_SAFE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const ENCODE_TABLES: Record<Base64Variant, string> = {
  standard: STANDARD_ALPHABET,
  'url-safe': URL_SAFE_ALPHABET,
};

/** 解码表同时收录两套字母表，因此标准与 URL Safe 输入都能直接解出；255 表示非法字符 */
const INVALID = 255;
const DECODE_TABLE: Uint8Array = (() => {
  const table = new Uint8Array(128).fill(INVALID);
  for (let i = 0; i < 64; i++) {
    table[STANDARD_ALPHABET.charCodeAt(i)] = i;
    table[URL_SAFE_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export interface Base64EncodeOptions {
  variant?: Base64Variant;
  /** 是否补齐 `=` 填充，URL Safe 场景通常省略 */
  padding?: boolean;
  /** 每行字符数，0 表示单行 */
  lineWrap?: number;
}

/** data URL 前缀，例如 `data:image/png;base64,` */
const DATA_URL_RE = /^\s*data:[^,]*;base64,/i;

/**
 * 剔除 data URL 前缀，只留 base64 数据部分。
 * 返回的 `offset` 是数据在原字符串中的起始下标，用于校正错误位置。
 */
export function stripDataUrlPrefix(input: string): { text: string; offset: number } {
  const match = DATA_URL_RE.exec(input);
  if (!match) return { text: input, offset: 0 };
  return { text: input.slice(match[0].length), offset: match[0].length };
}

/** 按宽度折行，返回不含末尾换行的文本 */
function wrapLines(text: string, width: number): string {
  if (width <= 0 || text.length <= width) return text;

  const lines: string[] = [];
  for (let i = 0; i < text.length; i += width) lines.push(text.slice(i, i + width));
  return lines.join('\n');
}

/** 字节编码为 Base64 文本 */
export function encodeBase64(bytes: Uint8Array, options: Base64EncodeOptions = {}): string {
  const alphabet = ENCODE_TABLES[options.variant ?? 'standard'];
  const padding = options.padding ?? true;
  const chars: string[] = new Array(4 * Math.ceil(bytes.length / 3));
  let cursor = 0;
  let index = 0;

  for (; index + 2 < bytes.length; index += 3) {
    const triple = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    chars[cursor++] = alphabet[(triple >> 18) & 0x3f];
    chars[cursor++] = alphabet[(triple >> 12) & 0x3f];
    chars[cursor++] = alphabet[(triple >> 6) & 0x3f];
    chars[cursor++] = alphabet[triple & 0x3f];
  }

  const rest = bytes.length - index;
  if (rest === 1) {
    const triple = bytes[index] << 16;
    chars[cursor++] = alphabet[(triple >> 18) & 0x3f];
    chars[cursor++] = alphabet[(triple >> 12) & 0x3f];
    chars[cursor++] = padding ? '=' : '';
    chars[cursor++] = padding ? '=' : '';
  } else if (rest === 2) {
    const triple = (bytes[index] << 16) | (bytes[index + 1] << 8);
    chars[cursor++] = alphabet[(triple >> 18) & 0x3f];
    chars[cursor++] = alphabet[(triple >> 12) & 0x3f];
    chars[cursor++] = alphabet[(triple >> 6) & 0x3f];
    chars[cursor++] = padding ? '=' : '';
  }

  return wrapLines(chars.join(''), options.lineWrap ?? 0);
}

/**
 * Base64 文本解码为字节。
 * 自动接受标准表与 URL Safe 表，忽略空白与缺少的填充。
 */
export function decodeBase64(input: string): Uint8Array {
  const cleaned = input.replace(/\s+/g, '');
  const body = cleaned.replace(/=+$/, '');

  // 4n+1 个有效字符无法对应任何字节，说明输入被截断
  if (body.length % 4 === 1) throw new CodecError('invalid_base64_length', { len: body.length });

  const output = new Uint8Array(Math.floor((body.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;

  for (let i = 0; i < body.length; i++) {
    const code = body.charCodeAt(i);
    const value = code < 128 ? DECODE_TABLE[code] : INVALID;
    if (value === INVALID) throw new CodecError('invalid_base64_char', { char: body[i], pos: i + 1 });

    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[written++] = (buffer >> bits) & 0xff;
    }
  }

  return output.subarray(0, written);
}
