/**
 * PDF 文本与日期。
 *
 * PDF 的字符串字面量只保证 ASCII 可移植；非 ASCII 文本（例如中文标题）
 * 统一写成 UTF-16BE 十六进制串，这是 PDF 1.4 起最通用的做法。
 */

const PLAIN_TEXT = /^[\x20-\x7e]*$/;

/** ASCII 字符串转字面量：(...) 形式，转义反斜杠与括号 */
function toLiteralString(value: string): string {
  return `(${value.replace(/[\\()]/g, match => `\\${match}`)})`;
}

/** UTF-8 文本转 UTF-16BE 十六进制串：<FEFF...> */
function toHexString(value: string): string {
  let hex = 'FEFF';
  for (let index = 0; index < value.length; index += 1) {
    hex += value.charCodeAt(index).toString(16).padStart(4, '0');
  }
  return `<${hex}>`;
}

/** 任意文本 → PDF 字符串对象（自动选择字面量或 UTF-16BE） */
export function toPdfTextString(value: string): string {
  return PLAIN_TEXT.test(value) ? toLiteralString(value) : toHexString(value);
}

const pad = (value: number, size = 2): string => String(value).padStart(size, '0');

/** 生成 PDF 日期字符串：D:YYYYMMDDHHmmSS */
export function formatPdfDate(date: Date): string {
  return (
    `D:${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}
