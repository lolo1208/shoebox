import { DEFAULT_GIF_SETTINGS, type GifSettings } from '@/lib/media/gif';

/** 预设只覆盖画质相关参数，区间、循环与速度沿用用户当前设置 */
export type GifPresetId = 'emoji' | 'social' | 'hd';

export interface GifPreset {
  id: GifPresetId;
  nameKey: string;
  descKey: string;
  patch: Pick<GifSettings, 'width' | 'fps' | 'colors' | 'dither' | 'mode'>;
}

/** 按使用场景划分的快捷预设（体积从小到大） */
export const GIF_PRESETS: GifPreset[] = [
  {
    id: 'emoji',
    nameKey: 'gif.preset.emoji',
    descKey: 'gif.preset.emoji.desc',
    patch: { width: 240, fps: 10, colors: 128, dither: 'sierra2_4a', mode: 'palette' },
  },
  {
    id: 'social',
    nameKey: 'gif.preset.social',
    descKey: 'gif.preset.social.desc',
    patch: { width: 480, fps: 15, colors: 256, dither: 'sierra2_4a', mode: 'palette' },
  },
  {
    id: 'hd',
    nameKey: 'gif.preset.hd',
    descKey: 'gif.preset.hd.desc',
    patch: { width: 640, fps: 20, colors: 256, dither: 'floyd_steinberg', mode: 'palette' },
  },
];

/** 画质相关字段，用于判断当前设置命中哪个预设 */
const PRESET_FIELDS = ['width', 'fps', 'colors', 'dither', 'mode'] as const;

/** 当前设置命中的预设，全部不匹配时返回 custom */
export function resolvePresetId(settings: GifSettings): GifPresetId | 'custom' {
  const hit = GIF_PRESETS.find(preset => {
    const merged: GifSettings = { ...DEFAULT_GIF_SETTINGS, ...preset.patch };
    return PRESET_FIELDS.every(field => merged[field] === settings[field]);
  });
  return hit?.id ?? 'custom';
}
