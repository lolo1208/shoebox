/// <reference lib="dom" />
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  parseHex,
  rgbToHex,
  sortPaletteColors,
  type PaletteColor,
  type PaletteOptions,
  type RGB,
} from '@/lib/image/palette';
import { DEFAULT_PALETTE_OPTIONS, normalizePaletteOptions } from './constants';
import ImagePanel from './components/ImagePanel';
import PaletteSettings from './components/PaletteSettings';
import PaletteGrid from './components/PaletteGrid';
import ColorInspector from './components/ColorInspector';
import HarmonyPanel from './components/HarmonyPanel';
import ExportPanel from './components/ExportPanel';
import { useImageSource } from './hooks/useImageSource';
import { usePaletteExtraction } from './hooks/usePaletteExtraction';

/**
 * 图片主色调提取（调色板生成）。
 *
 * 页面只负责状态编排：图片 → 采样 → 量化 → 调色板 → 取色 / 配色 / 导出。
 * 具体算法在 @/lib/image/palette，展示组件在 ./components，状态逻辑在 ./hooks。
 */
const PaletteExtractor: React.FC = () => {
  const { t } = useLanguage();
  const [storedOptions, setStoredOptions] = useLocalStorage<PaletteOptions>(
    'tool-palette-options',
    DEFAULT_PALETTE_OPTIONS,
  );
  // 旧版本数据可能缺字段或越界，统一校正后再使用
  const options = useMemo<PaletteOptions>(() => normalizePaletteOptions(storedOptions), [storedOptions]);

  const { source, errorKey: imageErrorKey, openFile, clear } = useImageSource();
  const { report, status, errorKey: extractionErrorKey } = usePaletteExtraction(source, options);

  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [picked, setPicked] = useState<RGB | null>(null);

  // 排序只影响展示/导出顺序，因此单独在渲染层计算，切换排序不会触发重新分析
  const colors = useMemo(
    () => (report ? sortPaletteColors(report.colors, options.sort) : []),
    [report, options.sort],
  );

  // 结果刷新后，保证选中项仍然存在于调色板中
  useEffect(() => {
    if (!colors.length) {
      setSelectedHex(null);
      return;
    }
    setSelectedHex(previous =>
      previous && colors.some(color => color.hex === previous) ? previous : colors[0].hex,
    );
  }, [colors]);

  // 换图时清掉取色结果，避免残留上一张图的颜色
  useEffect(() => {
    setPicked(null);
  }, [source]);

  const selectedRgb = picked ?? (selectedHex ? parseHex(selectedHex) : null) ?? colors[0]?.rgb ?? null;
  const selectedHexValue = selectedRgb ? rgbToHex(selectedRgb) : null;
  const selectedColor = colors.find(color => color.hex === selectedHexValue) ?? null;
  const pickedHex = picked ? rgbToHex(picked) : null;

  const updateOptions = (patch: Partial<PaletteOptions>) => {
    setStoredOptions(current => ({ ...normalizePaletteOptions(current), ...patch }));
  };

  const handleFile = useCallback((file: File) => void openFile(file), [openFile]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <aside className="w-full lg:w-80 shrink-0 space-y-4">
        <ImagePanel
          source={source}
          errorKey={imageErrorKey}
          onFile={handleFile}
          onClear={clear}
          onPick={setPicked}
        />
        <PaletteSettings options={options} onChange={updateOptions} />
      </aside>

      <div className="flex-1 min-w-0 space-y-4">
        <PaletteGrid
          report={report}
          colors={colors}
          requestedCount={options.count}
          status={status}
          mode={options.mode}
          selectedHex={selectedHexValue}
          pickedHex={pickedHex}
          errorKey={extractionErrorKey}
          onSelect={(color: PaletteColor) => {
            setPicked(null);
            setSelectedHex(color.hex);
          }}
        />

        <ColorInspector
          rgb={selectedRgb}
          share={selectedColor?.share ?? null}
          picked={picked !== null}
          onManualChange={hex => {
            const rgb = parseHex(hex);
            if (rgb) setPicked(rgb);
          }}
          onClearPick={() => setPicked(null)}
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <HarmonyPanel base={selectedRgb} />
          <ExportPanel colors={colors} />
        </div>

        <p className="text-[11px] leading-relaxed text-gray-400">{t('palette.footnote')}</p>
      </div>
    </div>
  );
};

export default PaletteExtractor;
