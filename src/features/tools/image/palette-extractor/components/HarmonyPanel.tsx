import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import {
  HARMONY_TYPES,
  buildHarmony,
  buildRamp,
  type HarmonyColor,
  type HarmonyType,
  type RGB,
} from '@/lib/image/palette';

interface HarmonyPanelProps {
  base: RGB | null;
}

const rampSteps = 9;

/** 由选中色派生和谐配色与明暗梯度，点击色块直接复制 HEX */
const HarmonyPanel: React.FC<HarmonyPanelProps> = ({ base }) => {
  const { t } = useLanguage();
  const { copy, isCopied } = useClipboard(1200);
  const [type, setType] = useState<HarmonyType>('complementary');

  const colors = useMemo(() => (base ? buildHarmony(base, type) : []), [base, type]);
  const ramp = useMemo(() => (base ? buildRamp(base, rampSteps) : []), [base]);

  const label = (color: HarmonyColor) => {
    if (type === 'monochrome') return `${Math.round(color.hsl.l * 100)}%`;
    if (!color.offset) return '0°';
    return `${color.offset > 0 ? '+' : ''}${color.offset}°`;
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-800">{t('palette.harmony')}</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">{t('palette.harmony_hint')}</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {HARMONY_TYPES.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setType(item)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                type === item
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t(`palette.harmony.${item}`)}
            </button>
          ))}
        </div>

        {!base ? (
          <p className="text-xs text-gray-400">{t('palette.select_hint')}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {colors.map(color => {
                const copied = isCopied(color.hex);
                return (
                  <button
                    key={`${color.hex}-${color.offset}`}
                    type="button"
                    onClick={() => void copy(color.hex, color.hex)}
                    className="group relative rounded-lg overflow-hidden border border-black/5 text-left"
                    title={`${color.hex} · ${t('common.copy')}`}
                  >
                    <span className="block h-16 relative" style={{ backgroundColor: color.hex }}>
                      {copied && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <Check size={18} className="text-white" />
                        </span>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-1 px-2 py-1 bg-white">
                      <span className="font-mono text-[10px] text-gray-700">{color.hex.toUpperCase()}</span>
                      <span className="font-mono text-[10px] text-gray-400">{label(color)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <p className="text-[11px] font-medium text-gray-500 mb-1.5">{t('palette.ramp')}</p>
              <div className="flex rounded-lg overflow-hidden border border-black/5">
                {ramp.map(color => (
                  <button
                    key={color.hex}
                    type="button"
                    onClick={() => void copy(color.hex, color.hex)}
                    className="relative flex-1 h-9 group"
                    style={{ backgroundColor: color.hex }}
                    title={`${color.hex} · L ${Math.round(color.hsl.l * 100)}%`}
                  >
                    {isCopied(color.hex) && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Check size={13} className="text-white" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default HarmonyPanel;
