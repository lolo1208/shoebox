import React from 'react';
import { Category } from '../types';
import { ChevronRight } from 'lucide-react';

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
  return (
    <div className="py-4">
      <div className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        LOLO' Shoebox
      </div>
      <nav className="space-y-1">
        {categories.map((category) => {
          const isActive = activeCategoryId === category.id;
          return (
            <div key={category.id} className="px-3">
              <button
                onClick={() => onSelectCategory(category.id)}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors
                  ${isActive 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
                `}
              >
                <div className="flex items-center gap-3">
                  <category.icon size={18} className={isActive ? 'text-primary-600' : 'text-gray-500'} />
                  {category.name}
                </div>
              </button>
              
              {/* Expand tools if category is active */}
              {isActive && (
                <div className="mt-1 ml-4 space-y-0.5 border-l border-gray-200 pl-3 py-1">
                   {category.tools.map(tool => (
                     <button
                        key={tool.id}
                        onClick={() => onSelectTool(tool.id)}
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
                        开发中...
                     </div>
                   )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;