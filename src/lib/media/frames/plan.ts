/**
 * 抽帧时间点规划：把「模式 + 区间 + 参数」换算成一组待抓取的时间点。
 *
 * 纯计算，不接触 <video>，便于独立测试与复用。
 */

import type { PlanOptions, PlanResult } from './types';

/** 单次抽帧的硬上限，避免浏览器内存被大量 canvas 快照拖垮 */
export const MAX_FRAMES = 600;

/** 场景检测的采样点上限（采样点只是候选，最终帧数由 maxFrames 决定） */
export const MAX_SCENE_SAMPLES = 1500;

/** 最小采样间隔（秒），约对应 50fps 的单帧 */
export const MIN_INTERVAL = 0.02;

/** 默认帧率，用于无法探测时的时间轴步进 */
export const DEFAULT_FPS = 30;

const roundTime = (value: number) => Math.round(value * 1000) / 1000;

/** 把区间收敛到合法的 [0, duration] 内 */
export function normalizeRange(start: number, end: number, duration: number): { start: number; end: number } {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  let from = Number.isFinite(start) ? start : 0;
  let to = Number.isFinite(end) ? end : safeDuration;

  from = Math.min(Math.max(from, 0), safeDuration);
  to = Math.min(Math.max(to, 0), safeDuration);
  if (to < from) [from, to] = [to, from];
  if (to - from < 1e-3) to = Math.min(safeDuration, from + 1e-3);

  return { start: from, end: to };
}

/** 区间内按固定间隔采样（含首帧；尾帧仅在命中时纳入） */
function sampleByInterval(start: number, end: number, interval: number, limit: number): { times: number[]; truncated: boolean } {
  const step = Math.max(interval, MIN_INTERVAL);
  const times: number[] = [];
  for (let t = start; t <= end + 1e-6; t += step) {
    times.push(roundTime(t));
    if (times.length >= limit) return { times, truncated: t + step <= end + 1e-6 };
  }
  return { times, truncated: false };
}

/** 区间内均分 count 个时间点（两端对齐） */
function sampleByCount(start: number, end: number, count: number, limit: number): { times: number[]; truncated: boolean } {
  const total = Math.min(Math.max(Math.round(count) || 1, 1), limit);
  if (total === 1) return { times: [roundTime((start + end) / 2)], truncated: false };

  const span = end - start;
  const times = Array.from({ length: total }, (_, i) => roundTime(start + (span * i) / (total - 1)));
  return { times, truncated: Math.round(count) > limit };
}

/** 不做上限截断地估算帧数，用于 UI 提示 */
export function predictFrameCount(options: PlanOptions, maxFrames = MAX_FRAMES): number {
  const { start, end } = normalizeRange(options.start, options.end, options.duration);
  const span = end - start;

  if (options.mode === 'count') {
    return Math.min(Math.max(Math.round(options.count) || 1, 1), maxFrames);
  }

  const step = Math.max(options.interval, MIN_INTERVAL);
  const sampled = options.mode === 'scene' ? Math.min(Math.ceil(span / step) + 1, MAX_SCENE_SAMPLES) : Math.ceil(span / step) + 1;
  return Math.min(sampled, maxFrames);
}

/**
 * 生成抽帧计划。
 * - interval：每 N 秒一帧（限定区间）
 * - count：区间内均分 N 帧
 * - scene：先按 interval 密集采样，再由场景检测筛选真正变化的帧
 */
export function planFrames(options: PlanOptions, maxFrames = MAX_FRAMES): PlanResult {
  const { start, end } = normalizeRange(options.start, options.end, options.duration);

  switch (options.mode) {
    case 'count':
      return sampleByCount(start, end, options.count, maxFrames);
    case 'scene':
      return sampleByInterval(start, end, options.interval, MAX_SCENE_SAMPLES);
    case 'interval':
    default:
      return sampleByInterval(start, end, options.interval, maxFrames);
  }
}
