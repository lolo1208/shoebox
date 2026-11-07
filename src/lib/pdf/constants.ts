/**
 * 纸张预设与页面排版相关的可调范围。
 */

import type { PdfFitMode, PdfOrientation, PdfPageSize } from './types';

export interface PageSizePreset {
  id: Exclude<PdfPageSize, 'fit'>;
  /** 展示用名称，属于标准纸张型号，无需翻译 */
  label: string;
  widthMm: number;
  heightMm: number;
}

/** ISO 216 / ANSI 标准纸张（纵向尺寸：宽 < 高） */
export const PAGE_SIZE_PRESETS: Record<PageSizePreset['id'], PageSizePreset> = {
  a4: { id: 'a4', label: 'A4', widthMm: 210, heightMm: 297 },
  a5: { id: 'a5', label: 'A5', widthMm: 148, heightMm: 210 },
  letter: { id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4 },
  legal: { id: 'legal', label: 'Legal', widthMm: 215.9, heightMm: 355.6 },
};

/** 纸张尺寸下拉项的顺序 */
export const PAGE_SIZE_IDS: readonly PdfPageSize[] = ['fit', 'a4', 'a5', 'letter', 'legal'];

export const PDF_ORIENTATIONS: readonly PdfOrientation[] = ['auto', 'portrait', 'landscape'];

export const PDF_FIT_MODES: readonly PdfFitMode[] = ['contain', 'cover', 'stretch'];

/** 页边距范围（毫米） */
export const MARGIN_MIN_MM = 0;
export const MARGIN_MAX_MM = 40;

/**
 * 「适应图片」时把图片像素换算成点的基准 DPI。
 * 与主流图片转 PDF 工具保持一致：无 DPI 元信息时按 96 DPI 解释。
 */
export const FIT_PAGE_DPI = 96;

export function isFixedPageSize(size: PdfPageSize): size is PageSizePreset['id'] {
  // 非法值（例如旧缓存）按 'fit' 处理，避免取值越界导致导出中断
  return Object.prototype.hasOwnProperty.call(PAGE_SIZE_PRESETS, size);
}
