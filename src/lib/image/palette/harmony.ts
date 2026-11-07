/**
 * 和谐配色与明暗梯度。
 *
 * 以色相环为基础生成经典配色方案（互补 / 类似 / 三角 / 分裂互补 / 四角），
 * 以及保留色相的明暗梯度，方便直接用于 UI 主题设计。
 */

import { clamp01, hslToRgb, rgbToHex, rgbToHsl, type HSL, type RGB } from './color';

export type HarmonyType = 'complementary' | 'analogous' | 'triadic' | 'split' | 'tetradic' | 'monochrome';

export const HARMONY_TYPES: HarmonyType[] = [
  'complementary',
  'analogous',
  'triadic',
  'split',
  'tetradic',
  'monochrome',
];

export interface HarmonyColor {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  /** 相对基准色的色相偏移（度），单色方案恒为 0 */
  offset: number;
}

/** 各方案相对基准色的色相偏移 */
const HARMONY_OFFSETS: Record<Exclude<HarmonyType, 'monochrome'>, number[]> = {
  complementary: [0, 180],
  analogous: [-60, -30, 0, 30, 60],
  triadic: [0, 120, 240],
  split: [0, 150, 210],
  tetradic: [0, 90, 180, 270],
};

/** 单色方案的明度阶梯（暗 → 亮） */
const MONO_LIGHTNESS = [0.14, 0.3, 0.46, 0.62, 0.78, 0.92];

export function makeHarmonyColor(hsl: HSL, offset: number): HarmonyColor {
  const rgb = hslToRgb(hsl);
  return { rgb, hex: rgbToHex(rgb), hsl, offset };
}

export function buildHarmony(base: RGB, type: HarmonyType): HarmonyColor[] {
  const hsl = rgbToHsl(base);

  if (type === 'monochrome') {
    return MONO_LIGHTNESS.map(lightness =>
      makeHarmonyColor(
        {
          h: hsl.h,
          // 极暗 / 极亮处略微降低饱和度，避免出现荧光感
          s: clamp01(hsl.s * (1 - Math.abs(lightness - 0.5) * 0.45)),
          l: lightness,
        },
        0,
      ),
    );
  }

  return HARMONY_OFFSETS[type].map(offset =>
    makeHarmonyColor({ ...hsl, h: ((hsl.h + offset) % 360 + 360) % 360 }, offset),
  );
}

/**
 * 明暗梯度：保持色相与饱和度，把明度从浅到深等距排开。
 * 与「单色」方案的区别是梯度数量可调且不改变饱和度。
 */
export function buildRamp(base: RGB, steps = 9): HarmonyColor[] {
  const hsl = rgbToHsl(base);
  const total = Math.max(2, Math.round(steps));
  const colors: HarmonyColor[] = [];

  for (let i = 0; i < total; i += 1) {
    const ratio = total === 1 ? 0 : i / (total - 1);
    const lightness = 0.94 - ratio * 0.88;
    colors.push(makeHarmonyColor({ ...hsl, l: lightness }, 0));
  }

  return colors;
}
