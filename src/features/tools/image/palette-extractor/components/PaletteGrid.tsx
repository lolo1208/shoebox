import React from 'react';
import { Loader2, Palette as PaletteIcon, Pipette } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type { PaletteColor, PaletteMode, PaletteReport } from '@/lib/image/palette';
import type { ExtractionStatus } from '../hooks/usePaletteExtraction';

interface PaletteGridProps {
  report: PaletteReport | null;
  /** 已按当前排序方式排好的调色板颜色 */
  colors: PaletteColor[];
  /** 用户期望的颜色数量，用于提示实际颜色更少的情况 */
  requestedCount: number;
  status: ExtractionStatus;
  mode: PaletteMode;
  selectedHex: string | null;
  pickedHex: string | null;
  errorKey?: string | null;
  onSelect: (color: PaletteColor) => void;
}

/** 调色板结果：色块网格 + 平均色 */
const PaletteGrid: React.FC<PaletteGridProps> = ({
  report,
  colors,
  requestedCount,
  status,
  mode,
  selectedHex,
  pickedHex,
  errorKey,
  onSelect,
}) => {
  const { t } = useLanguage();

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm text-gray-800 flex items-center gap-2">
            {t('palette.result')}
            {status === 'working' && <Loader2 size={14} className="animate-spin text-primary-500" />}
          </h2>
          {report && report.totalPixels > 0 && (
            <p className="text-[11px] text-gray-400 mt-0.5 font-mono">
              {report.filteredPixels > 0
                ? t('palette.summary_filtered', {
                    mode: t(`palette.mode.${mode}`),
                    count: colors.length,
                    width: report.width,
                    height: report.height,
                    filtered: report.filteredPixels,
                  })
                : t('palette.summary', {
                    mode: t(`palette.mode.${mode}`),
                    count: colors.length,
                    width: report.width,
                    height: report.height,
                    pixels: report.totalPixels,
                  })}
            </p>
          )}
        </div>

        {report?.average && (
          <button
            type="button"
            onClick={() => onSelect(report.average as PaletteColor)}
            className={`group inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border transition-colors ${
              selectedHex === report.average.hex
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
            }`}
            title={t('palette.average')}
            aria-label={`${t('palette.average')} ${report.average.hex}`}
          >
            <span
              className="w-6 h-6 rounded-full border border-black/10"
              style={{ backgroundColor: report.average.hex }}
            />
            <span className="text-left leading-tight">
              <span className="block text-[10px] text-gray-500">{t('palette.average')}</span>
              <span className="block font-mono text-[11px] text-gray-700">
                {report.average.hex.toUpperCase()}
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="p-4">
        {colors.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-gray-400">
            {status === 'working' ? (
              <Loader2 size={36} className="animate-spin mb-3 opacity-40" />
            ) : (
              <PaletteIcon size={40} className="mb-3 opacity-20" />
            )}
            <p className="text-sm">
              {status === 'working'
                ? t('palette.working')
                : errorKey
                  ? t(errorKey)
                  : t('palette.empty')}
            </p>
            {status !== 'working' && !errorKey && (
              <p className="text-xs mt-1 max-w-xs">{t('palette.empty_note')}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
            {colors.map(color => {
              const active = selectedHex === color.hex;
              return (
                <button
                  key={color.hex}
                  type="button"
                  onClick={() => onSelect(color)}
                  className={`group text-left rounded-xl overflow-hidden border transition-all ${
                    active
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <span className="block h-16 relative" style={{ backgroundColor: color.hex }}>
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-white/90 ring-2 ring-primary-500" />
                    )}
                  </span>
                  <span className="block h-1 bg-gray-100">
                    <span
                      className="block h-full"
                      style={{
                        width: `${Math.max(3, Math.min(100, color.share * 100))}%`,
                        backgroundColor: color.hex,
                      }}
                    />
                  </span>
                  <span className="block px-2 py-1.5">
                    <span className="block font-mono text-[11px] font-semibold text-gray-800">
                      {color.hex.toUpperCase()}
                    </span>
                    <span className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                      <span>{(color.share * 100).toFixed(1)}%</span>
                      <span>{Math.round(color.hsl.h)}°</span>
                    </span>
                  </span>
                </button>
              );
            })}

            {pickedHex && !colors.some(color => color.hex === pickedHex) && (
              <div className="rounded-xl border border-dashed border-primary-300 bg-primary-50/50 p-2 flex flex-col items-center justify-center text-center">
                <Pipette size={14} className="text-primary-500 mb-1" />
                <span className="font-mono text-[11px] font-semibold text-primary-700">
                  {pickedHex.toUpperCase()}
                </span>
                <span className="text-[10px] text-primary-500 leading-tight mt-0.5">{t('palette.picked')}</span>
              </div>
            )}
          </div>
        )}

        {status === 'ready' && colors.length > 0 && colors.length < requestedCount && (
          <p className="mt-3 text-[11px] text-gray-400">
            {t('palette.fewer', { count: colors.length })}
          </p>
        )}
      </div>
    </section>
  );
};

export default PaletteGrid;
