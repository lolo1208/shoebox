import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

/** 工具分类标识（顺序不代表展示顺序，展示顺序由配置数组决定） */
export enum CategoryId {
  TEXT = 'text',
  IMAGE = 'image',
  SECURITY = 'security',
  DEVELOPER = 'developer',
  NETWORK = 'network',
  MEDIA = 'media',
}

/** 已翻译的工具条目 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
  /** 工具内容区宽度类，缺省为 w-full */
  layoutClass?: string;
}

/** 已翻译的分类条目 */
export interface Category {
  id: CategoryId;
  name: string;
  description: string;
  icon: LucideIcon;
  tools: Tool[];
}

/** 配置层的工具定义，仅存翻译 key 与组件引用 */
export interface ToolDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  component: ComponentType;
  layoutClass?: string;
}

/** 配置层的分类定义 */
export interface CategoryDefinition {
  id: CategoryId;
  nameKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  tools: ToolDefinition[];
}
