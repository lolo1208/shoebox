import React, { useState } from 'react';
import { 
  Type, 
  Image as ImageIcon, 
  Code2, 
  Braces, 
  KeyRound, 
  Fingerprint, 
  Hash, 
  Menu,
  X,
  QrCode,
  FileOutput,
  Activity,
  FileType,
  Stamp,
  Scaling,
  Video,
  Crop,
  Grid,
  Layers
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import JsonFormatter from './components/tools/JsonFormatter';
import PasswordGenerator from './components/tools/PasswordGenerator';
import UuidGenerator from './components/tools/UuidGenerator';
import Md5Generator from './components/tools/Md5Generator';
import QrCodeGenerator from './components/tools/QrCodeGenerator';
import ImageConverter from './components/tools/ImageConverter';
import EasingVisualizer from './components/tools/EasingVisualizer';
import MarkdownToImage from './components/tools/MarkdownToImage';
import WatermarkGenerator from './components/tools/WatermarkGenerator';
import ImageResizer from './components/tools/ImageResizer';
import ImageCropper from './components/tools/ImageCropper';
import ImageGridSlicer from './components/tools/ImageGridSlicer';
import ImageComposition from './components/tools/ImageComposition';
import Logo from './components/Logo';
import { Category, CategoryId } from './types';

// Define the catalog of tools
const categories: Category[] = [
  {
    id: CategoryId.TEXT,
    name: '文本',
    icon: Type,
    tools: [
      {
        id: 'json-format',
        name: 'JSON 格式化',
        description: '验证、格式化和压缩 JSON 数据',
        icon: Braces,
        component: <JsonFormatter />,
        // Full width for code editors
        layoutClass: 'w-full'
      },
      {
        id: 'password-gen',
        name: '随机密码生成',
        description: '生成高强度随机密码',
        icon: KeyRound,
        component: <PasswordGenerator />,
        layoutClass: 'max-w-3xl mx-auto'
      },
      {
        id: 'uuid-gen',
        name: 'UUID 生成',
        description: '批量生成随机 UUID (v4)',
        icon: Fingerprint,
        component: <UuidGenerator />,
        layoutClass: 'max-w-3xl mx-auto'
      },
      {
        id: 'md5-hash',
        name: 'MD5 加密',
        description: '计算文本的 MD5 哈希值',
        icon: Hash,
        component: <Md5Generator />,
        layoutClass: 'max-w-3xl mx-auto'
      }
    ]
  },
  {
    id: CategoryId.IMAGE,
    name: '图像',
    icon: ImageIcon,
    tools: [
      {
        id: 'img-comp',
        name: '画布拼贴',
        description: '多图层自由拼贴、旋转与合成',
        icon: Layers,
        component: <ImageComposition />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-resize',
        name: '图像尺寸调整',
        description: '调整图片像素尺寸或按百分比缩放',
        icon: Scaling,
        component: <ImageResizer />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-crop',
        name: '图像裁剪',
        description: '自定义区域裁剪图片，支持精确坐标控制',
        icon: Crop,
        component: <ImageCropper />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-slice',
        name: '图像切片',
        description: '将图片按行列均匀切分并打包下载',
        icon: Grid,
        component: <ImageGridSlicer />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-convert',
        name: '图像压缩与转换',
        description: '图片格式转换 (JPG/PNG) 与体积压缩',
        icon: FileOutput,
        component: <ImageConverter />,
        layoutClass: 'w-full'
      },
      {
        id: 'watermark',
        name: '图片水印',
        description: '安全地为本地图片添加平铺文字水印',
        icon: Stamp,
        component: <WatermarkGenerator />,
        layoutClass: 'max-w-5xl mx-auto'
      },
      {
        id: 'qr-gen',
        name: '二维码生成',
        description: '生成自定义颜色和尺寸的二维码',
        icon: QrCode,
        component: <QrCodeGenerator />,
        layoutClass: 'max-w-5xl mx-auto'
      },
      {
        id: 'md-to-img',
        name: 'Markdown 转图片',
        description: '将 Markdown 文本转换为精美图片并下载',
        icon: FileType,
        component: <MarkdownToImage />,
        layoutClass: 'w-full'
      }
    ]
  },
  {
    id: CategoryId.AUDIO_VIDEO,
    name: '影音',
    icon: Video,
    tools: []
  },
  {
    id: CategoryId.DEVELOPER,
    name: '开发者',
    icon: Code2,
    tools: [
      {
        id: 'easing-vis',
        name: '缓动函数可视化',
        description: '可视化展示与预览常见缓动函数效果',
        icon: Activity,
        component: <EasingVisualizer />,
        layoutClass: 'max-w-7xl mx-auto'
      }
    ]
  }
];

const App: React.FC = () => {
  const [activeCategoryId, setActiveCategoryId] = useState<string>(CategoryId.TEXT);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const activeTool = activeCategory?.tools.find(t => t.id === activeToolId);

  const handleToolSelect = (toolId: string) => {
    setActiveToolId(toolId);
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveToolId(null); // Reset tool when category changes to show category list
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans text-gray-900">
      {/* Mobile Sidebar Overlay */}
      {!isSidebarOpen && (
        <button 
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md md:hidden"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Sidebar */}
      <div 
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-4 h-16 border-b border-gray-100">
          <div className="flex items-center gap-2 font-bold text-xl text-primary-600">
            <div className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center">
              <Logo size={20} />
            </div>
            LOLO' Shoebox
          </div>
          <button className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <Sidebar 
          categories={categories} 
          activeCategoryId={activeCategoryId}
          activeToolId={activeToolId}
          onSelectCategory={handleCategorySelect}
          onSelectTool={handleToolSelect}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <button 
              onClick={() => setActiveToolId(null)}
              className="hover:text-primary-600 transition-colors flex items-center gap-1"
            >
               {categories.find(c => c.id === activeCategoryId)?.name}
            </button>
            {activeTool && (
              <>
                <span>/</span>
                <span className="font-medium text-gray-900">{activeTool.name}</span>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="w-full mx-auto">
            {!activeTool ? (
              // Category View (Tool Grid)
              <div className="animate-fade-in max-w-5xl mx-auto">
                 <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {activeCategory?.name}
                    </h1>
                    <p className="text-gray-500">
                      选择一个工具开始使用
                    </p>
                 </div>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeCategory?.tools.map((tool) => (
                      <button
                        key={tool.id}
                        onClick={() => handleToolSelect(tool.id)}
                        className="flex flex-col text-left p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 hover:ring-1 hover:ring-primary-200 transition-all duration-200 group"
                      >
                        <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                          <tool.icon size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {tool.name}
                        </h3>
                        <p className="text-sm text-gray-500 line-clamp-2">
                          {tool.description}
                        </p>
                      </button>
                    ))}
                    {activeCategory?.tools.length === 0 && (
                       <div className="col-span-full py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                          <div className="flex justify-center mb-2">
                             <Code2 size={48} className="opacity-20"/>
                          </div>
                          <p>该分类下暂无工具</p>
                       </div>
                    )}
                 </div>
              </div>
            ) : (
              // Tool Detail View - Layout controlled by activeTool.layoutClass
              <div className={`animate-fade-in bg-white rounded-xl border border-gray-200 shadow-sm min-h-[500px] ${activeTool.layoutClass || 'w-full'}`}>
                 <div className="border-b border-gray-100 p-6 flex items-center gap-4">
                    <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                       <activeTool.icon size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{activeTool.name}</h2>
                      <p className="text-sm text-gray-500">{activeTool.description}</p>
                    </div>
                 </div>
                 <div className="p-6">
                    {activeTool.component}
                 </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;