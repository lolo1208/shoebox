/**
 * 生成参数的上下限。
 * UI 控件与算法共用同一份定义，避免两端夹取范围不一致导致「显示 64 却生成 32」。
 */

/** 密码长度（字符） */
export const PASSWORD_LENGTH = { min: 4, max: 128 } as const;

/** 密钥字节数 */
export const KEY_BYTES = { min: 8, max: 128 } as const;

/** 单次生成条数 */
export const SECRET_COUNT = { min: 1, max: 20 } as const;

/** 取整并夹取到 [min, max]，非数字回退到 min */
export function clampInteger(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(Math.max(Math.round(numeric), min), max);
}
