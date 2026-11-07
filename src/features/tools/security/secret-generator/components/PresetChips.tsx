import React from 'react';

export interface PresetChipOption<T extends string> {
  id: T;
  label: string;
}

interface PresetChipsProps<T extends string> {
  options: PresetChipOption<T>[];
  /** 当前命中的预设，custom 表示参数已被手动调整 */
  activeId: T | 'custom';
  onSelect: (id: T) => void;
}

/** 快捷预设按钮组：命中项高亮，参数被改动后自动失焦 */
function PresetChips<T extends string>({ options, activeId, onSelect }: PresetChipsProps<T>) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1.5">
      {options.map((option) => {
        const active = option.id === activeId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={active}
            className={`rounded-md border px-2 py-1.5 text-xs transition-colors ${
              active
                ? 'border-primary-500 bg-primary-50 font-medium text-primary-700'
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

export default PresetChips;
