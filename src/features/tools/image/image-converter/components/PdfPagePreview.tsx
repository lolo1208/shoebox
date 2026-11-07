import React, { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PdfOutputOptions, SourceImage } from '@/lib/image/convert';
import { usePdfPagePreview } from '../hooks/usePreviews';

interface PdfPagePreviewProps {
  item: SourceImage;
  options: PdfOutputOptions;
}

/**
 * PDF 单页预览。
 *
 * 直接复用导出流程的排版与光栅化函数，所以预览里的留白、裁切、
 * 页面比例与最终下载的文件一致；画布由组件挂载，避免 React 反复重建。
 */
const PdfPagePreview: React.FC<PdfPagePreviewProps> = ({ item, options }) => {
  const { t } = useLanguage();
  const preview = usePdfPagePreview(item, options, true);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();
    if (preview.canvas) {
      preview.canvas.className = 'block max-h-full max-w-full bg-white shadow-lg';
      host.appendChild(preview.canvas);
    }
  }, [preview.canvas]);

  // 翻页 / 改参数时画布会短暂缺失或仍是上一次的渲染结果，都用浮层提示
  const busy = preview.status === 'running';

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div ref={hostRef} className="flex h-full w-full items-center justify-center" />

      {busy && !preview.canvas && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
          <RefreshCw className="animate-spin text-primary-500" size={28} />
          <span className="text-sm font-medium text-primary-600">{t('common.processing')}</span>
        </div>
      )}

      {busy && preview.canvas && (
        <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-primary-600 shadow-sm backdrop-blur-sm">
          <RefreshCw className="animate-spin" size={12} />
          {t('common.processing')}
        </div>
      )}

      {preview.errorKey && (
        <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-red-500">{t(preview.errorKey)}</p>
      )}
    </div>
  );
};

export default PdfPagePreview;
