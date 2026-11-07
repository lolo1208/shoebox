import React, { useEffect, useMemo, useState } from 'react';
import { Check, Download, Images, Loader2, Package, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import {
  buildZipName,
  downloadFrame,
  downloadFramesAsZip,
  formatClock,
  type ExportedFrame,
} from '@/lib/media/frames';
import FrameLightbox from './FrameLightbox';

interface FrameGalleryProps {
  frames: ExportedFrame[];
  /** 批量抽帧进行中 */
  running: boolean;
  /** 源文件名主部，用于 ZIP 命名 */
  zipBase: string;
  onRemove: (name: string) => void;
  onClear: () => void;
}

/** 抽帧结果网格：选择、预览、单张下载与 ZIP 打包 */
const FrameGallery: React.FC<FrameGalleryProps> = ({ frames, running, zipBase, onRemove, onClear }) => {
  const { t } = useLanguage();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipPercent, setZipPercent] = useState(0);

  // 结果被清空后同步清理选中态
  useEffect(() => {
    if (frames.length === 0) {
      setSelected(new Set());
      setLightbox(null);
    }
  }, [frames.length]);

  const selectedFrames = useMemo(() => frames.filter(frame => selected.has(frame.name)), [frames, selected]);
  const allSelected = frames.length > 0 && selectedFrames.length === frames.length;
  const visibleCount = selectedFrames.length;

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(frames.map(frame => frame.name)));
  };

  const handleRemove = (name: string) => {
    setSelected(prev => {
      if (!prev.has(name)) return prev;
      const next = new Set(prev);
      next.delete(name);
      return next;
    });
    onRemove(name);
  };

  const handleExport = async () => {
    const list = visibleCount > 0 ? selectedFrames : frames;
    if (list.length === 0 || zipping) return;
    setZipping(true);
    setZipPercent(0);
    try {
      await downloadFramesAsZip(list, buildZipName(zipBase, list.length), setZipPercent);
    } finally {
      setZipping(false);
      setZipPercent(0);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{t('vfx.result.title')}</h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs tabular-nums text-gray-600">{frames.length}</span>
        {visibleCount > 0 && (
          <span className="text-xs text-gray-400">{t('vfx.result.selected', { n: visibleCount })}</span>
        )}

        {frames.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={toggleAll}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              {allSelected ? t('vfx.result.select_none') : t('vfx.result.select_all')}
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={running}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('common.clear')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={zipping}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
            >
              {zipping ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
              {zipping
                ? t('vfx.result.zipping', { percent: Math.round(zipPercent) })
                : t('vfx.result.export_zip', { n: visibleCount || frames.length })}
            </button>
          </div>
        )}
      </div>

      {frames.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-6 py-12 text-center text-gray-400">
          {running ? <Loader2 size={26} className="animate-spin text-primary-400" /> : <Images size={26} className="opacity-40" />}
          <p className="text-sm">{running ? t('vfx.result.working') : t('vfx.result.empty')}</p>
          {!running && <p className="text-xs opacity-70">{t('vfx.result.empty_hint')}</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
          {frames.map((frame, index) => {
            const isSelected = selected.has(frame.name);
            return (
              <div key={`${frame.name}-${frame.time}`} className="group overflow-hidden rounded-lg border border-gray-200 bg-white">
                <div className="relative aspect-video bg-gray-900">
                  <img
                    src={frame.url}
                    alt={frame.name}
                    loading="lazy"
                    onClick={() => setLightbox(index)}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => toggle(frame.name)}
                    aria-pressed={isSelected}
                    aria-label={t('vfx.result.select_frame')}
                    className={`absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      isSelected ? 'border-primary-500 bg-primary-600 text-white' : 'border-white/60 bg-black/30 text-transparent hover:bg-black/50'
                    }`}
                  >
                    <Check size={13} />
                  </button>
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
                    {formatClock(frame.time)}
                  </span>
                  <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <button
                      type="button"
                      onClick={() => downloadFrame(frame)}
                      aria-label={t('vfx.result.download')}
                      className="rounded bg-black/50 p-1 text-white hover:bg-black/70"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(frame.name)}
                      disabled={running}
                      aria-label={t('vfx.result.delete')}
                      className="rounded bg-black/50 p-1 text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-[11px] text-gray-500" title={frame.name}>
                    {frame.name}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{formatBytes(frame.size)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightbox !== null && (
        <FrameLightbox frames={frames} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />
      )}
    </section>
  );
};

export default React.memo(FrameGallery);
