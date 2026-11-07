import React, { useEffect, useRef, useState } from 'react';
import { FIELD_CLASS } from '@/components/ui/FormField';

interface IntegerInputProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  label: string;
  onChange: (value: number) => void;
}

/**
 * 整数输入框。
 *
 * 不能直接把受控输入框的每次按键都夹取后写回：那样输入「100」时会先被夹成 4，
 * 结果变成 400 再被夹成上限。这里在输入过程中保留原始文本，
 * 只有落在合法区间时才即时提交，失焦 / 回车时再做一次夹取。
 */
const IntegerInput: React.FC<IntegerInputProps> = ({ value, min, max, step = 1, suffix, label, onChange }) => {
  const [draft, setDraft] = useState(String(value));
  const editing = useRef(false);

  // 滑块、快捷值、预设等外部改动时同步显示；正在输入时不打断用户
  useEffect(() => {
    if (!editing.current) setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        value={draft}
        min={min}
        max={max}
        step={step}
        aria-label={label}
        onFocus={() => {
          editing.current = true;
        }}
        onBlur={(event) => {
          editing.current = false;
          commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);

          const parsed = Number.parseInt(raw, 10);
          if (Number.isFinite(parsed) && parsed >= min && parsed <= max) onChange(parsed);
        }}
        className={`${FIELD_CLASS} ${suffix ? 'pr-8' : ''} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  );
};

export default IntegerInput;
