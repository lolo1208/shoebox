import type { CaptureMode, FrameFormat } from '@/lib/media/frames';

/** 抽帧面板的全部可调参数 */
export interface CaptureSettings {
  /** 抽帧模式 */
  mode: CaptureMode;
  /** interval 模式：采样间隔（秒） */
  interval: number;
  /** scene 模式：密集采样步长（秒） */
  sceneStep: number;
  /** count 模式：目标帧数 */
  count: number;
  /** 区间起点（秒） */
  start: number;
  /** 区间终点（秒） */
  end: number;
  /** 场景模式：差异阈值（0–100） */
  threshold: number;
  /** 场景模式：两帧之间的最小间隔（秒） */
  minGap: number;
  /** 输出格式 */
  format: FrameFormat;
  /** jpeg / webp 质量（0–1） */
  quality: number;
  /** 最长边上限（像素，0 = 原始尺寸） */
  maxSize: number;
  /** 文件名模板 */
  template: string;
  /** 序号补零位数 */
  digits: number;
}

/** 面板默认值：1 秒 1 帧、JPEG 0.92、原始尺寸 */
export const DEFAULT_SETTINGS: CaptureSettings = {
  mode: 'interval',
  interval: 1,
  sceneStep: 1,
  count: 10,
  start: 0,
  end: 0,
  threshold: 12,
  minGap: 0.4,
  format: 'jpeg',
  quality: 0.92,
  maxSize: 0,
  template: '{name}_{index}',
  digits: 3,
};

/** 间隔模式快捷值（秒） */
export const INTERVAL_PRESETS = [0.5, 1, 2, 5, 10] as const;

/** 最长边候选值（0 表示不缩放） */
export const MAX_SIZE_OPTIONS = [0, 2560, 1920, 1280, 854] as const;

/** 输出格式顺序（webp 不受支持时会自动隐藏） */
export const FORMAT_OPTIONS: FrameFormat[] = ['jpeg', 'png', 'webp'];

/** 格式按钮文案 */
export const FORMAT_LABELS: Record<FrameFormat, string> = {
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
};

/** 帧数滑杆范围 */
export const COUNT_MIN = 1;
export const COUNT_MAX = 200;

/** 场景阈值滑杆范围 */
export const THRESHOLD_MIN = 2;
export const THRESHOLD_MAX = 60;
