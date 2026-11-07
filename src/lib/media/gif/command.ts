/**
 * ffmpeg 命令构建：把导出计划翻译成滤镜链与参数列表。
 *
 * 画质模式使用业界通行的「全局调色板」方案：
 *   1. palettegen 从整段画面统计出 256 色调色板；
 *   2. paletteuse 用该调色板重映射每一帧。
 * 两者放在同一条滤镜图里用 split 分流，只需解码一次即可完成，
 * 相比两遍法速度更快、画质一致。
 *
 * 全部为纯函数，方便单测；不依赖 ffmpeg 运行时。
 */

import type { GifCommand, GifPlan } from './types';

/** ffmpeg 虚拟文件系统中的输出文件名（下载时再改名） */
const OUTPUT_NAME = 'output.gif';

/** 数值格式化：去掉多余的尾随零，避免出现科学计数法 */
function number(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '0';
  const fixed = value.toFixed(digits);
  const trimmed = fixed.replace(/\.?0+$/, '');
  return trimmed === '' || trimmed === '-' ? '0' : trimmed;
}

/** 缩放滤镜：宽度固定、高度按比例对齐偶数；宽度为 0 时不缩放 */
export function buildScaleFilter(width: number): string | null {
  if (!(width > 0)) return null;
  return `scale=${Math.round(width)}:-2:flags=lanczos`;
}

/** 时间滤镜：先按倍率改写时间戳，再重采样到目标帧率 */
export function buildRateFilter(fps: number, speed: number): string {
  const parts: string[] = [];
  if (Math.abs(speed - 1) > 0.001) parts.push(`setpts=PTS/${number(speed, 4)}`);
  parts.push(`fps=${number(fps, 3)}`);
  return parts.join(',');
}

/** 基础链：缩放 + 帧率（顺序即执行顺序） */
function buildBaseChain(plan: GifPlan): string {
  return [buildScaleFilter(plan.scaleWidth), buildRateFilter(plan.fps, plan.speed)]
    .filter((part): part is string => Boolean(part))
    .join(',');
}

/**
 * 全局调色板滤镜图（单次解码）。
 * diff_mode=rectangle 只对发生变化的矩形区域重新量化，动态画面更干净。
 */
export function buildPaletteGraph(plan: GifPlan): string {
  const base = buildBaseChain(plan);
  return [
    `${base},split[palette_in][frames_in]`,
    `[palette_in]palettegen=max_colors=${Math.round(plan.colors)}:stats_mode=diff[palette]`,
    `[frames_in][palette]paletteuse=dither=${plan.dither}:diff_mode=rectangle`,
  ].join(';');
}

/** 直接编码滤镜图：交给 GIF 编码器自行量化，速度快但渐变色带明显 */
export function buildPlainGraph(plan: GifPlan): string {
  return buildBaseChain(plan);
}

export interface BuildCommandOptions {
  /** 跳过调色板滤镜（降级路径或用户选择快速编码时） */
  plain?: boolean;
}

/**
 * 构建一次 GIF 编码命令。
 * -ss / -t 放在 -i 之前：快速定位且只读取所需片段，长视频也能秒开。
 */
export function buildGifCommand(
  plan: GifPlan,
  inputName: string,
  options: BuildCommandOptions = {},
): GifCommand {
  const plain = options.plain ?? plan.mode === 'simple';
  const graph = plain ? buildPlainGraph(plan) : buildPaletteGraph(plan);

  const args: string[] = [
    '-hide_banner',
    '-ss',
    number(plan.start),
    '-t',
    number(plan.duration),
    '-i',
    inputName,
    '-an',
    '-vf',
    graph,
    '-loop',
    String(Math.round(plan.loop)),
    '-f',
    'gif',
    OUTPUT_NAME,
  ];

  return {
    inputName,
    outputName: OUTPUT_NAME,
    args,
    palette: !plain,
  };
}
