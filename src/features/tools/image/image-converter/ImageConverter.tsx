import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MAX_IMAGES } from '@/lib/image/convert';
import ConverterPanel from './components/ConverterPanel';
import ImageDropZone from './components/ImageDropZone';
import ResultStage from './components/ResultStage';
import SourceQueue from './components/SourceQueue';
import { useConverterSettings } from './hooks/useConverterSettings';
import { useExportTask } from './hooks/useExportTask';
import { useImageQueue } from './hooks/useImageQueue';
import { useImagePreview } from './hooks/usePreviews';

/**
 * 图片转换。
 *
 * 两种输出合并在同一个工具里：
 * - 图片：按格式 / 质量批量转换，多张时打包 ZIP
 * - PDF：每张图片一页，纸张、方向、边距、适配方式与压缩方式可调
 *
 * 页面只做状态编排：导入队列在 ./hooks/useImageQueue，
 * 参数在 ./hooks/useConverterSettings，转换与排版全部在 @/lib/image/convert，
 * 预览与导出复用同一条流水线，保证所见即所得。
 */
const ImageConverter: React.FC = () => {
  const { t } = useLanguage();
  const queue = useImageQueue();
  const { settings, update, updateImage, updatePdf } = useConverterSettings();
  const [pageIndex, setPageIndex] = useState(0);

  const isPdf = settings.target === 'pdf';
  const imagePreview = useImagePreview(queue.selected, settings.image, !isPdf);
  const exportTask = useExportTask(queue.items, settings);

  // 删除图片后页码可能越界：同步回有效范围，避免再次添加时跳到意外页码
  useEffect(() => {
    setPageIndex(current => {
      const max = Math.max(0, queue.items.length - 1);
      return current > max ? max : current;
    });
  }, [queue.items.length]);

  const safePageIndex = Math.min(pageIndex, Math.max(0, queue.items.length - 1));
  const pageItem = queue.items[safePageIndex] ?? null;
  const previewItem = isPdf ? pageItem : queue.selected;

  const queueErrorText = queue.errorKey ? t(queue.errorKey, { n: MAX_IMAGES }) : null;

  const handleAddFiles = (files: File[]) => {
    queue.dismissError();
    void queue.addFiles(files);
  };

  const handleSelect = (id: string) => {
    queue.select(id);
    const index = queue.items.findIndex(item => item.id === id);
    if (index >= 0) setPageIndex(index);
  };

  const handleClear = () => {
    queue.clear();
    setPageIndex(0);
  };

  if (queue.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <ImageDropZone onFiles={handleAddFiles} errorText={queueErrorText} />
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 xl:col-start-1 xl:row-start-1">
        <ResultStage
          target={settings.target}
          items={queue.items}
          previewItem={previewItem}
          pageIndex={safePageIndex}
          onPageChange={setPageIndex}
          imagePreview={imagePreview}
          pdfOptions={settings.pdf}
          exportTask={exportTask}
        />
      </div>

      {/* 右栏比视口高时内部滚动，避免 sticky 把下方设置项顶出可视区域 */}
      <div className="space-y-4 xl:sticky xl:top-6 xl:col-start-2 xl:row-start-1 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
        <SourceQueue
          items={queue.items}
          selectedId={queue.selected?.id ?? null}
          onSelect={handleSelect}
          onRemove={queue.remove}
          onMove={queue.move}
          onClear={handleClear}
          onAdd={handleAddFiles}
          orderMatters={isPdf}
          errorText={queueErrorText}
        />
        <ConverterPanel
          settings={settings}
          onTargetChange={target => update({ target })}
          onImageChange={updateImage}
          onPdfChange={updatePdf}
        />
      </div>
    </div>
  );
};

export default ImageConverter;
