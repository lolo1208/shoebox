/**
 * PDF 逻辑层统一出口。
 *
 * 分层：
 * - types      公共数据形状（页面、位图、元信息）
 * - units      毫米 / 像素 / 点换算与数值格式化
 * - constants  标准纸张与可调范围
 * - layout     页面尺寸解析、内容区与图片适配（纯函数）
 * - text       文本与日期编码
 * - document   对象表、交叉引用表与文件序列化
 */

export { PAGE_SIZE_PRESETS, PDF_FIT_MODES, PDF_ORIENTATIONS, PAGE_SIZE_IDS } from './constants';
export { MARGIN_MAX_MM, MARGIN_MIN_MM, FIT_PAGE_DPI, isFixedPageSize } from './constants';
export type { PageSizePreset } from './constants';

export { insetPageBox, placeImage, resolvePageBox } from './layout';
export type { ResolvePageBoxInput } from './layout';

export { PdfDocumentBuilder, PdfEmptyDocumentError } from './document';

export { formatPdfDate, toPdfTextString } from './text';

export { MM_TO_POINTS, POINTS_PER_INCH, formatPdfNumber, mmToPoints, pixelsToPoints, pointsToMm } from './units';

export type {
  PdfDocumentMetadata,
  PdfFitMode,
  PdfImageData,
  PdfImageFilter,
  PdfOrientation,
  PdfPageBox,
  PdfPageInput,
  PdfPageSize,
  PdfPlacement,
} from './types';
