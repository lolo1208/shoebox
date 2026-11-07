/**
 * 图片转换的文件命名：批量导出时保证文件名可读且互不覆盖。
 */

import { sanitizeFileName, stripExtension } from '@/lib/fileName';
import { IMAGE_FORMAT_EXTENSION } from './constants';
import type { ImageFormat } from './types';

/** `<源文件名>.<目标扩展名>` */
export function buildImageFileName(sourceName: string, format: ImageFormat): string {
  return `${sanitizeFileName(stripExtension(sourceName), 'image')}.${IMAGE_FORMAT_EXTENSION[format]}`;
}

/** PDF 文件名：优先使用用户填写的文档标题，留空时用第一张图片的文件名 */
export function buildPdfFileName(title: string, fallbackSourceName: string): string {
  const stem = title.trim() || stripExtension(fallbackSourceName);
  return `${sanitizeFileName(stem, 'images')}.pdf`;
}

/** 批量导出的 ZIP 文件名 */
export function buildArchiveFileName(sourceName: string, count: number): string {
  const stem = sanitizeFileName(stripExtension(sourceName), 'images');
  return `${stem}-converted-${count}.zip`;
}
