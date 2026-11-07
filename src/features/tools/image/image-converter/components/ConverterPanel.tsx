import React from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Segmented } from '@/components/ui/FormField';
import type { ConverterSettings, ConvertTarget, ImageOutputOptions, PdfOutputOptions } from '@/lib/image/convert';
import { TARGET_OPTIONS, optionLabel } from '../constants';
import ImageOptionsSection from './ImageOptionsSection';
import PdfOptionsSection from './PdfOptionsSection';

interface ConverterPanelProps {
  settings: ConverterSettings;
  onTargetChange: (target: ConvertTarget) => void;
  onImageChange: (patch: Partial<ImageOutputOptions>) => void;
  onPdfChange: (patch: Partial<PdfOutputOptions>) => void;
}

const TARGET_ICONS: Record<ConvertTarget, React.ReactNode> = {
  image: <ImageIcon size={13} />,
  pdf: <FileText size={13} />,
};

/** 导出设置：目标类型 + 对应参数面板 */
const ConverterPanel: React.FC<ConverterPanelProps> = ({
  settings,
  onTargetChange,
  onImageChange,
  onPdfChange,
}) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{t('img_conv.panel_title')}</h3>

      <Segmented
        value={settings.target}
        options={TARGET_OPTIONS.map(option => ({
          value: option.value,
          label: optionLabel(option, t),
          icon: TARGET_ICONS[option.value],
        }))}
        onChange={onTargetChange}
      />

      {settings.target === 'image' ? (
        <ImageOptionsSection options={settings.image} onChange={onImageChange} />
      ) : (
        <PdfOptionsSection options={settings.pdf} onChange={onPdfChange} />
      )}
    </div>
  );
};

export default ConverterPanel;
