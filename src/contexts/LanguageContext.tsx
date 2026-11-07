import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations, type Language, type TranslationKey } from '@/locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = 'shoebox-language';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // 先用英文渲染，挂载后再按本地存储 / 浏览器语言切换，避免闪烁
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY) as Language | null;
    if (saved === 'en' || saved === 'zh') {
      setLanguageState(saved);
      return;
    }
    setLanguageState(navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en');
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANGUAGE_KEY, lang);
  }, []);

  // 依赖 language 缓存，useTools 等下游 memo 才能命中
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const dict = translations[language] || translations.en;
      let text = (dict as Record<string, string>)[key] || key;

      if (params) {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          text = text.replace(`{${paramKey}}`, String(paramValue));
        }
      }
      return text;
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
