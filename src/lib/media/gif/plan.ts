/**
 * 导出计划：把「用户设置 + 源视频信息」换算成可直接执行的参数。
 *
 * 纯计算，不接触 DOM 与 ffmpeg，便于独立测试与复用。
 * 输出宽高、帧数、体积估算与文件名都在这里统一推导，UI 只负责展示。
 */

import {
  COLORS_MAX,
  COLORS_MIN,
  DEFAULT_GIF_SETTINGS,
  DITHER_OPTIONS,
  FPS_MAX,
  FPS_MIN,
  LOOP_INFINITE,
  LOOP_ONCE,
  MIN_CLIP_DURATION,
  SOFT_MAX_BYTES,
  SOFT_MAX_DURATION,
  SOFT_MAX_FRAMES,
  SPEED_MAX,
  SPEED_MIN,
  WIDTH_MAX,
  WIDTH_MIN,
} from './constants';
import { buildGifFileName } from './naming';
import type { GifDither, GifMode, GifPlan, GifSettings, GifSourceInfo } from './types';

/** 单帧像素体积基准（字节/像素）：全局调色板明显优于直接编码 */
const BYTES_PER_PIXEL: Record<GifMode, number> = {
  palette: 0.16,
  simple: 0.26,
};

/** 不同抖动算法对体积的影响（抖动越细腻，压缩率越低） */
const DITHER_WEIGHT: Record<GifDither, number> = {
  sierra2_4a: 1.05,
  bayer: 0.95,
  floyd_steinberg: 1.2,
  none: 0.85,
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);

const round = (value: number, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/** 把边长收敛到偶数，保证与 ffmpeg 的 scale=W:-2 计算结果一致 */
const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

/** 循环次数归一化：只允许无限、一次或有限的额外次数 */
function normalizeLoop(loop: number): number {
  const value = Math.round(toFinite(loop, LOOP_INFINITE));
  if (value === LOOP_INFINITE || value === LOOP_ONCE) return value;
  return clamp(value, 1, 100);
}

/** 归一化设置：收敛区间、帧率、宽度、颜色数等，返回可直接使用的新对象 */
export function normalizeSettings(settings: GifSettings, source: GifSourceInfo | null): GifSettings {
  const total = source && source.duration > 0 ? source.duration : 0;

  let start = Math.max(0, toFinite(settings.start, 0));
  let end = Math.max(0, toFinite(settings.end, total || start + 1));

  if (total > 0) {
    start = Math.min(start, Math.max(0, total - MIN_CLIP_DURATION));
    end = clamp(end, start + MIN_CLIP_DURATION, total);
  } else if (end <= start) {
    // 元数据尚未就绪时仍保证区间合法，避免后续除零
    end = start + 1;
  }

  const width =
    settings.width > 0
      ? Math.round(clamp(toFinite(settings.width, WIDTH_MIN), WIDTH_MIN, WIDTH_MAX))
      : 0;

  return {
    start: round(start, 3),
    end: round(end, 3),
    fps: round(clamp(toFinite(settings.fps, DEFAULT_GIF_SETTINGS.fps), FPS_MIN, FPS_MAX), 1),
    width,
    speed: round(clamp(toFinite(settings.speed, 1), SPEED_MIN, SPEED_MAX), 2),
    colors: Math.round(clamp(toFinite(settings.colors, COLORS_MAX), COLORS_MIN, COLORS_MAX)),
    dither: DITHER_OPTIONS.includes(settings.dither) ? settings.dither : DEFAULT_GIF_SETTINGS.dither,
    loop: normalizeLoop(settings.loop),
    mode: settings.mode === 'simple' ? 'simple' : 'palette',
  };
}

/** 计算输出尺寸：指定宽度时不放大源视频，保持宽高比并把高度对齐到偶数 */
export function resolveOutputSize(
  settings: GifSettings,
  source: GifSourceInfo | null,
): { width: number; height: number } {
  const sourceWidth = source?.width ?? 0;
  const sourceHeight = source?.height ?? 0;

  // 未指定宽度：直接沿用源尺寸，不做缩放（也避免奇数边被凑成偶数后反而放大）
  if (!(settings.width > 0)) return { width: sourceWidth, height: sourceHeight };

  const width = toEven(sourceWidth > 0 ? Math.min(settings.width, sourceWidth) : settings.width);
  if (sourceWidth <= 0 || sourceHeight <= 0) return { width, height: 0 };

  return { width, height: toEven((width * sourceHeight) / sourceWidth) };
}

/** 预计输出帧数（播放速度会改变实际时长） */
export function estimateFrames(duration: number, fps: number, speed: number): number {
  if (!(duration > 0) || !(fps > 0)) return 0;
  const playbackDuration = duration / Math.max(speed, SPEED_MIN);
  return Math.max(1, Math.round(playbackDuration * fps));
}

/** 估算 GIF 体积（字节）：GIF 只做 LZW 压缩，按像素数 × 经验系数估算 */
export function estimateBytes(
  width: number,
  height: number,
  frames: number,
  colors: number,
  dither: GifDither,
  mode: GifMode,
): number {
  if (width <= 0 || height <= 0 || frames <= 0) return 0;

  // 颜色数越少，调色板索引重复度越高，压缩率越好
  const colorWeight = 0.65 + 0.35 * (clamp(colors, COLORS_MIN, COLORS_MAX) / COLORS_MAX);
  const bytes = width * height * frames * BYTES_PER_PIXEL[mode] * DITHER_WEIGHT[dither] * colorWeight;
  return Math.round(bytes);
}

/** 设置指纹：参数变化后用于判断已生成的结果是否过期 */
export function buildSignature(settings: GifSettings): string {
  return [
    settings.start,
    settings.end,
    settings.fps,
    settings.width,
    settings.speed,
    settings.colors,
    settings.dither,
    settings.loop,
    settings.mode,
  ].join('|');
}

/**
 * 生成导出计划。
 * baseName 为源文件名主部（不含扩展名），用于生成下载文件名。
 */
export function buildGifPlan(
  settings: GifSettings,
  source: GifSourceInfo | null,
  baseName: string,
): GifPlan {
  const normalized = normalizeSettings(settings, source);
  const duration = Math.max(0, round(normalized.end - normalized.start, 3));
  const { width, height } = resolveOutputSize(normalized, source);
  const frames = estimateFrames(duration, normalized.fps, normalized.speed);
  const estimatedBytes = estimateBytes(width, height, frames, normalized.colors, normalized.dither, normalized.mode);

  return {
    signature: buildSignature(normalized),
    start: normalized.start,
    duration,
    speed: normalized.speed,
    fps: normalized.fps,
    width,
    height,
    scaleWidth: normalized.width > 0 ? width : 0,
    frames,
    colors: normalized.colors,
    dither: normalized.dither,
    loop: normalized.loop,
    mode: normalized.mode,
    estimatedBytes,
    fileName: buildGifFileName(baseName),
    heavy:
      frames > SOFT_MAX_FRAMES ||
      estimatedBytes > SOFT_MAX_BYTES ||
      duration > SOFT_MAX_DURATION,
  };
}
