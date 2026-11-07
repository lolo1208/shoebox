import React, { Suspense, useMemo, useState } from 'react';
import { Menu, X } from 'lucide-react';
import AppHeader from '@/components/layout/AppHeader';
import Sidebar from '@/components/layout/Sidebar';
import Home from '@/components/home/Home';
import Logo from '@/components/brand/Logo';
import CategoryView from '@/components/tool/CategoryView';
import ToolLoading from '@/components/tool/ToolLoading';
import { CategoryId } from '@/types/tool';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useTools } from '@/hooks/useTools';

const AppContent: React.FC = () => {
  const categories = useTools();
  const [isHome, setIsHome] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>(CategoryId.TEXT);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // 已打开过的工具保持挂载（隐藏），以便切回时保留输入状态
  const [visitedToolIds, setVisitedToolIds] = useState<string[]>([]);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const activeTool = activeCategory?.tools.find(t => t.id === activeToolId);
  const visitedTools = useMemo(
    () => categories.flatMap(c => c.tools).filter(t => visitedToolIds.includes(t.id)),
    [categories, visitedToolIds],
  );

  const selectTool = (toolId: string, categoryId?: CategoryId) => {
    if (categoryId) setActiveCategoryId(categoryId);
    setActiveToolId(toolId);
    setIsHome(false);
    setVisitedToolIds(prev => (prev.includes(toolId) ? prev : [...prev, toolId]));
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const selectCategory = (categoryId: string) => {
    setActiveCategoryId(categoryId as CategoryId);
    setActiveToolId(null);
    setIsHome(false);
  };

  const goHome = () => {
    setIsHome(true);
    setActiveToolId(null);
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {!isSidebarOpen && (
        <button
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md md:hidden"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-gray-100">
          <button
            onClick={goHome}
            className="flex items-center gap-2 font-bold text-xl text-primary-600 hover:opacity-80 transition-opacity"
          >
            <span className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center">
              <Logo size={20} />
            </span>
            LOLO' Shoebox
          </button>
          <button className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)} aria-label="Close navigation">
            <X size={20} />
          </button>
        </div>

        <Sidebar
          categories={categories}
          activeCategoryId={activeCategoryId}
          activeToolId={isHome ? null : activeToolId}
          onSelectCategory={selectCategory}
          onSelectTool={id => selectTool(id)}
        />
      </aside>

      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <AppHeader
          isHome={isHome}
          category={activeCategory}
          tool={activeTool}
          onBackToCategory={() => setActiveToolId(null)}
        />

        <main className="flex-1 overflow-auto p-4 md:p-8">
          {isHome ? (
            <Home categories={categories} onSelectTool={selectTool} />
          ) : (
            <>
              {!activeTool && (
                <CategoryView category={activeCategory} onSelectTool={id => selectTool(id)} />
              )}

              {visitedTools.map(tool => {
                const ToolComponent = tool.component;
                return (
                  <div
                    key={tool.id}
                    className={`${
                      tool.id === activeToolId ? '' : 'hidden'
                    } animate-fade-in bg-white rounded-xl border border-gray-200 shadow-sm min-h-[500px] ${
                      tool.layoutClass || 'w-full'
                    }`}
                  >
                    <div className="border-b border-gray-100 p-6 flex items-center gap-4">
                      <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                        <tool.icon size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{tool.name}</h2>
                        <p className="text-sm text-gray-500">{tool.description}</p>
                      </div>
                    </div>
                    <div className="p-6">
                      {/* 每个工具独立 Suspense：新增工具加载时不会卸载已打开的工具状态 */}
                      <Suspense fallback={<ToolLoading />}>
                        <ToolComponent />
                      </Suspense>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

const App: React.FC = () => (
  <LanguageProvider>
    <AppContent />
  </LanguageProvider>
);

export default App;
