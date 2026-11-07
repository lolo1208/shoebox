/**
 * 图片转换的可调范围与常量。
 */

import type { ImageFormat, PdfCompression, PdfRenderDpi } from './types';

export const IMAGE_FORMAT_IDS: readonly ImageFormat[] = ['jpeg', 'png', 'webp'];

export const IMAGE_FORMAT_MIME: Record<ImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const IMAGE_FORMAT_EXTENSION: Record<ImageFormat, string> = {
  jpeg: 'jpg',
  png: 'png',
  webp: 'webp',
};

/** 质量取值范围（JPEG / WebP / PDF 内 JPEG 共用） */
export const QUALITY_MIN = 0.1;
export const QUALITY_MAX = 1;
export const QUALITY_STEP = 0.05;

/** PNG 量化颜色数（UPNG 的图集上限为 256） */
export const PNG_COLORS_MIN = 2;
export const PNG_COLORS_MAX = 256;
export const PNG_COLORS_STEP = 2;

/** PDF 固定纸张的渲染分辨率候选 */
export const PDF_DPI_OPTIONS: readonly PdfRenderDpi[] = [96, 150, 300];

export const PDF_COMPRESSIONS: readonly PdfCompression[] = ['jpeg', 'lossless'];

/** 不支持透明的格式（JPEG）在合成时使用的底色 */
export const FLATTEN_BACKGROUND = '#ffffff';

/** PDF 页面底色；也为透明图片提供底色 */
export const PDF_PAGE_BACKGROUND = '#ffffff';

/** 单页位图像素上限，防止超大图片 × 高 DPI 时占满内存 */
export const MAX_PAGE_PIXELS = 40_000_000;

/** 页面预览位图的长边上限（预览不需要成品分辨率） */
export const PREVIEW_MAX_EDGE = 1400;

/** 导入队列允许的最大图片数（超出会让批量导出非常慢） */
export const MAX_IMAGES = 60;

/** 列表缩略图的长边（像素）：避免为大图解码出整屏位图 */
export const THUMBNAIL_MAX_EDGE = 96;

/** 缩略图 JPEG 质量 */
export const THUMBNAIL_QUALITY = 0.8;
