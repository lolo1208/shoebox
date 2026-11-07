import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import { downloadFrame, formatClock, type ExportedFrame } from '@/lib/media/frames';

interface FrameLightboxProps {
  frames: ExportedFrame[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

/** 单帧大图预览：支持 ←/→ 翻页与 Esc 关闭 */
const FrameLightbox: React.FC<FrameLightboxProps> = ({ frames, index, onClose, onIndexChange }) => {
  const { t } = useLanguage();
  const frame = frames[index];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onIndexChange(index - 1);
      } else if (event.key === 'ArrowRight' && index < frames.length - 1) {
        event.preventDefault();
        onIndexChange(index + 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [frames.length, index, onClose, onIndexChange]);

  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="flex items-start gap-3 px-5 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{frame.name}</p>
          <p className="mt-0.5 text-xs text-white/60">
            {formatClock(frame.time)} · {frame.width}×{frame.height} · {formatBytes(frame.size)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => downloadFrame(frame)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
          >
            <Download size={14} />
            {t('vfx.result.download')}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4"
        onClick={event => {
          // 仅点击空白背景时关闭，避免点图片/按钮误触
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {index > 0 && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            aria-label={t('vfx.result.prev')}
            className="absolute left-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <img src={frame.url} alt={frame.name} className="max-h-full max-w-full object-contain" />
        {index < frames.length - 1 && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            aria-label={t('vfx.result.next')}
            className="absolute right-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      <div className="pb-4 text-center text-xs tabular-nums text-white/50">
        {index + 1} / {frames.length}
      </div>
    </div>
  );
};

export default FrameLightbox;
