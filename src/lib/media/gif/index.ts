/**
 * 视频转 GIF 逻辑层统一出口。
 *
 * 分层：
 * - types      数据形状
 * - constants  默认值与可调范围
 * - plan       设置归一化、输出尺寸/帧数/体积估算
 * - command    ffmpeg 滤镜链与参数构建（纯函数）
 * - naming     文件名
 * - source     源视频校验与探测
 * - engine     ffmpeg.wasm 执行与取消
 */

export {
  COLORS_MAX,
  COLORS_MIN,
  COLOR_OPTIONS,
  DEFAULT_GIF_SETTINGS,
  DITHER_OPTIONS,
  FFMPEG_CORE_MIRRORS,
  FPS_MAX,
  FPS_MIN,
  FPS_OPTIONS,
  LOOP_INFINITE,
  LOOP_ONCE,
  LOOP_OPTIONS,
  MIN_CLIP_DURATION,
  SOFT_MAX_BYTES,
  SOFT_MAX_DURATION,
  SOFT_MAX_FRAMES,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_OPTIONS,
  WIDTH_MAX,
  WIDTH_MIN,
  WIDTH_OPTIONS,
} from './constants';
export {
  buildGifPlan,
  buildSignature,
  estimateBytes,
  estimateFrames,
  normalizeSettings,
  resolveOutputSize,
} from './plan';
export {
  buildGifCommand,
  buildPaletteGraph,
  buildPlainGraph,
  buildRateFilter,
  buildScaleFilter,
} from './command';
export { buildGifFileName, sanitizeName, stripExtension } from './naming';
export { fileExtension, isVideoFile, readSourceInfo } from './source';
export { GifEngine, GifEngineError } from './engine';
export type {
  GifCommand,
  GifConvertHandlers,
  GifDither,
  GifErrorCode,
  GifMode,
  GifPhase,
  GifPlan,
  GifResult,
  GifSettings,
  GifSourceInfo,
} from './types';
