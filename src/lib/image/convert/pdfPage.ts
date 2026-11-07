/**
 * PDF 页面光栅化。
 *
 * 页面排版只做一次几何计算（planPdfPage），预览与导出共用同一份结果：
 * 预览按长边缩限尺寸，导出按设置的 DPI 出图，两者版式完全一致。
 */

import {
  POINTS_PER_INCH,
  insetPageBox,
  mmToPoints,
  placeImage,
  resolvePageBox,
  type PdfPageBox,
  type PdfPlacement,
} from '@/lib/pdf';
import { ConversionError } from './errors';
import { MAX_PAGE_PIXELS, PDF_PAGE_BACKGROUND } from './constants';
import { createCanvas, decodeImage, getCanvasContext, paintBackground } from './raster';
import type { PdfOutputOptions, SourceImage } from './types';

/** 页面位图尺寸的限制条件 */
export interface PdfPageLimits {
  /** 位图长边上限（预览用） */
  maxEdge?: number;
  /** 位图像素总数上限 */
  maxPixels?: number;
}

/** 一页的几何信息（单位：点；位图尺寸单位：像素） */
export interface PdfPagePlan {
  page: PdfPageBox;
  /** 页边距内的可用区域 */
  content: PdfPlacement;
  /** 图片实际绘制区域（cover 时会超出内容区） */
  image: PdfPlacement;
  /** 每点对应的像素数 */
  scale: number;
  pixelWidth: number;
  pixelHeight: number;
}

export interface ImageSize {
  width: number;
  height: number;
}

/**
 * 计算页面几何与位图尺寸。
 *
 * scale 的取值：
 * - 固定纸张：dpi / 72，让成品在打印尺寸下保持所选清晰度
 * - 适应图片：图片像素 / 页面宽度，即按原图像素输出、不重采样放大
 */
export function planPdfPage(
  image: ImageSize,
  options: PdfOutputOptions,
  limits: PdfPageLimits = {},
): PdfPagePlan {
  const imageWidth = Math.max(1, image.width);
  const imageHeight = Math.max(1, image.height);
  const margin = mmToPoints(options.marginMm);

  const page = resolvePageBox({
    size: options.pageSize,
    orientation: options.orientation,
    margin,
    imageWidth,
    imageHeight,
  });
  const content = insetPageBox(page, margin);
  const placement = placeImage(content, imageWidth, imageHeight, options.fit);

  const baseScale = options.pageSize === 'fit' ? imageWidth / page.width : options.dpi / POINTS_PER_INCH;
  let scale = Number.isFinite(baseScale) && baseScale > 0 ? baseScale : 1;

  // 先按像素总量限幅，再按预览长边限幅
  const maxPixels = limits.maxPixels ?? MAX_PAGE_PIXELS;
  const pixelCount = page.width * page.height * scale * scale;
  if (pixelCount > maxPixels) scale *= Math.sqrt(maxPixels / pixelCount);

  if (limits.maxEdge) {
    const longestEdge = Math.max(page.width, page.height) * scale;
    if (longestEdge > limits.maxEdge) scale *= limits.maxEdge / longestEdge;
  }

  return {
    page,
    content,
    image: placement,
    scale,
    // 向下取整：保证位图总像素不超过上限
    pixelWidth: Math.max(1, Math.floor(page.width * scale)),
    pixelHeight: Math.max(1, Math.floor(page.height * scale)),
  };
}

/** 按页面几何把图片绘制到整页画布上 */
export async function renderPdfPage(
  item: SourceImage,
  options: PdfOutputOptions,
  limits?: PdfPageLimits,
): Promise<{ canvas: HTMLCanvasElement; plan: PdfPagePlan }> {
  const decoded = await decodeImage(item.file);

  try {
    const plan = planPdfPage({ width: decoded.width, height: decoded.height }, options, limits);
    // 无损写入需要 getImageData，提前声明 CPU 画布
    const settings = options.compression === 'lossless' ? { willReadFrequently: true } : undefined;
    const canvas = createCanvas(plan.pixelWidth, plan.pixelHeight, settings);
    const context = getCanvasContext(canvas, settings);

    paintBackground(context, canvas.width, canvas.height, PDF_PAGE_BACKGROUND);

    const scale = plan.scale;
    context.save();
    // cover 时图片会超出内容区，按内容区裁切
    context.beginPath();
    context.rect(
      plan.content.x * scale,
      plan.content.y * scale,
      plan.content.width * scale,
      plan.content.height * scale,
    );
    context.clip();
    context.drawImage(
      decoded.source,
      plan.image.x * scale,
      plan.image.y * scale,
      plan.image.width * scale,
      plan.image.height * scale,
    );
    context.restore();

    return { canvas, plan };
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError('pdf', error instanceof Error ? error.message : undefined);
  } finally {
    decoded.release();
  }
}
