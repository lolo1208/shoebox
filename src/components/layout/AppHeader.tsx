import React from 'react';
import { Github } from 'lucide-react';
import LanguageSwitcher from '@/components/layout/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category, Tool } from '@/types/tool';

interface AppHeaderProps {
  isHome: boolean;
  category?: Category;
  tool?: Tool;
  onBackToCategory: () => void;
}

/** 顶栏：面包屑与全局操作 */
const AppHeader: React.FC<AppHeaderProps> = ({ isHome, category, tool, onBackToCategory }) => {
  const { t } = useLanguage();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {isHome ? (
          <span className="font-medium text-gray-900">{t('header.home')}</span>
        ) : (
          <>
            <button onClick={onBackToCategory} className="hover:text-primary-600 transition-colors">
              {category?.name}
            </button>
            {tool && (
              <>
                <span>/</span>
                <span className="font-medium text-gray-900">{tool.name}</span>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <div className="h-4 w-px bg-gray-200 mx-1" />
        <a
          href="https://github.com/lolo1208/shoebox"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-900 transition-colors p-2 rounded-full hover:bg-gray-100"
          aria-label={t('header.github')}
        >
          <Github size={20} />
        </a>
      </div>
    </header>
  );
};

export default AppHeader;
