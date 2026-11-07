/**
 * 色彩模型转换与度量。
 *
 * 只做纯计算，不触碰 DOM：
 * - sRGB ↔ HEX / HSL
 * - sRGB ↔ CIE Lab（D65，用于感知距离与聚类）
 * - sRGB ↔ OKLCH（用于现代 CSS 输出与明度排序）
 * - WCAG 相对亮度与对比度
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** 色相 0–360，饱和度 / 明度 0–1 */
export interface HSL {
  h: number;
  s: number;
  l: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const D65 = { x: 0.95047, y: 1, z: 1.08883 };

export const WHITE: RGB = { r: 255, g: 255, b: 255 };
export const BLACK: RGB = { r: 0, g: 0, b: 0 };

export const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));
export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** 解析 #rgb / #rrggbb（允许省略 #），非法输入返回 null */
export function parseHex(input: string): RGB | null {
  const match = HEX_RE.exec((input || '').trim());
  if (!match) return null;

  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(char => char + char)
      .join('');
  }

  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB, uppercase = false): string {
  const hex = `#${[r, g, b].map(channel => clampByte(channel).toString(16).padStart(2, '0')).join('')}`;
  return uppercase ? hex.toUpperCase() : hex;
}

/** sRGB 通道（0–255）转线性光，用于亮度与 Lab 计算 */
const channelToLinear = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** WCAG 2.x 相对亮度（0–1） */
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

/** WCAG 对比度，范围 1–21 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 在该颜色上更易读的前景色（白或黑） */
export const readableOn = (rgb: RGB): string =>
  contrastRatio(rgb, WHITE) >= contrastRatio(rgb, BLACK) ? '#ffffff' : '#000000';

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;

  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp01(s);
  const light = clamp01(l);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: clampByte((r + m) * 255),
    g: clampByte((g + m) * 255),
    b: clampByte((b + m) * 255),
  };
}

export const hslToHex = (hsl: HSL, uppercase = false): string => rgbToHex(hslToRgb(hsl), uppercase);

/** sRGB → CIE Lab（D65 白点） */
export function rgbToLab(rgb: RGB): Lab {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);

  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / D65.x;
  const y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / D65.y;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / D65.z;

  const f = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** CIE76 色差（Lab 空间欧氏距离），约等于人眼可感知的颜色差异 */
export const deltaE = (a: Lab, b: Lab): number => Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);

/** sRGB → OKLCH */
export function rgbToOklch(rgb: RGB): Oklch {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const chroma = Math.hypot(a, bb);
  let hue = (Math.atan2(bb, a) * 180) / Math.PI;
  if (hue < 0) hue += 360;

  return { l: lightness, c: chroma, h: hue };
}

/** 按比例混合两种颜色（t=0 取 a，t=1 取 b） */
export function mixRgb(a: RGB, b: RGB, t: number): RGB {
  const ratio = clamp01(t);
  return {
    r: clampByte(a.r + (b.r - a.r) * ratio),
    g: clampByte(a.g + (b.g - a.g) * ratio),
    b: clampByte(a.b + (b.b - a.b) * ratio),
  };
}

/** 保持色相与饱和度，仅替换明度（0–1） */
export function withLightness(rgb: RGB, lightness: number): RGB {
  const hsl = rgbToHsl(rgb);
  return hslToRgb({ ...hsl, l: clamp01(lightness) });
}

export const formatRgb = ({ r, g, b }: RGB): string => `rgb(${r}, ${g}, ${b})`;

export const formatHsl = (hsl: HSL): string =>
  `hsl(${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%)`;

export const formatOklch = (oklch: Oklch): string =>
  `oklch(${(oklch.l * 100).toFixed(1)}% ${oklch.c.toFixed(3)} ${oklch.h.toFixed(1)})`;

export const formatLab = ({ L, a, b }: Lab): string =>
  `lab(${L.toFixed(1)}% ${a.toFixed(1)} ${b.toFixed(1)})`;
