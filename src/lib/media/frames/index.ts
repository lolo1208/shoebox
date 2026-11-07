/**
 * 视频抽帧公共 API。
 *
 * - plan    时间点规划（等间隔 / 均分 / 场景采样）
 * - grab    <video> + <canvas> 逐帧抓取与编码
 * - scene   画面差异检测与场景切换筛选
 * - probe   时长 / 分辨率 / 帧率探测
 * - naming  文件名模板与时间码
 * - export  单张下载与 ZIP 打包
 */
export { DEFAULT_FPS, MAX_FRAMES, MAX_SCENE_SAMPLES, MIN_INTERVAL, normalizeRange, planFrames, predictFrameCount } from './plan';
export { FrameGrabber, canvasToBlob, isFormatSupported, isVideoFile } from './grab';
export { detectSceneChanges } from './scene';
export { downloadFrame, downloadFramesAsZip, buildZipName } from './export';
export {
  DEFAULT_FRAME_TEMPLATE,
  FRAME_FORMAT_EXT,
  FRAME_FORMAT_MIME,
  FRAME_NAME_TOKENS,
  buildFrameFileName,
  formatClock,
  formatTimecode,
  sanitizeFileName,
  stripExtension,
} from './naming';
export { estimateFrameRate, readProbe, resolveFps } from './probe';
export type { FrameRateProbeOptions } from './probe';
export type { SceneScanOptions } from './scene';
export type {
  CaptureMode,
  ExportedFrame,
  FrameFormat,
  GrabOptions,
  GrabbedFrame,
  NamingOptions,
  PlanOptions,
  PlanResult,
  VideoProbe,
} from './types';
