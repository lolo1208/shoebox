import React, { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Pause, Play, RefreshCw, Repeat, Scissors, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatBytes } from '@/lib/format';
import type { GifSourceInfo } from '@/lib/media/gif';

interface VideoPreviewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string;
  fileName: string;
  fileSize: number;
  info: GifSourceInfo | null;
  /** 当前截取区间（秒） */
  selection: { start: number; end: number };
  /** 正在编码时禁用播放，避免和编码争抢 CPU */
  busy: boolean;
  onPlayhead: (time: number) => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
}

/** 秒 → m:ss.s */
const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
};

/**
 * 视频预览：播放 / 定位 / 选区循环预览。
 *
 * 只负责本地播放与选区展示，参数编辑放在右侧面板；
 * 选区由父组件的 settings 统一管理，本组件只读取。
 */
const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoRef,
  src,
  fileName,
  fileSize,
  info,
  selection,
  busy,
  onPlayhead,
  onReplace,
  onRemove,
}) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [looping, setLooping] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // 事件监听在挂载时绑定一次，通过 ref 读取最新值，避免频繁解绑
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const playheadRef = useRef(onPlayhead);
  playheadRef.current = onPlayhead;
  const loopingRef = useRef(false);
  /** 同步循环预览状态：ref 供事件回调读取，state 驱动按钮高亮 */
  const updateLooping = useCallback((value: boolean) => {
    loopingRef.current = value;
    setLooping(value);
  }, []);

  const duration = info?.duration ?? 0;
  const clipDuration = Math.max(0, selection.end - selection.start);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const report = (time: number) => {
      setCurrentTime(time);
      playheadRef.current(time);
    };

    const onTimeUpdate = () => {
      const time = video.currentTime;
      report(time);

      // 选区循环预览：到达终点后跳回起点继续播放
      if (loopingRef.current) {
        const { start, end } = selectionRef.current;
        if (time >= end - 0.02) {
          try {
            video.currentTime = start;
            report(start);
          } catch {
            /* seek 失败时停止循环 */
            updateLooping(false);
            video.pause();
          }
        }
      }
    };

    const onSeeked = () => report(video.currentTime);
    const onEnded = () => {
      if (!loopingRef.current) return;
      // 终点恰好是视频末尾时，ended 会先触发，这里主动续播
      try {
        video.currentTime = selectionRef.current.start;
      } catch {
        updateLooping(false);
        return;
      }
      void video.play().catch(() => updateLooping(false));
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      // ended 造成的暂停交给 onEnded 处理，避免循环被打断
      if (video.ended && loopingRef.current) return;
      updateLooping(false);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [updateLooping, videoRef, src]);

  // 换片时重置播放与循环状态
  useEffect(() => {
    updateLooping(false);
    setPlaying(false);
    setCurrentTime(0);
  }, [src, updateLooping]);

  // 开始编码时停止播放，避免同时解码两遍
  useEffect(() => {
    if (busy) videoRef.current?.pause();
  }, [busy, videoRef]);

  const seek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video) return;
      const limit = duration || (Number.isFinite(video.duration) ? video.duration : 0);
      const next = Math.min(Math.max(time, 0), Math.max(0, limit - 0.001));
      try {
        video.currentTime = next;
      } catch {
        /* 元数据未就绪时忽略 */
      }
      setCurrentTime(next);
      playheadRef.current(next);
    },
    [duration, videoRef],
  );

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || busy) return;
    if (video.paused) {
      updateLooping(false);
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [busy, updateLooping, videoRef]);

  const toggleLoopPreview = useCallback(() => {
    const video = videoRef.current;
    if (!video || busy || clipDuration <= 0) return;

    if (loopingRef.current) {
      video.pause();
      updateLooping(false);
      return;
    }

    video.pause();
    seek(selectionRef.current.start);
    updateLooping(true);
    void video.play().catch(() => {
      updateLooping(false);
    });
  }, [busy, clipDuration, seek, updateLooping, videoRef]);

  const startPercent = duration > 0 ? (selection.start / duration) * 100 : 0;
  const widthPercent = duration > 0 ? (clipDuration / duration) * 100 : 0;

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
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <RefreshCw size={13} />
            {t('gif.replace')}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={13} />
            {t('gif.remove')}
          </button>
        </div>
      </div>

      <div className="bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          onClick={togglePlay}
          className="mx-auto max-h-[52vh] w-full cursor-pointer bg-black object-contain"
        />
      </div>

      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-500">{formatTime(currentTime)}</span>
          <div className="min-w-0 flex-1 space-y-1">
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.01}
              value={Math.min(currentTime, duration || 0)}
              onChange={event => seek(Number(event.target.value))}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
              aria-label={t('gif.timeline')}
            />
            {/* 选区指示条：与进度条同一刻度，便于确认截取范围 */}
            <div className="relative h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="absolute inset-y-0 rounded-full bg-primary-500/70"
                style={{ left: `${startPercent}%`, width: `${widthPercent}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 font-mono text-xs tabular-nums text-gray-400">{formatTime(duration)}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            disabled={busy}
            title={playing ? t('gif.pause') : t('gif.play')}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={toggleLoopPreview}
            disabled={busy || clipDuration <= 0}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              looping
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            <Repeat size={13} />
            {t('gif.loop_preview')}
          </button>

          <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-1 text-xs tabular-nums text-gray-600">
            <Scissors size={12} />
            {formatTime(selection.start)} – {formatTime(selection.end)}
            <span className="text-gray-400">({clipDuration.toFixed(1)}s)</span>
          </span>

          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            {info && info.width > 0 && (
              <span className="rounded-md bg-gray-100 px-2 py-1 tabular-nums text-gray-600">
                {info.width}×{info.height}
              </span>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-400">{t('gif.preview_hint')}</p>
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

export default VideoPreview;
