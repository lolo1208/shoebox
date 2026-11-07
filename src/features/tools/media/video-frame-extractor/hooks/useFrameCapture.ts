import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  buildFrameFileName,
  detectSceneChanges,
  FrameGrabber,
  MAX_FRAMES,
  planFrames,
  type ExportedFrame,
  type GrabOptions,
  type GrabbedFrame,
  type VideoProbe,
} from '@/lib/media/frames';
import type { CaptureSettings } from '../constants';

export type CapturePhase = 'idle' | 'scan' | 'capture';
export type CaptureError = 'empty' | 'seek' | 'partial' | 'generic' | null;

export interface CaptureJob {
  settings: CaptureSettings;
  /** 源文件名主部，用于渲染命名模板 */
  baseName: string;
}

export interface FrameCapture {
  frames: ExportedFrame[];
  running: boolean;
  phase: CapturePhase;
  /** 0–1，scan 阶段表示场景扫描进度 */
  progress: number;
  done: number;
  total: number;
  /** 上一轮批量任务中抓取失败的帧数 */
  failed: number;
  error: CaptureError;
  /** 抓取当前播放位置的一帧 */
  captureCurrent: (job: CaptureJob) => Promise<void>;
  /** 按设置批量抽帧 */
  run: (job: CaptureJob) => Promise<void>;
  cancel: () => void;
  removeFrame: (name: string) => void;
  clearFrames: () => void;
}

/** 每抓够多少帧刷新一次界面，兼顾实时反馈与渲染开销 */
const FLUSH_SIZE = 4;

function toGrabOptions(settings: CaptureSettings): GrabOptions {
  return { format: settings.format, quality: settings.quality, maxSize: settings.maxSize };
}

function toExportedFrame(
  grabbed: GrabbedFrame,
  settings: CaptureSettings,
  baseName: string,
  time: number,
  index: number,
  used: Set<string>,
): ExportedFrame {
  const candidate = buildFrameFileName(
    { template: settings.template, digits: settings.digits },
    { base: baseName, index, time, width: grabbed.width, height: grabbed.height, format: settings.format },
  );
  const name = ensureUniqueName(candidate, used);
  used.add(name);

  return {
    name,
    blob: grabbed.blob,
    url: URL.createObjectURL(grabbed.blob),
    time,
    width: grabbed.width,
    height: grabbed.height,
    size: grabbed.blob.size,
  };
}

/** 多次抽帧后序号可能回退，重名时追加剧号避免覆盖 */
function ensureUniqueName(name: string, used: Set<string>): string {
  if (!used.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let suffix = 1;
  let candidate = `${stem}-${suffix}${ext}`;
  while (used.has(candidate)) {
    suffix += 1;
    candidate = `${stem}-${suffix}${ext}`;
  }
  return candidate;
}

/**
 * 抽帧任务编排：规划时间点 →（场景模式）扫描筛选 → 逐帧抓取 → 汇总结果。
 *
 * 支持取消、分批刷新结果，并在卸载 / 移除时回收预览用 object URL。
 */
export function useFrameCapture(videoRef: RefObject<HTMLVideoElement | null>, probe: VideoProbe | null): FrameCapture {
  const [frames, setFrames] = useState<ExportedFrame[]>([]);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState<CaptureError>(null);

  const cancelRef = useRef(false);
  const grabberRef = useRef<FrameGrabber | null>(null);
  const usedNamesRef = useRef<Set<string>>(new Set());
  /** 防止双击导致的并发任务（state 更新存在延迟，因此用 ref 兵底） */
  const busyRef = useRef(false);
  /** 会话号：清空 / 换片时递增，用于让旧任务丢弃过期结果 */
  const sessionRef = useRef(0);

  // 便于卸载时统一回收所有预览 URL
  const framesRef = useRef<ExportedFrame[]>([]);
  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    return () => {
      grabberRef.current?.dispose();
      grabberRef.current = null;
      framesRef.current.forEach(frame => URL.revokeObjectURL(frame.url));
    };
  }, []);

  const getGrabber = useCallback((): FrameGrabber | null => {
    const video = videoRef.current;
    if (!video) return null;
    if (!grabberRef.current || grabberRef.current.element !== video) {
      grabberRef.current?.dispose();
      grabberRef.current = new FrameGrabber(video);
    }
    return grabberRef.current;
  }, [videoRef]);

  const captureCurrent = useCallback(
    async (job: CaptureJob) => {
      const video = videoRef.current;
      if (!video || running || busyRef.current) return;
      const grabber = getGrabber();
      if (!grabber) return;

      busyRef.current = true;
      const session = sessionRef.current;
      video.pause();
      setError(null);
      try {
        const grabbed = await grabber.captureCurrent(toGrabOptions(job.settings));
        if (sessionRef.current !== session) return;
        const frame = toExportedFrame(grabbed, job.settings, job.baseName, video.currentTime, frames.length + 1, usedNamesRef.current);
        setFrames(prev => [...prev, frame]);
      } catch {
        setError('seek');
      } finally {
        busyRef.current = false;
      }
    },
    [frames.length, getGrabber, running, videoRef],
  );

  const run = useCallback(
    async (job: CaptureJob) => {
      const video = videoRef.current;
      if (!video || running || busyRef.current) return;
      const grabber = getGrabber();
      if (!grabber) return;

      const { settings } = job;
      const duration = probe?.duration || grabber.duration;
      const plan = planFrames({
        mode: settings.mode,
        duration,
        // 场景模式的采样步长独立配置，避免与等间隔模式互相影响
        interval: settings.mode === 'scene' ? settings.sceneStep : settings.interval,
        count: settings.count,
        start: settings.start,
        end: settings.end,
      });

      if (plan.times.length === 0) {
        setError('empty');
        return;
      }

      cancelRef.current = false;
      busyRef.current = true;
      const session = sessionRef.current;
      // 记录抽帧前的播放位置，结束后恢复，避免播放器停在末尾
      const resumeTime = video.currentTime;
      const wasPlaying = !video.paused;
      video.pause();
      setRunning(true);
      setError(null);
      setFailed(0);
      setDone(0);
      setTotal(plan.times.length);
      setProgress(0);

      let pending: ExportedFrame[] = [];
      const flush = () => {
        if (pending.length === 0) return;
        const batch = pending;
        pending = [];
        setFrames(prev => [...prev, ...batch]);
      };

      try {
        let times = plan.times;

        if (settings.mode === 'scene') {
          setPhase('scan');
          times = await detectSceneChanges(grabber, times, {
            threshold: settings.threshold,
            minGap: settings.minGap,
            maxFrames: MAX_FRAMES,
            onProgress: (scanned, count) => setProgress(count > 0 ? scanned / count : 0),
            shouldCancel: () => cancelRef.current || sessionRef.current !== session,
          });
          if (times.length === 0) {
            setError('empty');
            return;
          }
          setTotal(times.length);
          setProgress(0);
        }

        setPhase('capture');
        const grabOptions = toGrabOptions(settings);
        const startIndex = frames.length;
        let failures = 0;

        for (let i = 0; i < times.length; i += 1) {
          if (cancelRef.current || sessionRef.current !== session) break;
          const time = times[i];
          try {
            const grabbed = await grabber.capture(time, grabOptions);
            pending.push(toExportedFrame(grabbed, settings, job.baseName, time, startIndex + i + 1, usedNamesRef.current));
            if (pending.length >= FLUSH_SIZE) flush();
          } catch {
            // 单帧失败（seek 超时 / 解码异常）不中止整批，最后统一提示
            failures += 1;
          }
          setDone(i + 1);
          setFailed(failures);
          setProgress((i + 1) / times.length);
        }

        if (failures > 0 && !cancelRef.current) {
          setError(failures >= times.length ? 'seek' : 'partial');
        }
      } catch {
        if (!cancelRef.current) setError('seek');
      } finally {
        busyRef.current = false;
        // 源已切换（会话已更新）时丢弃这批帧，并回收其预览 URL
        const stale = sessionRef.current !== session;
        if (stale) {
          pending.forEach(frame => URL.revokeObjectURL(frame.url));
          pending = [];
        } else {
          flush();
        }
        setRunning(false);
        setPhase('idle');
        setProgress(0);
        if (!stale) {
          try {
            video.currentTime = Math.min(resumeTime, Math.max(0, (video.duration || 0) - 0.001));
          } catch {
            /* 忽略 seek 失败 */
          }
          if (wasPlaying) video.play().catch(() => undefined);
        }
      }
    },
    [frames.length, getGrabber, probe, running, videoRef],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const removeFrame = useCallback((name: string) => {
    const target = framesRef.current.find(frame => frame.name === name);
    if (target) URL.revokeObjectURL(target.url);
    // 释放文件名，避免后续抽帧被迫追加剧号
    usedNamesRef.current.delete(name);
    setFrames(prev => prev.filter(frame => frame.name !== name));
  }, []);

  const clearFrames = useCallback(() => {
    framesRef.current.forEach(frame => URL.revokeObjectURL(frame.url));
    usedNamesRef.current.clear();
    // 递增会话号：即使有任务仍在运行，也会丢弃它的后续结果
    sessionRef.current += 1;
    setFrames([]);
  }, []);

  return {
    frames,
    running,
    phase,
    progress,
    done,
    total,
    failed,
    error,
    captureCurrent,
    run,
    cancel,
    removeFrame,
    clearFrames,
  };
}
