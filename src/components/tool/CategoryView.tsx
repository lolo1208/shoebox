import React from 'react';
import { Boxes } from 'lucide-react';
import ToolCard from '@/components/tool/ToolCard';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category } from '@/types/tool';

interface CategoryViewProps {
  category?: Category;
  onSelectTool: (id: string) => void;
}

/** 分类详情页：工具网格 */
const CategoryView: React.FC<CategoryViewProps> = ({ category, onSelectTool }) => {
  const { t } = useLanguage();

  if (!category) return null;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{category.name}</h1>
        <p className="text-gray-500">{category.description}</p>
      </div>

      {category.tools.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {category.tools.map(tool => (
            <ToolCard key={tool.id} tool={tool} onClick={() => onSelectTool(tool.id)} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
          <Boxes size={48} className="mx-auto mb-2 opacity-20" />
          <p>{t('home.empty.title')}</p>
          <p className="text-xs mt-1 opacity-60">{t('home.empty.desc')}</p>
        </div>
      )}
    </div>
  );
};

export default CategoryView;
