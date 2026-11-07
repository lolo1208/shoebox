/**
 * 密码 / 随机密钥生成共用的类型定义。
 * 本文件只描述数据形状，具体算法见 password.ts 与 key.ts。
 */

/** 生成模式：字符型密码，或字节型随机密钥 */
export type SecretMode = 'password' | 'key';

/** 密码可选的字符类别 */
export type CharacterClassId = 'uppercase' | 'lowercase' | 'digits' | 'symbols';

/** 固定的类别顺序，保证 UI 渲染与字符集拼接顺序一致 */
export const CHARACTER_CLASS_IDS: readonly CharacterClassId[] = ['uppercase', 'lowercase', 'digits', 'symbols'];

export type CharacterClassSelection = Record<CharacterClassId, boolean>;

/** 特殊符号集：常用安全子集 / 全部 32 个 ASCII 标点（VeraCrypt 风格） */
export type SymbolSet = 'standard' | 'full';

export const SYMBOL_SET_IDS: readonly SymbolSet[] = ['standard', 'full'];

export interface PasswordOptions {
  /** 密码长度（字符数） */
  length: number;
  /** 启用的字符类别 */
  classes: CharacterClassSelection;
  /** 特殊符号使用哪一套字符集 */
  symbolSet: SymbolSet;
  /** 追加到字符集中的自定义字符 */
  customCharacters: string;
  /** 排除 0/O、1/l/I 等易混淆字符 */
  excludeAmbiguous: boolean;
  /** 允许同一字符重复出现 */
  allowRepeats: boolean;
  /** 每种已选类别至少出现一次 */
  requireEachClass: boolean;
  /** 生成条数 */
  count: number;
}

/** 密钥输出格式：字节本身由 Web Crypto 生成，这里只决定编码方式 */
export type KeyFormat = 'hex' | 'base64' | 'base64url' | 'base32' | 'ascii';

export const KEY_FORMATS: readonly KeyFormat[] = ['hex', 'base64', 'base64url', 'base32', 'ascii'];

/** 需要字节输入的编码格式；`ascii` 直接从字符集取样，不经过字节编码 */
export type ByteEncodingFormat = Exclude<KeyFormat, 'ascii'>;

export interface KeyOptions {
  format: KeyFormat;
  /** 随机字节数，决定密钥强度 */
  bytes: number;
  /** 生成条数 */
  count: number;
}

export type SecretErrorCode =
  /** 没有勾选任何字符类别（也没有自定义字符） */
  | 'no_character_class'
  /** 关闭重复后，长度超过字符集大小 */
  | 'length_exceeds_charset'
  /** 长度不足以覆盖所有必选类别 */
  | 'length_below_class_count';

export interface SecretError {
  code: SecretErrorCode;
  params: Record<string, string | number>;
}

export interface GenerationResult {
  /** 生成结果，按展示顺序排列 */
  secrets: string[];
  error: SecretError | null;
  /** 单条结果的理论熵（bit） */
  bits: number;
  /** 参与随机的字符集大小；密钥模式为 0 */
  charsetSize: number;
  /** 单条结果的字符数 */
  length: number;
}
