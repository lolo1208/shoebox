
/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { ImageMinus, Download, RefreshCw, X, Layers, Wand2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { removeBackground, Config } from '@imgly/background-removal';

const BackgroundRemover: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // View State
  const [isComparing, setIsComparing] = useState(false); // True = show original
  const [bgColor, setBgColor] = useState<'transparent' | 'white' | 'black' | 'checker'>('checker');

  // Clean up originalUrl independently
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl);
    };
  }, [originalUrl]);

  // Clean up processedUrl independently
  useEffect(() => {
    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl);
    };
  }, [processedUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        loadImage(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
        loadImage(e.dataTransfer.files[0]);
    }
  };

  const loadImage = (f: File) => {
      setFile(f);
      const url = URL.createObjectURL(f);
      setOriginalUrl(url);
      setProcessedUrl(null);
      setError(null);
      setProgressText('');
      setIsComparing(false);
  };

  const processImage = async () => {
    if (!originalUrl) return;
    
    setIsProcessing(true);
    setError(null);
    setProgressText('正在初始化...');

    try {
        // Robust calculation of publicPath relative to current deployment root.
        // It handles cases like:
        // - http://localhost/
        // - http://localhost/shoebox/
        // - http://localhost/shoebox/index.html
        
        let root = window.location.pathname;
        // Remove 'index.html' if present
        root = root.replace(/\/[^/]*\.html$/, '');
        // Remove trailing slash if present, to be consistent
        root = root.replace(/\/$/, '');
        
        // Construct final URL: origin + root + /models/...
        const publicPath = `${window.location.origin}${root}/models/imgly-bg-data/dist/`;

        const config: Config = {
            publicPath: publicPath,
            progress: (key: string, current: number, total: number) => {
                 if (key === 'compute:inference') {
                     const p = Math.round((current / total) * 100);
                     setProgressText(`AI 计算中: ${p}%`);
                 } else if (key.includes('fetch')) {
                     setProgressText('加载本地模型...');
                 }
            },
            debug: false,
            device: 'gpu' // Prefer GPU if available
        };

        const imageBlob = await removeBackground(originalUrl, config);
        
        const url = URL.createObjectURL(imageBlob);
        setProcessedUrl(url);
        setProgressText('完成');
    } catch (err: any) {
        console.error(err);
        setError('处理失败。请检查 public/models/imgly-bg-data/dist/ 目录是否存在且包含模型文件 (.wasm, .onnx)。' + (err.message ? ` (${err.message})` : ''));
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedUrl) return;
    const link = document.createElement('a');
    link.href = processedUrl;
    link.download = `removed_bg_${new Date().getTime()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  const getBgStyle = () => {
      switch (bgColor) {
          case 'white': return { backgroundColor: '#ffffff' };
          case 'black': return { backgroundColor: '#0f172a' }; // Slate 900
          case 'transparent': return { backgroundColor: 'transparent' };
          case 'checker': 
          default:
              return { backgroundImage: `url("${checkerboardPattern}")` };
      }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
        {/* Upload Area */}
        {!file ? (
             <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('bg-remove-upload')?.click()}
                className={`
                    h-80 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                    ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                `}
            >
                <input id="bg-remove-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <div className="w-20 h-20 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-6 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                    <ImageMinus size={40} />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">选择图片进行抠图</h3>
                <p className="text-gray-500">AI 自动识别主体，一键透明化处理</p>
            </div>
        ) : (
            <div className="flex flex-col h-full gap-6">
                {/* Header / Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                            <ImageMinus size={24} />
                        </div>
                        <div>
                            <div className="font-bold text-gray-900 line-clamp-1 max-w-[200px]">{file.name}</div>
                            <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                        <button 
                            onClick={() => { setFile(null); setOriginalUrl(null); setProcessedUrl(null); }}
                            className="ml-2 p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                            title="移除图片"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={processImage}
                            disabled={isProcessing || !!processedUrl}
                            className={`
                                flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white shadow-sm transition-all
                                ${isProcessing 
                                    ? 'bg-primary-600 opacity-70 cursor-wait' 
                                    : processedUrl 
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                        : 'bg-primary-600 hover:bg-primary-700 active:scale-95'}
                            `}
                        >
                            {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Wand2 size={18} />}
                            {isProcessing ? 'AI 计算中...' : processedUrl ? '已完成' : '开始抠图'}
                        </button>
                        
                        {processedUrl && (
                             <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-sm transition-all active:scale-95"
                            >
                                <Download size={18} />
                                下载 PNG
                            </button>
                        )}
                    </div>
                </div>

                {/* Main Display */}
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl flex flex-col overflow-hidden relative min-h-[400px]">
                     
                     {/* Top Status Badges */}
                     <div className="absolute top-4 left-4 flex gap-2 z-20">
                         {processedUrl ? (
                             <span className={`px-2 py-1 rounded text-xs font-medium backdrop-blur-sm shadow-sm transition-colors duration-200 ${isComparing ? 'bg-black/70 text-white' : 'bg-green-600/90 text-white'}`}>
                                 {isComparing ? '原图' : '抠图结果'}
                             </span>
                         ) : (
                             <span className="px-2 py-1 rounded text-xs font-medium bg-black/50 text-white backdrop-blur-sm">原图预览</span>
                         )}
                     </div>

                     <div 
                        className="flex-1 flex items-center justify-center p-8 overflow-auto transition-colors duration-300"
                        style={getBgStyle()}
                     >
                         {/* Image Display */}
                         {(processedUrl || originalUrl) ? (
                             <img 
                                src={isComparing ? originalUrl! : (processedUrl || originalUrl!)} 
                                alt="Content" 
                                className="max-w-full max-h-[600px] object-contain shadow-xl transition-all duration-200"
                                draggable={false}
                             />
                         ) : (
                             <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                                 {isProcessing ? (
                                     <RefreshCw className="animate-spin text-primary-500" size={32} />
                                 ) : (
                                     <Layers size={48} className="opacity-20" />
                                 )}
                                 <p className="text-sm font-medium text-gray-500">
                                     {isProcessing ? progressText : '请上传图片'}
                                 </p>
                             </div>
                         )}
                     </div>
                </div>

                {/* Controls Bar */}
                {processedUrl && (
                    <div className="flex justify-center animate-fade-in">
                        <div className="flex items-center gap-2 p-2 bg-white shadow-lg border border-gray-200 rounded-full">
                            {/* Compare Button */}
                            <button
                                onMouseDown={() => setIsComparing(true)}
                                onMouseUp={() => setIsComparing(false)}
                                onMouseLeave={() => setIsComparing(false)}
                                onTouchStart={() => setIsComparing(true)}
                                onTouchEnd={() => setIsComparing(false)}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-full text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all select-none shadow-sm"
                            >
                                {isComparing ? <EyeOff size={16} /> : <Eye size={16} />}
                                <span>按住对比</span>
                            </button>

                            <div className="w-px h-5 bg-gray-300 mx-1"></div>
                            
                            {/* Bg Toggles */}
                            <div className="flex gap-2 px-1">
                                <button onClick={() => setBgColor('checker')} className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all ${bgColor === 'checker' ? 'border-primary-500 ring-2 ring-primary-100 scale-110' : 'border-gray-200 hover:border-gray-300'}`} style={{ backgroundImage: `url("${checkerboardPattern}")` }} title="透明网格"></button>
                                <button onClick={() => setBgColor('white')} className={`w-8 h-8 rounded-full border bg-white transition-all ${bgColor === 'white' ? 'border-primary-500 ring-2 ring-primary-100 scale-110' : 'border-gray-200 hover:border-gray-300'}`} title="白色背景"></button>
                                <button onClick={() => setBgColor('black')} className={`w-8 h-8 rounded-full border bg-slate-900 transition-all ${bgColor === 'black' ? 'border-primary-500 ring-2 ring-primary-100 scale-110' : 'border-gray-200 hover:border-gray-300'}`} title="黑色背景"></button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error Box */}
                {error && (
                    <div className="bg-red-50 p-4 rounded-xl flex items-start gap-3 text-sm text-red-700 border border-red-100 animate-fade-in">
                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold mb-1">出错了</p>
                            <p className="opacity-90">{error}</p>
                            <p className="text-xs mt-1 text-red-500">
                                请确保已将解压后的 package 文件夹内容放置在 public/models/imgly-bg-data/ 目录下，且包含 dist 文件夹。
                            </p>
                        </div>
                    </div>
                )}
            </div>
        )}
    </div>
  );
};

export default BackgroundRemover;
