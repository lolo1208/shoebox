/**
 * URL 百分号编码：
 * - component：encodeURIComponent / decodeURIComponent，用于查询参数值
 * - uri：encodeURI / decodeURI，保留 :/?#& 等保留字符，用于整条 URL
 * - form：application/x-www-form-urlencoded，空格写作 `+`，按 WHATWG 规则转义
 */

import { CodecError, type UrlMode } from './types';
import { decodeUtf8, decodeUtf8Lossy, utf8ToBytes } from './bytes';

/** 表单编码中无需转义的字节：字母数字与 `* - . _` */
const FORM_SAFE_BYTE = /[A-Za-z0-9*\-._]/;

/** 找出首个孤立的 UTF-16 代理项位置（1 基），用于提示非法 Unicode 输入 */
function findLoneSurrogate(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        continue;
      }
      return i + 1;
    }
    if (code >= 0xdc00 && code <= 0xdfff) return i + 1;
  }
  return 0;
}

/**
 * 找出首个可疑的 `%` 转义位置（1 基）。
 * 没有明显残缺时退回首个 `%` 的位置——字节序列非 UTF-8 时错误也来自这里。
 */
export function findBadPercent(text: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '%') continue;
    if (!/^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) return i + 1;
    i += 2;
  }
  const firstPercent = text.indexOf('%');
  return firstPercent >= 0 ? firstPercent + 1 : 0;
}

/** 按字节做 WHATWG 表单转义：空格 → `+`，其余非安全字节 → %XX */
function encodeForm(text: string): string {
  const bytes = utf8ToBytes(text);
  let output = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if (byte === 0x20) {
      output += '+';
      continue;
    }
    const char = String.fromCharCode(byte);
    output += FORM_SAFE_BYTE.test(char) ? char : `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }

  return output;
}

/** 文本编码为百分号形式 */
export function encodeUrl(text: string, mode: UrlMode): string {
  // form 模式自己实现字节转义，不会像 encodeURI* 那样抛出，需要先拦住孤立代理项
  if (mode === 'form') {
    const lone = findLoneSurrogate(text);
    if (lone > 0) throw new CodecError('invalid_unicode', { pos: lone });
    return encodeForm(text);
  }

  try {
    return mode === 'uri' ? encodeURI(text) : encodeURIComponent(text);
  } catch {
    throw new CodecError('invalid_unicode', { pos: findLoneSurrogate(text) });
  }
}

export interface UrlDecodeResult {
  bytes: Uint8Array;
  text: string;
  /** 文本是否为合法 UTF-8；false 时需要改用十六进制查看 */
  strict: boolean;
}

/**
 * 逐字节还原 `%XX`，非转义部分按 UTF-8 原样保留。
 * 每个 UTF-16 单元最多展开 3 字节，因此按 3 倍长度预分配即可一次写完。
 */
function percentDecodeBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length * 3);
  let written = 0;
  let plainStart = 0;

  const flushPlain = (end: number) => {
    if (end <= plainStart) return;
    const chunk = utf8ToBytes(text.slice(plainStart, end));
    out.set(chunk, written);
    written += chunk.length;
  };

  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '%') continue;

    const pair = text.slice(i + 1, i + 3);
    if (!/^[0-9a-f]{2}$/i.test(pair)) throw new CodecError('invalid_percent', { pos: i + 1 });

    flushPlain(i);
    out[written++] = parseInt(pair, 16);
    i += 2;
    plainStart = i + 1;
  }
  flushPlain(text.length);

  return out.subarray(0, written);
}

/** 百分号形式解码为字节与文本 */
export function decodeUrl(input: string, mode: UrlMode): UrlDecodeResult {
  if (mode === 'form') {
    const bytes = percentDecodeBytes(input.replace(/\+/g, ' '));
    const strict = decodeUtf8(bytes);
    return { bytes, text: strict.ok ? strict.text : decodeUtf8Lossy(bytes), strict: strict.ok };
  }

  try {
    const text = mode === 'uri' ? decodeURI(input) : decodeURIComponent(input);
    return { bytes: utf8ToBytes(text), text, strict: true };
  } catch {
    throw new CodecError('invalid_percent', { pos: findBadPercent(input) });
  }
}
