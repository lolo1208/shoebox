/**
 * 文件名处理的通用规则：扩展名剥离、非法字符清洗与重名消解。
 *
 * 抽帧、转 GIF、图片转换等模块都需要同一套规则，
 * 统一放在这里避免同一策略在多处漂移。
 */

/** Windows / POSIX 均不允许出现在文件名中的字符 */
const ILLEGAL_CHARS = /[\\/:*?"<>|\u0000-\u001f]/g;

/** 清洗后文件名主部的最大长度，留出扩展名空间 */
const MAX_STEM_LENGTH = 120;

/** 去掉扩展名的文件名主部；以点开头的隐藏文件名保持不变 */
export function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

/**
 * 清洗文件名主部：替换非法字符、压缩空白、去掉结尾的点与空格并截断。
 * `fallback` 在清洗后为空时使用。
 */
export function sanitizeFileName(input: string, fallback = 'file'): string {
  const cleaned = input
    .replace(ILLEGAL_CHARS, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return cleaned.length > 0 ? cleaned.slice(0, MAX_STEM_LENGTH) : fallback;
}

/**
 * 消解同名文件：重复项追加 `(2)`、`(3)`… 序号。
 * 批量导出（ZIP、多页文档）时用它保证不互相覆盖。
 */
export function dedupeFileNames(names: readonly string[]): string[] {
  const used = new Set<string>();

  return names.map(name => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }

    const stem = stripExtension(name);
    const extension = name.slice(stem.length);
    let index = 2;
    let candidate = `${stem}(${index})${extension}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${stem}(${index})${extension}`;
    }
    used.add(candidate);
    return candidate;
  });
}
