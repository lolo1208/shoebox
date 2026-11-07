import React from 'react';
import { Field, NumberField } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import { KEY_BYTES, KEY_FORMATS, type KeyFormat, type KeyOptions } from '@/lib/secret';
import { KEY_BYTE_CHIPS, KEY_FORMAT_HINTS } from '../constants';
import OptionChip from './OptionChip';

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';

/** 字节数滑块步长：按常见密钥长度（16 / 32 / 64 字节）对齐 */
const BYTE_STEP = 8;

interface KeyOptionsPanelProps {
  options: KeyOptions;
  onChange: (patch: Partial<KeyOptions>) => void;
}

/** 密钥参数面板：编码格式与随机字节数 */
const KeyOptionsPanel: React.FC<KeyOptionsPanelProps> = ({ options, onChange }) => {
  const { t } = useLanguage();
  const formatHint = KEY_FORMAT_HINTS[options.format];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <span className={SECTION_LABEL}>{t('secret.key.format')}</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {KEY_FORMATS.map((format: KeyFormat) => {
            const active = options.format === format;
            return (
              <button
                key={format}
                type="button"
                onClick={() => onChange({ format })}
                aria-pressed={active}
                className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-primary-500 bg-primary-50 font-medium text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {t(`secret.key.format.${format}`)}
              </button>
            );
          })}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-[11px] leading-relaxed text-gray-400">
          <span>{t(formatHint.hintKey)}</span>
          <span className="text-gray-300">·</span>
          <span>{t('secret.key.sample')}</span>
          <span className="font-mono text-gray-500">{formatHint.sample}</span>
        </p>
      </div>

      <Field label={t('secret.key.bytes')} hint={t('secret.key.bits', { n: options.bytes * 8 })}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={KEY_BYTES.min}
            max={KEY_BYTES.max}
            step={BYTE_STEP}
            value={options.bytes}
            onChange={(event) => onChange({ bytes: Number(event.target.value) })}
            aria-label={t('secret.key.bytes')}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
          />
          <div className="w-20 shrink-0">
            <NumberField
              value={options.bytes}
              onChange={(bytes) => onChange({ bytes })}
              min={KEY_BYTES.min}
              max={KEY_BYTES.max}
              step={BYTE_STEP}
              suffix="B"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {KEY_BYTE_CHIPS.map((bytes) => (
            <OptionChip key={bytes} active={options.bytes === bytes} onClick={() => onChange({ bytes })}>
              {bytes}B
            </OptionChip>
          ))}
        </div>
      </Field>
    </div>
  );
};

export default KeyOptionsPanel;
