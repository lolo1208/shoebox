/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Crop, Upload, Download, RefreshCw, X, FileImage, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ArrowDownToLine, FoldHorizontal, FoldVertical, Crosshair } from 'lucide-react';

const ImageCropper: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  
  // Image natural dimensions
  const [imgNaturalW, setImgNaturalW] = useState(0);
  const [imgNaturalH, setImgNaturalH] = useState(0);

  // Crop State (in Image Pixels)
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [cropW, setCropW] = useState(0);
  const [cropH, setCropH] = useState(0);

  const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Interaction State
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizingCrop, setIsResizingCrop] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<number>(1); // For proportional scaling

  useEffect(() => {
    return () => {
      if (imgSrc) URL.revokeObjectURL(imgSrc);
    };
  }, [imgSrc]);

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImgNaturalW(img.width);
      setImgNaturalH(img.height);
      setImgSrc(objectUrl);
      
      // Default crop: Center 80%
      const w = Math.floor(img.width * 0.8);
      const h = Math.floor(img.height * 0.8);
      const x = Math.floor((img.width - w) / 2);
      const y = Math.floor((img.height - h) / 2);
      
      setCropW(w);
      setCropH(h);
      setCropX(x);
      setCropY(y);

      setFormat(file.type === 'image/png' ? 'png' : 'jpeg');
    };
    img.src = objectUrl;
  }, [file]);

  // Helpers to clamp values
  const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

  // Manual Input Handlers
  const handleInputChange = (field: 'x' | 'y' | 'w' | 'h', valStr: string) => {
    let val = parseInt(valStr) || 0;
    if (field === 'x') {
      val = clamp(val, 0, imgNaturalW - cropW);
      setCropX(val);
    } else if (field === 'y') {
      val = clamp(val, 0, imgNaturalH - cropH);
      setCropY(val);
    } else if (field === 'w') {
      val = clamp(val, 1, imgNaturalW - cropX);
      setCropW(val);
    } else if (field === 'h') {
      val = clamp(val, 1, imgNaturalH - cropY);
      setCropH(val);
    }
  };

  // Alignment Helpers
  const align = (direction: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom' | 'center-all') => {
      if (imgNaturalW === 0 || imgNaturalH === 0) return;

      switch(direction) {
          case 'left':
              setCropX(0);
              break;
          case 'center-x':
              setCropX(Math.floor((imgNaturalW - cropW) / 2));
              break;
          case 'right':
              setCropX(imgNaturalW - cropW);
              break;
          case 'top':
              setCropY(0);
              break;
          case 'center-y':
              setCropY(Math.floor((imgNaturalH - cropH) / 2));
              break;
          case 'bottom':
              setCropY(imgNaturalH - cropH);
              break;
          case 'center-all':
              setCropX(Math.floor((imgNaturalW - cropW) / 2));
              setCropY(Math.floor((imgNaturalH - cropH) / 2));
              break;
      }
  };

  // --- Interaction Logic ---

  const getScale = () => {
    if (!imageRef.current) return 1;
    return imageRef.current.width / imgNaturalW; // Displayed Width / Real Width
  };

  const onMouseDownCrop = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsDraggingCrop(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCropStart({ x: cropX, y: cropY, w: cropW, h: cropH });
  };

  const onMouseDownHandle = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizingCrop(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCropStart({ x: cropX, y: cropY, w: cropW, h: cropH });
    // Store initial aspect ratio for proportional resizing
    if (cropH !== 0) {
        setAspectRatio(cropW / cropH);
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop && !isResizingCrop) return;
    const scale = getScale();
    const dx = (e.clientX - dragStart.x) / scale;
    const dy = (e.clientY - dragStart.y) / scale;

    if (isDraggingCrop) {
      let newX = cropStart.x + dx;
      let newY = cropStart.y + dy;
      
      // Boundary check
      newX = clamp(newX, 0, imgNaturalW - cropW);
      newY = clamp(newY, 0, imgNaturalH - cropH);
      
      setCropX(Math.round(newX));
      setCropY(Math.round(newY));
    }

    if (isResizingCrop) {
      if (resizeHandle === 'se') {
        // Proportional Scaling
        let newW = clamp(cropStart.w + dx, 10, imgNaturalW - cropStart.x);
        // Recalculate H based on fixed aspect ratio
        let newH = newW / aspectRatio;
        
        // Check if H is out of bounds
        if (cropStart.y + newH > imgNaturalH) {
             newH = imgNaturalH - cropStart.y;
             newW = newH * aspectRatio; // Adjust W back
        }

        setCropW(Math.round(newW));
        setCropH(Math.round(newH));
      } 
      else if (resizeHandle === 'e') {
        // Width Only
        const newW = clamp(cropStart.w + dx, 10, imgNaturalW - cropStart.x);
        setCropW(Math.round(newW));
      }
      else if (resizeHandle === 's') {
        // Height Only
        const newH = clamp(cropStart.h + dy, 10, imgNaturalH - cropStart.y);
        setCropH(Math.round(newH));
      }
    }
  };

  const onMouseUp = () => {
    setIsDraggingCrop(false);
    setIsResizingCrop(false);
  };

  const handleDownload = () => {
    if (!imgSrc) return;
    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw slice
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const nameParts = file!.name.split('.');
        nameParts.pop();
        link.download = `${nameParts.join('.')}_crop.${ext}`;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setIsProcessing(false);
      }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
    };
    img.src = imgSrc;
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    if (e.dataTransfer.files?.[0] && e.dataTransfer.files[0].type.startsWith('image/')) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  const ButtonStyle = "p-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-600 transition-colors";

  return (
    <div 
      className="flex flex-col lg:flex-row gap-8 h-full"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Left Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        {/* Fix: Always mount input */}
        <input id="crop-upload" type="file" accept="image/*" className="hidden" onChange={(e) => (e.target as HTMLInputElement).files?.[0] && setFile((e.target as HTMLInputElement).files![0])} />

        {!file ? (
             <div
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('crop-upload')?.click()}
                className={`
                    h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                    ${isDraggingFile ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
                `}
            >
                <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                    <Crop size={32} />
                </div>
                <p className="text-lg font-bold text-gray-800 mb-1">打开图片</p>
                <p className="text-sm text-gray-500 px-4">自由裁剪或按比例截取</p>
            </div>
        ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 relative">
                 <button onClick={() => setFile(null)} className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600">
                    <X size={20} />
                 </button>
                 <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                         <FileImage size={24} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{file.name}</h3>
                        <p className="text-xs text-gray-500">{imgNaturalW} x {imgNaturalH} px</p>
                    </div>
                 </div>

                 <div className="space-y-4 pt-4 border-t border-gray-100">
                     <h4 className="text-sm font-semibold text-gray-800">对齐控制</h4>
                     
                     {/* Alignment Controls - Unified Style */}
                     <div className="space-y-2">
                        <div className="flex gap-2 justify-between">
                             <button onClick={() => align('left')} className={ButtonStyle} title="左对齐"><ArrowLeftToLine size={18}/></button>
                             <button onClick={() => align('center-x')} className={ButtonStyle} title="水平居中"><FoldHorizontal size={18}/></button>
                             <button onClick={() => align('right')} className={ButtonStyle} title="右对齐"><ArrowRightToLine size={18}/></button>
                             <div className="w-px bg-gray-200 mx-1"></div>
                             <button onClick={() => align('center-all')} className={ButtonStyle} title="完全居中"><Crosshair size={18}/></button>
                        </div>
                        <div className="flex gap-2 justify-between">
                             <button onClick={() => align('top')} className={ButtonStyle} title="顶部对齐"><ArrowUpToLine size={18}/></button>
                             <button onClick={() => align('center-y')} className={ButtonStyle} title="垂直居中"><FoldVertical size={18}/></button>
                             <button onClick={() => align('bottom')} className={ButtonStyle} title="底部对齐"><ArrowDownToLine size={18}/></button>
                             <div className="w-px bg-gray-200 mx-1"></div>
                             <div className="w-[34px]"></div> {/* Spacer */}
                        </div>
                     </div>

                     <h4 className="text-sm font-semibold text-gray-800 pt-2">尺寸与位置</h4>
                     <div className="grid grid-cols-2 gap-3">
                         <div>
                             <label className="text-xs text-gray-500 block mb-1">X 坐标</label>
                             <input 
                                type="number" value={cropX} 
                                onChange={(e) => handleInputChange('x', (e.target as HTMLInputElement).value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                             />
                         </div>
                         <div>
                             <label className="text-xs text-gray-500 block mb-1">Y 坐标</label>
                             <input 
                                type="number" value={cropY} 
                                onChange={(e) => handleInputChange('y', (e.target as HTMLInputElement).value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                             />
                         </div>
                         <div>
                             <label className="text-xs text-gray-500 block mb-1">宽度 (W)</label>
                             <input 
                                type="number" value={cropW} 
                                onChange={(e) => handleInputChange('w', (e.target as HTMLInputElement).value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                             />
                         </div>
                         <div>
                             <label className="text-xs text-gray-500 block mb-1">高度 (H)</label>
                             <input 
                                type="number" value={cropH} 
                                onChange={(e) => handleInputChange('h', (e.target as HTMLInputElement).value)}
                                className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                             />
                         </div>
                     </div>

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

      {/* Right Interactive Area */}
      <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-gray-50 border border-gray-200 rounded-xl flex-1 flex flex-col relative overflow-hidden min-h-[500px]">
               <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center z-10">
                 <span className="font-semibold text-gray-700">编辑与预览</span>
                 {file && <span className="text-xs text-gray-400">拖拽方框移动，右侧/底部/右下角调整大小</span>}
               </div>

               <div 
                   className="flex-1 relative overflow-auto flex items-center justify-center p-8 select-none"
                   style={{ backgroundImage: `url("${checkerboardPattern}")` }}
                   ref={containerRef}
               >
                   {imgSrc ? (
                       <div className="relative shadow-lg inline-block line-height-0">
                           <img 
                               ref={imageRef}
                               src={imgSrc} 
                               alt="To Crop" 
                               className="max-w-full max-h-[70vh] block"
                               draggable={false}
                           />
                           
                           {/* Shadow Overlay - This dims the area outside the crop */}
                           <div 
                               className="absolute cursor-move"
                               style={{
                                   left: `${(cropX / imgNaturalW) * 100}%`,
                                   top: `${(cropY / imgNaturalH) * 100}%`,
                                   width: `${(cropW / imgNaturalW) * 100}%`,
                                   height: `${(cropH / imgNaturalH) * 100}%`,
                                   boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                   border: '1px solid rgba(255,255,255,0.8)'
                               }}
                               onMouseDown={onMouseDownCrop}
                           >
                               {/* Resize Handle (SE) - Proportional */}
                               <div 
                                   className="absolute bottom-[-6px] right-[-6px] w-4 h-4 bg-primary-600 border-2 border-white rounded-full cursor-se-resize z-20 hover:scale-125 transition-transform shadow-sm"
                                   onMouseDown={(e) => onMouseDownHandle(e, 'se')}
                                   title="等比缩放"
                               />
                               
                               {/* Resize Handle (E) - Width Only */}
                               <div 
                                   className="absolute top-1/2 right-[-6px] -translate-y-1/2 w-3 h-6 bg-white border border-gray-400 rounded-full cursor-e-resize z-20 hover:bg-primary-50 transition-colors shadow-sm"
                                   onMouseDown={(e) => onMouseDownHandle(e, 'e')}
                                   title="调整宽度"
                               />

                               {/* Resize Handle (S) - Height Only */}
                               <div 
                                   className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-gray-400 rounded-full cursor-s-resize z-20 hover:bg-primary-50 transition-colors shadow-sm"
                                   onMouseDown={(e) => onMouseDownHandle(e, 's')}
                                   title="调整高度"
                               />
                               
                               {/* Grid lines */}
                               <div className="absolute inset-0 flex flex-col pointer-events-none opacity-30">
                                   <div className="flex-1 border-b border-white"></div>
                                   <div className="flex-1 border-b border-white"></div>
                                   <div className="flex-1"></div>
                               </div>
                               <div className="absolute inset-0 flex pointer-events-none opacity-30">
                                   <div className="flex-1 border-r border-white"></div>
                                   <div className="flex-1 border-r border-white"></div>
                                   <div className="flex-1"></div>
                               </div>
                           </div>
                       </div>
                   ) : (
                       <div className="text-gray-400 flex flex-col items-center">
                            <FileImage size={48} className="mb-2 opacity-20" />
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
                        {isProcessing ? '处理中...' : `导出裁剪区域 (${cropW} x ${cropH})`}
                    </button>
               </div>
          </div>
      </div>
    </div>
  );
};

export default ImageCropper;