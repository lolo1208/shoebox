/// <reference lib="dom" />
/**
 * 字节工具：UTF-8 文本、十六进制与 Uint8Array 之间的互转。
 * Base64 / Base32 / URL 的编解码一律以字节为中间层，避免 btoa 的 Latin-1 陷阱。
 */

import { CodecError } from './types';

const encoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });
const lossyDecoder = new TextDecoder('utf-8');
const HEX_DIGITS = '0123456789abcdef';

/** 文本按 UTF-8 编码为字节 */
export function utf8ToBytes(text: string): Uint8Array {
  return encoder.encode(text);
}

/** 严格解码 UTF-8：遇到非法字节序列返回 ok=false 而不是乱码 */
export function decodeUtf8(bytes: Uint8Array): { ok: boolean; text: string } {
  try {
    return { ok: true, text: strictDecoder.decode(bytes) };
  } catch {
    return { ok: false, text: '' };
  }
}

/** 宽松解码 UTF-8：非法字节以 U+FFFD 占位 */
export function decodeUtf8Lossy(bytes: Uint8Array): string {
  return lossyDecoder.decode(bytes);
}

/** 字节转十六进制文本，每行 perLine 字节，便于人工核对二进制结果 */
export function bytesToHex(bytes: Uint8Array, options: { uppercase?: boolean; perLine?: number } = {}): string {
  const perLine = Math.max(1, options.perLine ?? 16);
  const digits = options.uppercase ? HEX_DIGITS.toUpperCase() : HEX_DIGITS;
  const rows: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += perLine) {
    const end = Math.min(offset + perLine, bytes.length);
    let row = '';
    for (let i = offset; i < end; i++) {
      const byte = bytes[i];
      if (i > offset) row += ' ';
      row += digits[byte >> 4] + digits[byte & 0x0f];
    }
    rows.push(row);
  }

  return rows.join('\n');
}

/** 解析十六进制输入，容忍空格、逗号、冒号、连字符与 0x 前缀 */
export function hexToBytes(text: string): Uint8Array {
  const cleaned = text.replace(/0x/gi, '').replace(/[\s,:;\-_]+/g, '');
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 2 !== 0) throw new CodecError('invalid_hex_length', { len: cleaned.length });

  const bytes = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const part = cleaned.slice(i * 2, i * 2 + 2);
    if (!/^[0-9a-f]{2}$/i.test(part)) throw new CodecError('invalid_hex_char', { part });
    bytes[i] = parseInt(part, 16);
  }
  return bytes;
}
