import React from 'react';
import { preloadToolComponent, type Tool } from '@/types/tool';

interface ToolCardProps {
  tool: Tool;
  onClick: () => void;
}

/** 首页与分类页共用的工具卡片 */
const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => (
  <button
    onClick={onClick}
    // 悬停/聚焦即开始拉取该工具的 chunk，点击时通常已就绪
    onPointerEnter={() => preloadToolComponent(tool.component)}
    onFocus={() => preloadToolComponent(tool.component)}
    className="group flex flex-col text-left p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 hover:ring-1 hover:ring-primary-200 transition-all duration-200"
  >
    <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300">
      <tool.icon size={24} />
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-2">{tool.name}</h3>
    <p className="text-sm text-gray-500 leading-relaxed line-clamp-2">{tool.description}</p>
  </button>
);

export default ToolCard;
