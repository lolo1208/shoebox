import React from 'react';
import { Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Field, Segmented } from '@/components/ui/FormField';
import {
  PNG_COLORS_MAX,
  PNG_COLORS_MIN,
  PNG_COLORS_STEP,
  QUALITY_MAX,
  QUALITY_MIN,
  QUALITY_STEP,
  type ImageOutputOptions,
} from '@/lib/image/convert';
import { FORMAT_OPTIONS, optionLabel } from '../constants';
import RangeField from './RangeField';

interface ImageOptionsSectionProps {
  options: ImageOutputOptions;
  onChange: (patch: Partial<ImageOutputOptions>) => void;
}

/** 图片输出参数：格式、质量与 PNG 量化压缩 */
const ImageOptionsSection: React.FC<ImageOptionsSectionProps> = ({ options, onChange }) => {
  const { t } = useLanguage();
  const flattensAlpha = options.format === 'jpeg';

  return (
    <div className="space-y-4">
      <Field label={t('img_conv.target_format')}>
        <Segmented
          value={options.format}
          options={FORMAT_OPTIONS.map(option => ({ value: option.value, label: optionLabel(option, t) }))}
          onChange={format => onChange({ format })}
        />
      </Field>

      {options.format !== 'png' && (
        <RangeField
          label={t('img_conv.quality')}
          value={options.quality}
          min={QUALITY_MIN}
          max={QUALITY_MAX}
          step={QUALITY_STEP}
          display={`${Math.round(options.quality * 100)}%`}
          minHint={t('img_conv.low')}
          maxHint={t('img_conv.high')}
          onChange={quality => onChange({ quality })}
        />
      )}

      {options.format === 'png' && (
        <div className="space-y-3">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={options.pngCompress}
              onChange={event => onChange({ pngCompress: event.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">{t('img_conv.png_compress')}</span>
          </label>

          {options.pngCompress && (
            <RangeField
              label={t('img_conv.colors')}
              value={options.pngColors}
              min={PNG_COLORS_MIN}
              max={PNG_COLORS_MAX}
              step={PNG_COLORS_STEP}
              display={String(options.pngColors)}
              onChange={pngColors => onChange({ pngColors })}
            />
          )}

          <div className="flex gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
            <Info size={15} className="mt-0.5 shrink-0" />
            <p>{t('img_conv.png_tip')}</p>
          </div>
        </div>
      )}

      {flattensAlpha && (
        <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
          <Info size={15} className="mt-0.5 shrink-0" />
          <p>{t('img_conv.jpg_tip')}</p>
        </div>
      )}
    </div>
  );
};

export default ImageOptionsSection;
