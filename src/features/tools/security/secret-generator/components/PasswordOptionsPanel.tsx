import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { Field, FIELD_CLASS } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  buildCharset,
  CHARACTER_CLASS_IDS,
  PASSWORD_LENGTH,
  SYMBOL_CHARSETS,
  SYMBOL_SET_IDS,
  type CharacterClassId,
  type PasswordOptions,
} from '@/lib/secret';
import { PASSWORD_LENGTH_CHIPS } from '../constants';
import IntegerInput from './IntegerInput';
import OptionChip from './OptionChip';

const SECTION_LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-gray-400';

/** 类别示例，帮助用户快速对应到具体字符 */
const CLASS_SAMPLE: Record<CharacterClassId, string> = {
  uppercase: 'A-Z',
  lowercase: 'a-z',
  digits: '0-9',
  symbols: '!@#$',
};

const MAX_CUSTOM_LENGTH = 32;

interface CheckLineProps {
  checked: boolean;
  label: string;
  hint: string;
  onChange: (checked: boolean) => void;
}

const CheckLine: React.FC<CheckLineProps> = ({ checked, label, hint, onChange }) => (
  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-gray-50">
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
    />
    <span className="min-w-0">
      <span className="block text-xs font-medium text-gray-700">{label}</span>
      <span className="block text-[11px] leading-relaxed text-gray-400">{hint}</span>
    </span>
  </label>
);

interface PasswordOptionsPanelProps {
  options: PasswordOptions;
  onChange: (patch: Partial<PasswordOptions>) => void;
  onToggleClass: (id: CharacterClassId) => void;
}

/** 密码参数面板：长度、字符类别与高级取样规则 */
const PasswordOptionsPanel: React.FC<PasswordOptionsPanelProps> = ({ options, onChange, onToggleClass }) => {
  const { t } = useLanguage();
  // 不重复模式的可选长度上限由字符集大小决定，提示行需要实时读取
  const charsetSize = useMemo(() => buildCharset(options).size, [options]);

  return (
    <div className="space-y-5">
      <Field
        label={t('secret.password.length')}
        hint={
          options.allowRepeats
            ? t('secret.password.length_hint', { min: PASSWORD_LENGTH.min, max: PASSWORD_LENGTH.max })
            : t('secret.password.length_unique_hint', { max: charsetSize })
        }
      >
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={PASSWORD_LENGTH.min}
            max={PASSWORD_LENGTH.max}
            value={options.length}
            onChange={(event) => onChange({ length: Number(event.target.value) })}
            aria-label={t('secret.password.length')}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-600"
          />
          <div className="w-20 shrink-0">
            <IntegerInput
              value={options.length}
              onChange={(length) => onChange({ length })}
              min={PASSWORD_LENGTH.min}
              max={PASSWORD_LENGTH.max}
              label={t('secret.password.length')}
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PASSWORD_LENGTH_CHIPS.map((length) => (
            <OptionChip key={length} active={options.length === length} onClick={() => onChange({ length })}>
              {length}
            </OptionChip>
          ))}
        </div>
      </Field>

      <div className="space-y-2">
        <span className={SECTION_LABEL}>{t('secret.password.classes')}</span>
        <div className="grid grid-cols-2 gap-2">
          {CHARACTER_CLASS_IDS.map((id) => {
            const checked = options.classes[id];
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 transition-colors ${
                  checked ? 'border-primary-200 bg-primary-50/60' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleClass(id)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-gray-700">{t(`secret.class.${id}`)}</span>
                  <span className="block truncate font-mono text-[10px] text-gray-400">{CLASS_SAMPLE[id]}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {options.classes.symbols && (
        <div className="rounded-lg bg-gray-50 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-gray-600">{t('secret.password.symbol_set')}</span>
            <div className="flex items-center gap-1.5">
              {SYMBOL_SET_IDS.map((id) => (
                <OptionChip key={id} active={options.symbolSet === id} onClick={() => onChange({ symbolSet: id })}>
                  {t(`secret.password.symbol_set_${id}`)}
                </OptionChip>
              ))}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-gray-400">
            {t(`secret.password.symbol_set_${options.symbolSet}_hint`, {
              n: Array.from(SYMBOL_CHARSETS[options.symbolSet]).length,
            })}
          </p>
        </div>
      )}

      <details className="group rounded-lg border border-gray-200">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:text-primary-600">
          {t('secret.password.advanced')}
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        </summary>

        <div className="space-y-1 border-t border-gray-100 p-2.5">
          <CheckLine
            checked={options.requireEachClass}
            label={t('secret.password.require_each')}
            hint={t('secret.password.require_each_hint')}
            onChange={(requireEachClass) => onChange({ requireEachClass })}
          />
          <CheckLine
            checked={options.excludeAmbiguous}
            label={t('secret.password.exclude_ambiguous')}
            hint={t('secret.password.exclude_ambiguous_hint')}
            onChange={(excludeAmbiguous) => onChange({ excludeAmbiguous })}
          />
          <CheckLine
            checked={!options.allowRepeats}
            label={t('secret.password.no_repeats')}
            hint={t('secret.password.no_repeats_hint')}
            onChange={(noRepeats) => onChange({ allowRepeats: !noRepeats })}
          />

          <Field label={t('secret.password.custom')} hint={t('secret.password.custom_hint')}>
            <input
              type="text"
              value={options.customCharacters}
              maxLength={MAX_CUSTOM_LENGTH}
              spellCheck={false}
              onChange={(event) => onChange({ customCharacters: event.target.value })}
              placeholder={t('secret.password.custom_ph')}
              className={`${FIELD_CLASS} font-mono`}
            />
          </Field>
        </div>
      </details>
    </div>
  );
};

export default PasswordOptionsPanel;
