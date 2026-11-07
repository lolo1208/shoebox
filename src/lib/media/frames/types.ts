/**
 * 视频抽帧（截图取帧）的公共类型。
 *
 * 该模块只描述数据形状，不依赖 React 与 DOM 之外的运行时，
 * 方便被 UI 层（features）与逻辑层（lib）共同引用。
 */

/** 导出图片格式 */
export type FrameFormat = 'png' | 'jpeg' | 'webp';

/** 视频探测结果 */
export interface VideoProbe {
  /** 总时长（秒） */
  duration: number;
  width: number;
  height: number;
  /** 估算帧率，无法获取时为 null（调用方回退到默认值） */
  fps: number | null;
}

/** 抽帧模式 */
export type CaptureMode = 'interval' | 'count' | 'scene';

/** 抽帧计划参数 */
export interface PlanOptions {
  mode: CaptureMode;
  /** 视频总时长（秒） */
  duration: number;
  /** interval / scene 模式的采样间隔（秒） */
  interval: number;
  /** count 模式的目标帧数 */
  count: number;
  /** 区间起点（秒） */
  start: number;
  /** 区间终点（秒） */
  end: number;
}

/** 抽帧计划结果 */
export interface PlanResult {
  /** 待抓取时间点（秒，升序） */
  times: number[];
  /** 是否因帧数上限被截断 */
  truncated: boolean;
}

/** 单帧抓取参数 */
export interface GrabOptions {
  format: FrameFormat;
  /** jpeg / webp 质量，0–1（png 忽略） */
  quality: number;
  /** 最长边像素上限，0 表示保持原始尺寸 */
  maxSize: number;
}

/** 单帧抓取结果 */
export interface GrabbedFrame {
  blob: Blob;
  width: number;
  height: number;
}

/** 已导出的帧（UI 展示与下载使用） */
export interface ExportedFrame {
  /** 带扩展名的文件名 */
  name: string;
  blob: Blob;
  /** 预览用对象 URL（需在移除帧时回收） */
  url: string;
  /** 所在时间点（秒） */
  time: number;
  width: number;
  height: number;
  /** 字节数 */
  size: number;
}

/** 文件命名参数 */
export interface NamingOptions {
  /** 文件名模板，支持 {name} {index} {time} {sec} {w} {h} */
  template: string;
  /** 序号补零位数 */
  digits: number;
}
