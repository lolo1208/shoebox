import React from 'react';
import { Field, FIELD_CLASS, NumberField, Segmented, ChoiceChips } from '@/components/ui/FormField';
import { useLanguage } from '@/contexts/LanguageContext';
import { MARGIN_MAX_MM, MARGIN_MIN_MM } from '@/lib/pdf';
import { QUALITY_MAX, QUALITY_MIN, QUALITY_STEP, type PdfOutputOptions } from '@/lib/image/convert';
import {
  COMPRESSION_OPTIONS,
  DPI_OPTIONS,
  FIT_MODE_OPTIONS,
  ORIENTATION_OPTIONS,
  PAGE_SIZE_OPTIONS,
  optionLabel,
} from '../constants';
import RangeField from './RangeField';

interface PdfOptionsSectionProps {
  options: PdfOutputOptions;
  onChange: (patch: Partial<PdfOutputOptions>) => void;
}

/**
 * PDF 输出参数。
 *
 * 「适应图片」时页面尺寸由图片决定，纸张方向 / 适配方式 / 分辨率都不再起作用，
 * 因此只在固定纸张下展示这些选项，避免无效设置。
 */
const PdfOptionsSection: React.FC<PdfOptionsSectionProps> = ({ options, onChange }) => {
  const { t } = useLanguage();
  const fixedPage = options.pageSize !== 'fit';

  return (
    <div className="space-y-4">
      <Field label={t('img_conv.pdf.page_size')}>
        <select
          value={options.pageSize}
          onChange={event => onChange({ pageSize: event.target.value as PdfOutputOptions['pageSize'] })}
          className={FIELD_CLASS}
        >
          {PAGE_SIZE_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {optionLabel(option, t)}
            </option>
          ))}
        </select>
      </Field>

      {fixedPage && (
        <>
          <Field label={t('img_conv.pdf.orientation')}>
            <Segmented
              value={options.orientation}
              options={ORIENTATION_OPTIONS.map(option => ({
                value: option.value,
                label: optionLabel(option, t),
              }))}
              onChange={orientation => onChange({ orientation })}
            />
          </Field>

          <Field label={t('img_conv.pdf.fit')}>
            <Segmented
              value={options.fit}
              options={FIT_MODE_OPTIONS.map(option => ({ value: option.value, label: optionLabel(option, t) }))}
              onChange={fit => onChange({ fit })}
            />
          </Field>

          <Field label={t('img_conv.pdf.dpi')} hint={t('img_conv.pdf.dpi_hint')}>
            <ChoiceChips
              value={options.dpi}
              columns={3}
              options={DPI_OPTIONS.map(option => ({ value: option.value, label: optionLabel(option, t) }))}
              onChange={dpi => onChange({ dpi })}
            />
          </Field>
        </>
      )}

      <Field label={t('img_conv.pdf.margin')}>
        <NumberField
          value={options.marginMm}
          min={MARGIN_MIN_MM}
          max={MARGIN_MAX_MM}
          suffix="mm"
          onChange={marginMm => onChange({ marginMm })}
        />
      </Field>

      <Field
        label={t('img_conv.pdf.compression')}
        hint={options.compression === 'lossless' ? t('img_conv.pdf.lossless_hint') : undefined}
      >
        <Segmented
          value={options.compression}
          options={COMPRESSION_OPTIONS.map(option => ({
            value: option.value,
            label: optionLabel(option, t),
          }))}
          onChange={compression => onChange({ compression })}
        />
      </Field>

      {options.compression === 'jpeg' && (
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

      <Field label={t('img_conv.pdf.title')} hint={t('img_conv.pdf.title_hint')}>
        <input
          type="text"
          value={options.title}
          maxLength={120}
          placeholder={t('img_conv.pdf.title_placeholder')}
          onChange={event => onChange({ title: event.target.value })}
          className={FIELD_CLASS}
        />
      </Field>
    </div>
  );
};

export default PdfOptionsSection;
