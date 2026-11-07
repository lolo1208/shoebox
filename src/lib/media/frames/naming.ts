/**
 * 抽帧结果的文件命名：模板渲染、时间码格式化与非法字符清洗。
 */

import type { FrameFormat, NamingOptions } from './types';

/** 默认模板：{name}_{index} */
export const DEFAULT_FRAME_TEMPLATE = '{name}_{index}';

/** 模板支持的占位符，供 UI 展示提示 */
export const FRAME_NAME_TOKENS = ['{name}', '{index}', '{time}', '{sec}', '{w}', '{h}'] as const;

/** Windows / POSIX 均不允许的文件名字符 */
const ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

export const FRAME_FORMAT_EXT: Record<FrameFormat, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
};

export const FRAME_FORMAT_MIME: Record<FrameFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

/** 清洗文件名片段（保留扩展名分隔符由调用方处理） */
export function sanitizeFileName(input: string): string {
  const cleaned = input.replace(ILLEGAL_CHARS, '_').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'frame';
}

/** 秒 → 文件安全的时间码 HH-MM-SS-mmm */
export function formatTimecode(seconds: number): string {
  const totalMs = Math.max(0, Math.round(seconds * 1000));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(h)}-${pad(m)}-${pad(s)}-${pad(ms, 3)}`;
}

/** 秒 → 便于阅读的时间码 HH:MM:SS.mmm */
export function formatClock(seconds: number): string {
  return formatTimecode(seconds).replace(/-(\d{3})$/, '.$1').replace(/-/g, ':');
}

/** 去掉扩展名的文件名主部 */
export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export interface FrameNameContext {
  /** 源文件名主部 */
  base: string;
  /** 1 起始序号 */
  index: number;
  /** 时间点（秒） */
  time: number;
  width: number;
  height: number;
  format: FrameFormat;
}

/** 模板尾部的图片扩展名（导出时会统一追加，避免出现 x.png_001.png 这类叠层） */
const TRAILING_EXT = /\.(png|jpe?g|jfif|webp|bmp|tiff?|gif)$/i;

/**
 * 渲染单帧文件名。
 * - 模板中的扩展名会被去掉，统一由导出格式决定
 * - 模板中若既无 {index} 也无 {time}，会自动补上序号，避免同名覆盖
 */
export function buildFrameFileName(options: NamingOptions, context: FrameNameContext): string {
  const rawTemplate = (options.template.trim() || DEFAULT_FRAME_TEMPLATE).replace(TRAILING_EXT, '');
  const template = rawTemplate.trim() || DEFAULT_FRAME_TEMPLATE;
  const needsIndex = !template.includes('{index}') && !template.includes('{time}');
  const digits = Math.min(Math.max(Math.round(options.digits) || 1, 1), 8);

  const padIndex = String(context.index).padStart(digits, '0');
  const rendered = (needsIndex ? `${template}_{index}` : template)
    .replace(/\{name\}/g, context.base)
    .replace(/\{index\}/g, padIndex)
    .replace(/\{time\}/g, formatTimecode(context.time))
    .replace(/\{sec\}/g, context.time.toFixed(3))
    .replace(/\{w\}/g, String(context.width))
    .replace(/\{h\}/g, String(context.height));

  const ext = FRAME_FORMAT_EXT[context.format];
  // 占位符展开后仍可能以扩展名结尾（如 {name} 自带后缀），再次剔除
  const stem = rendered.toLowerCase().endsWith(`.${ext}`) ? rendered.slice(0, -(ext.length + 1)) : rendered;

  return `${sanitizeFileName(stem)}.${ext}`;
}
