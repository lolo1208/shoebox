/// <reference lib="dom" />
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, RefreshCw, X, Plus, RotateCw, Trash2, ArrowUp, ArrowDown, LayoutTemplate, ChevronDown, ChevronRight, Smartphone, Monitor, FileText, Instagram, Hash, Layers, ArrowRightLeft } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

interface CanvasElement {
  id: string;
  src: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
}

// Structured Presets
const PRESET_CATEGORIES = [
  {
    id: 'common',
    label: '常用标准',
    icon: Hash,
    items: [
      { name: '1080P (FHD)', w: 1920, h: 1080 },
      { name: '2K QHD', w: 2560, h: 1440 },
      { name: '4K UHD', w: 3840, h: 2160 },
      { name: 'A4 纸张 (300dpi)', w: 2480, h: 3508 },
      { name: '4:3 标准', w: 800, h: 600 },
      { name: '1:1 方图', w: 1080, h: 1080 },
    ]
  },
  {
    id: 'social',
    label: '社交媒体',
    icon: Instagram,
    items: [
      { name: '公众号封面(首)', w: 900, h: 383 },
      { name: '公众号封面(次)', w: 200, h: 200 },
      { name: '小红书 (3:4)', w: 1242, h: 1660 },
      { name: 'Instagram Story', w: 1080, h: 1920 },
      { name: 'B站/Youtube 封面', w: 1280, h: 720 },
      { name: '朋友圈海报', w: 1080, h: 1920 },
    ]
  },
  {
    id: 'mobile',
    label: '手机设备',
    icon: Smartphone,
    items: [
      { name: 'iPhone 15 Pro Max', w: 1290, h: 2796 },
      { name: 'iPhone 15/14 Pro', w: 1179, h: 2556 },
      { name: 'Samsung S24 Ultra', w: 1440, h: 3120 },
      { name: 'Google Pixel 8 Pro', w: 1344, h: 2992 },
      { name: 'Huawei Mate 60 Pro', w: 1260, h: 2720 },
      { name: 'iPhone SE', w: 750, h: 1334 },
      { name: 'Android 通用', w: 1080, h: 2400 },
    ]
  },
  {
    id: 'tablet',
    label: '平板设备',
    icon: Layers,
    items: [
      { name: 'iPad Pro 12.9"', w: 2048, h: 2732 },
      { name: 'iPad Air/Pro 11"', w: 1668, h: 2388 },
      { name: 'Samsung Tab S9 Ultra', w: 1848, h: 2960 },
      { name: 'Surface Pro 9', w: 2880, h: 1920 },
      { name: 'iPad mini', w: 1488, h: 2266 },
    ]
  },
  {
    id: 'desktop',
    label: '电脑屏幕',
    icon: Monitor,
    items: [
      { name: '4K UHD', w: 3840, h: 2160 },
      { name: '2K QHD', w: 2560, h: 1440 },
      { name: 'Full HD', w: 1920, h: 1080 },
      { name: 'MacBook Pro 16"', w: 3456, h: 2234 },
      { name: 'MacBook Air', w: 2560, h: 1664 },
    ]
  },
  {
    id: 'paper',
    label: '纸张/打印 (300dpi)',
    icon: FileText,
    items: [
      { name: 'A4', w: 2480, h: 3508 },
      { name: 'A3', w: 3508, h: 4961 },
      { name: 'A5', w: 1748, h: 2480 },
      { name: '名片 (90x54mm)', w: 1063, h: 638 },
      { name: 'A4 (屏幕用 72dpi)', w: 595, h: 842 },
    ]
  }
];

const ImageComposition: React.FC = () => {
  // Canvas Settings
  const [canvasW, setCanvasW] = useLocalStorage<number>('tool-comp-w', 800);
  const [canvasH, setCanvasH] = useLocalStorage<number>('tool-comp-h', 600);
  const [bgColor, setBgColor] = useLocalStorage<string>('tool-comp-bg', '#ffffff00'); // Hex + Alpha (00=Transparent)
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('png');

  // UI State
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string>('common');
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // Elements State
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Resource Tracking
  const createdObjectUrls = useRef<Set<string>>(new Set());

  // Interaction Refs
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Use a ref to track drag state to avoid stale closure issues with React State in event listeners
  const dragInfo = useRef<{
    activeId: string | null;
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
    initialW: number;
    initialH: number;
    initialRotate: number;
    centerX: number;
    centerY: number;
    aspectRatio: number;
    mode: 'move' | 'resize' | 'rotate' | null;
    handle: string | null;
  }>({
    activeId: null,
    startX: 0, startY: 0, initialX: 0, initialY: 0, initialW: 0, initialH: 0, initialRotate: 0, centerX: 0, centerY: 0, aspectRatio: 1, mode: null, handle: null
  });

  // Click outside to close preset menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(event.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    if (showPresetMenu) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPresetMenu]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      createdObjectUrls.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const addImage = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    createdObjectUrls.current.add(objectUrl);

    const img = new Image();
    img.onload = () => {
      // Calculate initial fit size (max 50% of canvas)
      // Use fallback 800x600 if canvas state is invalid/loading
      const currentCanvasW = canvasW || 800;
      const currentCanvasH = canvasH || 600;
      
      let w = img.width;
      let h = img.height;
      const maxDim = Math.min(currentCanvasW, currentCanvasH) * 0.5;
      
      if (w > maxDim || h > maxDim) {
        const ratio = w / h;
        if (w > h) {
          w = maxDim;
          h = w / ratio;
        } else {
          h = maxDim;
          w = h * ratio;
        }
      }

      const newEl: CanvasElement = {
        id: Date.now().toString() + Math.random().toString().slice(2),
        src: objectUrl,
        name: file.name,
        x: (currentCanvasW - w) / 2,
        y: (currentCanvasH - h) / 2,
        width: w,
        height: h,
        rotation: 0,
        zIndex: elements.length + 1
      };

      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
    };
    img.src = objectUrl;
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from<File>(e.target.files).forEach(file => {
        if (file.type.startsWith('image/')) addImage(file);
      });
    }
    // Reset input
    e.target.value = '';
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const changeZIndex = (id: string, delta: number) => {
    setElements(prev => {
      const idx = prev.findIndex(el => el.id === id);
      if (idx === -1) return prev;
      
      const newArr = [...prev];
      const el = newArr[idx];
      const targetIdx = idx + delta;
      
      if (targetIdx < 0 || targetIdx >= newArr.length) return prev;
      
      // Swap
      newArr[idx] = newArr[targetIdx];
      newArr[targetIdx] = el;
      
      // Reassign zIndex based on array order
      return newArr.map((item, i) => ({ ...item, zIndex: i + 1 }));
    });
  };

  const updateElement = (id: string, changes: Partial<CanvasElement>) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...changes } : el));
  };

  const swapDimensions = () => {
      const temp = canvasW;
      setCanvasW(canvasH);
      setCanvasH(temp);
  };

  // --- Interaction Logic ---

  const getPointerPos = (e: React.MouseEvent | MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0, absX: 0, absY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      absX: e.clientX,
      absY: e.clientY
    };
  };

  const onMouseDown = (e: React.MouseEvent, id: string, mode: 'move' | 'resize' | 'rotate', handle: string = '') => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    
    // Find the element *freshly* from the list
    const el = elements.find(item => item.id === id);
    if (!el) return;

    const { absX, absY } = getPointerPos(e);
    
    dragInfo.current = {
      activeId: id, // Store the explicit ID to prevent bug where stale selectedId is used
      startX: absX,
      startY: absY,
      initialX: el.x,
      initialY: el.y,
      initialW: el.width,
      initialH: el.height,
      initialRotate: el.rotation,
      centerX: el.x + el.width / 2,
      centerY: el.y + el.height / 2,
      aspectRatio: el.width / el.height,
      mode,
      handle
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!dragInfo.current.mode || !dragInfo.current.activeId) return;

    const { activeId, startX, startY, initialX, initialY, initialW, initialH, initialRotate, centerX, centerY, aspectRatio, handle } = dragInfo.current;
    
    // Calculate delta relative to screen
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (dragInfo.current.mode === 'move') {
      updateElement(activeId, {
        x: initialX + dx,
        y: initialY + dy
      });
    } else if (dragInfo.current.mode === 'resize') {
      // Un-rotate the mouse vector to get local delta
      const rad = -initialRotate * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;

      if (handle === 'se') {
        // Bottom-Right: Proportional
        let newW = Math.max(20, initialW + localDx);
        // Maintain Aspect Ratio
        let newH = newW / aspectRatio;
        
        updateElement(activeId, {
          width: newW,
          height: newH
        });
      } else if (handle === 'e') {
        // Right: Width only
        let newW = Math.max(20, initialW + localDx);
        updateElement(activeId, { width: newW });
      } else if (handle === 's') {
        // Bottom: Height only
        let newH = Math.max(20, initialH + localDy);
        updateElement(activeId, { height: newH });
      }

    } else if (dragInfo.current.mode === 'rotate') {
      // Provide container relative coords for center
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + centerX;
      const cy = rect.top + centerY;
      
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const deg = angle * (180 / Math.PI) + 90; // +90 because handle is at top (which is -90deg in standard math)
      
      updateElement(activeId, {
        rotation: deg
      });
    }
  };

  const onMouseUp = () => {
    dragInfo.current.mode = null;
    dragInfo.current.activeId = null; // Clear active ID
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // --- Export Logic ---
  const handleExport = async () => {
    setIsProcessing(true);
    const canvas = document.createElement('canvas');
    canvas.width = canvasW || 800; // Fallback
    canvas.height = canvasH || 600;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert('Canvas init failed');
      setIsProcessing(false);
      return;
    }

    // 1. Background
    const hasAlpha = bgColor.length > 7 && bgColor.slice(-2) === '00';
    
    if (exportFormat === 'jpeg') {
        if (hasAlpha) {
            ctx.fillStyle = '#FFFFFF';
        } else {
            ctx.fillStyle = bgColor.slice(0, 7); // Strip alpha
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
        // PNG
        if (!hasAlpha) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // 2. Draw Elements in Order
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    
    // Helper to load image
    const loadImg = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

    try {
        for (const el of sorted) {
            const imgObj = await loadImg(el.src);
            ctx.save();
            // Translate to center of image
            const cx = el.x + el.width / 2;
            const cy = el.y + el.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(el.rotation * Math.PI / 180);
            ctx.drawImage(imgObj, -el.width / 2, -el.height / 2, el.width, el.height);
            ctx.restore();
        }

        // 3. Download
        canvas.toBlob(blob => {
            if (blob) {
                const link = document.createElement('a');
                link.download = `composition.${exportFormat === 'jpeg' ? 'jpg' : 'png'}`;
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            setIsProcessing(false);
        }, exportFormat === 'jpeg' ? 'image/jpeg' : 'image/png');

    } catch (e) {
        console.error(e);
        alert('Failed to process images');
        setIsProcessing(false);
    }
  };

  const checkerboardPattern = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 shrink-0 space-y-6 flex flex-col h-full relative">
        {/* Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
             <h3 className="font-bold text-gray-900 flex items-center gap-2">
                 <RefreshCw size={18} className="text-primary-600"/>
                 画布设置
             </h3>
             
             <div className="flex items-end gap-2">
                 <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">宽度 (W)</label>
                    <input 
                        type="number" 
                        value={canvasW || ''} 
                        onChange={e => {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            setCanvasW(isNaN(val) ? 0 : val);
                        }} 
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                 </div>
                 <button 
                    onClick={swapDimensions}
                    className="mb-1 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="交换宽高"
                 >
                     <ArrowRightLeft size={16} />
                 </button>
                 <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">高度 (H)</label>
                    <input 
                        type="number" 
                        value={canvasH || ''} 
                        onChange={e => {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            setCanvasH(isNaN(val) ? 0 : val);
                        }} 
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                 </div>
             </div>
             
             {/* Presets Button */}
             <div className="relative" ref={presetMenuRef}>
                 <button
                    onClick={() => setShowPresetMenu(!showPresetMenu)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-all"
                 >
                     <div className="flex items-center gap-2">
                        <LayoutTemplate size={16} className="text-primary-600" />
                        <span>选择预设尺寸...</span>
                     </div>
                     {showPresetMenu ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                 </button>

                 {/* Presets Popover */}
                 {showPresetMenu && (
                     <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] max-h-[400px] overflow-auto flex flex-col p-1 animate-fade-in">
                         {PRESET_CATEGORIES.map(category => (
                             <div key={category.id} className="border-b border-gray-100 last:border-0">
                                 <button
                                    onClick={() => setExpandedCategory(expandedCategory === category.id ? '' : category.id)}
                                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
                                 >
                                     <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                                         <category.icon size={14} className="text-gray-500" />
                                         {category.label}
                                     </div>
                                     <div className="text-gray-400">
                                         {expandedCategory === category.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                     </div>
                                 </button>
                                 
                                 {expandedCategory === category.id && (
                                     <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded-lg mb-2">
                                         {category.items.map(item => (
                                             <button
                                                key={item.name}
                                                onClick={() => {
                                                    setCanvasW(item.w);
                                                    setCanvasH(item.h);
                                                    setShowPresetMenu(false);
                                                }}
                                                className="text-xs p-2 bg-white border border-gray-200 rounded hover:border-primary-300 hover:text-primary-600 hover:shadow-sm transition-all text-left"
                                             >
                                                 <div className="font-medium truncate">{item.name}</div>
                                                 <div className="text-gray-400 font-mono mt-0.5">{item.w} x {item.h}</div>
                                             </button>
                                         ))}
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                 )}
             </div>

             <div>
                <label className="text-xs text-gray-500 block mb-1">背景颜色 (支持透明)</label>
                <div className="flex gap-2">
                    <input 
                        type="color" 
                        value={bgColor.slice(0, 7)} // Input only takes hex
                        onChange={e => setBgColor((e.target as HTMLInputElement).value)}
                        className="h-9 w-12 p-1 bg-white border border-gray-300 rounded cursor-pointer"
                    />
                    <div className="flex-1 flex gap-2">
                        <button 
                            onClick={() => setBgColor('#ffffff00')} 
                            className={`flex-1 text-xs border rounded ${bgColor.endsWith('00') ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-500'}`}
                        >
                            透明
                        </button>
                        <button 
                            onClick={() => setBgColor('#ffffff')} 
                            className={`flex-1 text-xs border rounded ${bgColor === '#ffffff' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-500'}`}
                        >
                            纯白
                        </button>
                    </div>
                </div>
             </div>
        </div>
        
        {/* Layer List */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 flex flex-col min-h-0">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900">图层 ({elements.length})</h3>
                 <button 
                    onClick={() => document.getElementById('comp-upload')?.click()}
                    className="p-1.5 bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                 >
                     <Plus size={16} />
                 </button>
                 <input id="comp-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
             </div>
             
             <div className="flex-1 overflow-auto space-y-2 pr-1 custom-scrollbar">
                 {elements.slice().reverse().map((el) => (
                     <div 
                        key={el.id}
                        onClick={() => setSelectedId(el.id)}
                        className={`
                            group flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors
                            ${selectedId === el.id ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-transparent hover:bg-gray-100'}
                        `}
                     >
                         <img src={el.src} className="w-8 h-8 object-cover rounded bg-white" alt="" />
                         <span className="flex-1 text-sm truncate select-none">{el.name}</span>
                         
                         {selectedId === el.id && (
                             <div className="flex gap-1">
                                 <button onClick={e => { e.stopPropagation(); changeZIndex(el.id, 1); }} title="上移" className="p-1 hover:bg-white rounded text-gray-500 hover:text-primary-600">
                                     <ArrowUp size={14} />
                                 </button>
                                 <button onClick={e => { e.stopPropagation(); changeZIndex(el.id, -1); }} title="下移" className="p-1 hover:bg-white rounded text-gray-500 hover:text-primary-600">
                                     <ArrowDown size={14} />
                                 </button>
                                 <button onClick={e => { e.stopPropagation(); deleteElement(el.id); }} title="删除" className="p-1 hover:bg-white rounded text-gray-500 hover:text-red-500">
                                     <Trash2 size={14} />
                                 </button>
                             </div>
                         )}
                     </div>
                 ))}
                 {elements.length === 0 && (
                     <div 
                        onClick={() => document.getElementById('comp-upload')?.click()}
                        className="flex flex-col items-center justify-center py-10 text-center cursor-pointer hover:bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-300 transition-all group"
                     >
                         <div className="w-12 h-12 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-3 text-gray-400 group-hover:text-primary-600 transition-colors">
                             <Plus size={24} />
                         </div>
                         <div className="text-sm font-bold text-gray-700">添加图片</div>
                         <div className="text-xs text-gray-400 mt-1">支持多选导入</div>
                     </div>
                 )}
             </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden">
           <div className="flex-1 overflow-auto relative flex items-center justify-center p-8 bg-gray-100"
                style={{ backgroundImage: `url("${checkerboardPattern}")` }}
                onMouseDown={() => setSelectedId(null)}
           >
               {/* Canvas */}
               <div 
                   ref={containerRef}
                   className="relative shadow-2xl overflow-hidden bg-white"
                   style={{ 
                       // Ensure valid CSS values. Min 1px to prevent layout crash.
                       width: Math.max(1, canvasW || 0), 
                       height: Math.max(1, canvasH || 0),
                       minWidth: Math.max(1, canvasW || 0) + 'px',
                       minHeight: Math.max(1, canvasH || 0) + 'px',
                       flexShrink: 0,
                       backgroundColor: bgColor.endsWith('00') ? 'transparent' : bgColor,
                   }}
               >
                   {elements.map(el => (
                       <div
                           key={el.id}
                           style={{
                               position: 'absolute',
                               left: el.x,
                               top: el.y,
                               width: el.width,
                               height: el.height,
                               transform: `rotate(${el.rotation}deg)`,
                               zIndex: el.zIndex,
                               cursor: 'move',
                               // If transparent bg, outline helps see images
                               outline: selectedId === el.id ? '2px solid #2a97ff' : 'none'
                           }}
                           onMouseDown={(e) => onMouseDown(e, el.id, 'move')}
                       >
                           <img 
                               src={el.src} 
                               alt="" 
                               className="w-full h-full block pointer-events-none select-none"
                               style={{ objectFit: 'fill' }}
                           />
                           
                           {/* Controls Overlay (Only for selected) */}
                           {selectedId === el.id && (
                               <>
                                   {/* Rotate Handle */}
                                   <div 
                                       className="absolute left-1/2 -top-8 -translate-x-1/2 w-6 h-6 bg-white border border-primary-500 rounded-full flex items-center justify-center cursor-pointer shadow-sm z-50"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'rotate')}
                                       title="旋转"
                                   >
                                       <RotateCw size={14} className="text-primary-600" />
                                   </div>
                                   {/* Connector line */}
                                   <div className="absolute left-1/2 -top-8 bottom-full w-px bg-primary-500 h-8"></div>

                                   {/* Resize Handle (SE) - Proportional */}
                                   <div 
                                       className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary-600 border-2 border-white rounded-full cursor-se-resize z-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 'se')}
                                       title="等比缩放"
                                   ></div>

                                   {/* Resize Handle (E) - Width Only */}
                                   <div 
                                       className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-white border border-gray-400 rounded-full cursor-e-resize z-40 hover:bg-primary-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 'e')}
                                       title="调整宽度"
                                   ></div>

                                   {/* Resize Handle (S) - Height Only */}
                                   <div 
                                       className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-gray-400 rounded-full cursor-s-resize z-40 hover:bg-primary-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 's')}
                                       title="调整高度"
                                   ></div>
                               </>
                           )}
                       </div>
                   ))}
               </div>
           </div>

           {/* Toolbar */}
           <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center z-10">
                <div className="flex gap-4 items-center">
                    <span className="text-sm text-gray-500">导出格式:</span>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                         <button onClick={() => setExportFormat('jpeg')} className={`px-3 py-1 text-xs rounded ${exportFormat === 'jpeg' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>JPG</button>
                         <button onClick={() => setExportFormat('png')} className={`px-3 py-1 text-xs rounded ${exportFormat === 'png' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>PNG</button>
                    </div>
                </div>

                <button 
                    onClick={handleExport}
                    disabled={isProcessing || elements.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                    导出合成图片
                </button>
           </div>
      </div>
    </div>
  );
};

export default ImageComposition;