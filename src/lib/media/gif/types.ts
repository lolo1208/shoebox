/**
 * 视频转 GIF 的公共类型。
 *
 * 该模块只描述数据形状，不依赖 React、DOM 或 ffmpeg 运行时，
 * 便于 UI 层（features）与逻辑层（lib）共同引用，也方便独立测试。
 */

/** 编码模式：全局调色板（palettegen/paletteuse）或直接编码（快速预览） */
export type GifMode = 'palette' | 'simple';

/** 抖动算法，对应 ffmpeg paletteuse 的 dither 参数 */
export type GifDither = 'sierra2_4a' | 'bayer' | 'floyd_steinberg' | 'none';

/** 用户可调的导出设置 */
export interface GifSettings {
  /** 截取起点（秒） */
  start: number;
  /** 截取终点（秒） */
  end: number;
  /** 输出帧率 */
  fps: number;
  /** 输出宽度（像素），0 表示保持原始尺寸 */
  width: number;
  /** 播放速度倍率（1 为原速） */
  speed: number;
  /** 调色板颜色数（GIF 上限 256） */
  colors: number;
  /** 抖动算法 */
  dither: GifDither;
  /** 循环次数：0 无限循环，-1 播放一次，正数为额外循环次数 */
  loop: number;
  /** 编码模式 */
  mode: GifMode;
}

/** 源视频探测结果 */
export interface GifSourceInfo {
  /** 总时长（秒），无法读取时为 0 */
  duration: number;
  width: number;
  height: number;
}

/** 一次导出任务的派生计划（由设置与源信息计算得出） */
export interface GifPlan {
  /** 设置指纹，用于判断结果是否已过期 */
  signature: string;
  /** 截取起点（秒） */
  start: number;
  /** 截取时长（秒，未计播放速度） */
  duration: number;
  /** 播放速度倍率 */
  speed: number;
  fps: number;
  /** 输出宽高（像素，未知时为 0） */
  width: number;
  height: number;
  /** 实际交给 scale 滤镜的宽度（0 表示保持原始尺寸、不缩放） */
  scaleWidth: number;
  /** 预计帧数 */
  frames: number;
  colors: number;
  dither: GifDither;
  loop: number;
  mode: GifMode;
  /** 预计文件体积（字节） */
  estimatedBytes: number;
  /** 下载文件名 */
  fileName: string;
  /** 是否超过推荐的帧数 / 体积 / 时长（仅提示，不阻断） */
  heavy: boolean;
}

/** 待执行的 ffmpeg 命令 */
export interface GifCommand {
  /** ffmpeg 虚拟文件系统中的输入文件名 */
  inputName: string;
  /** ffmpeg 虚拟文件系统中的输出文件名 */
  outputName: string;
  /** 不含可执行文件的参数列表 */
  args: string[];
  /** 是否使用调色板滤镜链 */
  palette: boolean;
}

/** 编码完成的结果 */
export interface GifResult {
  blob: Blob;
  fileName: string;
  signature: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  /** 截取起点（秒） */
  start: number;
  /** 截取时长（秒，未计播放速度） */
  duration: number;
  bytes: number;
  /** 实际耗时（毫秒） */
  elapsedMs: number;
  /** 实际使用的编码模式（调色板滤镜不可用时会降级） */
  mode: GifMode;
  /** 用户请求的编码模式，用于提示是否发生降级 */
  requestedMode: GifMode;
}

/** 编码阶段：加载引擎 → 编码 → 汇总输出 */
export type GifPhase = 'loading' | 'encoding' | 'finalizing';

/** 引擎错误码，UI 据此选择文案 */
export type GifErrorCode = 'load' | 'cancelled' | 'encode' | 'empty';

/** 单次转换的过程回调 */
export interface GifConvertHandlers {
  onPhase?: (phase: GifPhase) => void;
  /** 0–1，单调递增 */
  onProgress?: (ratio: number) => void;
}
