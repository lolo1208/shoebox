import React, { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Camera, ChevronLeft, ChevronRight, Loader2, Pause, Play, RefreshCw, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import { formatClock, resolveFps, type VideoProbe } from '@/lib/media/frames';

interface VideoStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  fileName: string;
  fileSize: number;
  probe: VideoProbe | null;
  /** 批量抽帧进行中：锁定播放控制，避免与抓帧互相抢占 seek */
  capturing: boolean;
  /** 视频元数据就绪（完成后才能抓单帧） */
  ready: boolean;
  onCaptureCurrent: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
}

/** 播放器 + 时间轴：定位、逐帧步进与「抓取当前帧」 */
const VideoStage: React.FC<VideoStageProps> = ({
  videoRef,
  src,
  fileName,
  fileSize,
  probe,
  capturing,
  ready,
  onCaptureCurrent,
  onReplace,
  onRemove,
}) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const fps = resolveFps(probe);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncTime = () => setCurrentTime(video.currentTime);
    const syncDuration = () => setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('timeupdate', syncTime);
    video.addEventListener('seeked', syncTime);
    video.addEventListener('durationchange', syncDuration);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);

    syncDuration();
    syncTime();

    return () => {
      video.removeEventListener('timeupdate', syncTime);
      video.removeEventListener('seeked', syncTime);
      video.removeEventListener('durationchange', syncDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, src]);

  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const limit = Number.isFinite(video.duration) ? video.duration : time;
      const next = Math.min(Math.max(time, 0), Math.max(0, limit - 0.001));
      video.currentTime = next;
      setCurrentTime(next);
    },
    [videoRef],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  }, [videoRef]);

  const stepFrames = useCallback(
    (frames: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      seekTo(video.currentTime + frames / fps);
    },
    [fps, seekTo, videoRef],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
    // 批量抽帧中锁定快捷键，避免与抓帧互相抢占 seek
    if (capturing) return;

    switch (event.key) {
      case ' ':
        event.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        event.preventDefault();
        // Shift + ←/→ 走 1 秒，单独按走 1 帧
        stepFrames(event.shiftKey ? -fps : -1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        stepFrames(event.shiftKey ? fps : 1);
        break;
      case 'c':
      case 'C':
        event.preventDefault();
        if (!capturing) onCaptureCurrent();
        break;
      default:
        break;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5">
        <span className="truncate text-sm font-medium text-gray-900" title={fileName}>
          {fileName}
        </span>
        <span className="shrink-0 text-xs text-gray-400">{formatBytes(fileSize)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={capturing}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw size={13} />
            {t('vfx.replace')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={capturing}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={13} />
            {t('vfx.remove')}
          </button>
        </div>
      </div>

      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <div className="bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            src={src}
            playsInline
            preload="auto"
            className="mx-auto max-h-[52vh] w-full bg-black object-contain"
            onClick={() => {
              if (!capturing) togglePlay();
            }}
          />
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">{formatClock(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.001}
              value={Math.min(currentTime, duration || 0)}
              onChange={event => seekTo(Number(event.target.value))}
              disabled={capturing}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('vfx.timeline')}
            />
            <span className="shrink-0 font-mono text-xs tabular-nums text-gray-400">{formatClock(duration)}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`flex items-center gap-1 rounded-lg bg-gray-100 p-1 ${capturing ? 'pointer-events-none opacity-50' : ''}`}>
              <button
                type="button"
                onClick={() => stepFrames(-fps)}
                title={t('vfx.prev_second')}
                className="rounded-md p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => stepFrames(-1)}
                title={t('vfx.prev_frame')}
                className="rounded-md p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
              >
                <span className="block text-[11px] font-semibold">-1f</span>
              </button>
              <button
                type="button"
                onClick={togglePlay}
                title={playing ? t('vfx.pause') : t('vfx.play')}
                className="rounded-md bg-white p-1.5 text-primary-600 shadow-sm"
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                type="button"
                onClick={() => stepFrames(1)}
                title={t('vfx.next_frame')}
                className="rounded-md p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
              >
                <span className="block text-[11px] font-semibold">+1f</span>
              </button>
              <button
                type="button"
                onClick={() => stepFrames(fps)}
                title={t('vfx.next_second')}
                className="rounded-md p-1.5 text-gray-600 hover:bg-white hover:text-gray-900"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
              {probe && (
                <span className="rounded-md bg-gray-100 px-2 py-1 tabular-nums">
                  {probe.width}×{probe.height}
                </span>
              )}
              <span className="rounded-md bg-gray-100 px-2 py-1 tabular-nums">
                {probe?.fps ? `${probe.fps} fps` : t('vfx.meta.fps_unknown')}
              </span>
            </div>

            <button
              type="button"
              onClick={onCaptureCurrent}
              disabled={capturing || !ready}
              className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {capturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {t('vfx.capture_current')}
            </button>
          </div>

          <p className="text-[11px] text-gray-400">{t('vfx.shortcuts')}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mkv,.mov,.m4v"
        className="hidden"
        onChange={event => {
          const next = event.target.files?.[0];
          if (next) onReplace(next);
          event.target.value = '';
        }}
      />
    </div>
  );
};

export default VideoStage;
