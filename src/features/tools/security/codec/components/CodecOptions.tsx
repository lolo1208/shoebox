import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import type {
  Base32Variant,
  Base64Variant,
  CodecDirection,
  CodecFamily,
  CodecOptions as CodecOptionsValue,
  InputFormat,
  OutputView,
  UrlMode,
} from '@/lib/codec';

interface SegmentedItem<T> {
  value: T;
  label: string;
}

/** 小型分段选择器，与工具其他页面的胶囊按钮保持一致的视觉 */
function Segmented<T extends string | number | boolean>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: SegmentedItem<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex p-1 bg-gray-100 rounded-lg">
      {items.map((item) => (
        <button
          key={String(item.value)}
          onClick={() => onChange(item.value)}
          aria-pressed={value === item.value}
          className={`px-2.5 py-1 text-xs rounded-md transition-all ${
            value === item.value ? 'bg-white text-primary-600 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

interface CodecOptionsProps {
  family: CodecFamily;
  direction: CodecDirection;
  options: CodecOptionsValue;
  /** 输入来自文件字节时，文本/十六进制输入格式不生效 */
  byteInput?: boolean;
  onChange: (patch: Partial<CodecOptionsValue>) => void;
  onReset: () => void;
}

/**
 * 参数面板：只渲染当前编码族 / 方向下有意义的选项，
 * 避免 Base64 的填充开关出现在 URL 模式里造成误解。
 */
const CodecOptions: React.FC<CodecOptionsProps> = ({ family, direction, options, byteInput, onChange, onReset }) => {
  const { t } = useLanguage();
  const encoding = direction === 'encode';
  const rows: { key: string; label: string; control: React.ReactNode }[] = [];

  if (encoding && family !== 'url' && !byteInput) {
    const items: SegmentedItem<InputFormat>[] = [
      { value: 'text', label: t('codec.input_format.text') },
      { value: 'hex', label: t('codec.input_format.hex') },
    ];
    rows.push({
      key: 'input-format',
      label: t('codec.options.input_format'),
      control: <Segmented value={options.inputFormat} items={items} onChange={(value) => onChange({ inputFormat: value })} />,
    });
  }

  if (family === 'base64' && encoding) {
    const variants: SegmentedItem<Base64Variant>[] = [
      { value: 'standard', label: t('codec.variant.standard') },
      { value: 'url-safe', label: t('codec.variant.url_safe') },
    ];
    const wraps: SegmentedItem<number>[] = [
      { value: 0, label: t('codec.wrap.none') },
      { value: 64, label: '64' },
      { value: 76, label: '76' },
    ];
    const flags: SegmentedItem<boolean>[] = [
      { value: true, label: t('codec.value.on') },
      { value: false, label: t('codec.value.off') },
    ];

    rows.push(
      {
        key: 'b64-variant',
        label: t('codec.options.variant'),
        control: <Segmented value={options.base64Variant} items={variants} onChange={(value) => onChange({ base64Variant: value })} />,
      },
      {
        key: 'b64-padding',
        label: t('codec.options.padding'),
        control: <Segmented value={options.base64Padding} items={flags} onChange={(value) => onChange({ base64Padding: value })} />,
      },
      {
        key: 'b64-wrap',
        label: t('codec.options.wrap'),
        control: <Segmented value={options.base64Wrap} items={wraps} onChange={(value) => onChange({ base64Wrap: value })} />,
      },
    );
  }

  if (family === 'base32') {
    const variants: SegmentedItem<Base32Variant>[] = [
      { value: 'rfc4648', label: t('codec.variant.rfc4648') },
      { value: 'base32hex', label: t('codec.variant.base32hex') },
    ];
    rows.push({
      key: 'b32-variant',
      label: t('codec.options.variant'),
      control: <Segmented value={options.base32Variant} items={variants} onChange={(value) => onChange({ base32Variant: value })} />,
    });
  }

  if (family === 'base32' && encoding) {
    const flags: SegmentedItem<boolean>[] = [
      { value: true, label: t('codec.value.on') },
      { value: false, label: t('codec.value.off') },
    ];
    const cases: SegmentedItem<boolean>[] = [
      { value: false, label: t('codec.case.upper') },
      { value: true, label: t('codec.case.lower') },
    ];

    rows.push(
      {
        key: 'b32-padding',
        label: t('codec.options.padding'),
        control: <Segmented value={options.base32Padding} items={flags} onChange={(value) => onChange({ base32Padding: value })} />,
      },
      {
        key: 'b32-case',
        label: t('codec.options.case'),
        control: <Segmented value={options.base32Lowercase} items={cases} onChange={(value) => onChange({ base32Lowercase: value })} />,
      },
    );
  }

  if (family === 'url') {
    const modes: SegmentedItem<UrlMode>[] = [
      { value: 'component', label: t('codec.url_mode.component') },
      { value: 'uri', label: t('codec.url_mode.uri') },
      { value: 'form', label: t('codec.url_mode.form') },
    ];
    rows.push({
      key: 'url-mode',
      label: t('codec.options.url_mode'),
      control: <Segmented value={options.urlMode} items={modes} onChange={(value) => onChange({ urlMode: value })} />,
    });
  }

  if (!encoding) {
    const views: SegmentedItem<OutputView>[] = [
      { value: 'auto', label: t('codec.view.auto') },
      { value: 'text', label: t('codec.view.text') },
      { value: 'hex', label: t('codec.view.hex') },
    ];
    rows.push({
      key: 'output-view',
      label: t('codec.options.view'),
      control: <Segmented value={options.outputView} items={views} onChange={(value) => onChange({ outputView: value })} />,
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-3 border-t border-gray-100">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{row.label}</span>
          {row.control}
        </div>
      ))}
      <button
        onClick={onReset}
        className="ml-auto inline-flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <RotateCcw size={12} />
        {t('codec.reset_options')}
      </button>
    </div>
  );
};

export default CodecOptions;
