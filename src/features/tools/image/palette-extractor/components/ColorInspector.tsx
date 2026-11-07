import React, { useEffect, useMemo, useState } from 'react';
import { Pipette, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import CopyButton from '@/components/ui/CopyButton';
import {
  BLACK,
  WHITE,
  contrastRatio,
  formatHsl,
  formatLab,
  formatOklch,
  formatRgb,
  parseHex,
  rgbToHex,
  rgbToHsl,
  rgbToLab,
  rgbToOklch,
  type RGB,
} from '@/lib/image/palette';

interface ColorInspectorProps {
  rgb: RGB | null;
  /** 该颜色在画面中的占比（取色时为空） */
  share: number | null;
  picked: boolean;
  onManualChange: (hex: string) => void;
  onClearPick: () => void;
}

const ValueRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
    <span className="w-14 shrink-0 text-[11px] text-gray-400">{label}</span>
    <span className="flex-1 min-w-0 truncate font-mono text-xs text-gray-700" title={value}>
      {value}
    </span>
    <CopyButton text={value} />
  </div>
);

const ContrastBadge: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span
    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
      ok ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'
    }`}
  >
    {label}
  </span>
);

const ContrastRow: React.FC<{ label: string; ratio: number }> = ({ label, ratio }) => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-gray-500">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-gray-700">{ratio.toFixed(2)}:1</span>
        <ContrastBadge ok={ratio >= 4.5} label={t('palette.aa_text')} />
        <ContrastBadge ok={ratio >= 3} label={t('palette.aa_large')} />
        <ContrastBadge ok={ratio >= 7} label={t('palette.aaa_text')} />
      </span>
    </div>
  );
};

/** 选中颜色的详细数值：HEX / RGB / HSL / OKLCH / Lab、WCAG 对比度 */
const ColorInspector: React.FC<ColorInspectorProps> = ({
  rgb,
  share,
  picked,
  onManualChange,
  onClearPick,
}) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');

  const hex = useMemo(() => (rgb ? rgbToHex(rgb) : ''), [rgb]);

  useEffect(() => {
    setDraft(hex);
  }, [hex]);

  const details = useMemo(() => {
    if (!rgb) return null;
    return {
      hex: hex.toUpperCase(),
      rgb: formatRgb(rgb),
      hsl: formatHsl(rgbToHsl(rgb)),
      oklch: formatOklch(rgbToOklch(rgb)),
      lab: formatLab(rgbToLab(rgb)),
      onWhite: contrastRatio(rgb, WHITE),
      onBlack: contrastRatio(rgb, BLACK),
    };
  }, [rgb, hex]);

  const handleDraftChange = (value: string) => {
    setDraft(value);
  };

  // 输入框失焦 / 回车时才提交，避免输入 3 位简写时被立即展开成 6 位
  const commitDraft = () => {
    const parsed = parseHex(draft);
    if (!parsed) {
      setDraft(hex);
      return;
    }
    const next = rgbToHex(parsed);
    setDraft(next);
    if (next !== hex) onManualChange(next);
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-800">{t('palette.selected')}</h2>
        {picked && (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 text-[10px] font-medium">
              <Pipette size={11} />
              {t('palette.picked')}
            </span>
            <button
              type="button"
              onClick={onClearPick}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title={t('palette.clear_pick')}
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {!rgb || !details ? (
        <div className="p-4 text-xs text-gray-400">{t('palette.select_hint')}</div>
      ) : (
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex flex-col gap-2 shrink-0">
            <div
              className="w-full sm:w-28 h-24 sm:h-28 rounded-xl border border-black/10"
              style={{ backgroundColor: hex }}
            />
            {share !== null && (
              <p className="text-[11px] text-gray-500 text-center">
                {t('palette.share')} <span className="font-mono text-gray-700">{(share * 100).toFixed(1)}%</span>
              </p>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={draft}
                onChange={event => handleDraftChange(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={event => {
                  if (event.key === 'Enter') commitDraft();
                }}
                spellCheck={false}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-gray-200 font-mono text-xs text-gray-800 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <input
                type="color"
                value={hex}
                onChange={event => onManualChange(event.target.value)}
                className="w-9 h-9 rounded-lg border border-gray-200 bg-white cursor-pointer shrink-0"
                title={t('palette.pick_color')}
                aria-label={t('palette.pick_color')}
              />
            </div>

            <div>
              <ValueRow label="HEX" value={details.hex} />
              <ValueRow label="RGB" value={details.rgb} />
              <ValueRow label="HSL" value={details.hsl} />
              <ValueRow label="OKLCH" value={details.oklch} />
              <ValueRow label="Lab" value={details.lab} />
            </div>
          </div>

          <div className="sm:w-56 shrink-0 space-y-1.5 sm:border-l sm:border-gray-100 sm:pl-4">
            <p className="text-[11px] font-medium text-gray-500">{t('palette.contrast')}</p>
            <ContrastRow label={t('palette.on_white')} ratio={details.onWhite} />
            <ContrastRow label={t('palette.on_black')} ratio={details.onBlack} />
          </div>
        </div>
      )}
    </section>
  );
};

export default ColorInspector;
