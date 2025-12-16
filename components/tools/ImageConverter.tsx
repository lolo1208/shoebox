/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { ImagePlus, Download, RefreshCw, X, ArrowRight, FileImage, Image as ImageIcon, Info } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import UPNG from 'upng-js';

const ImageConverter: React.FC = () => {
  // Settings
  const [outputFormat, setOutputFormat] = useLocalStorage<string>('tool-img-format', 'image/jpeg');
  const [quality, setQuality] = useLocalStorage<number>('tool-img-quality', 0.8);
  
  // PNG Specific Settings
  const [pngCompress, setPngCompress] = useLocalStorage<boolean>('tool-img-png-compress', false);
  const [pngColors, setPngColors] = useLocalStorage<number>('tool-img-png-colors', 256); // 2-256
  
  // File State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Clean up object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const processImage = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            setError('Browser canvas context not supported');
            setIsProcessing(false);
            return;
        }

        // Draw white background for transparent images (if converting to JPG)
        if (outputFormat === 'image/jpeg') {
             ctx.fillStyle = '#FFFFFF';
             ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        // Special handling for PNG compression
        if (outputFormat === 'image/png' && pngCompress) {
             try {
                 const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                 // UPNG.encode(buffer, width, height, cnum, [dels])
                 // cnum: 0 for lossless, >0 for color quantization (e.g. 256)
                 
                 // FIX: Wrap buffer in an array [imageData.data.buffer]
                 const pngBuffer = UPNG.encode([imageData.data.buffer], canvas.width, canvas.height, pngColors);
                 const blob = new Blob([pngBuffer], { type: 'image/png' });
                 
                 setConvertedBlob(blob);
                 const resUrl = URL.createObjectURL(blob);
                 if (previewUrl) URL.revokeObjectURL(previewUrl);
                 setPreviewUrl(resUrl);
                 setIsProcessing(false);
             } catch (e) {
                 console.error("UPNG error", e);
                 setError('PNG Compression failed');
                 setIsProcessing(false);
             }
        } else {
            // Standard Canvas Conversion (JPG or Lossless PNG)
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  setConvertedBlob(blob);
                  // Create a preview URL for the converted image result
                  const resUrl = URL.createObjectURL(blob);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(resUrl);
                } else {
                  setError('Conversion failed');
                }
                setIsProcessing(false);
              },
              outputFormat,
              quality
            );
        }
      };

      img.onerror = () => {
        setError('Failed to load image');
        setIsProcessing(false);
      };

      img.src = objectUrl;

    } catch (e) {
      setError('An error occurred during processing');
      console.error(e);
      setIsProcessing(false);
    }
  };

  // Auto process when file or settings change
  useEffect(() => {
    if (file) {
      // Debounce slightly for slider dragging
      const timer = setTimeout(() => {
        processImage();
      }, 500); // Increased debounce time as UPNG is heavier
      return () => clearTimeout(timer);
    } else {
        setConvertedBlob(null);
        setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, outputFormat, quality, pngCompress, pngColors]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type.startsWith('image/')) {
        setFile(droppedFile);
      } else {
        setError('请上传有效的图片文件');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    if (!convertedBlob || !file) return;
    
    const ext = outputFormat === 'image/jpeg' ? 'jpg' : 'png';
    // Remove original extension and append new one
    const originalName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const fileName = `${originalName}_converted.${ext}`;
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(convertedBlob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setFile(null);
    setConvertedBlob(null);
    setPreviewUrl(null);
    setError(null);
  };

  // Simple checkerboard pattern data URI (light gray/white)
  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
        {/* Left Side: Upload or File Info - Fixed Width */}
        <div className="w-full lg:w-80 space-y-6 shrink-0">
            {/* Input must be always mounted */}
            <input 
                id="img-upload" 
                type="file" 
                accept="image/png, image/jpeg, image/webp, image/gif, image/bmp"
                className="hidden" 
                onChange={handleFileSelect}
            />

            {!file ? (
                <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`
                        h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                        ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                    `}
                    onClick={() => document.getElementById('img-upload')?.click()}
                >
                    <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                        <ImagePlus size={32} />
                    </div>
                    <p className="text-lg font-bold text-gray-800 mb-1">导入图片</p>
                    <p className="text-sm text-gray-500 px-4">支持 JPG, PNG, WEBP, GIF 等</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
                     <button 
                        onClick={reset}
                        className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                        title="Remove file"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                             <FileImage size={32} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-gray-900 line-clamp-1 break-all">{file.name}</h3>
                            <p className="text-sm text-gray-500">原始大小: {formatSize(file.size)}</p>
                        </div>
                    </div>
                    
                    {/* Settings Panel */}
                    <div className="space-y-6 pt-6 border-t border-gray-100">
                         <div className="grid grid-cols-1 gap-6">
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">目标格式</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        onClick={() => setOutputFormat('image/jpeg')}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${outputFormat === 'image/jpeg' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        JPG
                                    </button>
                                    <button
                                        onClick={() => setOutputFormat('image/png')}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${outputFormat === 'image/png' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                        PNG
                                    </button>
                                </div>
                             </div>

                             {outputFormat === 'image/jpeg' && (
                                 <div className="animate-fade-in">
                                    <div className="flex justify-between mb-2">
                                        <label className="text-sm font-medium text-gray-700">图像质量</label>
                                        <span className="text-sm font-mono text-primary-600">{(quality * 100).toFixed(0)}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1.0"
                                        step="0.05"
                                        value={quality}
                                        onChange={(e) => setQuality(parseFloat((e.target as HTMLInputElement).value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                                        <span>低 (小)</span>
                                        <span>高 (大)</span>
                                    </div>
                                 </div>
                             )}
                             
                             {outputFormat === 'image/png' && (
                                 <div className="space-y-4 animate-fade-in">
                                     <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-lg flex gap-2">
                                         <div className="shrink-0 mt-0.5"><Info size={16}/></div>
                                         <p className="text-xs">
                                             原生 PNG 为无损。开启<strong>“有损压缩”</strong>可大幅减小体积。
                                         </p>
                                     </div>

                                     <label className="flex items-center space-x-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={pngCompress}
                                            onChange={(e) => setPngCompress((e.target as HTMLInputElement).checked)}
                                            className="w-5 h-5 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                                        />
                                        <span className="font-medium text-gray-700 text-sm">启用 PNG 有损压缩</span>
                                     </label>

                                     {pngCompress && (
                                         <div className="pl-8 animate-fade-in">
                                            <div className="flex justify-between mb-2">
                                                <label className="text-sm font-medium text-gray-700">颜色深度</label>
                                                <span className="text-sm font-mono text-primary-600">{pngColors}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="2"
                                                max="256"
                                                step="2"
                                                value={pngColors}
                                                onChange={(e) => setPngColors(parseInt((e.target as HTMLInputElement).value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                            />
                                        </div>
                                     )}
                                 </div>
                             )}
                         </div>
                    </div>
                </div>
            )}

            {error && (
                 <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                     {error}
                 </div>
            )}
        </div>

        {/* Right Side: Preview & Action - Fluid Width */}
        <div className="flex-1 flex flex-col min-w-0">
            <div className="bg-gray-50 border border-gray-200 rounded-xl flex-1 flex flex-col relative overflow-hidden min-h-[400px]">
                <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
                    <span className="font-semibold text-gray-700">预览结果</span>
                    {convertedBlob && (
                         <span className={`text-sm font-mono font-medium ${convertedBlob.size < file!.size ? 'text-green-600' : 'text-orange-600'}`}>
                            {formatSize(convertedBlob.size)} 
                            {convertedBlob.size < file!.size ? 
                                ` (↓${((1 - convertedBlob.size / file!.size) * 100).toFixed(1)}%)` : 
                                ' (↑)'
                            }
                         </span>
                    )}
                </div>
                
                <div 
                  className="flex-1 flex items-center justify-center p-6 overflow-auto"
                  style={{ backgroundImage: `url("${checkerboardPattern}")` }}
                >
                    {isProcessing ? (
                        <div className="flex flex-col items-center gap-3 text-primary-600">
                            <RefreshCw className="animate-spin" size={32} />
                            <span className="font-medium">处理中...</span>
                        </div>
                    ) : previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="max-w-full max-h-[600px] object-contain shadow-lg bg-white" />
                    ) : (
                        <div className="text-gray-400 flex flex-col items-center">
                            <ArrowRight size={48} className="mb-2 opacity-20" />
                            <span>上传图片查看预览</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white border-t border-gray-200">
                    <button
                        onClick={handleDownload}
                        disabled={!convertedBlob}
                        className={`
                            w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all
                            ${convertedBlob 
                                ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md' 
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                        `}
                    >
                        <Download size={20} />
                        下载转换后的图片
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default ImageConverter;