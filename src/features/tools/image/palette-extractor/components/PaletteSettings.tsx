import React from 'react';
import { Contrast, Droplet, Layers, Sparkles, type LucideIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  SAMPLE_SIZES,
  type PaletteMode,
  type PaletteOptions,
  type PaletteSort,
} from '@/lib/image/palette';
import { MAX_PALETTE_COUNT, MIN_PALETTE_COUNT } from '../constants';

const MODES: { id: PaletteMode; icon: LucideIcon }[] = [
  { id: 'dominant', icon: Layers },
  { id: 'vibrant', icon: Sparkles },
  { id: 'muted', icon: Droplet },
  { id: 'tonal', icon: Contrast },
];

const SORTS: PaletteSort[] = ['share', 'hue', 'lightness'];

interface PaletteSettingsProps {
  options: PaletteOptions;
  onChange: (patch: Partial<PaletteOptions>) => void;
}

const Toggle: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({
  label,
  checked,
  onChange,
}) => (
  <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer select-none">
    <span className="text-sm text-gray-600">{label}</span>
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="w-4 h-4 accent-primary-600"
    />
  </label>
);

/** 提取参数：模式、色数、采样精度、过滤与排序 */
const PaletteSettings: React.FC<PaletteSettingsProps> = ({ options, onChange }) => {
  const { t } = useLanguage();

  const changeMode = (mode: PaletteMode) => {
    // 影调模式本身就是明度阶梯，切过去时同步排序方式
    onChange(mode === 'tonal' ? { mode, sort: 'lightness' } : { mode });
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="font-semibold text-sm text-gray-800">{t('palette.settings')}</span>
      </div>

      <div className="p-4 space-y-5">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">{t('palette.mode')}</p>
          <div className="grid grid-cols-2 gap-2">
            {MODES.map(({ id, icon: Icon }) => {
              const active = options.mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeMode(id)}
                  className={`text-left rounded-lg border p-2.5 transition-colors ${
                    active
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      active ? 'text-primary-700' : 'text-gray-700'
                    }`}
                  >
                    <Icon size={13} />
                    {t(`palette.mode.${id}`)}
                  </span>
                  <span className="block text-[11px] leading-snug text-gray-500 mt-1">
                    {t(`palette.mode.${id}.desc`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">{t('palette.count')}</span>
            <span className="font-mono text-xs text-primary-600">{options.count}</span>
          </div>
          <input
            type="range"
            min={MIN_PALETTE_COUNT}
            max={MAX_PALETTE_COUNT}
            step={1}
            value={options.count}
            onChange={event => onChange({ count: Number(event.target.value) })}
            className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">{t('palette.quality')}</span>
            <span className="text-[11px] text-gray-400">{t('palette.quality_hint')}</span>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
            {SAMPLE_SIZES.map(size => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ maxEdge: size })}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  options.maxEdge === size ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {size}px
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">{t('palette.filters')}</p>
          <Toggle
            label={t('palette.ignore_alpha')}
            checked={options.ignoreTransparent !== false}
            onChange={checked => onChange({ ignoreTransparent: checked })}
          />
          <Toggle
            label={t('palette.ignore_white')}
            checked={options.ignoreNearWhite === true}
            onChange={checked => onChange({ ignoreNearWhite: checked })}
          />
          <Toggle
            label={t('palette.ignore_black')}
            checked={options.ignoreNearBlack === true}
            onChange={checked => onChange({ ignoreNearBlack: checked })}
          />
          <Toggle
            label={t('palette.merge')}
            checked={options.mergeSimilar}
            onChange={checked => onChange({ mergeSimilar: checked })}
          />
          {options.mergeSimilar && (
            <div className="pt-1 pl-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-gray-500">{t('palette.merge_threshold')}</span>
                <span className="font-mono text-[11px] text-primary-600">ΔE {options.mergeThreshold}</span>
              </div>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={options.mergeThreshold}
                onChange={event => onChange({ mergeThreshold: Number(event.target.value) })}
                className="w-full h-1.5 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
              />
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-500 mb-2">{t('palette.sort')}</p>
          <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
            {SORTS.map(sort => (
              <button
                key={sort}
                type="button"
                onClick={() => onChange({ sort })}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
                  options.sort === sort ? 'bg-white shadow text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`palette.sort.${sort}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PaletteSettings;
