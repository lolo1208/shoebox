import React from 'react';
import { ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import { CHECKERBOARD_BACKGROUND } from '@/styles/checkerboard';
import type { ConvertTarget, PdfOutputOptions, SourceImage } from '@/lib/image/convert';
import type { ExportTask } from '../hooks/useExportTask';
import type { ImagePreview } from '../hooks/usePreviews';
import PdfPagePreview from './PdfPagePreview';

interface ResultStageProps {
  target: ConvertTarget;
  items: SourceImage[];
  /** 当前预览对象：图片模式为选中项，PDF 模式为当前页 */
  previewItem: SourceImage | null;
  pageIndex: number;
  onPageChange: (index: number) => void;
  imagePreview: ImagePreview;
  pdfOptions: PdfOutputOptions;
  exportTask: ExportTask;
}

const STAGE_HEIGHT = 'h-[320px] sm:h-[420px] xl:h-[min(62vh,600px)]';

/** 输出预览与下载：参数变化时自动刷新，预览与导出使用同一条转换流水线 */
const ResultStage: React.FC<ResultStageProps> = ({
  target,
  items,
  previewItem,
  pageIndex,
  onPageChange,
  imagePreview,
  pdfOptions,
  exportTask,
}) => {
  const { t } = useLanguage();

  const exporting = exportTask.status === 'running';
  const progressPercent = Math.round(exportTask.progress * 100);
  const errorText = exportTask.errorKey
    ? t(exportTask.errorKey)
    : imagePreview.errorKey
      ? t(imagePreview.errorKey)
      : null;

  const exportLabel =
    target === 'pdf'
      ? t('img_conv.export_pdf')
      : items.length > 1
        ? t('img_conv.export_zip', { n: items.length })
        : t('img_conv.export_image');

  const sizeMeta = (() => {
    if (target === 'pdf' || !previewItem || !imagePreview.blob) return null;
    const ratio = imagePreview.blob.size / Math.max(1, previewItem.size);
    const smaller = ratio <= 1;
    return (
      <span className="text-xs tabular-nums text-gray-500">
        {formatBytes(previewItem.size)} →{' '}
        <span className={smaller ? 'font-medium text-green-600' : 'font-medium text-orange-600'}>
          {formatBytes(imagePreview.blob.size)} ({smaller ? '−' : '+'}
          {Math.abs(Math.round((1 - ratio) * 100))}%)
        </span>
      </span>
    );
  })();

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <span className="text-sm font-semibold text-gray-700">{t('img_conv.preview')}</span>

        {target === 'pdf' ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(pageIndex - 1)}
              disabled={pageIndex <= 0}
              title={t('img_conv.pdf.prev')}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium tabular-nums text-gray-600">
              {t('img_conv.pdf.page_indicator', { current: pageIndex + 1, total: items.length })}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(pageIndex + 1)}
              disabled={pageIndex >= items.length - 1}
              title={t('img_conv.pdf.next')}
              className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : (
          sizeMeta
        )}
      </div>

      <div
        className={`relative flex items-center justify-center overflow-hidden p-6 ${STAGE_HEIGHT}`}
        style={{ backgroundImage: CHECKERBOARD_BACKGROUND }}
      >
        {target === 'image' ? (
          imagePreview.url ? (
            <img
              src={imagePreview.url}
              alt={previewItem?.name ?? ''}
              draggable={false}
              className={`max-h-full max-w-full bg-white object-contain shadow-lg transition-opacity duration-200 ${
                imagePreview.status === 'running' ? 'opacity-60' : 'opacity-100'
              }`}
            />
          ) : (
            <Placeholder running={imagePreview.status === 'running'} />
          )
        ) : previewItem ? (
          <PdfPagePreview item={previewItem} options={pdfOptions} />
        ) : (
          <Placeholder running={false} />
        )}

        {imagePreview.status === 'running' && target === 'image' && imagePreview.url && (
          <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-primary-600 shadow-sm backdrop-blur-sm">
            <RefreshCw className="animate-spin" size={13} />
            {t('common.processing')}
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-gray-200 bg-white p-4">
        {errorText && <p className="text-xs text-red-500">{errorText}</p>}

        {exporting && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <span>{t('img_conv.exporting')}</span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{progressPercent}%</span>
                <button
                  type="button"
                  onClick={exportTask.cancel}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {t('img_conv.export_cancel')}
                </button>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-150"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {!exporting && exportTask.status === 'done' && exportTask.fileName && (
          <p className="text-xs text-green-600">{t('img_conv.export_done', { name: exportTask.fileName })}</p>
        )}

        <button
          type="button"
          onClick={() => void exportTask.run()}
          disabled={exporting || items.length === 0}
          className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-medium shadow-sm transition-all ${
            exporting || items.length === 0
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'
          }`}
        >
          {exporting ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
          {exporting ? t('img_conv.exporting') : exportLabel}
        </button>
      </div>
    </div>
  );
};

const Placeholder: React.FC<{ running: boolean }> = ({ running }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center gap-3 text-gray-400">
      {running ? (
        <>
          <RefreshCw className="animate-spin text-primary-500" size={30} />
          <span className="text-sm font-medium text-primary-600">{t('common.processing')}</span>
        </>
      ) : (
        <span className="text-sm">{t('img_conv.preview_hint')}</span>
      )}
    </div>
  );
};

export default ResultStage;
