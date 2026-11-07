/**
 * 多张图片 → 单个 PDF 文档。
 *
 * 每张图片按页面设置排版后光栅化为整页位图，再交给 @/lib/pdf 序列化：
 * 页面尺寸、方向、边距、适配方式与预览使用同一套几何计算。
 */

import { PdfDocumentBuilder } from '@/lib/pdf';
import { ConversionError, abortIfCancelled } from './errors';
import { canvasToPdfImage } from './pdfImage';
import { renderPdfPage } from './pdfPage';
import type { ExportHandlers, PdfOutputOptions, SourceImage } from './types';

/** 生成 PDF 文件；进度按页推进 */
export async function buildPdfDocument(
  items: SourceImage[],
  options: PdfOutputOptions,
  handlers: ExportHandlers = {},
): Promise<Blob> {
  if (items.length === 0) throw new ConversionError('empty');

  const document = new PdfDocumentBuilder({
    title: options.title.trim() || undefined,
    creator: 'LOLO Shoebox',
    producer: 'LOLO Shoebox',
  });

  for (let index = 0; index < items.length; index += 1) {
    abortIfCancelled(handlers);
    const { canvas, plan } = await renderPdfPage(items[index], options);
    const image = await canvasToPdfImage(canvas, options);
    document.addImagePage({ box: plan.page, image });
    // 及时释放画布引用，避免批量导出时内存叠加
    canvas.width = 1;
    canvas.height = 1;
    handlers.onProgress?.((index + 1) / items.length);
  }

  try {
    return document.build();
  } catch (error) {
    throw new ConversionError('pdf', error instanceof Error ? error.message : undefined);
  }
}
