
import React from 'react';
import { ShieldCheck, Zap, Lock, Box } from 'lucide-react';
import Logo from './Logo';
import { Category } from '../types';

interface HomeProps {
  categories: Category[];
  onSelectTool: (id: string, categoryId: string) => void;
}

const Home: React.FC<HomeProps> = ({ categories, onSelectTool }) => {
  return (
    <div className="max-w-6xl mx-auto pb-12 animate-fade-in">
      {/* Hero Section */}
      <div className="py-20 text-center relative">
        <div className="flex justify-center mb-8">
           <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center text-primary-600 ring-4 ring-gray-50">
              <Logo size={64} />
           </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight mb-6">
          LOLO' Shoebox
        </h1>
        <div className="space-y-4 max-w-2xl mx-auto">
            <p className="text-xl md:text-2xl text-gray-600 font-medium leading-relaxed">
            为开发者和创作者打造的轻量级工具箱
            </p>
            <p className="text-lg text-gray-500 font-normal">
            无需安装 · 即开即用
            </p>
        </div>
        
        {/* Privacy Badge */}
        <div className="flex justify-center mt-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100 shadow-sm">
                <ShieldCheck size={18} className="fill-current" />
                <span>Client-Side Only: 数据仅在本地处理，绝不上传</span>
            </div>
        </div>
      </div>

      {/* Features Section (Redesigned - Minimal List) */}
      <div className="mb-20 px-6 py-12 bg-gray-50/50 border-y border-gray-100">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl shrink-0">
                      <Zap size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 mb-1 text-lg">极致性能</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                          基于 WebAssembly 和现代 Web API 构建，处理速度飞快。
                      </p>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl shrink-0">
                      <Lock size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 mb-1 text-lg">隐私安全</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                          没有后台数据库，没有追踪脚本。文件永远不离开您的设备。
                      </p>
                  </div>
              </div>
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl shrink-0">
                      <Box size={24} />
                  </div>
                  <div>
                      <h3 className="font-bold text-gray-900 mb-1 text-lg">开箱即用</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">
                          集合了文本处理、图像编辑、音视频转换等多种常用工具。
                      </p>
                  </div>
              </div>
          </div>
      </div>

      {/* Tools List */}
      <div className="space-y-16 px-4">
          {categories.map(category => (
              <div key={category.id}>
                  <div className="flex flex-col gap-1 mb-6">
                      <div className="flex items-center gap-3">
                          <div className="h-8 w-1 bg-primary-500 rounded-full"></div>
                          <h2 className="text-2xl font-bold text-gray-800">{category.name}</h2>
                      </div>
                      <p className="text-gray-500 pl-4">{category.description}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {category.tools.map(tool => (
                          <button
                              key={tool.id}
                              onClick={() => onSelectTool(tool.id, category.id)}
                              className="group flex flex-col text-left p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 hover:ring-1 hover:ring-primary-200 transition-all duration-200"
                          >
                              <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors duration-300">
                                  <tool.icon size={24} />
                              </div>
                              <h3 className="text-lg font-bold text-gray-900 mb-2">
                                  {tool.name}
                              </h3>
                              <p className="text-sm text-gray-500 leading-relaxed">
                                  {tool.description}
                              </p>
                          </button>
                      ))}
                  </div>
              </div>
          ))}
      </div>
      
      {/* Footer */}
      <div className="mt-24 pt-8 border-t border-gray-200 text-center text-gray-400 text-sm pb-8">
          <p>&copy; {new Date().getFullYear()} LOLO' Shoebox. Built for developers & creators.</p>
      </div>
    </div>
  );
};

export default Home;
