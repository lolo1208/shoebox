/**
 * 视频转 GIF 的默认值与可调范围。
 *
 * 数值上限按「浏览器内 WebAssembly 编码」的实际情况设定：
 * GIF 单帧最多 256 色，超过 30 fps 的画面流畅度收益极低，体积却线性增长。
 */

import type { GifDither, GifSettings } from './types';

/* --------------------------------- 帧率 --------------------------------- */

export const FPS_MIN = 1;
export const FPS_MAX = 30;

/** 帧率快捷值 */
export const FPS_OPTIONS = [8, 10, 12, 15, 20, 24] as const;

/* --------------------------------- 尺寸 --------------------------------- */

/** 宽度快捷值，0 表示保持原始尺寸 */
export const WIDTH_OPTIONS = [0, 240, 320, 480, 640] as const;

export const WIDTH_MIN = 64;
export const WIDTH_MAX = 1920;

/* -------------------------------- 调色板 -------------------------------- */

export const COLORS_MIN = 2;
export const COLORS_MAX = 256;

/** 颜色数快捷值 */
export const COLOR_OPTIONS = [256, 128, 64, 32] as const;

/** 抖动算法（顺序即 UI 展示顺序，首项为默认推荐值） */
export const DITHER_OPTIONS: GifDither[] = ['sierra2_4a', 'bayer', 'floyd_steinberg', 'none'];

/* -------------------------------- 循环与速度 ------------------------------ */

/** 无限循环（gif muxer 的 -loop 0） */
export const LOOP_INFINITE = 0;
/** 只播放一次（gif muxer 的 -loop -1） */
export const LOOP_ONCE = -1;
/** 循环次数快捷值 */
export const LOOP_OPTIONS = [LOOP_INFINITE, LOOP_ONCE, 3, 5] as const;

export const SPEED_MIN = 0.25;
export const SPEED_MAX = 4;
export const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const;

/* -------------------------------- 软性上限 -------------------------------- */

/** 单段最少截取时长（秒），避免 0 时长导致滤镜链报错 */
export const MIN_CLIP_DURATION = 0.1;

/** 超过推荐帧数时提示用户缩短区间或降低帧率 */
export const SOFT_MAX_FRAMES = 600;

/** 超过推荐体积时提示（WebAssembly 编码大文件耗时明显） */
export const SOFT_MAX_BYTES = 25 * 1024 * 1024;

/** 超过推荐时长时提示 */
export const SOFT_MAX_DURATION = 60;

/* --------------------------------- 默认值 -------------------------------- */

/** 默认导出设置：整段视频、12 fps、480px 宽、无限循环、全局调色板 */
export const DEFAULT_GIF_SETTINGS: GifSettings = {
  start: 0,
  end: 0,
  fps: 12,
  width: 480,
  speed: 1,
  colors: COLORS_MAX,
  dither: 'sierra2_4a',
  loop: LOOP_INFINITE,
  mode: 'palette',
};

/* --------------------------------- 引擎 --------------------------------- */

/**
 * ffmpeg.wasm 核心的 CDN 地址（单线程核心，无需 SharedArrayBuffer）。
 * 按顺序尝试，首个可用镜像生效；升级核心时同步修改版本号。
 */
export const FFMPEG_CORE_MIRRORS = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
] as const;
