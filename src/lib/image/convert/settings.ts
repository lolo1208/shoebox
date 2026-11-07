/**
 * 设置归一化。
 *
 * 本地存储与旧版本数据可能缺字段或越界，读取时统一校正后再交给 UI 与导出逻辑。
 */

import { MARGIN_MAX_MM, MARGIN_MIN_MM, PAGE_SIZE_IDS, PDF_FIT_MODES, PDF_ORIENTATIONS } from '@/lib/pdf';
import {
  IMAGE_FORMAT_IDS,
  PDF_COMPRESSIONS,
  PDF_DPI_OPTIONS,
  PNG_COLORS_MAX,
  PNG_COLORS_MIN,
  QUALITY_MAX,
  QUALITY_MIN,
} from './constants';
import type { ConverterSettings, ImageOutputOptions, PdfOutputOptions, PdfRenderDpi } from './types';

export const DEFAULT_IMAGE_OPTIONS: ImageOutputOptions = {
  format: 'jpeg',
  quality: 0.85,
  pngCompress: false,
  pngColors: 256,
};

export const DEFAULT_PDF_OPTIONS: PdfOutputOptions = {
  // 默认「适应图片」：不裁切、不留白，页面尺寸等于图片本身
  pageSize: 'fit',
  orientation: 'auto',
  marginMm: 0,
  fit: 'contain',
  dpi: 150,
  compression: 'jpeg',
  quality: 0.85,
  title: '',
};

export const DEFAULT_SETTINGS: ConverterSettings = {
  target: 'image',
  image: DEFAULT_IMAGE_OPTIONS,
  pdf: DEFAULT_PDF_OPTIONS,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const normalizeNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? clamp(numeric, min, max) : fallback;
};

export function normalizeImageOptions(value: Partial<ImageOutputOptions> | null | undefined): ImageOutputOptions {
  const merged = { ...DEFAULT_IMAGE_OPTIONS, ...(value || {}) };
  return {
    format: pick(merged.format, IMAGE_FORMAT_IDS, DEFAULT_IMAGE_OPTIONS.format),
    quality: normalizeNumber(merged.quality, QUALITY_MIN, QUALITY_MAX, DEFAULT_IMAGE_OPTIONS.quality),
    pngCompress: merged.pngCompress === true,
    pngColors: Math.round(
      normalizeNumber(merged.pngColors, PNG_COLORS_MIN, PNG_COLORS_MAX, DEFAULT_IMAGE_OPTIONS.pngColors),
    ),
  };
}

export function normalizePdfOptions(value: Partial<PdfOutputOptions> | null | undefined): PdfOutputOptions {
  const merged = { ...DEFAULT_PDF_OPTIONS, ...(value || {}) };
  return {
    pageSize: pick(merged.pageSize, PAGE_SIZE_IDS, DEFAULT_PDF_OPTIONS.pageSize),
    orientation: pick(merged.orientation, PDF_ORIENTATIONS, DEFAULT_PDF_OPTIONS.orientation),
    marginMm: normalizeNumber(merged.marginMm, MARGIN_MIN_MM, MARGIN_MAX_MM, DEFAULT_PDF_OPTIONS.marginMm),
    fit: pick(merged.fit, PDF_FIT_MODES, DEFAULT_PDF_OPTIONS.fit),
    dpi: PDF_DPI_OPTIONS.includes(Number(merged.dpi) as PdfRenderDpi)
      ? (Number(merged.dpi) as PdfRenderDpi)
      : DEFAULT_PDF_OPTIONS.dpi,
    compression: pick(merged.compression, PDF_COMPRESSIONS, DEFAULT_PDF_OPTIONS.compression),
    quality: normalizeNumber(merged.quality, QUALITY_MIN, QUALITY_MAX, DEFAULT_PDF_OPTIONS.quality),
    title: typeof merged.title === 'string' ? merged.title.slice(0, 120) : DEFAULT_PDF_OPTIONS.title,
  };
}

export function normalizeSettings(value: Partial<ConverterSettings> | null | undefined): ConverterSettings {
  const merged = value || {};
  return {
    target: merged.target === 'pdf' ? 'pdf' : 'image',
    image: normalizeImageOptions(merged.image),
    pdf: normalizePdfOptions(merged.pdf),
  };
}
