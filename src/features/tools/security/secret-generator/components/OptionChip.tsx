import React, { type ReactNode } from 'react';

interface OptionChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/** 参数快捷值按钮：数值类选项的常用取值 */
const OptionChip: React.FC<OptionChipProps> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`rounded-md border px-2 py-1 text-xs tabular-nums transition-colors ${
      active
        ? 'border-primary-500 bg-primary-50 text-primary-700'
        : 'border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600'
    }`}
  >
    {children}
  </button>
);

export default OptionChip;
