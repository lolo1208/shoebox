/// <reference lib="dom" />
import React, { useState, useRef, useEffect } from 'react';
import { Stamp, Download, RefreshCw, X, Image as ImageIcon } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const WatermarkGenerator: React.FC = () => {
  // Settings
  const [text, setText] = useLocalStorage<string>('tool-wm-text', '仅供资料审核使用');
  const [color, setColor] = useLocalStorage<string>('tool-wm-color', '#B8B8B8');
  const [alpha, setAlpha] = useLocalStorage<number>('tool-wm-alpha', 0.4);
  const [angle, setAngle] = useLocalStorage<number>('tool-wm-angle', 25);
  const [space, setSpace] = useLocalStorage<number>('tool-wm-space', 8);
  const [size, setSize] = useLocalStorage<number>('tool-wm-size', 1.5);
  const [format, setFormat] = useLocalStorage<string>('tool-wm-format', 'jpeg');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // File & Preview
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const drawWatermark = () => {
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Setup Text
      const textSize = size * Math.max(15, (Math.min(canvas.width, canvas.height)) / 25);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.font = `bold ${textSize}px -apple-system,"Helvetica Neue",Helvetica,Arial,sans-serif`;

      const textMetrics = ctx.measureText(text || ' ');
      const textWidth = textMetrics.width;
      const margin = ctx.measureText('啊').width; // Rough margin approximation

      // Calculate grid
      const step = Math.sqrt(Math.pow(canvas.width, 2) + Math.pow(canvas.height, 2));
      const xCount = Math.ceil(step / (textWidth + margin));
      const yCount = Math.ceil((step / (space * textSize)) / 2);

      // Draw grid loop
      for (let i = -xCount; i <= xCount; i++) {
        for (let j = -yCount; j <= yCount; j++) {
          ctx.fillText(text, (textWidth + margin) * i, space * textSize * j);
        }
      }

      ctx.restore();

      canvasRef.current = canvas;

      // Update Preview
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(url);
        }
      }, format === 'jpeg' ? 'image/jpeg' : 'image/png');
    };

    img.src = objectUrl;
  };

  // Trigger draw when deps change
  useEffect(() => {
    if (file && autoRefresh) {
      // Debounce slightly for slider performance
      const timer = setTimeout(drawWatermark, 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, color, alpha, angle, space, size, file, autoRefresh, format]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      const f = e.dataTransfer.files[0];
      if (f.type.startsWith('image/')) setFile(f);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `watermark_${new Date().getTime()}.${ext}`;

    const dataUrl = canvasRef.current.toDataURL(mimeType, 0.9);
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Upload Section */}
        <div className="lg:col-span-1 space-y-4">
             <div 
                className={`
                   border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all
                   ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                   ${file ? 'bg-gray-50' : ''}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('wm-upload')?.click()}
             >
                <input 
                   id="wm-upload" 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   onChange={(e) => (e.target as HTMLInputElement).files?.[0] && setFile((e.target as HTMLInputElement).files![0])} 
                />
                
                {file ? (
                    <div className="text-center px-4">
                        <ImageIcon className="mx-auto text-gray-400 group-hover:text-primary-600 mb-2 transition-colors" size={32} />
                        <p className="font-medium text-gray-700 truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-1">点击更换底图</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                            <Stamp size={24} />
                        </div>
                        <p className="text-base font-bold text-gray-800">选择底图</p>
                        <p className="text-xs text-gray-500 mt-1">拖拽或点击导入</p>
                    </div>
                )}
             </div>

             <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-700">水印文字</label>
                 <input 
                    type="text" 
                    value={text} 
                    onChange={(e) => setText((e.target as HTMLInputElement).value)}
                    className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500"
                    placeholder="请输入水印内容"
                 />
             </div>
        </div>

        {/* Sliders Section */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
            <div>
                <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">颜色</label>
                    <span className="text-xs font-mono text-gray-400">{color}</span>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="color" 
                        value={color} 
                        onChange={(e) => setColor((e.target as HTMLInputElement).value)}
                        className="h-9 w-12 p-1 bg-white border border-gray-300 rounded cursor-pointer"
                    />
                    <input 
                       type="text"
                       value={color}
                       onChange={(e) => setColor((e.target as HTMLInputElement).value)}
                       className="flex-1 p-2 border border-gray-300 rounded-lg text-sm"
                    />
                </div>
            </div>

            <div>
                <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">透明度</label>
                    <span className="text-xs text-primary-600">{alpha}</span>
                </div>
                <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={alpha} onChange={(e) => setAlpha(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                />
            </div>

            <div>
                <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">角度</label>
                    <span className="text-xs text-primary-600">{angle}°</span>
                </div>
                <input 
                    type="range" min="-90" max="90" step="1" 
                    value={angle} onChange={(e) => setAngle(parseInt((e.target as HTMLInputElement).value))}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                />
            </div>

             <div>
                <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">间距 (Space)</label>
                    <span className="text-xs text-primary-600">{space}</span>
                </div>
                <input 
                    type="range" min="1" max="10" step="0.2" 
                    value={space} onChange={(e) => setSpace(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                />
            </div>
            
            <div>
                <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">字号 (Size)</label>
                    <span className="text-xs text-primary-600">{size}x</span>
                </div>
                <input 
                    type="range" min="0.5" max="5" step="0.1" 
                    value={size} onChange={(e) => setSize(parseFloat((e.target as HTMLInputElement).value))}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                />
            </div>

            <div className="flex items-end gap-4">
                 <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-2">下载格式</label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setFormat('jpeg')}
                            className={`flex-1 py-1 text-xs font-medium rounded ${format === 'jpeg' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                        >
                            JPG
                        </button>
                        <button 
                            onClick={() => setFormat('png')}
                            className={`flex-1 py-1 text-xs font-medium rounded ${format === 'png' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-500'}`}
                        >
                            PNG
                        </button>
                    </div>
                 </div>
                 <div className="flex-1 pb-1">
                     <label className="flex items-center gap-2 cursor-pointer">
                         <input 
                            type="checkbox" 
                            checked={autoRefresh} 
                            onChange={(e) => setAutoRefresh((e.target as HTMLInputElement).checked)}
                            className="rounded text-primary-600 focus:ring-primary-500"
                         />
                         <span className="text-sm text-gray-700">实时刷新</span>
                     </label>
                 </div>
            </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
              onClick={drawWatermark}
              disabled={!file}
              className="px-4 py-2 text-sm bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
              <RefreshCw size={16} className="inline mr-2" />
              手动刷新
          </button>
          <button
              onClick={handleDownload}
              disabled={!file || !previewUrl}
              className="px-6 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 shadow-sm"
          >
              <Download size={16} className="inline mr-2" />
              下载图片
          </button>
      </div>

      {/* Preview Area */}
      <div className="bg-gray-100 rounded-xl border border-gray-200 p-4 min-h-[400px] flex items-center justify-center overflow-auto">
          {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="max-w-full shadow-lg bg-white" />
          ) : (
              <div className="text-gray-400 text-center">
                  <ImageIcon size={48} className="mx-auto mb-2 opacity-20" />
                  <p>预览区域</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default WatermarkGenerator;