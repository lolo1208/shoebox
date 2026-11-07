/**
 * 单张图片的转换。
 *
 * 预览与批量导出都调用这里，保证「预览所见 = 下载所得」。
 */

import { ConversionError } from './errors';
import { decodeImage, encodeCanvas, renderSourceCanvas } from './raster';
import type { ImageOutputOptions, SourceImage } from './types';

export async function convertImage(item: SourceImage, options: ImageOutputOptions): Promise<Blob> {
  let decoded;
  try {
    decoded = await decodeImage(item.file);
  } catch (error) {
    throw error instanceof ConversionError
      ? error
      : new ConversionError('decode', error instanceof Error ? error.message : undefined);
  }

  try {
    const canvas = renderSourceCanvas(decoded, {
      flatten: options.format === 'jpeg',
      // PNG 量化要读回像素，交给 CPU 画布更快也更省显存
      readback: options.format === 'png' && options.pngCompress,
    });
    return await encodeCanvas(canvas, options);
  } finally {
    decoded.release();
  }
}
