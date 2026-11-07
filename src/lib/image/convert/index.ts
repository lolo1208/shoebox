/**
 * 图片转换逻辑层统一出口。
 *
 * 分层：
 * - types      公共数据形状
 * - constants  格式、范围与阈值
 * - settings   默认值与归一化
 * - naming     输出文件名
 * - raster     解码 / 合成 / 编码
 * - pdfImage   画布 → PDF 位图（JPEG / 无损）
 * - pdfPage    页面几何计算与整页光栅化
 * - imageExport / pdfExport  两条导出流水线
 * - export     统一入口（含 ZIP 打包）
 *
 * 页面尺寸与 PDF 序列化在 @/lib/pdf，本模块只负责图片侧的像素处理。
 */

export {
  IMAGE_FORMAT_IDS,
  MAX_IMAGES,
  PDF_COMPRESSIONS,
  PDF_DPI_OPTIONS,
  PNG_COLORS_MAX,
  PNG_COLORS_MIN,
  PNG_COLORS_STEP,
  PREVIEW_MAX_EDGE,
  QUALITY_MAX,
  QUALITY_MIN,
  QUALITY_STEP,
} from './constants';

export { DEFAULT_IMAGE_OPTIONS, DEFAULT_PDF_OPTIONS, DEFAULT_SETTINGS, normalizeSettings } from './settings';

export { inspectImage } from './raster';
export { renderPdfPage } from './pdfPage';
export { convertImage } from './imageExport';
export { buildPdfDocument } from './pdfExport';
export { runExport } from './export';

export { ConversionError, type ConversionErrorCode } from './errors';

export type {
  ConverterSettings,
  ConvertTarget,
  ExportResult,
  ImageFormat,
  ImageOutputOptions,
  PdfCompression,
  PdfOutputOptions,
  PdfRenderDpi,
  SourceImage,
} from './types';
export type { PdfPageLimits, PdfPagePlan } from './pdfPage';
export type { ImageInspection } from './raster';
