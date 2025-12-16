
/// <reference lib="dom" />
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
  FileImage, 
  Activity,
  FileType,
  Stamp,
  Scaling,
  Crop,
  Grid,
  Layers,
  FileVideo,
  Music,
  ImageMinus,
  Clock,
  Terminal,
  Globe,
  Gauge,
  Network,
  FileText,
  Film
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Home from './components/Home';
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
import VideoCommandGenerator from './components/tools/VideoCommandGenerator';
import AudioConverter from './components/tools/AudioConverter';
import BackgroundRemover from './components/tools/BackgroundRemover';
import TimestampConverter from './components/tools/TimestampConverter';
import CodeRunner from './components/tools/CodeRunner';
import CheckHost from './components/tools/CheckHost';
import SpeedTest from './components/tools/SpeedTest';
import Logo from './components/Logo';
import { Category, CategoryId } from './types';

// Define the catalog of tools
const categories: Category[] = [
  {
    id: CategoryId.IMAGE,
    name: '图像',
    icon: ImageIcon,
    description: '提供图片压缩、裁剪、拼接、水印、格式转换及 AI 抠图等一站式图像处理能力。',
    tools: [
      {
        id: 'img-convert',
        name: '图像压缩与转换',
        description: '支持 JPG/PNG 格式互转，可调节质量与颜色深度以压缩体积',
        icon: FileImage,
        component: <ImageConverter />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-resize',
        name: '图像尺寸调整',
        description: '修改图片分辨率，支持像素/百分比缩放及等比锁定',
        icon: Scaling,
        component: <ImageResizer />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-crop',
        name: '图像裁剪',
        description: '可视化自由裁剪，支持精确坐标定位与快捷对齐',
        icon: Crop,
        component: <ImageCropper />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-slice',
        name: '图像切片',
        description: '将图片按行列网格切分为多张小图，并打包为 ZIP 下载',
        icon: Grid,
        component: <ImageGridSlicer />,
        layoutClass: 'w-full'
      },
      {
        id: 'bg-remove',
        name: '智能抠图',
        description: '基于 AI 自动识别并移除图片背景，支持人像、商品与物体',
        icon: ImageMinus,
        component: <BackgroundRemover />,
        layoutClass: 'w-full'
      },
      {
        id: 'img-comp',
        name: '画布拼贴',
        description: '无限画布、多图层拖拽合成，支持自由旋转、缩放与层级调整',
        icon: Layers,
        component: <ImageComposition />,
        layoutClass: 'w-full'
      },
      {
        id: 'watermark',
        name: '图片水印',
        description: '全本地处理，支持自定义文字、颜色、角度的平铺水印制作',
        icon: Stamp,
        component: <WatermarkGenerator />,
        layoutClass: 'max-w-5xl mx-auto'
      },
      {
        id: 'md-to-img',
        name: 'Markdown 转图片',
        description: 'Markdown 文本实时渲染，一键转换为长图下载',
        icon: FileType,
        component: <MarkdownToImage />,
        layoutClass: 'w-full'
      },
      {
        id: 'qr-gen',
        name: '二维码生成',
        description: '实时生成二维码，支持自定义前景色、背景色与尺寸',
        icon: QrCode,
        component: <QrCodeGenerator />,
        layoutClass: 'max-w-5xl mx-auto'
      }
    ]
  },
  {
    id: CategoryId.MEDIA,
    name: '影音媒体',
    icon: FileVideo,
    description: '支持音视频格式转码、压缩、提取音频及剪辑等功能的影音工具箱。',
    tools: [
      {
        id: 'audio-convert',
        name: '音频压缩与转换',
        description: '支持音频/视频导入，可视化波形剪辑、音量调节、采样率转换与导出',
        icon: Music,
        component: <AudioConverter />,
        layoutClass: 'w-full'
      },
      {
        id: 'video-cmd',
        name: '视频压缩与转换',
        description: '本地解析视频参数，可视化生成 FFmpeg 转码与压缩命令',
        icon: Film,
        component: <VideoCommandGenerator />,
        layoutClass: 'w-full'
      }
    ]
  },
  {
    id: CategoryId.TEXT_DATA,
    name: '文本与数据',
    icon: FileText,
    description: '包含时间转换、哈希计算、UUID 生成、密码生成等通用数据处理工具。',
    tools: [
      {
        id: 'timestamp',
        name: '时间与日期',
        description: '实时时间戳、日期互转、公农历转换及时间差计算',
        icon: Clock,
        component: <TimestampConverter />,
        layoutClass: 'max-w-5xl mx-auto'
      },
      {
        id: 'password-gen',
        name: '随机密码生成',
        description: '可自定义字符类型与长度的高强度密码生成器',
        icon: KeyRound,
        component: <PasswordGenerator />,
        layoutClass: 'max-w-3xl mx-auto'
      },
      {
        id: 'uuid-gen',
        name: 'UUID 生成',
        description: '支持 V4 (随机) 与 V5 (基于命名空间) 的 UUID 生成',
        icon: Fingerprint,
        component: <UuidGenerator />,
        layoutClass: 'max-w-3xl mx-auto'
      },
      {
        id: 'md5-hash',
        name: 'MD5 计算器',
        description: '支持文本摘要计算与本地文件 MD5 哈希值计算',
        icon: Hash,
        component: <Md5Generator />,
        layoutClass: 'max-w-3xl mx-auto'
      }
    ]
  },
  {
    id: CategoryId.DEVELOPER,
    name: '开发者',
    icon: Code2,
    description: '提供代码运行、JSON 格式化、缓动函数可视化等编程辅助工具。',
    tools: [
      {
        id: 'json-format',
        name: 'JSON 格式化',
        description: 'JSON 数据的验证、美化、压缩、纠错与树状预览',
        icon: Braces,
        component: <JsonFormatter />,
        layoutClass: 'w-full'
      },
      {
        id: 'code-runner',
        name: '在线运行代码',
        description: '支持 50+ 种语言的在线编译与运行，提供即时反馈',
        icon: Terminal,
        component: <CodeRunner />,
        layoutClass: 'w-full'
      },
      {
        id: 'easing-vis',
        name: '缓动函数',
        description: '交互式展示 CSS/JS 常用缓动函数曲线与动画效果',
        icon: Activity,
        component: <EasingVisualizer />,
        layoutClass: 'max-w-7xl mx-auto'
      }
    ]
  },
  {
    id: CategoryId.NETWORK,
    name: '网络',
    icon: Network,
    description: '提供全球网络连通性检测、宽带测速及网络协议调试工具。',
    tools: [
      {
        id: 'check-host',
        name: '全球网络检测',
        description: '利用 Globalping 分布式网络检测全球各地的 Ping/HTTP/DNS/路由 连通性',
        icon: Globe,
        component: <CheckHost />,
        layoutClass: 'w-full'
      },
      {
        id: 'speed-test',
        name: '宽带测速',
        description: '精准检测网络下行与上行速度，支持延迟与抖动分析，实时图形化展示',
        icon: Gauge,
        component: <SpeedTest />,
        layoutClass: 'w-full'
      }
    ]
  }
];

const App: React.FC = () => {
  const [isHome, setIsHome] = useState(true);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(CategoryId.IMAGE);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeCategory = categories.find(c => c.id === activeCategoryId);
  const activeTool = activeCategory?.tools.find(t => t.id === activeToolId);

  const handleToolSelect = (toolId: string, categoryId?: string) => {
    if (categoryId) {
        setActiveCategoryId(categoryId);
    }
    setActiveToolId(toolId);
    setIsHome(false);
    
    // On mobile, close sidebar after selection
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    setActiveToolId(null); // Reset tool when category changes
    setIsHome(false);
  };

  const goHome = () => {
      setIsHome(true);
      setActiveToolId(null);
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
          <button 
            onClick={goHome}
            className="flex items-center gap-2 font-bold text-xl text-primary-600 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 bg-primary-600 text-white rounded-lg flex items-center justify-center">
              <Logo size={20} />
            </div>
            LOLO' Shoebox
          </button>
          <button className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <Sidebar 
          categories={categories} 
          activeCategoryId={activeCategoryId}
          activeToolId={isHome ? null : activeToolId}
          onSelectCategory={handleCategorySelect}
          onSelectTool={(id) => handleToolSelect(id)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            {isHome ? (
                <span className="font-medium text-gray-900">首页</span>
            ) : (
                <>
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
                </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <div className="w-full mx-auto">
            {isHome ? (
                <Home categories={categories} onSelectTool={handleToolSelect} />
            ) : (
                <>
                    {!activeTool ? (
                    // Category View (Tool Grid)
                    <div className="animate-fade-in max-w-5xl mx-auto">
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                            {activeCategory?.name}
                            </h1>
                            <p className="text-gray-500">
                            {activeCategory?.description}
                            </p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {activeCategory?.tools.map((tool) => (
                            <button
                                key={tool.id}
                                onClick={() => handleToolSelect(tool.id)}
                                className="flex flex-col text-left p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-200 hover:ring-1 hover:ring-primary-200 transition-all duration-200 group"
                            >
                                <div className="w-12 h-12 bg-gray-50 text-gray-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-600 group-hover:text-white transition-colors">
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
                    // Tool Detail View
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
                </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
