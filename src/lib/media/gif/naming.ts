/**
 * 视频转 GIF 的文件命名：扩展名剥离、非法字符清洗与下载文件名生成。
 */

/** Windows / POSIX 均不允许的文件名字符 */
const ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** 清洗后的文件名主部最大长度 */
const MAX_STEM_LENGTH = 120;

/** 去掉扩展名的文件名主部 */
export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/** 清洗文件名主部：替换非法字符、压缩空白、去掉结尾的点与空格并截断 */
export function sanitizeName(input: string, fallback = 'animation'): string {
  const cleaned = input
    .replace(ILLEGAL_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned.length > 0 ? cleaned.slice(0, MAX_STEM_LENGTH) : fallback;
}

/**
 * 生成下载文件名（`<源文件名>.gif`）。
 * 传入的 baseName 应为已去掉扩展名的主部。
 */
export function buildGifFileName(baseName: string): string {
  return `${sanitizeName(baseName)}.gif`;
}
