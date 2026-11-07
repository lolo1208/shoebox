/**
 * 视频转 GIF 的文件命名：非法字符清洗与下载文件名生成。
 * 通用规则见 @/lib/fileName。
 */

import { sanitizeFileName } from '@/lib/fileName';

export { stripExtension } from '@/lib/fileName';

/** 清洗文件名主部，空值时回退到 animation */
export function sanitizeName(input: string): string {
  return sanitizeFileName(input, 'animation');
}

/**
 * 生成下载文件名（`<源文件名>.gif`）。
 * 传入的 baseName 应为已去掉扩展名的主部。
 */
export function buildGifFileName(baseName: string): string {
  return `${sanitizeName(baseName)}.gif`;
}
