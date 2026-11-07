import {
  MAX_PALETTE_COUNT,
  MIN_PALETTE_COUNT,
  PALETTE_MODES,
  PALETTE_SORTS,
  SAMPLE_SIZES,
  type PaletteOptions,
} from '@/lib/image/palette';

/** 调色板工具的默认提取参数（首次打开与旧版本数据迁移共用） */
export const DEFAULT_PALETTE_OPTIONS: PaletteOptions = {
  mode: 'dominant',
  count: 6,
  maxEdge: 256,
  ignoreTransparent: true,
  ignoreNearWhite: false,
  ignoreNearBlack: false,
  mergeSimilar: false,
  mergeThreshold: 6,
  sort: 'share',
};

/** 颜色数量范围由算法层定义，这里只做转发，避免两处维护 */
export { MAX_PALETTE_COUNT, MIN_PALETTE_COUNT } from '@/lib/image/palette';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 本地存储 / 旧版本数据可能缺字段或越界，统一校正后再使用 */
export function normalizePaletteOptions(value: Partial<PaletteOptions> | null | undefined): PaletteOptions {
  const merged = { ...DEFAULT_PALETTE_OPTIONS, ...(value || {}) };

  return {
    mode: PALETTE_MODES.includes(merged.mode) ? merged.mode : DEFAULT_PALETTE_OPTIONS.mode,
    sort: PALETTE_SORTS.includes(merged.sort) ? merged.sort : DEFAULT_PALETTE_OPTIONS.sort,
    count: clamp(Math.round(Number(merged.count) || DEFAULT_PALETTE_OPTIONS.count), MIN_PALETTE_COUNT, MAX_PALETTE_COUNT),
    maxEdge: (SAMPLE_SIZES as readonly number[]).includes(merged.maxEdge)
      ? merged.maxEdge
      : DEFAULT_PALETTE_OPTIONS.maxEdge,
    ignoreTransparent: merged.ignoreTransparent !== false,
    ignoreNearWhite: merged.ignoreNearWhite === true,
    ignoreNearBlack: merged.ignoreNearBlack === true,
    mergeSimilar: merged.mergeSimilar === true,
    mergeThreshold: clamp(Number(merged.mergeThreshold) || DEFAULT_PALETTE_OPTIONS.mergeThreshold, 2, 20),
  };
}
