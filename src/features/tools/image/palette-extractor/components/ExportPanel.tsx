import React, { useMemo, useState } from 'react';
import { Download, FileImage } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import CopyButton from '@/components/ui/CopyButton';
import {
  DEFAULT_FORMAT_OPTIONS,
  PALETTE_FORMATS,
  buildPaletteText,
  renderSwatchSheet,
  type PaletteColor,
} from '@/lib/image/palette';
import { downloadBlob } from '@/lib/download';

interface ExportPanelProps {
  colors: PaletteColor[];
}

/** 调色板导出：CSS / Tailwind / JSON / 设计软件色板 / SVG / PNG 色卡 */
const ExportPanel: React.FC<ExportPanelProps> = ({ colors }) => {
  const { t } = useLanguage();
  const [formatId, setFormatId] = useState('css');
  const [prefix, setPrefix] = useState(DEFAULT_FORMAT_OPTIONS.prefix);
  const [uppercase, setUppercase] = useState(DEFAULT_FORMAT_OPTIONS.uppercase);

  const empty = colors.length === 0;

  // 变量前缀只保留安全字符，避免导出无法解析的 CSS 变量名
  const safePrefix = useMemo(() => {
    const cleaned = prefix.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned || DEFAULT_FORMAT_OPTIONS.prefix;
  }, [prefix]);

  const text = useMemo(
    () => (empty ? '' : buildPaletteText(formatId, colors, { prefix: safePrefix, uppercase })),
    [formatId, colors, safePrefix, uppercase, empty],
  );

  const activeFormat = PALETTE_FORMATS.find(item => item.id === formatId) || PALETTE_FORMATS[0];

  const downloadText = () => {
    if (empty) return;
    downloadBlob(
      new Blob([text], { type: `${activeFormat.mime};charset=utf-8` }),
      `palette.${activeFormat.extension}`,
    );
  };

  const downloadPng = () => {
    if (empty) return;
    const canvas = renderSwatchSheet(colors);
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, 'palette.png');
    }, 'image/png');
  };

  return (
    <section className="bg-white border border-gray-200 rounded-xl">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-sm text-gray-800">{t('palette.export')}</h2>
        <p className="text-[11px] text-gray-400 mt-0.5">{t('palette.export_hint')}</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_FORMATS.map(format => (
            <button
              key={format.id}
              type="button"
              disabled={empty}
              onClick={() => setFormatId(format.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                formatId === format.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t(format.labelKey)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
            {t('palette.prefix')}
            <input
              value={prefix}
              onChange={event => setPrefix(event.target.value)}
              spellCheck={false}
              className="w-24 px-2 py-1 rounded-lg border border-gray-200 font-mono text-[11px] text-gray-700 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={uppercase}
              onChange={event => setUppercase(event.target.checked)}
              className="w-3.5 h-3.5 accent-primary-600"
            />
            {t('palette.uppercase')}
          </label>
        </div>

        <pre className="max-h-56 overflow-auto rounded-lg bg-gray-50 border border-gray-100 p-3 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre">
          {empty ? t('palette.empty') : text}
        </pre>

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            text={text}
            label={t('common.copy')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all ${
              empty ? 'opacity-40 pointer-events-none' : ''
            }`}
          />
          <button
            type="button"
            onClick={downloadText}
            disabled={empty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={13} />
            {t('palette.download', { ext: activeFormat.extension })}
          </button>
          <button
            type="button"
            onClick={downloadPng}
            disabled={empty}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileImage size={13} />
            {t('palette.download_png')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default ExportPanel;
