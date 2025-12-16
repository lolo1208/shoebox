/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Grid, Upload, Download, RefreshCw, X, FileImage, ArrowRight } from 'lucide-react';
import JSZip from 'jszip';

const ImageGridSlicer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Dimensions & Grid
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);
  
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Zoom State
  const [zoom, setZoom] = useState(1);

  // Clean up
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load Image
  useEffect(() => {
    if (!file) return;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      setImgW(img.width);
      setImgH(img.height);
      setPreviewUrl(objectUrl);
      setZoom(1); // Reset zoom on new file
      // Don't revoke yet as we need it for preview img src, but clean up old one
    };
    img.src = objectUrl;
  }, [file]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
      if (!file) return;
      // Simple zoom logic
      const delta = e.deltaY * -0.001;
      setZoom(prev => Math.min(Math.max(0.1, prev + delta), 5));
  };

  const handleDownload = async () => {
    if (!file || !previewUrl) return;
    setIsProcessing(true);

    try {
        const img = new Image();
        img.src = previewUrl;
        await img.decode();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("No context");

        const sliceW = Math.floor(img.width / cols);
        const sliceH = Math.floor(img.height / rows);
        
        canvas.width = sliceW;
        canvas.height = sliceH;

        const zip = new JSZip();
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const ext = file.type === 'image/png' ? 'png' : 'jpg';
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

        let count = 0;
        
        // Loop Rows then Cols
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                ctx.clearRect(0, 0, sliceW, sliceH);
                // Draw slice
                ctx.drawImage(img, c * sliceW, r * sliceH, sliceW, sliceH, 0, 0, sliceW, sliceH);
                
                // Convert to blob
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mime, 0.95));
                if (blob) {
                    // Filename: name_row_col.ext (1-based index)
                    const fileName = `${baseName}_${r+1}_${c+1}.${ext}`;
                    zip.file(fileName, blob);
                    count++;
                }
            }
        }

        // Generate Zip
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.download = `${baseName}_slices.zip`;
        link.href = URL.createObjectURL(zipBlob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error(e);
        alert("Processing failed");
    } finally {
        setIsProcessing(false);
    }
  };

  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Left Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        {/* Fix: Always mount input */}
        <input id="slice-upload" type="file" accept="image/*" className="hidden" onChange={(e) => (e.target as HTMLInputElement).files?.[0] && setFile((e.target as HTMLInputElement).files![0])} />

        {!file ? (
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('slice-upload')?.click()}
                className={`
                    h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                    ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                `}
            >
                <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                    <Grid size={32} />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-1">选择图片</p>
                <p className="text-sm text-gray-500 px-4">制作九宫格或自定义切片</p>
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
                        <p className="text-xs text-gray-500">{imgW} x {imgH} px</p>
                    </div>
                 </div>

                 {/* Controls */}
                 <div className="space-y-6 pt-4 border-t border-gray-100">
                     <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2">
                        <Grid size={16} className="text-blue-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700">
                            将图片切分为 {rows} 行 {cols} 列，共 <strong>{rows * cols}</strong> 张小图。
                        </p>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">行数 (Rows)</label>
                            <input 
                                type="number" min="1" max="20"
                                value={rows} 
                                onChange={(e) => setRows(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">列数 (Cols)</label>
                            <input 
                                type="number" min="1" max="20"
                                value={cols} 
                                onChange={(e) => setCols(Math.max(1, parseInt((e.target as HTMLInputElement).value) || 1))}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                            />
                        </div>
                     </div>
                     
                     <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex justify-between">
                            <span>单张尺寸:</span>
                            <span className="font-mono">{Math.floor(imgW/cols)} x {Math.floor(imgH/rows)} px</span>
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
                 <span className="font-semibold text-gray-700">预览结果</span>
                 {file && (
                     <div className="flex items-center gap-4 text-xs">
                        <span className="text-primary-600 font-medium">滚动鼠标缩放 {(zoom * 100).toFixed(0)}%</span>
                        <span className="text-gray-400">虚线表示切割位置</span>
                     </div>
                 )}
            </div>
            
            <div 
                className="flex-1 flex items-center justify-center p-6 overflow-auto"
                style={{ backgroundImage: `url("${checkerboardPattern}")` }}
                onWheel={handleWheel}
            >
                {previewUrl ? (
                    <div 
                        className="relative shadow-lg bg-white inline-block origin-center transition-all duration-75"
                        style={{ 
                            width: `${imgW * zoom}px`,
                            height: `${imgH * zoom}px`
                        }}
                    >
                        <img 
                            src={previewUrl} 
                            alt="Preview" 
                            className="w-full h-full block"
                            draggable={false}
                        />
                        {/* Grid Overlay */}
                        <div className="absolute inset-0 pointer-events-none border border-red-500 opacity-50">
                             {/* Horizontal Lines */}
                             {Array.from({length: rows - 1}).map((_, i) => (
                                <div 
                                    key={`r-${i}`} 
                                    className="absolute left-0 right-0 border-t border-red-500 border-dashed"
                                    style={{ top: `${((i + 1) / rows) * 100}%` }}
                                ></div>
                             ))}
                             {/* Vertical Lines */}
                             {Array.from({length: cols - 1}).map((_, i) => (
                                <div 
                                    key={`c-${i}`} 
                                    className="absolute top-0 bottom-0 border-l border-red-500 border-dashed"
                                    style={{ left: `${((i + 1) / cols) * 100}%` }}
                                ></div>
                             ))}
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-400 flex flex-col items-center">
                        <ArrowRight size={48} className="mb-2 opacity-20" />
                        <span>等待上传</span>
                    </div>
                )}
            </div>
            
            <div className="p-4 bg-white border-t border-gray-200 z-10">
                <button
                    onClick={handleDownload}
                    disabled={!file || isProcessing}
                    className={`
                        w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all
                        ${file 
                            ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                    `}
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <Download size={20} />}
                    {isProcessing ? '打包中...' : `下载 ZIP 包 (${rows * cols} 张图片)`}
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ImageGridSlicer;