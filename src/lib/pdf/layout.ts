/**
 * 页面几何：纸张尺寸解析、内容区计算与图片适配。
 *
 * 全部为纯函数，输入输出都用点与像素，方便 UI 层复用同一套结果
 * 做页面预览与最终导出，避免「预览和成品不一致」。
 */

import { FIT_PAGE_DPI, PAGE_SIZE_PRESETS, isFixedPageSize } from './constants';
import type { PdfFitMode, PdfOrientation, PdfPageBox, PdfPageSize, PdfPlacement } from './types';
import { mmToPoints, pixelsToPoints } from './units';

export interface ResolvePageBoxInput {
  size: PdfPageSize;
  orientation: PdfOrientation;
  /** 页边距（点） */
  margin: number;
  /** 图片像素尺寸，'fit' 时用于推导页面大小 */
  imageWidth: number;
  imageHeight: number;
  /** 'fit' 时像素 → 点的基准 DPI */
  baseDpi?: number;
}

/**
 * 解析页面尺寸。
 *
 * - 'fit'：页面内容区等于图片按基准 DPI 换算后的尺寸，四边再加页边距
 * - 固定纸张：先按预设纵向尺寸，再按 orientation（auto 时跟随图片横竖）决定是否交换宽高
 */
export function resolvePageBox(input: ResolvePageBoxInput): PdfPageBox {
  const { size, orientation, margin, imageWidth, imageHeight } = input;
  const baseDpi = input.baseDpi ?? FIT_PAGE_DPI;
  const imageAspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;

  if (!isFixedPageSize(size)) {
    const contentWidth = pixelsToPoints(imageWidth, baseDpi);
    const contentHeight = pixelsToPoints(imageHeight, baseDpi);
    return {
      width: contentWidth + margin * 2,
      height: contentHeight + margin * 2,
    };
  }

  const preset = PAGE_SIZE_PRESETS[size];
  const portrait = { width: mmToPoints(preset.widthMm), height: mmToPoints(preset.heightMm) };
  // auto：横图用横向纸、竖图用纵向纸。
  // 标准纸张的纵横比接近 1/√2，按面积利用率计算，分界点正好是 1:1。
  const landscape = orientation === 'landscape' || (orientation === 'auto' && imageAspect > 1);

  return landscape ? { width: portrait.height, height: portrait.width } : portrait;
}

/** 页面内缩页边距后的内容区 */
export function insetPageBox(box: PdfPageBox, margin: number): PdfPlacement {
  const width = Math.max(box.width - margin * 2, 1);
  const height = Math.max(box.height - margin * 2, 1);
  return { x: margin, y: margin, width, height };
}

/**
 * 把图片放进内容区：
 * - contain：完整显示，留白
 * - cover：铺满内容区，超出部分裁切
 * - stretch：拉伸填满，忽略比例
 */
export function placeImage(
  content: PdfPlacement,
  imageWidth: number,
  imageHeight: number,
  mode: PdfFitMode,
): PdfPlacement {
  const safeWidth = imageWidth > 0 ? imageWidth : 1;
  const safeHeight = imageHeight > 0 ? imageHeight : 1;
  const aspect = safeWidth / safeHeight;

  if (mode === 'stretch') {
    return { x: content.x, y: content.y, width: content.width, height: content.height };
  }

  const widthFromWidth = content.width;
  const widthFromHeight = content.height * aspect;
  const width = mode === 'cover' ? Math.max(widthFromWidth, widthFromHeight) : Math.min(widthFromWidth, widthFromHeight);
  const height = width / aspect;

  return {
    x: content.x + (content.width - width) / 2,
    y: content.y + (content.height - height) / 2,
    width,
    height,
  };
}
