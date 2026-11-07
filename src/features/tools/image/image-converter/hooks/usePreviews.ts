import { useEffect, useState } from 'react';
import {
  ConversionError,
  PREVIEW_MAX_EDGE,
  convertImage,
  renderPdfPage,
  type ImageOutputOptions,
  type PdfOutputOptions,
  type SourceImage,
} from '@/lib/image/convert';
import { useDebouncedTask, type TaskStatus } from './useDebouncedTask';

export interface ImagePreview {
  status: TaskStatus;
  blob: Blob | null;
  /** 预览用 ObjectURL，随结果自动回收 */
  url: string | null;
  errorKey: string | null;
}

const errorKeyOf = (error: unknown): string => {
  const code = error instanceof ConversionError ? error.code : 'encode';
  return `img_conv.error.${code}`;
};

/**
 * 单张图片的转换预览。
 * 结果与最终导出走同一个 convertImage，因此体积与画质所见即所得。
 *
 * 结果里带上来源 id：切换图片时旧结果立即失效（不会把上一张的图/体积算到新图上），
 * 但仅调整参数时仍保留旧结果到新结果就绪，避免画面闪烁。
 */
export function useImagePreview(
  item: SourceImage | null,
  options: ImageOutputOptions,
  enabled: boolean,
): ImagePreview {
  const task = useDebouncedTask(
    async () => (item ? { itemId: item.id, blob: await convertImage(item, options) } : null),
    {
      deps: [item?.id, item?.size, options.format, options.quality, options.pngCompress, options.pngColors],
      enabled: enabled && item !== null,
    },
  );

  const blob = task.result && item && task.result.itemId === item.id ? task.result.blob : null;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return {
    status: task.status,
    blob,
    url,
    errorKey: task.status === 'error' ? errorKeyOf(task.error) : null,
  };
}

export interface PagePreview {
  status: TaskStatus;
  canvas: HTMLCanvasElement | null;
  errorKey: string | null;
}

/**
 * PDF 页面预览：用与导出完全相同的排版函数生成整页位图，
 * 只把长边限制在 PREVIEW_MAX_EDGE，避免预览就生成超大画布。
 *
 * 同样按来源 id 校验结果，翻页 / 换图时不会短暂显示上一页。
 */
export function usePdfPagePreview(
  item: SourceImage | null,
  options: PdfOutputOptions,
  enabled: boolean,
): PagePreview {
  const task = useDebouncedTask(
    async () =>
      item
        ? { itemId: item.id, canvas: (await renderPdfPage(item, options, { maxEdge: PREVIEW_MAX_EDGE })).canvas }
        : null,
    {
      deps: [
        item?.id,
        item?.size,
        options.pageSize,
        options.orientation,
        options.marginMm,
        options.fit,
        options.dpi,
      ],
      enabled: enabled && item !== null,
    },
  );

  const canvas = task.result && item && task.result.itemId === item.id ? task.result.canvas : null;

  return {
    status: task.status,
    canvas,
    errorKey: task.status === 'error' ? errorKeyOf(task.error) : null,
  };
}
