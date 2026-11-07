import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

/** 顶部语言切换下拉 */
const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const options = [
    { value: 'en' as const, label: 'English' },
    { value: 'zh' as const, label: '简体中文' },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-gray-100"
        aria-label="Change Language"
      >
        <Languages size={20} />
        <span className="text-xs font-medium uppercase w-5 text-center">{language === 'zh' ? '中' : 'EN'}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-32 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 animate-fade-in">
          {options.map(option => (
            <button
              key={option.value}
              onClick={() => {
                setLanguage(option.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                language === option.value ? 'text-primary-600 font-medium' : 'text-gray-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
