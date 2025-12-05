/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Scaling, Download, RefreshCw, X, FileImage, Lock, Unlock, ArrowRight } from 'lucide-react';

const ImageResizer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Dimensions
  const [originalW, setOriginalW] = useState(0);
  const [originalH, setOriginalH] = useState(0);
  const [targetW, setTargetW] = useState(0);
  const [targetH, setTargetH] = useState(0);
  const [scalePercent, setScalePercent] = useState(100);
  
  // Settings
  const [lockRatio, setLockRatio] = useState(true);
  const [mode, setMode] = useState<'pixel' | 'percent'>('percent');
  const [format, setFormat] = useState<'original' | 'jpeg' | 'png'>('original');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load image dimensions
  useEffect(() => {
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      setOriginalW(img.width);
      setOriginalH(img.height);
      // Reset targets to original
      setTargetW(img.width);
      setTargetH(img.height);
      setScalePercent(100);
      
      // Default export format logic
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          setFormat('jpeg');
      } else {
          setFormat('png');
      }
      
      URL.revokeObjectURL(objectUrl);
    };
    img.src = objectUrl;
    setPreviewUrl(objectUrl);
  }, [file]);

  // Sync mode changes
  const changeMode = (newMode: 'pixel' | 'percent') => {
      if (newMode === 'percent') {
          // Sync percent from current pixels
          if (originalW > 0) {
              const p = Math.round((targetW / originalW) * 100);
              setScalePercent(p);
          }
      } else {
          // Sync pixels from current percent (already set in state, but logic good to verify)
      }
      setMode(newMode);
  };

  // Handlers
  const handleDimensionChange = (dimension: 'w' | 'h', value: string) => {
    const val = parseInt(value) || 0;
    
    if (dimension === 'w') {
      setTargetW(val);
      if (lockRatio && originalW > 0) {
        const ratio = originalH / originalW;
        setTargetH(Math.round(val * ratio));
      }
    } else {
      setTargetH(val);
      if (lockRatio && originalH > 0) {
        const ratio = originalW / originalH;
        setTargetW(Math.round(val * ratio));
      }
    }
  };

  const handlePercentChange = (val: number) => {
    setScalePercent(val);
    if (originalW > 0 && originalH > 0) {
        setTargetW(Math.round(originalW * (val / 100)));
        setTargetH(Math.round(originalH * (val / 100)));
    }
  };

  const processAndDownload = () => {
    if (!file || targetW === 0 || targetH === 0) return;
    setIsProcessing(true);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw white background if JPG to prevent transparent becoming black
      const exportType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      if (exportType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // High quality scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      ctx.drawImage(img, 0, 0, targetW, targetH);
      
      canvas.toBlob((blob) => {
        if (!blob) return;
        
        const link = document.createElement('a');
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const nameParts = file.name.split('.');
        nameParts.pop();
        link.download = `${nameParts.join('.')}_${targetW}x${targetH}.${ext}`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsProcessing(false);
      }, exportType, 0.92);
    };
    img.src = objectUrl;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Left Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
         {/* Fix: Always mount input */}
         <input id="resize-upload" type="file" accept="image/*" className="hidden" onChange={(e) => (e.target as HTMLInputElement).files?.[0] && setFile((e.target as HTMLInputElement).files![0])} />

         {!file ? (
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('resize-upload')?.click()}
                className={`
                    h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                    ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                `}
            >
                <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                    <Scaling size={32} />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-1">导入图片</p>
                <p className="text-sm text-gray-500 px-4">支持拖拽，调整尺寸与比例</p>
            </div>
         ) : (
             <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
                 <button onClick={() => setFile(null)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                 </button>
                 <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                         <FileImage size={24} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{file.name}</h3>
                        <p className="text-xs text-gray-500">{originalW} x {originalH} px</p>
                    </div>
                 </div>

                 {/* Resize Controls */}
                 <div className="space-y-6 pt-4 border-t border-gray-100">
                     <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => changeMode('percent')} className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === 'percent' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>百分比</button>
                        <button onClick={() => changeMode('pixel')} className={`flex-1 py-1.5 text-xs font-medium rounded ${mode === 'pixel' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>像素值</button>
                     </div>

                     {mode === 'percent' ? (
                         <div className="space-y-2">
                             <div className="flex justify-between text-sm">
                                 <span className="text-gray-600">缩放比例</span>
                                 <span className="font-mono text-primary-600">{scalePercent}%</span>
                             </div>
                             <input 
                                type="range" min="1" max="200" step="1" 
                                value={scalePercent} 
                                onChange={(e) => handlePercentChange(parseInt((e.target as HTMLInputElement).value))}
                                className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                             />
                             <div className="flex justify-between text-xs text-gray-400 pt-1">
                                <span className="cursor-pointer hover:text-primary-600" onClick={() => handlePercentChange(25)}>25%</span>
                                <span className="cursor-pointer hover:text-primary-600" onClick={() => handlePercentChange(50)}>50%</span>
                                <span className="cursor-pointer hover:text-primary-600" onClick={() => handlePercentChange(75)}>75%</span>
                                <span className="cursor-pointer hover:text-primary-600" onClick={() => handlePercentChange(100)}>100%</span>
                             </div>
                             <div className="pt-2 text-center text-xs text-gray-500 font-mono">
                                结果: {targetW} x {targetH}
                             </div>
                         </div>
                     ) : (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">宽度 (W)</label>
                                    <input type="number" value={targetW} onChange={(e) => handleDimensionChange('w', (e.target as HTMLInputElement).value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <button onClick={() => setLockRatio(!lockRatio)} className={`mt-5 p-1.5 rounded ${lockRatio ? 'bg-primary-50 text-primary-600' : 'text-gray-400'}`}>
                                    {lockRatio ? <Lock size={16} /> : <Unlock size={16} />}
                                </button>
                                <div className="flex-1">
                                    <label className="text-xs text-gray-500 mb-1 block">高度 (H)</label>
                                    <input type="number" value={targetH} onChange={(e) => handleDimensionChange('h', (e.target as HTMLInputElement).value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>
                        </div>
                     )}

                     <div className="pt-2">
                         <label className="block text-sm font-medium text-gray-700 mb-2">导出格式</label>
                         <div className="flex gap-2">
                             <label className="flex-1 cursor-pointer border border-gray-200 p-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                                 <input type="radio" checked={format === 'jpeg'} onChange={() => setFormat('jpeg')} />
                                 <span className="text-sm">JPG</span>
                             </label>
                             <label className="flex-1 cursor-pointer border border-gray-200 p-2 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2">
                                 <input type="radio" checked={format === 'png'} onChange={() => setFormat('png')} />
                                 <span className="text-sm">PNG</span>
                             </label>
                         </div>
                     </div>
                 </div>
             </div>
         )}
      </div>

      {/* Right Preview */}
      <div className="flex-1 flex flex-col min-w-0">
         <div className="bg-gray-50 border border-gray-200 rounded-xl flex-1 flex flex-col relative overflow-hidden min-h-[400px]">
            <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center z-10">
                 <span className="font-semibold text-gray-700">实时预览</span>
                 {file && <span className="text-xs text-gray-400">预览已模拟导出尺寸与比例</span>}
            </div>
            
            <div 
                className="flex-1 flex items-center justify-center p-6 overflow-auto"
                style={{ backgroundImage: `url("${checkerboardPattern}")` }}
            >
                {previewUrl ? (
                    <img 
                        src={previewUrl} 
                        alt="Preview" 
                        style={{ 
                            // Simulate target dimensions
                            width: targetW + 'px',
                            height: targetH + 'px',
                            // CRITICAL FIX: Ensure min-dimensions match target to force scrolling
                            minWidth: targetW + 'px',
                            minHeight: targetH + 'px',
                            // CRITICAL FIX: Prevent flex item from shrinking
                            flexShrink: 0,
                            objectFit: 'fill' 
                        }}
                        className="shadow-lg bg-white" 
                    />
                ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                        <ArrowRight size={48} className="mb-2 opacity-20" />
                        <span>等待上传</span>
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-white border-t border-gray-200 z-10">
                <button
                    onClick={processAndDownload}
                    disabled={!file || isProcessing}
                    className={`
                        w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all
                        ${file 
                            ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                    `}
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                    {isProcessing ? '处理中...' : `导出图片 (${targetW} x ${targetH})`}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ImageResizer;