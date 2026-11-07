/**
 * 强度分级与破解耗时估算。
 *
 * 熵（bit）本身对普通用户没有意义，这里把它翻译成两件可判断的事：
 * 强度档位（进度条颜色）与「离线暴力破解平均需要多久」。
 */

export type StrengthLevel = 'weak' | 'fair' | 'strong' | 'excellent';

/** 分级阈值（bit）：低于 weak 视为偏弱，其余依次为一般 / 强 / 极强 */
const STRENGTH_THRESHOLD = { fair: 40, strong: 64, excellent: 100 } as const;

/** 进度条满格对应的熵值 */
const PROGRESS_FULL_BITS = 128;

/** 攻击者每秒可尝试的次数：按离线 GPU 暴力破解的量级估算 */
export const CRACK_GUESSES_PER_SECOND = 1e11;

const LOG10_OF_2 = Math.LOG10E * Math.LN2;

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_MONTH = 2_629_800;
const SECONDS_PER_YEAR = 31_557_600;
/** 低于该值时用普通小数显示，超过后改用科学计数法，避免出现 3e+24 之外的超长字符串 */
const SCIENTIFIC_THRESHOLD = 1e6;

export function classifyStrength(bits: number): StrengthLevel {
  if (bits < STRENGTH_THRESHOLD.fair) return 'weak';
  if (bits < STRENGTH_THRESHOLD.strong) return 'fair';
  if (bits < STRENGTH_THRESHOLD.excellent) return 'strong';
  return 'excellent';
}

/** 进度条填充比例（0–1） */
export function strengthProgress(bits: number): number {
  if (!Number.isFinite(bits) || bits <= 0) return 0;
  return Math.min(bits / PROGRESS_FULL_BITS, 1);
}

export type CrackTimeUnit = 'instant' | 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years';

export interface CrackEstimate {
  /** 以 unit 为单位的数值；unit 为 instant 时无意义 */
  value: number;
  unit: CrackTimeUnit;
}

/**
 * 估算暴力破解耗时：平均需要搜索一半的密钥空间，即 2^(bits-1) 次尝试。
 * 全程用对数运算，避免 2^1024 这类数值溢出。
 */
export function estimateCrackTime(bits: number, guessesPerSecond = CRACK_GUESSES_PER_SECOND): CrackEstimate {
  if (!Number.isFinite(bits) || bits <= 0 || guessesPerSecond <= 0) {
    return { value: 0, unit: 'instant' };
  }

  const log10Seconds = (bits - 1) * LOG10_OF_2 - Math.log10(guessesPerSecond);
  if (log10Seconds < 0) return { value: 0, unit: 'instant' };

  const seconds = 10 ** log10Seconds;
  if (seconds < SECONDS_PER_MINUTE) return { value: seconds, unit: 'seconds' };
  if (seconds < SECONDS_PER_HOUR) return { value: seconds / SECONDS_PER_MINUTE, unit: 'minutes' };
  if (seconds < SECONDS_PER_DAY) return { value: seconds / SECONDS_PER_HOUR, unit: 'hours' };
  if (seconds < SECONDS_PER_MONTH) return { value: seconds / SECONDS_PER_DAY, unit: 'days' };
  if (seconds < SECONDS_PER_YEAR) return { value: seconds / SECONDS_PER_MONTH, unit: 'months' };
  return { value: seconds / SECONDS_PER_YEAR, unit: 'years' };
}

/** 上标数字，用于把科学计数法写得紧凑一些（2.5 × 10¹²） */
const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

function toSuperscript(value: number): string {
  return String(value)
    .split('')
    .map((char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .join('');
}

/** 本地化数字：小数值保留一位小数，中等数值走千分位，超大值写成 2.5 × 10¹² */
export function formatCrackValue(value: number, locale: string): string {
  if (!Number.isFinite(value)) return '—';
  if (value < 10) return value.toFixed(1);
  if (value < SCIENTIFIC_THRESHOLD) return Math.round(value).toLocaleString(locale);

  const [mantissa, exponent] = value.toExponential(1).split('e');
  return `${mantissa} × 10${toSuperscript(Number(exponent))}`;
}
