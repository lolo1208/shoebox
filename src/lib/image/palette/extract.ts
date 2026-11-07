/**
 * 调色板提取策略。
 *
 * 统一的量化结果之上，按模式做二次加权与筛选：
 * - dominant 主导色：忠实反映画面占比
 * - vibrant  鲜明色：优先高饱和、明快的颜色
 * - muted    柔和色：优先低饱和、柔和的颜色
 * - tonal    影调：按亮度分桶，得到从暗到亮的连续影调
 */

import {
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
  rgbToOklch,
  type HSL,
  type Oklch,
  type RGB,
} from './color';
import {
  buildHistogram,
  mergeSimilar,
  quantizeColors,
  sortByCount,
  weightedAverage,
  type ColorBin,
  type SampleFilters,
} from './quantize';

export type PaletteMode = 'dominant' | 'vibrant' | 'muted' | 'tonal';
export type PaletteSort = 'share' | 'hue' | 'lightness';

export const PALETTE_MODES: PaletteMode[] = ['dominant', 'vibrant', 'muted', 'tonal'];
export const PALETTE_SORTS: PaletteSort[] = ['share', 'hue', 'lightness'];

/** 期望颜色数量范围（算法与 UI 共用） */
export const MIN_PALETTE_COUNT = 2;
export const MAX_PALETTE_COUNT = 16;

export interface PaletteOptions extends SampleFilters {
  mode: PaletteMode;
  /** 期望颜色数量（2–16） */
  count: number;
  /** 采样长边像素 */
  maxEdge: number;
  /** 是否合并视觉上几乎相同的颜色 */
  mergeSimilar: boolean;
  /** 合并阈值（CIE76 色差） */
  mergeThreshold: number;
  sort: PaletteSort;
}

export interface PaletteColor {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  oklch: Oklch;
  /** 占画面的比例（0–1） */
  share: number;
  luminance: number;
}

export interface PaletteReport {
  colors: PaletteColor[];
  /** 全图平均色 */
  average: PaletteColor | null;
  /** 参与统计的像素数 */
  totalPixels: number;
  /** 被过滤掉的像素数 */
  filteredPixels: number;
  /** 采样图尺寸 */
  width: number;
  height: number;
}

const EMPTY_REPORT: PaletteReport = {
  colors: [],
  average: null,
  totalPixels: 0,
  filteredPixels: 0,
  width: 0,
  height: 0,
};

const toPaletteColor = (bin: ColorBin, total: number): PaletteColor => {
  const rgb: RGB = {
    r: Math.round(bin.rgb.r),
    g: Math.round(bin.rgb.g),
    b: Math.round(bin.rgb.b),
  };

  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl: rgbToHsl(rgb),
    oklch: rgbToOklch(rgb),
    share: total > 0 ? bin.count / total : 0,
    luminance: relativeLuminance(rgb),
  };
};

/** 鲜明色：饱和度与明度同时参与打分，避免挑出过暗或过灰的颜色 */
function rankVibrant(pool: ColorBin[], count: number): ColorBin[] {
  const total = pool.reduce((sum, bin) => sum + bin.count, 0) || 1;

  const scored = pool.map(bin => {
    const { s, l } = rgbToHsl(bin.rgb);
    const share = bin.count / total;
    const lightnessFit = 1 - Math.min(1, Math.abs(l - 0.5) * 2) * 0.75;
    return {
      bin,
      vivid: s >= 0.22 && l > 0.12 && l < 0.92,
      score: s * 1.6 * lightnessFit + Math.min(0.5, share * 2),
    };
  });

  const vivid = scored
    .filter(item => item.vivid)
    .sort((a, b) => b.score - a.score)
    .map(item => item.bin);

  if (vivid.length >= count) return vivid.slice(0, count);

  const rest = sortByCount(scored.filter(item => !item.vivid).map(item => item.bin));
  return [...vivid, ...rest].slice(0, count);
}

const MUTED_TARGET_SATURATION = 0.2;

/** 柔和色：向低饱和靠拢，同时保留画面占比的权重 */
function rankMuted(pool: ColorBin[], count: number): ColorBin[] {
  const total = pool.reduce((sum, bin) => sum + bin.count, 0) || 1;

  const scored = pool.map(bin => {
    const { s, l } = rgbToHsl(bin.rgb);
    const share = bin.count / total;
    const softness = 1 - Math.min(1, Math.abs(s - MUTED_TARGET_SATURATION) / 0.45);
    return {
      bin,
      muted: s <= 0.5 && l > 0.12 && l < 0.94,
      score: softness * 0.7 + share * 1.2,
    };
  });

  const muted = scored
    .filter(item => item.muted)
    .sort((a, b) => b.score - a.score)
    .map(item => item.bin);

  if (muted.length >= count) return muted.slice(0, count);

  const rest = sortByCount(scored.filter(item => !item.muted).map(item => item.bin));
  return [...muted, ...rest].slice(0, count);
}

/** 影调：按 Lab 亮度把人眼可见的像素均分成若干段，每段取加权均色 */
function tonalBands(bins: ColorBin[], count: number): ColorBin[] {
  const sorted = [...bins].sort((a, b) => a.lab.L - b.lab.L);
  const total = sorted.reduce((sum, bin) => sum + bin.count, 0);
  if (!total) return [];

  const groups: ColorBin[][] = Array.from({ length: count }, () => []);
  let band = 0;
  let acc = 0;

  for (const bin of sorted) {
    groups[band].push(bin);
    acc += bin.count;
    while (band < count - 1 && acc >= (total * (band + 1)) / count) band += 1;
  }

  return groups
    .filter(group => group.length > 0)
    .map(group => weightedAverage(group))
    .filter((bin): bin is ColorBin => bin !== null);
}

function pickClusters(bins: ColorBin[], options: PaletteOptions): ColorBin[] {
  const count = Math.min(MAX_PALETTE_COUNT, Math.max(MIN_PALETTE_COUNT, Math.round(options.count)));

  if (options.mode === 'tonal') return tonalBands(bins, count);

  // 主导色按目标数量量化即可；鲜明 / 柔和需要更多候选再筛选
  const capacity = options.mode === 'dominant' ? count : Math.min(32, count * 3);
  let pool = quantizeColors(bins, capacity);
  if (options.mergeSimilar) pool = mergeSimilar(pool, options.mergeThreshold);

  if (options.mode === 'vibrant') return rankVibrant(pool, count);
  if (options.mode === 'muted') return rankMuted(pool, count);
  return sortByCount(pool).slice(0, count);
}

/** 按展示需要重新排序（占比 / 色相 / 明度），不改变颜色本身与占比 */
export function sortPaletteColors(colors: PaletteColor[], sort: PaletteSort): PaletteColor[] {
  const list = [...colors];

  switch (sort) {
    case 'hue':
      return list.sort((a, b) => a.hsl.h - b.hsl.h || b.share - a.share);
    case 'lightness':
      return list.sort((a, b) => a.oklch.l - b.oklch.l);
    default:
      return list.sort((a, b) => b.share - a.share);
  }
}

/** 量化与舍入后可能出现同色，合并占比避免网格里出现重复色块 */
function dedupeByHex(colors: PaletteColor[]): PaletteColor[] {
  const unique = new Map<string, PaletteColor>();

  for (const color of colors) {
    const existing = unique.get(color.hex);
    if (!existing) {
      unique.set(color.hex, color);
      continue;
    }
    unique.set(color.hex, { ...existing, share: existing.share + color.share });
  }

  return [...unique.values()];
}

/** 从采样像素中提取调色板 */
export function extractPalette(image: ImageData, options: PaletteOptions): PaletteReport {
  const histogram = buildHistogram(image.data, options);
  const base: PaletteReport = {
    ...EMPTY_REPORT,
    totalPixels: histogram.total,
    filteredPixels: histogram.filtered,
    width: image.width,
    height: image.height,
  };

  if (!histogram.total || !histogram.bins.length) return base;

  const averageBin = weightedAverage(histogram.bins);
  const clusters = pickClusters(histogram.bins, options);
  const palette = dedupeByHex(
    clusters.map(cluster => toPaletteColor(cluster, histogram.total)),
  );

  return {
    ...base,
    colors: sortPaletteColors(palette, options.sort),
    average: averageBin ? toPaletteColor(averageBin, histogram.total) : null,
  };
}
