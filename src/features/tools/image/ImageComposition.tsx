
/// <reference lib="dom" />
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, Download, RefreshCw, X, Plus, RotateCw, Trash2, ArrowUp, ArrowDown, LayoutTemplate, ChevronDown, ChevronRight, Smartphone, Monitor, FileText, Instagram, Hash, Layers, ArrowRightLeft, Move, Maximize, ZoomIn, ZoomOut, AlignStartVertical, AlignCenterVertical, AlignEndVertical, AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal, Lock, Unlock } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import Collapse from '@/components/ui/Collapse';

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

const ImageComposition: React.FC = () => {
  const { t } = useLanguage();
  
  // 结构化预设（按语言缓存）
  const presetCategories = useMemo(() => [
    {
      id: 'common',
      label: t('comp.preset.common'),
      icon: Hash,
      items: [
        { name: '1080P (FHD)', w: 1920, h: 1080 },
        { name: '2K QHD', w: 2560, h: 1440 },
        { name: '4K UHD', w: 3840, h: 2160 },
        { name: t('comp.item.a4'), w: 2480, h: 3508 },
        { name: t('comp.item.standard'), w: 800, h: 600 },
        { name: t('comp.item.square'), w: 1080, h: 1080 },
      ]
    },
    {
      id: 'social',
      label: t('comp.preset.social'),
      icon: Instagram,
      items: [
        { name: t('comp.item.wechat_cover_1'), w: 900, h: 383 },
        { name: t('comp.item.wechat_cover_2'), w: 200, h: 200 },
        { name: t('comp.item.rednote'), w: 1242, h: 1660 },
        { name: t('comp.item.insta_story'), w: 1080, h: 1920 },
        { name: t('comp.item.video_cover'), w: 1280, h: 720 },
        { name: t('comp.item.moments'), w: 1080, h: 1920 },
      ]
    },
    {
      id: 'mobile',
      label: t('comp.preset.mobile'),
      icon: Smartphone,
      items: [
        { name: 'iPhone 15 Pro Max', w: 1290, h: 2796 },
        { name: 'iPhone 15/14 Pro', w: 1179, h: 2556 },
        { name: 'Samsung S24 Ultra', w: 1440, h: 3120 },
        { name: 'Google Pixel 8 Pro', w: 1344, h: 2992 },
        { name: 'Huawei Mate 60 Pro', w: 1260, h: 2720 },
        { name: 'iPhone SE', w: 750, h: 1334 },
        { name: t('comp.item.android'), w: 1080, h: 2400 },
      ]
    },
    {
      id: 'tablet',
      label: t('comp.preset.tablet'),
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
      label: t('comp.preset.desktop'),
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
      label: t('comp.preset.paper'),
      icon: FileText,
      items: [
        { name: t('comp.item.a4'), w: 2480, h: 3508 },
        { name: t('comp.item.a3'), w: 3508, h: 4961 },
        { name: t('comp.item.a5'), w: 1748, h: 2480 },
        { name: t('comp.item.business_card'), w: 1063, h: 638 },
        { name: 'A4 (Screen 72dpi)', w: 595, h: 842 },
      ]
    }
  ], [t]);

  // 画布设置
  const [canvasW, setCanvasW] = useLocalStorage<number>('tool-comp-w', 800);
  const [canvasH, setCanvasH] = useLocalStorage<number>('tool-comp-h', 600);
  const [bgColor, setBgColor] = useLocalStorage<string>('tool-comp-bg', '#ffffff00'); // Hex + Alpha (00=Transparent)
  const [exportFormat, setExportFormat] = useState<'jpeg' | 'png'>('png');

  // UI 状态
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string>('common');
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // 元素状态
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 视图与编辑状态
  const [zoom, setZoom] = useState(1);
  const [lockAspect, setLockAspect] = useState(false);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // 资源跟踪
  const createdObjectUrls = useRef<Set<string>>(new Set());
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // 交互引用
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 用 ref 跟踪拖拽状态，避免事件监听器中的旧闭包
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

  // 点击外部关闭预设菜单
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

  // 卸载时释放 blob URL
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
      // 计算初始适配尺寸（画布的一半）
      // 画布状态无效时回退到 800x600
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
      w = Math.round(w);
      h = Math.round(h);

      const newEl: CanvasElement = {
        id: Date.now().toString() + Math.random().toString().slice(2),
        src: objectUrl,
        name: file.name,
        x: Math.round((currentCanvasW - w) / 2),
        y: Math.round((currentCanvasH - h) / 2),
        width: w,
        height: h,
        rotation: 0,
        zIndex: 0 // assigned below
      };

      // 函数式更新，保证批量上传的 zIndex 唯一
      setElements(prev => [...prev, { ...newEl, zIndex: prev.length + 1 }]);
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
    // Release resources of the deleted layer
    const el = elements.find(item => item.id === id);
    if (el) {
      if (createdObjectUrls.current.has(el.src)) {
        URL.revokeObjectURL(el.src);
        createdObjectUrls.current.delete(el.src);
      }
      imgCache.current.delete(el.src);
    }
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

  const selectedElement = elements.find(el => el.id === selectedId) || null;

  const updateSelected = (changes: Partial<CanvasElement>) => {
    if (selectedId) updateElement(selectedId, changes);
  };

  const handleNumericInput = (key: 'x' | 'y' | 'width' | 'height', raw: string) => {
    const val = parseFloat(raw);
    if (isNaN(val) || !selectedElement) return;
    if (key === 'width' || key === 'height') {
      const min = 1;
      if (lockAspect && selectedElement.height > 0 && selectedElement.width > 0) {
        const ratio = selectedElement.width / selectedElement.height;
        if (key === 'width') {
          updateSelected({ width: Math.max(min, Math.round(val)), height: Math.max(min, Math.round(val / ratio)) });
        } else {
          updateSelected({ height: Math.max(min, Math.round(val)), width: Math.max(min, Math.round(val * ratio)) });
        }
      } else {
        updateSelected({ [key]: Math.max(min, Math.round(val)) });
      }
    } else {
      updateSelected({ [key]: Math.round(val) });
    }
  };

  const alignSelected = (mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') => {
    if (!selectedElement) return;
    const cw = canvasW || 800;
    const ch = canvasH || 600;
    if (mode === 'left') updateSelected({ x: 0 });
    else if (mode === 'centerH') updateSelected({ x: Math.round((cw - selectedElement.width) / 2) });
    else if (mode === 'right') updateSelected({ x: cw - selectedElement.width });
    else if (mode === 'top') updateSelected({ y: 0 });
    else if (mode === 'centerV') updateSelected({ y: Math.round((ch - selectedElement.height) / 2) });
    else updateSelected({ y: ch - selectedElement.height });
  };

  const fitToScreen = () => {
    const area = canvasAreaRef.current;
    if (!area || !canvasW || !canvasH) return;
    const availW = area.clientWidth - 80;
    const availH = area.clientHeight - 80;
    if (availW <= 0 || availH <= 0) return;
    const scale = Math.min(1, availW / canvasW, availH / canvasH);
    setZoom(Math.max(0.05, Math.round(scale * 100) / 100));
  };

  const zoomBy = (delta: number) => {
    setZoom(z => Math.min(4, Math.max(0.05, Math.round((z + delta) * 100) / 100)));
  };

  // Fit canvas to view on mount and when canvas size changes
  useEffect(() => {
    fitToScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasW, canvasH]);

  // Ctrl/Cmd + wheel to zoom canvas view
  useEffect(() => {
    const area = canvasAreaRef.current;
    if (!area) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom(z => Math.min(4, Math.max(0.05, Math.round((z + step) * 100) / 100)));
    };
    area.addEventListener('wheel', onWheel, { passive: false });
    return () => area.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard: arrow keys nudge selected layer, Delete removes it
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selectedId) return;
      const el = elements.find(item => item.id === selectedId);
      if (!el) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteElement(selectedId);
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      updateElement(selectedId, { x: el.x + dx, y: el.y + dy });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, elements]);

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
    
    // Calculate delta relative to screen (compensate view zoom)
    const dz = zoom || 1;
    const dx = (e.clientX - startX) / dz;
    const dy = (e.clientY - startY) / dz;

    if (dragInfo.current.mode === 'move') {
      updateElement(activeId, {
        x: Math.round(initialX + dx),
        y: Math.round(initialY + dy)
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
        let newW = Math.round(Math.max(20, initialW + localDx));
        // Maintain Aspect Ratio
        let newH = Math.round(newW / aspectRatio);
        
        updateElement(activeId, {
          width: newW,
          height: newH
        });
      } else if (handle === 'e') {
        // Right: Width only
        let newW = Math.round(Math.max(20, initialW + localDx));
        updateElement(activeId, { width: newW });
      } else if (handle === 's') {
        // Bottom: Height only
        let newH = Math.round(Math.max(20, initialH + localDy));
        updateElement(activeId, { height: newH });
      }

    } else if (dragInfo.current.mode === 'rotate') {
      // Provide container relative coords for center
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const vz = zoom || 1;
      const cx = rect.left + centerX * vz;
      const cy = rect.top + centerY * vz;
      
      const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
      const deg = angle * (180 / Math.PI) + 90; // +90 because handle is at top (which is -90deg in standard math)
      
      updateElement(activeId, {
        rotation: Math.round(deg)
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
    canvas.width = Math.max(1, canvasW || 800); // Fallback
    canvas.height = Math.max(1, canvasH || 600);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      alert(t('common.error'));
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
    
    // Helper to load image (cached per src across exports)
    const loadImg = (src: string) => {
        const cached = imgCache.current.get(src);
        if (cached && cached.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                imgCache.current.set(src, img);
                resolve(img);
            };
            img.onerror = reject;
            img.src = src;
        });
    };

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
        alert(t('common.error'));
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
                 {t('comp.settings')}
             </h3>
             
             <div className="flex items-end gap-2">
                 <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">{t('comp.width')} (W)</label>
                    <input 
                        type="number" 
                        min={1}
                        value={canvasW || ''} 
                        onChange={e => {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            setCanvasW(isNaN(val) ? 0 : Math.max(1, val));
                        }} 
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                    />
                 </div>
                 <button 
                    onClick={swapDimensions}
                    className="mb-1 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title={t('comp.swap')}
                 >
                     <ArrowRightLeft size={16} />
                 </button>
                 <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">{t('comp.height')} (H)</label>
                    <input 
                        type="number" 
                        min={1}
                        value={canvasH || ''} 
                        onChange={e => {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            setCanvasH(isNaN(val) ? 0 : Math.max(1, val));
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
                        <span>{t('comp.presets')}</span>
                     </div>
                     {showPresetMenu ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                 </button>

                 {/* Presets Popover */}
                 {showPresetMenu && (
                     <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-[100] max-h-[400px] overflow-auto flex flex-col p-1 animate-fade-in">
                         {presetCategories.map(category => (
                             <div key={category.id} className="border-b border-gray-100 last:border-0">
                                 <button
                                    onClick={() => setExpandedCategory(expandedCategory === category.id ? '' : category.id)}
                                    className="w-full flex items-center justify-between p-2 text-left hover:bg-gray-50 rounded-lg transition-colors"
                                 >
                                     <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                                         <category.icon size={14} className="text-gray-500" />
                                         {category.label}
                                     </div>
                                     <div className={`text-gray-400 transition-transform duration-200 ease-crisp ${expandedCategory === category.id ? 'rotate-90' : ''}`}>
                                         <ChevronRight size={14} />
                                     </div>
                                 </button>

                                 <Collapse open={expandedCategory === category.id} duration={200}>
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
                                 </Collapse>
                             </div>
                         ))}
                     </div>
                 )}
             </div>

             <div>
                <label className="text-xs text-gray-500 block mb-1">{t('comp.bg_color')}</label>
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
                            {t('comp.transparent')}
                        </button>
                        <button 
                            onClick={() => setBgColor('#ffffff')} 
                            className={`flex-1 text-xs border rounded ${bgColor === '#ffffff' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-500'}`}
                        >
                            {t('comp.white')}
                        </button>
                        <button 
                            onClick={() => setBgColor('#000000')} 
                            className={`flex-1 text-xs border rounded ${bgColor === '#000000' ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-300 text-gray-500'}`}
                        >
                            {t('comp.black')}
                        </button>
                    </div>
                </div>
             </div>
        </div>

        {/* Selected Layer Properties */}
        {selectedElement && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Move size={18} className="text-primary-600"/>
                    {t('comp.layer_props')}
                </h3>
                <div className="text-xs text-gray-500 truncate" title={selectedElement.name}>{selectedElement.name}</div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">X</label>
                        <input 
                            type="number" 
                            value={selectedElement.x}
                            onChange={e => handleNumericInput('x', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">Y</label>
                        <input 
                            type="number" 
                            value={selectedElement.y}
                            onChange={e => handleNumericInput('y', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('comp.width')} (W)</label>
                        <input 
                            type="number" 
                            min={1}
                            value={selectedElement.width}
                            onChange={e => handleNumericInput('width', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-1">{t('comp.height')} (H)</label>
                        <input 
                            type="number" 
                            min={1}
                            value={selectedElement.height}
                            onChange={e => handleNumericInput('height', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                </div>
                {/* Size + Aspect Lock */}
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">{t('comp.width')} (W)</label>
                        <input 
                            type="number" 
                            min={1}
                            value={selectedElement.width}
                            onChange={e => handleNumericInput('width', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => setLockAspect(!lockAspect)}
                        title={t('comp.lock_aspect')}
                        className={`mb-0.5 p-2 border rounded transition-colors ${lockAspect ? 'bg-primary-50 border-primary-300 text-primary-600' : 'border-gray-300 text-gray-400 hover:text-gray-600'}`}
                    >
                        {lockAspect ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">{t('comp.height')} (H)</label>
                        <input 
                            type="number" 
                            min={1}
                            value={selectedElement.height}
                            onChange={e => handleNumericInput('height', (e.target as HTMLInputElement).value)}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                </div>
                {/* Rotation */}
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">{t('comp.rotation')} (°)</label>
                        <input 
                            type="number" 
                            value={selectedElement.rotation}
                            onChange={e => {
                                const val = parseFloat((e.target as HTMLInputElement).value);
                                if (!isNaN(val)) updateSelected({ rotation: Math.round(val) });
                            }}
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                        />
                    </div>
                    <button 
                        onClick={() => updateSelected({ rotation: 0 })}
                        title={t('comp.reset_rotation')}
                        className="mb-0.5 p-2 border border-gray-300 text-gray-400 hover:text-gray-600 rounded transition-colors"
                    >
                        <RotateCw size={14} />
                    </button>
                </div>
                {/* Alignment to Canvas */}
                <div>
                    <label className="text-xs text-gray-500 block mb-1">{t('comp.align')}</label>
                    <div className="grid grid-cols-6 gap-1">
                        {([
                            ['left', AlignStartVertical], ['centerH', AlignCenterVertical], ['right', AlignEndVertical],
                            ['top', AlignStartHorizontal], ['centerV', AlignCenterHorizontal], ['bottom', AlignEndHorizontal],
                        ] as const).map(([mode, Icon]) => (
                            <button
                                key={mode}
                                onClick={() => alignSelected(mode)}
                                title={t(`comp.align_${mode}`)}
                                className="p-1.5 border border-gray-300 rounded text-gray-500 hover:text-primary-600 hover:border-primary-300 hover:bg-primary-50 transition-colors flex items-center justify-center"
                            >
                                <Icon size={14} />
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-xs text-gray-400 leading-relaxed">
                    {t('comp.layer_props_tip')}<br/>
                    {t('comp.keyboard_tip')}
                </div>
            </div>
        )}

        {/* Layer List */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 flex flex-col min-h-0">
             <div className="flex justify-between items-center mb-4">
                 <h3 className="font-bold text-gray-900">{t('comp.layers')} ({elements.length})</h3>
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
                         <div className="flex-1 min-w-0">
                             <div className="text-sm truncate select-none">{el.name}</div>
                             <div className="text-xs text-gray-400 font-mono">{Math.round(el.width)} × {Math.round(el.height)}</div>
                         </div>
                         
                         {selectedId === el.id && (
                             <div className="flex gap-1">
                                 <button onClick={e => { e.stopPropagation(); changeZIndex(el.id, 1); }} title={t('comp.move_up')} className="p-1 hover:bg-white rounded text-gray-500 hover:text-primary-600">
                                     <ArrowUp size={14} />
                                 </button>
                                 <button onClick={e => { e.stopPropagation(); changeZIndex(el.id, -1); }} title={t('comp.move_down')} className="p-1 hover:bg-white rounded text-gray-500 hover:text-primary-600">
                                     <ArrowDown size={14} />
                                 </button>
                                 <button onClick={e => { e.stopPropagation(); deleteElement(el.id); }} title={t('comp.delete')} className="p-1 hover:bg-white rounded text-gray-500 hover:text-red-500">
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
                         <div className="text-sm font-bold text-gray-700">{t('comp.add_img')}</div>
                         <div className="text-xs text-gray-400 mt-1">{t('comp.upload_tip')}</div>
                     </div>
                 )}
             </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden">
           <div ref={canvasAreaRef} className="flex-1 overflow-auto relative flex items-center justify-center p-8 bg-gray-100"
                style={{ backgroundImage: `url("${checkerboardPattern}")` }}
                onMouseDown={() => setSelectedId(null)}
           >
               {/* Canvas (outer box tracks zoomed size for correct scrolling) */}
               <div 
                   ref={containerRef}
                   className="relative shadow-2xl"
                   style={{ 
                       width: Math.max(1, (canvasW || 0) * zoom), 
                       height: Math.max(1, (canvasH || 0) * zoom),
                       flexShrink: 0,
                   }}
               >
                   {/* World: unscaled canvas coordinates, scaled visually */}
                   <div
                       className="absolute top-0 left-0 overflow-hidden bg-white"
                       style={{
                           width: Math.max(1, canvasW || 0),
                           height: Math.max(1, canvasH || 0),
                           transform: `scale(${zoom})`,
                           transformOrigin: 'top left',
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
                                       title={t('comp.rotate')}
                                   >
                                       <RotateCw size={14} className="text-primary-600" />
                                   </div>
                                   {/* Connector line */}
                                   <div className="absolute left-1/2 -top-8 bottom-full w-px bg-primary-500 h-8"></div>

                                   {/* Resize Handle (SE) - Proportional */}
                                   <div 
                                       className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-primary-600 border-2 border-white rounded-full cursor-se-resize z-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 'se')}
                                       title={t('comp.scale_proportional')}
                                   ></div>

                                   {/* Resize Handle (E) - Width Only */}
                                   <div 
                                       className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-3 h-6 bg-white border border-gray-400 rounded-full cursor-e-resize z-40 hover:bg-primary-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 'e')}
                                       title={t('comp.resize_width')}
                                   ></div>

                                   {/* Resize Handle (S) - Height Only */}
                                   <div 
                                       className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-white border border-gray-400 rounded-full cursor-s-resize z-40 hover:bg-primary-50 shadow-sm"
                                       onMouseDown={(e) => onMouseDown(e, el.id, 'resize', 's')}
                                       title={t('comp.resize_height')}
                                   ></div>
                               </>
                           )}
                       </div>
                   ))}
               </div>
                   </div>
               </div>

           {/* Toolbar */}
           <div className="bg-white border-t border-gray-200 p-4 flex justify-between items-center z-10 flex-wrap gap-2">
                <div className="flex gap-4 items-center">
                    <span className="text-sm text-gray-500">{t('comp.export_format')}:</span>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                         <button onClick={() => setExportFormat('jpeg')} className={`px-3 py-1 text-xs rounded ${exportFormat === 'jpeg' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>JPG</button>
                         <button onClick={() => setExportFormat('png')} className={`px-3 py-1 text-xs rounded ${exportFormat === 'png' ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}>PNG</button>
                    </div>
                    <div className="h-5 w-px bg-gray-200"></div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => zoomBy(-0.1)} title="-" className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"><ZoomOut size={16} /></button>
                        <button 
                            onClick={() => setZoom(1)}
                            title={t('comp.zoom_reset')}
                            className="px-2 py-1 text-xs font-mono rounded hover:bg-gray-100 text-gray-600 min-w-[52px] transition-colors"
                        >
                            {Math.round(zoom * 100)}%
                        </button>
                        <button onClick={() => zoomBy(0.1)} title="+" className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"><ZoomIn size={16} /></button>
                        <button 
                            onClick={fitToScreen}
                            title={t('comp.zoom_fit')}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600 transition-colors"
                        >
                            <Maximize size={16} />
                        </button>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{canvasW || 0} × {canvasH || 0}</span>
                </div>

                <button 
                    onClick={handleExport}
                    disabled={isProcessing || elements.length === 0}
                    className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all active:scale-95"
                >
                    {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                    {t('comp.export_btn')}
                </button>
           </div>
      </div>
    </div>
  );
};
export default ImageComposition;
