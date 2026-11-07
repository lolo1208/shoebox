/**
 * 密码 / 密钥生成器的默认参数与快捷预设。
 *
 * 密码预设描述的是**完整的强度配置**（字符类别、长度、符号集、取样规则），
 * 点击预设即得到与之一致的密码形态；只有「生成条数」这类展示偏好不受影响。
 * 这样预设高亮判断可以和实际参数一一对应，不会出现「点了预设却仍显示自定义」。
 */

import { CHARACTER_CLASS_IDS, type KeyFormat, type KeyOptions, type PasswordOptions } from '@/lib/secret';

/** 预设覆盖的强度配置（不含生成条数） */
export type PasswordPresetConfig = Omit<PasswordOptions, 'count'>;

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
  config: PasswordPresetConfig;
}

/** 按使用场景排列：纯数字 → 易读 → 通用 → 高强度 */
export const PASSWORD_PRESETS: PasswordPreset[] = [
  {
    id: 'pin',
    nameKey: 'secret.preset.pin',
    config: {
      length: 6,
      classes: { uppercase: false, lowercase: false, digits: true, symbols: false },
      symbolSet: 'standard',
      customCharacters: '',
      excludeAmbiguous: false,
      allowRepeats: true,
      requireEachClass: true,
    },
  },
  {
    id: 'easy',
    nameKey: 'secret.preset.easy',
    config: {
      length: 16,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: false },
      symbolSet: 'standard',
      customCharacters: '',
      excludeAmbiguous: true,
      allowRepeats: true,
      requireEachClass: true,
    },
  },
  {
    id: 'balanced',
    nameKey: 'secret.preset.balanced',
    config: {
      length: 16,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: true },
      symbolSet: 'standard',
      customCharacters: '',
      excludeAmbiguous: false,
      allowRepeats: true,
      requireEachClass: true,
    },
  },
  {
    id: 'maximum',
    nameKey: 'secret.preset.maximum',
    config: {
      length: 32,
      classes: { uppercase: true, lowercase: true, digits: true, symbols: true },
      symbolSet: 'full',
      customCharacters: '',
      excludeAmbiguous: false,
      allowRepeats: true,
      requireEachClass: true,
    },
  },
];

function samePasswordConfig(a: PasswordOptions, b: PasswordPresetConfig): boolean {
  return (
    a.length === b.length &&
    a.symbolSet === b.symbolSet &&
    a.customCharacters === b.customCharacters &&
    a.excludeAmbiguous === b.excludeAmbiguous &&
    a.allowRepeats === b.allowRepeats &&
    a.requireEachClass === b.requireEachClass &&
    CHARACTER_CLASS_IDS.every((id) => a.classes[id] === b.classes[id])
  );
}

/** 当前参数命中的预设，全部不匹配时返回 custom */
export function resolvePasswordPresetId(options: PasswordOptions): PasswordPresetId | 'custom' {
  const hit = PASSWORD_PRESETS.find((preset) => samePasswordConfig(options, preset.config));
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
