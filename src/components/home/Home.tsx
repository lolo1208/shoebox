import React from 'react';
import { Box, Lock, ShieldCheck, Zap } from 'lucide-react';
import Logo from '@/components/brand/Logo';
import ToolCard from '@/components/tool/ToolCard';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Category, CategoryId } from '@/types/tool';

interface HomeProps {
  categories: Category[];
  onSelectTool: (id: string, categoryId: CategoryId) => void;
}

const FEATURES = [
  { icon: Zap, tone: 'bg-blue-100 text-blue-600', titleKey: 'home.feature.perf', descKey: 'home.feature.perf.desc' },
  { icon: Lock, tone: 'bg-purple-100 text-purple-600', titleKey: 'home.feature.privacy', descKey: 'home.feature.privacy.desc' },
  { icon: Box, tone: 'bg-orange-100 text-orange-600', titleKey: 'home.feature.ready', descKey: 'home.feature.ready.desc' },
] as const;

const Home: React.FC<HomeProps> = ({ categories, onSelectTool }) => {
  const { t } = useLanguage();

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      <section className="py-20 text-center">
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center text-primary-600 ring-4 ring-gray-50">
            <Logo size={64} />
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight mb-6">{t('app.title')}</h1>
        <div className="space-y-4 max-w-2xl mx-auto">
          <p className="text-xl md:text-2xl text-gray-600 font-medium leading-relaxed">{t('home.hero.subtitle')}</p>
          <p className="text-lg text-gray-500">{t('home.hero.tagline')}</p>
        </div>
        <div className="flex justify-center mt-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100 shadow-sm">
            <ShieldCheck size={18} className="fill-current" />
            <span>{t('home.badge')}</span>
          </div>
        </div>
      </section>

      <section className="mb-20 px-6 py-12 bg-gray-50/50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          {FEATURES.map(({ icon: Icon, tone, titleKey, descKey }) => (
            <div key={titleKey} className="flex flex-col md:flex-row items-center md:items-start gap-4">
              <div className={`p-3 rounded-2xl shrink-0 ${tone}`}>
                <Icon size={24} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1 text-lg">{t(titleKey)}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{t(descKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-16 px-4">
        {categories.map(category => (
          <section key={category.id}>
            <div className="flex flex-col gap-1 mb-6">
              <div className="flex items-center gap-3">
                <div className="h-8 w-1 bg-primary-500 rounded-full" />
                <h2 className="text-2xl font-bold text-gray-800">{category.name}</h2>
              </div>
              <p className="text-gray-500 pl-4">{category.description}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {category.tools.map(tool => (
                <ToolCard key={tool.id} tool={tool} onClick={() => onSelectTool(tool.id, category.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-24 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm pb-8">
        <p>{t('home.footer', { year: new Date().getFullYear() })}</p>
      </footer>
    </div>
  );
};

export default Home;
