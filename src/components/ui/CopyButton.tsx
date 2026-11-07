import React from 'react';
import { Check, Copy } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import { useLanguage } from '@/contexts/LanguageContext';

interface CopyButtonProps {
  text: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  copiedLabel?: string;
}

const DEFAULT_CLASS =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all';

/** 通用复制按钮，自带“已复制”反馈 */
const CopyButton: React.FC<CopyButtonProps> = ({ text, label, icon, className, copiedLabel }) => {
  const { t } = useLanguage();
  const { copy, isCopied } = useClipboard(1500);
  const done = isCopied();

  return (
    <button onClick={() => void copy(text)} className={className || DEFAULT_CLASS} title={t('common.copy')}>
      {done ? <Check size={13} className="text-green-500" /> : icon || <Copy size={13} />}
      {label !== undefined && <span>{done ? copiedLabel || t('common.copied') : label}</span>}
    </button>
  );
};

export default CopyButton;
