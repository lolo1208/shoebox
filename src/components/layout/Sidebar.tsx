import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Category, preloadToolComponent } from '@/types/tool';
import { useLanguage } from '@/contexts/LanguageContext';
import Collapse from '@/components/ui/Collapse';

interface SidebarProps {
  categories: Category[];
  activeCategoryId: string;
  activeToolId: string | null;
  onSelectCategory: (id: string) => void;
  onSelectTool: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  categories, 
  activeCategoryId, 
  activeToolId,
  onSelectCategory,
  onSelectTool
}) => {
  const { t } = useLanguage();

  // 侧边栏分组的展开状态：跟随当前分类，同时允许手动把已展开的分组收起
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(activeCategoryId);

  useEffect(() => {
    // 分类被外部切换（首页选工具、头部导航等）时展开对应分组
    setOpenCategoryId(activeCategoryId);
  }, [activeCategoryId]);

  useEffect(() => {
    // 从首页直接打开某个工具时，确保它所在分组是展开的
    if (activeToolId) setOpenCategoryId(activeCategoryId);
  }, [activeCategoryId, activeToolId]);

  const handleCategoryClick = (id: string) => {
    if (openCategoryId === id) {
      // 已展开：再次点击只收起分组，主区域保持当前分类
      setOpenCategoryId(null);
      return;
    }
    setOpenCategoryId(id);
    onSelectCategory(id);
  };

  return (
    <div className="py-4">
      <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {t('sidebar.title')}
      </div>
      <nav className="space-y-1">
        {categories.map((category) => {
          const isActive = activeCategoryId === category.id;
          const isOpen = isActive && openCategoryId === category.id;
          return (
            <div key={category.id} className="px-3">
              <button
                onClick={() => handleCategoryClick(category.id)}
                aria-expanded={isOpen}
                className={`
                  group/cat w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                `}
              >
                <div className="flex items-center gap-3">
                  <category.icon size={18} className={isActive ? 'text-primary-600' : 'text-gray-500'} />
                  {category.name}
                </div>
                <ChevronDown
                  size={14}
                  className={`
                    shrink-0 transition-transform duration-200 ease-crisp
                    ${isOpen ? 'rotate-0 text-primary-500' : '-rotate-90 text-gray-400 group-hover/cat:text-gray-500'}
                  `}
                />
              </button>

              {/* Expand tools if category is active */}
              <Collapse open={isOpen} duration={200}>
                <div className="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3 py-1">
                   {category.tools.map(tool => (
                     <button
                        key={tool.id}
                        onClick={() => onSelectTool(tool.id)}
                        onPointerEnter={() => preloadToolComponent(tool.component)}
                        className={`
                          w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors text-left
                          ${activeToolId === tool.id 
                            ? 'text-primary-600 font-medium bg-white shadow-sm ring-1 ring-gray-200' 
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}
                        `}
                     >
                       <span className="truncate">{tool.name}</span>
                     </button>
                   ))}
                   {category.tools.length === 0 && (
                     <div className="px-3 py-1.5 text-xs text-gray-400 italic">
                        {t('home.empty.desc')}
                     </div>
                   )}
                </div>
              </Collapse>
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
