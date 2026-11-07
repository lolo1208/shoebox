/**
 * 编码识别：根据输入形态猜测它更像哪种编码，仅用于界面提示，不参与实际计算。
 */

import type { CodecFamily } from './types';
import { stripDataUrlPrefix } from './base64';

/** Base64 文本（含换行的 MIME 形式） */
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
/** Base64 URL Safe 文本，必须带 `-` 或 `_` 才能与标准表区分 */
const BASE64_URL_RE = /^[A-Za-z0-9\-_]+={0,2}$/;
/** Base32 标准表：大写字母 A-Z 与数字 2-7 */
const BASE32_RE = /^[A-Z2-7]+=*$/;
/** 命中至少一处 %XX */
const PERCENT_RE = /%[0-9A-Fa-f]{2}/;

/** Base32 去掉填充后的合法长度模 8 */
const BASE32_REMAINDERS = [0, 2, 4, 5, 7];

/** 猜测输入所属编码族，无法判断时返回 null */
export function suggestCodec(input: string): CodecFamily | null {
  // data: URL 的主体部分才是真正的编码数据
  const flat = stripDataUrlPrefix(input).text.replace(/\s+/g, '');
  if (flat.length < 6) return null;

  if (PERCENT_RE.test(flat) && !/[\u4e00-\u9fa5]/.test(flat)) return 'url';
  if (BASE64_URL_RE.test(flat) && /[-_]/.test(flat)) return 'base64';

  if (BASE32_RE.test(flat) && /[2-7]/.test(flat)) {
    const bodyLength = flat.replace(/=+$/, '').length;
    if (bodyLength >= 8 && BASE32_REMAINDERS.includes(bodyLength % 8)) return 'base32';
  }

  // 纯小写单词也能通过字符集校验，要求出现大写、数字或填充才算 Base64 特征
  const base64Signal = /[A-Z0-9+/=]/.test(flat);
  if (BASE64_RE.test(flat) && base64Signal && flat.replace(/=+$/, '').length % 4 !== 1) return 'base64';
  return null;
}
