/**
 * 图片调色板（主色调提取）公共 API。
 *
 * 工具层只依赖本文件：
 * - color        色彩模型、色差与对比度
 * - sample       图片降采样与取色
 * - quantize     直方图、中位切分与 k-means 量化
 * - extract      提取策略与调色板数据结构
 * - harmony      和谐配色与明暗梯度
 * - formats      文本导出格式
 * - swatchRender 色卡图片渲染
 */
export {
  BLACK,
  WHITE,
  clamp01,
  clampByte,
  contrastRatio,
  deltaE,
  formatHsl,
  formatLab,
  formatOklch,
  formatRgb,
  hslToHex,
  hslToRgb,
  mixRgb,
  parseHex,
  readableOn,
  relativeLuminance,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  rgbToOklch,
  withLightness,
} from './color';
export type { HSL, Lab, Oklch, RGB } from './color';

export {
  buildHistogram,
  medianCut,
  mergeSimilar,
  quantizeColors,
  refineClusters,
  sortByCount,
  weightedAverage,
} from './quantize';
export type { ColorBin, Histogram, SampleFilters } from './quantize';

export {
  MAX_PALETTE_COUNT,
  MIN_PALETTE_COUNT,
  PALETTE_MODES,
  PALETTE_SORTS,
  extractPalette,
  sortPaletteColors,
} from './extract';
export type {
  PaletteColor,
  PaletteMode,
  PaletteOptions,
  PaletteReport,
  PaletteSort,
} from './extract';

export { HARMONY_TYPES, buildHarmony, buildRamp, makeHarmonyColor } from './harmony';
export type { HarmonyColor, HarmonyType } from './harmony';

export { DEFAULT_FORMAT_OPTIONS, PALETTE_FORMATS, buildPaletteText } from './formats';
export type { PaletteFormat, PaletteFormatOptions } from './formats';

export { SAMPLE_SIZES, pickImagePixel, sampleImage } from './sample';
export type { SampleSize } from './sample';

export { renderSwatchSheet } from './swatchRender';
