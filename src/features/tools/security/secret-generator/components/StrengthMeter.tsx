import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  classifyStrength,
  estimateCrackTime,
  formatCrackValue,
  strengthProgress,
  type StrengthLevel,
} from '@/lib/secret';

const TONE: Record<StrengthLevel, { bar: string; text: string }> = {
  weak: { bar: 'bg-red-500', text: 'text-red-600' },
  fair: { bar: 'bg-amber-500', text: 'text-amber-600' },
  strong: { bar: 'bg-primary-500', text: 'text-primary-600' },
  excellent: { bar: 'bg-emerald-500', text: 'text-emerald-600' },
};

interface StrengthMeterProps {
  /** 单条结果的理论熵（bit） */
  bits: number;
  /** 密码模式的字符集大小，密钥模式传 0 时不展示 */
  charsetSize: number;
}

/** 把熵翻译成强度档位与暴力破解耗时，避免用户直接面对 bit 数 */
const StrengthMeter: React.FC<StrengthMeterProps> = ({ bits, charsetSize }) => {
  const { t, language } = useLanguage();

  const level = classifyStrength(bits);
  const tone = TONE[level];
  const estimate = estimateCrackTime(bits);
  const timeText =
    estimate.unit === 'instant'
      ? t('secret.crack.instant')
      : `${formatCrackValue(estimate.value, language)} ${t(`secret.crack.unit.${estimate.unit}`)}`;

  return (
    <div className="space-y-2 rounded-xl bg-gray-50 p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-gray-600" title={t('secret.entropy_hint')}>
          {t('secret.entropy')}
        </span>
        <span className="font-mono text-xs tabular-nums text-gray-800">{t('secret.entropy_bits', { n: Math.round(bits) })}</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200" role="presentation">
        <div
          className={`h-full rounded-full transition-all duration-300 ${tone.bar}`}
          style={{ width: `${Math.max(strengthProgress(bits) * 100, 4)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[11px]">
        <span className={`font-medium ${tone.text}`}>{t(`secret.strength.${level}`)}</span>
        <span className="text-gray-400" title={t('secret.crack_hint')}>
          {t('secret.crack', { time: timeText })}
        </span>
      </div>

      {charsetSize > 0 && (
        <p className="text-[11px] text-gray-400">{t('secret.password.charset_info', { n: charsetSize })}</p>
      )}
    </div>
  );
};

export default StrengthMeter;
