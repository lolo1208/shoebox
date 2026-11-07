/**
 * 导出入口。
 *
 * UI 只需要调用 runExport：根据目标类型选择「图片 / ZIP」或「PDF」，
 * 命名、去重与打包都在这里完成。
 */

import JSZip from 'jszip';
import { dedupeFileNames } from '@/lib/fileName';
import { ConversionError, abortIfCancelled } from './errors';
import { IMAGE_FORMAT_MIME } from './constants';
import { convertImage } from './imageExport';
import { buildArchiveFileName, buildImageFileName, buildPdfFileName } from './naming';
import { buildPdfDocument } from './pdfExport';
import type { ConversionArtifact, ConverterSettings, ExportHandlers, ExportResult, SourceImage } from './types';

export const PDF_MIME = 'application/pdf';
export const ZIP_MIME = 'application/zip';

async function exportImages(
  items: SourceImage[],
  settings: ConverterSettings,
  handlers: ExportHandlers,
): Promise<ExportResult> {
  const artifacts: ConversionArtifact[] = [];

  for (let index = 0; index < items.length; index += 1) {
    abortIfCancelled(handlers);
    const item = items[index];
    const blob = await convertImage(item, settings.image);
    artifacts.push({ blob, fileName: buildImageFileName(item.name, settings.image.format) });
    handlers.onProgress?.(((index + 1) / items.length) * 0.9);
  }

  abortIfCancelled(handlers);

  const names = dedupeFileNames(artifacts.map(artifact => artifact.fileName));

  // 单张直接下载，多张打包为 ZIP
  if (artifacts.length === 1) {
    return {
      blob: artifacts[0].blob,
      fileName: names[0],
      mime: IMAGE_FORMAT_MIME[settings.image.format],
      count: 1,
    };
  }

  const zip = new JSZip();
  artifacts.forEach((artifact, index) => zip.file(names[index], artifact.blob));
  const blob = await zip.generateAsync({ type: 'blob' }, metadata => {
    handlers.onProgress?.(0.9 + (metadata.percent / 100) * 0.1);
  });

  return {
    blob,
    fileName: buildArchiveFileName(items[0].name, artifacts.length),
    mime: ZIP_MIME,
    count: artifacts.length,
  };
}

/** 执行一次完整导出 */
export async function runExport(
  items: SourceImage[],
  settings: ConverterSettings,
  handlers: ExportHandlers = {},
): Promise<ExportResult> {
  if (items.length === 0) throw new ConversionError('empty');

  if (settings.target === 'pdf') {
    const blob = await buildPdfDocument(items, settings.pdf, handlers);
    return {
      blob,
      fileName: buildPdfFileName(settings.pdf.title, items[0].name),
      mime: PDF_MIME,
      count: items.length,
    };
  }

  return exportImages(items, settings, handlers);
}
