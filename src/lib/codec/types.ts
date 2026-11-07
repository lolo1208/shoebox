/**
 * 编码工具（Base64 / Base32 / URL）的类型、默认参数与错误模型。
 * 本文件只含类型与常量，可被任意环境安全引入。
 */

/** 编码族 */
export type CodecFamily = 'base64' | 'base32' | 'url';

/** 处理方向 */
export type CodecDirection = 'encode' | 'decode';

/** Base64 字母表：RFC 4648 §4 标准表 / §5 URL Safe 表 */
export type Base64Variant = 'standard' | 'url-safe';

/** Base32 字母表：RFC 4648 §6 标准表 / §7 hex 扩展十六进制表 */
export type Base32Variant = 'rfc4648' | 'base32hex';

/** URL 百分号编码策略：组件 / 完整 URL / 表单（application/x-www-form-urlencoded） */
export type UrlMode = 'component' | 'uri' | 'form';

/** 解码结果的展示方式：自动（按 UTF-8 是否合法挑选）/ 强制文本 / 强制十六进制 */
export type OutputView = 'auto' | 'text' | 'hex';

/** 编码方向的输入按文本还是十六进制字节解读 */
export type InputFormat = 'text' | 'hex';

export interface CodecOptions {
  /** Base64 字母表，仅影响编码 */
  base64Variant: Base64Variant;
  /** Base64 是否补 `=` */
  base64Padding: boolean;
  /** Base64 每行字符数，0 表示不换行（MIME 习惯 76） */
  base64Wrap: number;
  /** Base32 字母表，仅影响编码 */
  base32Variant: Base32Variant;
  /** Base32 是否补 `=` */
  base32Padding: boolean;
  /** Base32 编码结果是否小写 */
  base32Lowercase: boolean;
  /** URL 编码策略 */
  urlMode: UrlMode;
  /** 解码结果展示方式 */
  outputView: OutputView;
  /** 编码方向输入格式 */
  inputFormat: InputFormat;
}

export const DEFAULT_CODEC_OPTIONS: CodecOptions = {
  base64Variant: 'standard',
  base64Padding: true,
  base64Wrap: 0,
  base32Variant: 'rfc4648',
  base32Padding: true,
  base32Lowercase: false,
  urlMode: 'component',
  outputView: 'auto',
  inputFormat: 'text',
};

/** 错误码，UI 通过 `codec.err.<code>` 翻译 */
export type CodecErrorCode =
  | 'invalid_base64_char'
  | 'invalid_base64_length'
  | 'invalid_base32_char'
  | 'invalid_base32_length'
  | 'invalid_hex_char'
  | 'invalid_hex_length'
  | 'invalid_percent'
  | 'invalid_unicode'
  | 'text_required'
  | 'unknown';

export type CodecErrorParams = Record<string, string | number>;

/** 携带错误码与文案参数的编解码异常 */
export class CodecError extends Error {
  readonly code: CodecErrorCode;
  readonly params: CodecErrorParams;

  constructor(code: CodecErrorCode, params: CodecErrorParams = {}) {
    super(params.part ? `${code}: ${String(params.part)}` : code);
    this.name = 'CodecError';
    this.code = code;
    this.params = params;
  }
}

/** 提示码，UI 通过 `codec.note.<code>` 翻译 */
export type CodecNoteCode = 'binary_hex' | 'lossy_text' | 'wrapped' | 'data_url' | 'truncated';

export interface CodecNote {
  code: CodecNoteCode;
  params?: CodecErrorParams;
}

export interface CodecErrorInfo {
  code: CodecErrorCode;
  params: CodecErrorParams;
}

/** 单次编解码结果，错误不会抛出到 UI 层 */
export interface CodecRun {
  ok: boolean;
  output: string;
  error: CodecErrorInfo | null;
  notes: CodecNote[];
  /** 编码方向为输入字节，解码方向为解码出的原始字节；空结果时为 null（用于下载） */
  bytes: Uint8Array | null;
  /** 参与计算的输入字节数 */
  inputBytes: number;
  /** 编码方向为输出字符数（不含折行符），解码方向为输出字节数 */
  outputBytes: number;
}
