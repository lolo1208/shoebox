/**
 * 视频探测：读取时长 / 分辨率，并尽力估算源帧率。
 *
 * 全部基于浏览器原生 <video>，不上传文件、不依赖 WASM。
 */

import { DEFAULT_FPS } from './plan';
import type { VideoProbe } from './types';

/** 常见帧率，用于把估算值吸附到工业标准值 */
const COMMON_FPS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120, 144];

interface FrameMeta {
  mediaTime: number;
}

type FrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: FrameMeta) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** 读取已加载视频的基础信息（调用前需确保 readyState >= 1） */
export function readProbe(video: HTMLVideoElement): VideoProbe {
  return {
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    width: video.videoWidth,
    height: video.videoHeight,
    fps: null,
  };
}

function snapFps(value: number): number {
  const hit = COMMON_FPS.find(candidate => Math.abs(candidate - value) < 0.6);
  return hit ?? Math.round(value * 100) / 100;
}

/**
 * 用 requestVideoFrameCallback 统计连续帧的 mediaTime 间隔，估算帧率。
 * 需要短暂静音播放，结束后恢复原有播放状态与进度；不支持时返回 null。
 */
/** estimateFrameRate 的可选项 */
export interface FrameRateProbeOptions {
  /** 采样帧数（默认 12） */
  samples?: number;
  /** 采集超时（默认 1500ms） */
  timeoutMs?: number;
  /** 返回 true 时放弃恢复播放状态（源已切换时避免污染新视频） */
  shouldAbort?: () => boolean;
}

/**
 * 用 requestVideoFrameCallback 统计连续帧的 mediaTime 间隔，估算帧率。
 * 需要短暂静音播放，结束后恢复原有播放状态与进度；不支持时返回 null。
 */
export async function estimateFrameRate(
  video: HTMLVideoElement,
  options: FrameRateProbeOptions = {},
): Promise<number | null> {
  const { samples = 12, timeoutMs = 1500, shouldAbort } = options;
  const target = video as FrameCallbackVideo;
  if (typeof target.requestVideoFrameCallback !== 'function') return null;
  if (!Number.isFinite(video.duration) || video.duration <= 0) return null;

  const originalTime = video.currentTime;
  const originalMuted = video.muted;
  const shouldResume = !video.paused && !shouldAbort?.();
  const marks: number[] = [];

  const collected = new Promise<number[] | null>(resolve => {
    let handle = 0;
    let settled = false;
    const finish = (result: number[] | null) => {
      if (settled) return;
      settled = true;
      if (handle && typeof target.cancelVideoFrameCallback === 'function') target.cancelVideoFrameCallback(handle);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish(marks.length > 3 ? marks : null), timeoutMs);
    const onFrame = (_now: number, metadata: FrameMeta) => {
      if (settled) return;
      marks.push(metadata.mediaTime);
      if (marks.length >= samples + 1) {
        window.clearTimeout(timer);
        finish(marks);
        return;
      }
      handle = target.requestVideoFrameCallback!(onFrame);
    };
    handle = target.requestVideoFrameCallback!(onFrame);
  });

  video.muted = true;
  try {
    await video.play();
  } catch {
    /* 自动播放被拦截时仍可能拿到少量回调，继续等待结果 */
  }

  const marks2 = await collected;

  // 源已切换（或组件已卸载）时不再触碰播放状态，否则会打断新视频的探测/播放
  if (shouldAbort?.()) {
    video.muted = originalMuted;
    return null;
  }

  video.pause();
  video.muted = originalMuted;
  try {
    video.currentTime = originalTime;
  } catch {
    /* 忽略 seek 失败 */
  }
  if (shouldResume) video.play().catch(() => undefined);

  if (!marks2 || marks2.length < 3) return null;

  const deltas = marks2
    .slice(1)
    .map((value, index) => value - marks2[index])
    .filter(delta => delta > 0.0005)
    .sort((a, b) => a - b);

  if (deltas.length === 0) return null;
  const median = deltas[Math.floor(deltas.length / 2)];
  const fps = 1 / median;
  if (!Number.isFinite(fps) || fps < 1 || fps > 480) return null;

  return snapFps(fps);
}

/** 探测帧率失败时的回退值 */
export function resolveFps(probe: VideoProbe | null): number {
  return probe?.fps && probe.fps > 0 ? probe.fps : DEFAULT_FPS;
}
