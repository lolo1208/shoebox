import React from 'react';

interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** 右侧展示的值文本，例如 "85%" 或 "128" */
  display: string;
  /** 滑杆两端的语义提示，例如「低 (小)」「高 (大)」 */
  minHint?: string;
  maxHint?: string;
  onChange: (value: number) => void;
}

/** 带数值回显的滑杆，图片与 PDF 参数面板共用 */
const RangeField: React.FC<RangeFieldProps> = ({
  label,
  value,
  min,
  max,
  step,
  display,
  minHint,
  maxHint,
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <span className="text-xs font-mono tabular-nums text-primary-600">{display}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary-600"
    />
    {(minHint || maxHint) && (
      <div className="flex justify-between text-[11px] text-gray-400">
        <span>{minHint}</span>
        <span>{maxHint}</span>
      </div>
    )}
  </div>
);

export default RangeField;
