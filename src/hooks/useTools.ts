import { useMemo } from 'react';
import { TOOL_CATALOG } from '@/config/toolCatalog';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category } from '@/types/tool';

/** 将配置层的翻译 key 解析为当前语言的分类与工具列表 */
export const useTools = (): Category[] => {
  const { t } = useLanguage();

  return useMemo(
    () =>
      TOOL_CATALOG.map(category => ({
        id: category.id,
        name: t(category.nameKey),
        description: t(category.descriptionKey),
        icon: category.icon,
        tools: category.tools.map(tool => ({
          id: tool.id,
          name: t(tool.nameKey),
          description: t(tool.descriptionKey),
          icon: tool.icon,
          component: tool.component,
          layoutClass: tool.layoutClass,
        })),
      })),
    [t],
  );
};
