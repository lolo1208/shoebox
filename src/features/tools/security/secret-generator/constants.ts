/**
 * 密码 / 密钥生成器的默认参数与快捷预设。
 * 预设只覆盖「强度相关」字段，生成条数等展示偏好保持不变。
 */

import {
  CHARACTER_CLASS_IDS,
  type KeyOptions,
  type KeyFormat,
  type PasswordOptions,
} from '@/lib/secret';

export const DEFAULT_PASSWORD_OPTIONS: PasswordOptions = {
  length: 16,
  classes: { uppercase: true, lowercase: true, digits: true, symbols: true },
  symbolSet: 'standard',
  customCharacters: '',
  excludeAmbiguous: false,
  allowRepeats: true,
  requireEachClass: true,
  count: 1,
};

export const DEFAULT_KEY_OPTIONS: KeyOptions = {
  format: 'hex',
  bytes: 32,
  count: 5,
};

/* ------------------------------- 密码预设 ------------------------------- */

export type PasswordPresetId = 'pin' | 'easy' | 'balanced' | 'maximum';

export interface PasswordPreset {
  id: PasswordPresetId;
  nameKey: string;
  patch: Partial<PasswordOptions>;
}

/** 按使用场景排列：纯数字 → 易读 → 通用 → 高强度 */
export const PASSWORD_PRESETS: PasswordPreset[] = [
  {
    id: 'pin',
    nameKey: 'secret.preset.pin',
    patch: {
      length: 6,
      classes: { uppercase: false, lowercase: false, digits: true, symbols: false },
      excludeAmbiguous: false,
      requireEachClass: false,
    },
  },
  {
    id: 'easy',
    nameKey: 'secret.preset.easy',
    patch: {
      length: 16,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: false },
      excludeAmbiguous: true,
      requireEachClass: true,
    },
  },
  {
    id: 'balanced',
    nameKey: 'secret.preset.balanced',
    patch: {
      length: 16,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: true },
      excludeAmbiguous: false,
      requireEachClass: true,
    },
  },
  {
    id: 'maximum',
    nameKey: 'secret.preset.maximum',
    patch: {
      length: 32,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: true },
      symbolSet: 'full',
      excludeAmbiguous: false,
      requireEachClass: true,
    },
  },
];

/** 预设命中判断只比较强度相关字段，仅 `count` 不参与 */
const PRESET_SCOPED_FIELDS = ['length', 'excludeAmbiguous', 'allowRepeats', 'requireEachClass', 'symbolSet'] as const;

function samePasswordConfig(a: PasswordOptions, b: PasswordOptions): boolean {
  return (
    PRESET_SCOPED_FIELDS.every((field) => a[field] === b[field]) &&
    a.customCharacters === b.customCharacters &&
    CHARACTER_CLASS_IDS.every((id) => a.classes[id] === b.classes[id])
  );
}

/** 当前参数命中的预设，全部不匹配时返回 custom */
export function resolvePasswordPresetId(options: PasswordOptions): PasswordPresetId | 'custom' {
  const hit = PASSWORD_PRESETS.find((preset) =>
    samePasswordConfig(options, { ...DEFAULT_PASSWORD_OPTIONS, ...preset.patch }),
  );
  return hit?.id ?? 'custom';
}

/* -------------------------------- 密钥预设 ------------------------------- */

export type KeyPresetId = 'bits128' | 'bits256' | 'bits512';

export interface KeyPreset {
  id: KeyPresetId;
  nameKey: string;
  /** 直接写入字节数，与 KeyOptions.bytes 对齐 */
  bytes: number;
}

/** 常见的对称密钥长度（16 / 32 / 64 字节） */
export const KEY_PRESETS: KeyPreset[] = [
  { id: 'bits128', nameKey: 'secret.key.preset.128', bytes: 16 },
  { id: 'bits256', nameKey: 'secret.key.preset.256', bytes: 32 },
  { id: 'bits512', nameKey: 'secret.key.preset.512', bytes: 64 },
];

/* --------------------------------- 展示值 -------------------------------- */

/** 密码长度快捷值 */
export const PASSWORD_LENGTH_CHIPS = [8, 12, 16, 24, 32, 64] as const;

/** 密钥字节数快捷值 */
export const KEY_BYTE_CHIPS = [8, 16, 24, 32, 64, 128] as const;

/** 各格式的说明与示例，用于格式选择下方的提示行 */
export const KEY_FORMAT_HINTS: Record<KeyFormat, { hintKey: string; sample: string }> = {
  hex: { hintKey: 'secret.key.format.hex_hint', sample: '9f2ae4c1' },
  base64: { hintKey: 'secret.key.format.base64_hint', sample: 'nyrkwUE=' },
  base64url: { hintKey: 'secret.key.format.base64url_hint', sample: 'nyrkwUE' },
  base32: { hintKey: 'secret.key.format.base32_hint', sample: 'T5FKSZDQ' },
  ascii: { hintKey: 'secret.key.format.ascii_hint', sample: 'Xk7#mQ2!' },
};
