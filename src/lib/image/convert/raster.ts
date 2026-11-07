/**
 * 位图解码、画布合成与图片编码。
 *
 * 所有图片工具都经过同一套「解码 → canvas → 编码」流程：
 * - 解码优先用 createImageBitmap（支持 EXIF 方向、不占 DOM）
 * - JPEG 不支持透明，合成时铺白底
 * - PNG 可选 UPNG 调色板量化，显著减小体积
 */

import UPNG from 'upng-js';
import { loadImageElement } from '@/lib/image/loadImage';
import { ConversionError } from './errors';
import {
  FLATTEN_BACKGROUND,
  IMAGE_FORMAT_MIME,
  THUMBNAIL_MAX_EDGE,
  THUMBNAIL_QUALITY,
} from './constants';
import type { ImageOutputOptions } from './types';

/** 解码后的图片：释放资源由调用方通过 release() 完成 */
export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/**
 * 解码图片。
 *
 * `imageOrientation: 'from-image'` 让手机拍摄的竖图按 EXIF 方向解码，
 * 避免导出结果被旋转 90°。
 */
export async function decodeImage(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // 某些格式（如部分 SVG/ICO）createImageBitmap 不支持，回退到 <img>
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImageElement(url);
    return {
      source: image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw new ConversionError('decode', error instanceof Error ? error.message : undefined);
  }
}

/** 导入阶段的探活结果 */
export interface ImageInspection {
  width: number;
  height: number;
  /** 列表用缩略图（小尺寸 JPEG）；生成失败时为 null，由调用方降级 */
  thumbnail: Blob | null;
}

/**
 * 导入一张图片：读取像素尺寸，并顺带生成列表缩略图。
 *
 * 只解码一次，且立即释放位图；列表不再引用原图 URL，
 * 因此导入几十张大图也不会因缩略图而积压解码内存。
 */
export async function inspectImage(blob: Blob, maxEdge = THUMBNAIL_MAX_EDGE): Promise<ImageInspection> {
  const decoded = await decodeImage(blob);

  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height, 1));
    const canvas = createCanvas(decoded.width * scale, decoded.height * scale);
    const context = getCanvasContext(canvas);

    // 缩略图统一用 JPEG：体积小、列表尺寸下画质足够；透明区铺白底避免变黑
    paintBackground(context, canvas.width, canvas.height, FLATTEN_BACKGROUND);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    return {
      width: decoded.width,
      height: decoded.height,
      thumbnail: await canvasToBlob(canvas, 'image/jpeg', THUMBNAIL_QUALITY),
    };
  } finally {
    decoded.release();
  }
}

export function createCanvas(
  width: number,
  height: number,
  settings?: CanvasRenderingContext2DSettings,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  // 需要回读像素（量化 / 无损编码）的画布提前声明，避免 GPU 同步回读开销
  if (settings) canvas.getContext('2d', settings);
  return canvas;
}

/** 取 2D 上下文；失败说明浏览器不支持 canvas（几乎不会发生） */
export function getCanvasContext(
  canvas: HTMLCanvasElement,
  settings?: CanvasRenderingContext2DSettings,
): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', settings);
  if (!context) throw new ConversionError('encode', 'CANVAS_CONTEXT_UNAVAILABLE');
  return context;
}

/** 整块填充底色；颜色为 null 时保持透明 */
export function paintBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  color?: string,
): void {
  if (!color) return;
  context.fillStyle = color;
  context.fillRect(0, 0, width, height);
}

/**
 * 按原图像素尺寸重绘到画布。
 * JPEG 会先铺底色，其余格式保留透明通道。
 * `readback` 表示后续要 getImageData（PNG 量化），此时改用 CPU 画布。
 */
export function renderSourceCanvas(
  decoded: DecodedImage,
  options: { flatten: boolean; readback: boolean },
): HTMLCanvasElement {
  const canvas = createCanvas(
    decoded.width,
    decoded.height,
    options.readback ? { willReadFrequently: true } : undefined,
  );
  const context = getCanvasContext(canvas);
  paintBackground(context, canvas.width, canvas.height, options.flatten ? FLATTEN_BACKGROUND : undefined);
  context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** canvas → Blob；失败时返回 null（例如浏览器不支持该 MIME） */
export function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob | null> {
  return new Promise(resolve => {
    try {
      canvas.toBlob(blob => resolve(blob), mime, quality);
    } catch {
      resolve(null);
    }
  });
}

/** 按目标格式编码画布 */
export async function encodeCanvas(canvas: HTMLCanvasElement, options: ImageOutputOptions): Promise<Blob> {
  const { format, quality, pngCompress, pngColors } = options;

  if (format === 'png' && pngCompress) {
    const context = getCanvasContext(canvas);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    try {
      const buffer = UPNG.encode([data.buffer], canvas.width, canvas.height, pngColors);
      return new Blob([buffer], { type: IMAGE_FORMAT_MIME.png });
    } catch (error) {
      throw new ConversionError('encode', error instanceof Error ? error.message : undefined);
    }
  }

  const blob = await canvasToBlob(canvas, IMAGE_FORMAT_MIME[format], format === 'png' ? undefined : quality);
  if (!blob) throw new ConversionError('encode', `UNSUPPORTED_OUTPUT_${format.toUpperCase()}`);
  return blob;
}
