import React from 'react';
import { Download, Film, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { downloadBlob } from '@/lib/download';
import { formatBytes, formatDuration } from '@/lib/format';
import type { GifPreview } from '../hooks/useGifConversion';

interface GifResultPanelProps {
  result: GifPreview | null;
  /** 参数已修改，结果与当前设置不一致 */
  stale: boolean;
  running: boolean;
  onRegenerate: () => void;
}

/** 透明区域的棋盘格背景 */
const CHECKERBOARD: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #eceef0 25%, transparent 25%), linear-gradient(-45deg, #eceef0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eceef0 75%), linear-gradient(-45deg, transparent 75%, #eceef0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

interface MetaRowProps {
  label: string;
  value: string;
}

const MetaRow: React.FC<MetaRowProps> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-gray-400">{label}</dt>
    <dd className="tabular-nums text-gray-700">{value}</dd>
  </div>
);

/** 生成结果：预览、参数回显与下载 */
const GifResultPanel: React.FC<GifResultPanelProps> = ({ result, stale, running, onRegenerate }) => {
  const { t } = useLanguage();

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{t('gif.result.title')}</h3>
        {result && stale && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
            {t('gif.result.stale')}
          </span>
        )}

        {result && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onRegenerate}
              disabled={running}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={14} />
              {t('gif.result.regenerate')}
            </button>
            <button
              type="button"
              onClick={() => downloadBlob(result.blob, result.fileName)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
            >
              <Download size={14} />
              {t('gif.result.download')}
            </button>
          </div>
        )}
      </div>

      {!result ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
          <Film size={26} className="opacity-40" />
          <p className="text-sm">{running ? t('gif.result.working') : t('gif.result.empty')}</p>
          {!running && <p className="max-w-md text-xs leading-relaxed opacity-70">{t('gif.result.empty_hint')}</p>}
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
            <div className="flex items-center justify-center rounded-lg p-3" style={CHECKERBOARD}>
              <img
                src={result.previewUrl}
                alt={result.fileName}
                className="max-h-[360px] w-auto max-w-full rounded"
              />
            </div>

            <dl className="space-y-2 text-xs">
              <MetaRow
                label={t('gif.result.size_px')}
                value={result.width > 0 ? `${result.width}×${result.height}` : '—'}
              />
              <MetaRow label={t('gif.result.frames')} value={String(result.frames)} />
              <MetaRow
                label={t('gif.result.duration')}
                value={`${(result.frames / Math.max(result.fps, 1)).toFixed(1)}s`}
              />
              <MetaRow label={t('gif.result.file_size')} value={formatBytes(result.bytes)} />
              <MetaRow label={t('gif.result.elapsed')} value={formatDuration(result.elapsedMs)} />
              <MetaRow label={t('gif.result.file_name')} value={result.fileName} />
            </dl>
          </div>

          {result.mode === 'simple' && result.requestedMode === 'palette' && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700">
              {t('gif.result.fallback')}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default GifResultPanel;
