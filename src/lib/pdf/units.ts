/**
 * PDF 单位换算与数值格式化。
 *
 * PDF 内部统一使用「点」（1pt = 1/72 英寸），
 * 面向用户的纸张尺寸用毫米、图片尺寸用像素。
 */

export const POINTS_PER_INCH = 72;

export const MM_PER_INCH = 25.4;

/** 1 毫米对应的点数 */
export const MM_TO_POINTS = POINTS_PER_INCH / MM_PER_INCH;

/** 毫米 → 点 */
export function mmToPoints(mm: number): number {
  return mm * MM_TO_POINTS;
}

/** 点 → 毫米 */
export function pointsToMm(points: number): number {
  return points / MM_TO_POINTS;
}

/** 像素 → 点（按给定 DPI） */
export function pixelsToPoints(pixels: number, dpi: number): number {
  return (pixels / dpi) * POINTS_PER_INCH;
}

/**
 * 写入 PDF 的数值：保留有限精度、去掉多余的 0，并避免出现 `-0`。
 */
export function formatPdfNumber(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Number(value.toFixed(precision));
  return rounded === 0 ? '0' : String(rounded);
}
