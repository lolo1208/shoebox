/**
 * 图片转换的错误类型。
 *
 * UI 只依赖 code 选择文案 key（img_conv.error.*），
 * 具体 message 留给控制台排查。
 */

import type { ExportHandlers } from './types';

export type ConversionErrorCode = 'decode' | 'encode' | 'empty' | 'pdf' | 'cancelled';

export class ConversionError extends Error {
  readonly code: ConversionErrorCode;

  constructor(code: ConversionErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ConversionError';
    this.code = code;
  }
}

/**
 * 长任务的分段检查点：每处理完一项图片就询问一次是否已取消。
 * 取消以异常形式抛出，调用方按 code 区分「用户取消」与「真正的失败」。
 */
export function abortIfCancelled(handlers?: ExportHandlers): void {
  if (handlers?.shouldCancel?.()) throw new ConversionError('cancelled');
}
