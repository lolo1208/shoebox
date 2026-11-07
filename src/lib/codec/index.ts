/**
 * 编码工具门面：把 Base64 / Base32 / URL 的编解码收敛到同一个入口。
 * UI 只依赖本文件，具体字母表与字节处理细节留在各自模块中。
 */

import { bytesToHex, decodeUtf8, decodeUtf8Lossy, hexToBytes, utf8ToBytes } from './bytes';
import { decodeBase32, encodeBase32 } from './base32';
import { decodeBase64, encodeBase64, stripDataUrlPrefix } from './base64';
import { decodeUrl, encodeUrl } from './url';
import {
  CodecError,
  DEFAULT_CODEC_OPTIONS,
  type CodecDirection,
  type CodecErrorInfo,
  type CodecFamily,
  type CodecNote,
  type CodecOptions,
  type CodecRun,
} from './types';

export * from './types';
export { bytesToHex, hexToBytes, decodeUtf8, decodeUtf8Lossy, utf8ToBytes } from './bytes';
export { encodeBase64, decodeBase64, stripDataUrlPrefix } from './base64';
export { encodeBase32, decodeBase32, detectBase32Variant, resolveBase32Variant } from './base32';
export { encodeUrl, decodeUrl, findBadPercent } from './url';
export { suggestCodec } from './detect';

/** 编码方向的输入：文本（按 UTF-8 或十六进制解析）或原始字节（文件） */
export type CodecInput = string | Uint8Array;

const encoder = new TextEncoder();

function takenBytes(input: CodecInput, options: CodecOptions): number {
  if (typeof input !== 'string') return input.length;
  if (options.inputFormat === 'hex') {
    try {
      return hexToBytes(input).length;
    } catch {
      return 0;
    }
  }
  return encoder.encode(input).length;
}

/** 解码后按“自动 / 文本 / 十六进制”渲染，并返回附带提示 */
function renderDecoded(
  bytes: Uint8Array,
  text: string,
  strict: boolean,
  options: CodecOptions,
): { output: string; notes: CodecNote[] } {
  if (options.outputView === 'hex') {
    return { output: bytesToHex(bytes), notes: [] };
  }

  if (options.outputView === 'text') {
    const notes: CodecNote[] = strict ? [] : [{ code: 'lossy_text' }];
    return { output: strict ? text : decodeUtf8Lossy(bytes), notes };
  }

  if (strict) return { output: text, notes: [] };
  return { output: bytesToHex(bytes), notes: [{ code: 'binary_hex' }] };
}

/** data URL 前缀被剔除时，把错误位置平移回用户可见的原字符串 */
function shiftErrorPosition(error: unknown, offset: number): unknown {
  if (offset <= 0 || !(error instanceof CodecError) || typeof error.params.pos !== 'number') return error;
  return new CodecError(error.code, { ...error.params, pos: error.params.pos + offset });
}

function runEncode(input: CodecInput, family: CodecFamily, options: CodecOptions): CodecRun {
  if (family === 'url') {
    if (typeof input !== 'string') throw new CodecError('text_required');
    const output = encodeUrl(input, options.urlMode);
    return {
      ok: true,
      output,
      error: null,
      notes: [],
      bytes: utf8ToBytes(output),
      inputBytes: encoder.encode(input).length,
      outputBytes: output.length,
    };
  }

  const bytes =
    typeof input === 'string' ? (options.inputFormat === 'hex' ? hexToBytes(input) : utf8ToBytes(input)) : input;

  if (family === 'base64') {
    const output = encodeBase64(bytes, {
      variant: options.base64Variant,
      padding: options.base64Padding,
      lineWrap: options.base64Wrap,
    });
    const wrapped = options.base64Wrap > 0;
    return {
      ok: true,
      output,
      error: null,
      notes: wrapped ? [{ code: 'wrapped', params: { n: options.base64Wrap } }] : [],
      bytes,
      inputBytes: bytes.length,
      // 折行符只是排版，不计入字符数
      outputBytes: wrapped ? output.replace(/\n/g, '').length : output.length,
    };
  }

  const output = encodeBase32(bytes, {
    variant: options.base32Variant,
    padding: options.base32Padding,
    lowercase: options.base32Lowercase,
  });
  return {
    ok: true,
    output,
    error: null,
    notes: [],
    bytes,
    inputBytes: bytes.length,
    outputBytes: output.length,
  };
}

function runDecode(input: CodecInput, family: CodecFamily, options: CodecOptions): CodecRun {
  if (typeof input !== 'string') throw new CodecError('text_required');

  let bytes: Uint8Array;
  let text: string;
  let strict: boolean;
  const prefixNotes: CodecNote[] = [];

  if (family === 'base64') {
    const { text: payload, offset } = stripDataUrlPrefix(input);
    if (offset > 0) prefixNotes.push({ code: 'data_url' });

    try {
      bytes = decodeBase64(payload);
    } catch (error) {
      throw shiftErrorPosition(error, offset);
    }
    const decoded = decodeUtf8(bytes);
    text = decoded.text;
    strict = decoded.ok;
  } else if (family === 'base32') {
    bytes = decodeBase32(input, { variant: options.base32Variant });
    const decoded = decodeUtf8(bytes);
    text = decoded.text;
    strict = decoded.ok;
  } else {
    const decoded = decodeUrl(input, options.urlMode);
    bytes = decoded.bytes;
    text = decoded.text;
    strict = decoded.strict;
  }

  const { output, notes } = renderDecoded(bytes, text, strict, options);
  return {
    ok: true,
    output,
    error: null,
    notes: [...prefixNotes, ...notes],
    bytes,
    inputBytes: encoder.encode(input).length,
    outputBytes: bytes.length,
  };
}

function toErrorInfo(error: unknown): CodecErrorInfo {
  if (error instanceof CodecError) return { code: error.code, params: error.params };
  return { code: 'unknown', params: { part: error instanceof Error ? error.message : String(error) } };
}

/**
 * 执行一次编解码。
 * `input` 为字符串时按文本（或十六进制）解析，为 `Uint8Array` 时直接作为原始字节参与编码。
 * 任何异常都会转成 `CodecRun.error`，调用方无需 try/catch。
 */
export function runCodec(
  input: CodecInput,
  family: CodecFamily,
  direction: CodecDirection,
  options: CodecOptions = DEFAULT_CODEC_OPTIONS,
): CodecRun {
  if (input.length === 0) {
    return { ok: true, output: '', error: null, notes: [], bytes: null, inputBytes: 0, outputBytes: 0 };
  }

  try {
    return direction === 'encode' ? runEncode(input, family, options) : runDecode(input, family, options);
  } catch (error) {
    return {
      ok: false,
      output: '',
      error: toErrorInfo(error),
      notes: [],
      bytes: null,
      inputBytes: takenBytes(input, options),
      outputBytes: 0,
    };
  }
}
