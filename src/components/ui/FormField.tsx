import React, { type ReactNode } from 'react';

/**
 * 工具设置面板共用的表单原语。
 *
 * 抽帧、转 GIF 等面板此前各自维护了一份同样的实现，
 * 统一到这里后只需维护一套视觉与交互细节。
 */

/** 输入框基础样式 */
export const FIELD_CLASS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums text-gray-900 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

interface FieldProps {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

/** 带标题与提示的表单行 */
export const Field: React.FC<FieldProps> = ({ label, hint, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {hint !== undefined && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
    {children}
  </div>
);

interface NumberFieldProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}

/** 数字输入框：自动夹取范围并显示单位后缀 */
export const NumberField: React.FC<NumberFieldProps> = ({ value, onChange, min, max, step = 1, suffix }) => (
  <div className="relative">
    <input
      type="number"
      value={Number.isFinite(value) ? value : min}
      min={min}
      max={max}
      step={step}
      onChange={event => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(clamp(next, min, max));
      }}
      className={`${FIELD_CLASS} ${suffix ? 'pr-10' : ''}`}
    />
    {suffix && (
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
    )}
  </div>
);

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/** 分段控件：少量互斥选项的首选交互 */
export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChoiceChipsProps<T extends string | number> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** 每行显示的选项数，默认 4 */
  columns?: number;
}

/** 选项按钮组：比分段控件容纳更多选项，适合分辨率、质量档位等枚举 */
export function ChoiceChips<T extends string | number>({ value, options, onChange, columns = 4 }: ChoiceChipsProps<T>) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map(option => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition-colors ${
              active
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
