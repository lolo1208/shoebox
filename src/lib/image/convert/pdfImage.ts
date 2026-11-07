/**
 * 画布 → PDF 位图。
 *
 * 两种压缩方式：
 * - jpeg     canvas 直接编码 JPEG，PDF 用 /DCTDecode 原样嵌入（体积最小）
 * - lossless 去掉 alpha 的 RGB 原始像素，经 zlib（/FlateDecode）无损压缩
 */

import type { PdfImageData } from '@/lib/pdf';
import { asBlobPart } from '@/lib/binary';
import { ConversionError } from './errors';
import { canvasToBlob, getCanvasContext } from './raster';
import type { PdfCompression } from './types';

/** zlib 压缩（CompressionStream('deflate') 输出的是带 zlib 头的流，即 PDF 需要的格式） */
async function deflate(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const stream = new Blob([asBlobPart(bytes)]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  } catch {
    return null;
  }
}

/** 去掉 alpha 通道，得到紧凑的 RGB 缓冲 */
function toRgbBytes(data: Uint8ClampedArray): Uint8Array {
  const rgb = new Uint8Array((data.length / 4) * 3);
  let target = 0;
  for (let index = 0; index < data.length; index += 4) {
    rgb[target] = data[index];
    rgb[target + 1] = data[index + 1];
    rgb[target + 2] = data[index + 2];
    target += 3;
  }
  return rgb;
}

export interface PdfImageEncodeOptions {
  compression: PdfCompression;
  /** JPEG 质量，0.1–1 */
  quality: number;
}

/** 把整页位图编码为可直接写入 PDF 的对象 */
export async function canvasToPdfImage(
  canvas: HTMLCanvasElement,
  options: PdfImageEncodeOptions,
): Promise<PdfImageData> {
  const base = {
    width: canvas.width,
    height: canvas.height,
    bitsPerComponent: 8,
    colorSpace: 'DeviceRGB' as const,
  };

  if (options.compression === 'jpeg') {
    const blob = await canvasToBlob(canvas, 'image/jpeg', options.quality);
    if (!blob) throw new ConversionError('pdf', 'JPEG_ENCODE_FAILED');
    return {
      ...base,
      filter: 'DCTDecode',
      data: new Uint8Array(await blob.arrayBuffer()),
    };
  }

  const context = getCanvasContext(canvas);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = toRgbBytes(data);
  const compressed = await deflate(rgb);

  if (!compressed) {
    // 环境不支持 CompressionStream 时退回未压缩位图：仍然是合法 PDF，只是体积大
    return { ...base, filter: null, data: rgb };
  }

  return { ...base, filter: 'FlateDecode', data: compressed };
}
