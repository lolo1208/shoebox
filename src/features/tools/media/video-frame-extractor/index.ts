/**
 * 视频抽帧（截图取帧）模块入口。
 *
 * 工具注册表只依赖本文件；抓帧与规划算法位于 @/lib/media/frames，
 * 展示组件与 hooks 可在本目录内独立演进。
 */
export { default } from './VideoFrameExtractor';
export { DEFAULT_SETTINGS } from './constants';
export type { CaptureSettings } from './constants';
export type { CaptureError, CaptureJob, CapturePhase, FrameCapture } from './hooks/useFrameCapture';
