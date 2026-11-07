/**
 * 图像采样。
 *
 * 调色板提取不关心原图分辨率：先把图片等比缩小到限定边长再读取像素，
 * 既能把耗时控制在毫秒级，也能天然抑制噪点对主色的干扰。
 */

import type { RGB } from './color';

/** 可选采样边长（长边像素） */
export const SAMPLE_SIZES = [128, 256, 512] as const;
export type SampleSize = (typeof SAMPLE_SIZES)[number];

let scratchCanvas: HTMLCanvasElement | null = null;
let pickCanvas: HTMLCanvasElement | null = null;

const getScratchCanvas = (): HTMLCanvasElement => {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  return scratchCanvas;
};

/** 把图片等比缩小到 maxEdge 后读取像素；失败返回 null */
export function sampleImage(image: HTMLImageElement, maxEdge: number): ImageData | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return null;

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));

  const canvas = getScratchCanvas();
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, sampleWidth, sampleHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

  try {
    return ctx.getImageData(0, 0, sampleWidth, sampleHeight);
  } catch {
    // 跨域图片会污染画布，此处按失败处理
    return null;
  }
}

/**
 * 读取原图上某个相对坐标（0–1）的精确像素，用于图片取色器。
 * 只截取 1×1 区域绘制，不经过降采样，因此取到的是原图真实颜色。
 */
export function pickImagePixel(image: HTMLImageElement, fx: number, fy: number): RGB | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) return null;

  const x = Math.min(width - 1, Math.max(0, Math.floor(fx * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(fy * height)));

  if (!pickCanvas) pickCanvas = document.createElement('canvas');
  pickCanvas.width = 1;
  pickCanvas.height = 1;

  const ctx = pickCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.clearRect(0, 0, 1, 1);
    ctx.drawImage(image, x, y, 1, 1, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    if (data[3] < 16) return null;
    return { r: data[0], g: data[1], b: data[2] };
  } catch {
    return null;
  }
}
