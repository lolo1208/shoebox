/**
 * 图片转换工具的可选项与文案 key。
 *
 * 数值范围由逻辑层（@/lib/image/convert）定义，这里只负责把枚举
 * 组装成 UI 需要的「值 + 文案」列表，避免在组件里堆 switch。
 */

import {
  PDF_COMPRESSIONS,
  PDF_DPI_OPTIONS,
  type ConvertTarget,
  type ImageFormat,
  type PdfCompression,
  type PdfRenderDpi,
} from '@/lib/image/convert';
import { PAGE_SIZE_IDS, PAGE_SIZE_PRESETS, PDF_FIT_MODES, PDF_ORIENTATIONS } from '@/lib/pdf';
import type { PdfFitMode, PdfOrientation, PdfPageSize } from '@/lib/pdf';

/** 设置持久化键 */
export const SETTINGS_STORAGE_KEY = 'tool-image-converter-settings';

/** 可导入的文件类型（浏览器会据此过滤选择框） */
export const ACCEPTED_FILE_TYPES = 'image/*';

export interface ChoiceOption<T> {
  value: T;
  /** 直接展示的文本（型号、数字等无需翻译的内容） */
  label?: string;
  /** 需要翻译的文案 key */
  labelKey?: string;
}

export const TARGET_OPTIONS: ChoiceOption<ConvertTarget>[] = [
  { value: 'image', labelKey: 'img_conv.target.image' },
  { value: 'pdf', labelKey: 'img_conv.target.pdf' },
];

export const FORMAT_OPTIONS: ChoiceOption<ImageFormat>[] = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

export const PAGE_SIZE_OPTIONS: ChoiceOption<PdfPageSize>[] = PAGE_SIZE_IDS.map(size =>
  size === 'fit'
    ? { value: size, labelKey: 'img_conv.pdf.page_fit' }
    : { value: size, label: PAGE_SIZE_PRESETS[size].label },
);

export const ORIENTATION_OPTIONS: ChoiceOption<PdfOrientation>[] = PDF_ORIENTATIONS.map(value => ({
  value,
  labelKey: `img_conv.pdf.${value}`,
}));

export const FIT_MODE_OPTIONS: ChoiceOption<PdfFitMode>[] = PDF_FIT_MODES.map(value => ({
  value,
  labelKey: `img_conv.pdf.fit_${value}`,
}));

export const COMPRESSION_OPTIONS: ChoiceOption<PdfCompression>[] = PDF_COMPRESSIONS.map(value => ({
  value,
  labelKey: `img_conv.pdf.compression_${value}`,
}));

export const DPI_OPTIONS: ChoiceOption<PdfRenderDpi>[] = PDF_DPI_OPTIONS.map(value => ({
  value,
  label: String(value),
}));

/** 取选项的展示文本；labelKey 交给调用方的 t() 解析 */
export function optionLabel<T>(option: ChoiceOption<T>, translate: (key: string) => string): string {
  if (option.label) return option.label;
  return option.labelKey ? translate(option.labelKey) : String(option.value);
}
