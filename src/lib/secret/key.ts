/**
 * 随机密钥生成。
 *
 * 密钥本体始终是 Web Crypto 生成的随机字节，`format` 只决定编码方式，
 * 因此除「可打印 ASCII」外，每种格式的强度都严格等于 `字节数 × 8`。
 */

import { encodeBase32, encodeBase64 } from '@/lib/codec';
import { clampInteger, KEY_BYTES, SECRET_COUNT } from './limits';
import { randomBytes, randomIndex } from './random';
import type { ByteEncodingFormat, GenerationResult, KeyFormat, KeyOptions } from './types';

/** 可打印 ASCII 区间（`!` 到 `~`），共 94 个字符 */
const ASCII_PRINTABLE_START = 33;
const ASCII_PRINTABLE_END = 126;
const ASCII_PRINTABLE_SIZE = ASCII_PRINTABLE_END - ASCII_PRINTABLE_START + 1;

const HEX_DIGITS = '0123456789abcdef';

/**
 * 小写十六进制。
 * 不用 `@/lib/codec` 的 `bytesToHex`：那个是给人看的核对视图，会按 16 字节分组插空格，
 * 密钥必须是连续字符串。
 */
function bytesToHexString(bytes: Uint8Array): string {
  let text = '';
  for (const byte of bytes) text += HEX_DIGITS[byte >> 4] + HEX_DIGITS[byte & 0x0f];
  return text;
}

/** 把随机字节编码为目标格式 */
export function encodeKeyBytes(bytes: Uint8Array, format: ByteEncodingFormat): string {
  switch (format) {
    case 'hex':
      return bytesToHexString(bytes);
    case 'base64':
      return encodeBase64(bytes, { variant: 'standard', padding: true });
    case 'base64url':
      return encodeBase64(bytes, { variant: 'url-safe', padding: false });
    case 'base32':
      return encodeBase32(bytes, { variant: 'rfc4648', padding: false });
  }
}

/** 可打印 ASCII 字符串：逐字符均匀取样，而非对字节取模 */
function randomAscii(length: number): string {
  let text = '';
  for (let i = 0; i < length; i++) {
    text += String.fromCharCode(ASCII_PRINTABLE_START + randomIndex(ASCII_PRINTABLE_SIZE));
  }
  return text;
}

/** 单条密钥的理论熵（bit） */
export function keyEntropyBits(bytes: number, format: KeyFormat): number {
  if (format === 'ascii') return bytes * Math.log2(ASCII_PRINTABLE_SIZE);
  return bytes * 8;
}

/** 批量生成密钥 */
export function generateKeyBatch(options: KeyOptions): GenerationResult {
  const bytes = clampInteger(options.bytes, KEY_BYTES.min, KEY_BYTES.max);
  const count = clampInteger(options.count, SECRET_COUNT.min, SECRET_COUNT.max);
  const bits = keyEntropyBits(bytes, options.format);

  const secrets: string[] = [];
  try {
    for (let i = 0; i < count; i++) {
      secrets.push(options.format === 'ascii' ? randomAscii(bytes) : encodeKeyBytes(randomBytes(bytes), options.format));
    }
  } catch {
    // Web Crypto 缺失 / 被策略禁用时不能静默降级，直接报错
    return { secrets: [], error: { code: 'random_unavailable', params: {} }, bits, charsetSize: 0, length: 0 };
  }

  return { secrets, error: null, bits, charsetSize: 0, length: secrets[0]?.length ?? 0 };
}
