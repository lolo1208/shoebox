
/// <reference lib="dom" />
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
    Type, Download, Trash2, RefreshCw, X, 
    Settings, Plus, Zap, ImageIcon, Box, ChevronDown, AlertCircle,
    ZoomIn, ZoomOut, Maximize, Minimize, FileText, Info, Hash
} from 'lucide-react';
import JSZip from 'jszip';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLanguage } from '../../contexts/LanguageContext';

interface CharSprite {
    id: string;
    file: File;
    name: string;
    width: number;
    height: number;
    dataUrl: string;
    char: string; // The character this sprite represents
    ascii: number;
    imgElement?: HTMLImageElement;
}

interface PackedChar {
    sprite: CharSprite;
    x: number;
    y: number;
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

type ExportFormat = 'text' | 'xml' | 'json';

const BitmapFontGenerator: React.FC = () => {
    const { t } = useLanguage();

    // --- Settings ---
    const [maxSize, setMaxSize] = useLocalStorage<number>('tool-bf-max-size', 1024);
    const [padding, setPadding] = useLocalStorage<number>('tool-bf-padding', 1);
    const [exportFormat, setExportFormat] = useLocalStorage<ExportFormat>('tool-bf-format', 'text');
    const [exportName, setExportName] = useLocalStorage<string>('tool-bf-export-name', 'custom_font');
    const [imageBg, setImageBg] = useLocalStorage<'white' | 'dark'>('tool-bf-img-bg', 'white');

    // --- State ---
    const [sprites, setSprites] = useState<CharSprite[]>([]);
    const [isPacking, setIsPacking] = useState(false);
    const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [atlasSize, setAtlasSize] = useState({ w: 0, h: 0 });
    const [packedCount, setPackedCount] = useState(0);

    // --- View State ---
    const [zoom, setZoom] = useState(1);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    const currentPackedResult = useRef<{ packed: PackedChar[], width: number, height: number } | null>(null);

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // --- Character Inference ---
    const inferChar = (filename: string): string => {
        const name = filename.replace(/\.[^/.]+$/, "");
        // 1. 如果文件名本身就是一个字符，直接使用该字符
        if (name.length === 1) return name;
        
        // 2. 如果是数字（通常是 ASCII 码），则转换
        if (/^\d+$/.test(name)) {
            const code = parseInt(name);
            if (code >= 32 && code <= 126) return String.fromCharCode(code);
        }
        
        return '';
    };

    // --- File Handlers ---
    const processFiles = async (files: File[]) => {
        const newSprites: CharSprite[] = [];
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const sprite = await loadCharSprite(file);
            newSprites.push(sprite);
        }
        setSprites(prev => [...prev, ...newSprites]);
    };

    const loadCharSprite = (file: File): Promise<CharSprite> => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const char = inferChar(file.name);
                resolve({
                    id: Math.random().toString(36).substr(2, 9),
                    file, name: file.name,
                    width: img.width, height: img.height, dataUrl: url,
                    char, ascii: char ? char.charCodeAt(0) : 0,
                    imgElement: img
                });
            };
            img.src = url;
        });
    };

    const updateCharMapping = (id: string, newChar: string) => {
        setSprites(prev => prev.map(s => {
            if (s.id === id) {
                const char = newChar.slice(0, 1);
                return { ...s, char, ascii: char ? char.charCodeAt(0) : 0 };
            }
            return s;
        }));
    };

    // --- Packing Logic (MaxRects) ---
    const packSprites = useCallback(() => {
        if (sprites.length === 0) return null;
        
        // Only pack valid mappings
        const validSprites = sprites.filter(s => s.char && s.ascii > 0);
        if (validSprites.length === 0) return null;

        // Sort by height desc
        const sorted = [...validSprites].sort((a, b) => b.height - a.height);
        
        let freeRects: Rect[] = [{ x: padding, y: padding, w: maxSize - padding * 2, h: maxSize - padding * 2 }];
        const packed: PackedChar[] = [];
        let maxWidth = 0;
        let maxHeight = 0;

        for (const sprite of sorted) {
            let bestRect: Rect | null = null;
            let bestShortSideFit = Number.MAX_VALUE;

            for (const rect of freeRects) {
                if (rect.w >= sprite.width && rect.h >= sprite.height) {
                    const leftoverW = rect.w - sprite.width;
                    const leftoverH = rect.h - sprite.height;
                    const shortSide = Math.min(leftoverW, leftoverH);
                    if (shortSide < bestShortSideFit) {
                        bestRect = rect;
                        bestShortSideFit = shortSide;
                    }
                }
            }

            if (!bestRect) continue;

            packed.push({ sprite, x: bestRect.x, y: bestRect.y });
            maxWidth = Math.max(maxWidth, bestRect.x + sprite.width + padding);
            maxHeight = Math.max(maxHeight, bestRect.y + sprite.height + padding);

            // Split logic
            const splitRects: Rect[] = [];
            for (const r of freeRects) {
                if (r.x < bestRect.x + sprite.width && r.x + r.w > bestRect.x && r.y < bestRect.y + sprite.height && r.y + r.h > bestRect.y) {
                    if (bestRect.x + sprite.width < r.x + r.w) splitRects.push({ x: bestRect.x + sprite.width, y: r.y, w: r.x + r.w - (bestRect.x + sprite.width), h: r.h });
                    if (bestRect.x > r.x) splitRects.push({ x: r.x, y: r.y, w: bestRect.x - r.x, h: r.h });
                    /* Fix: Referenced sprite.height instead of undefined height */
                    if (bestRect.y + sprite.height < r.y + r.h) splitRects.push({ x: r.x, y: bestRect.y + sprite.height, w: r.w, h: r.y + r.h - (bestRect.y + sprite.height) });
                    if (bestRect.y > r.y) splitRects.push({ x: r.x, y: r.y, w: r.w, h: bestRect.y - r.y });
                } else { splitRects.push(r); }
            }
            // Logic correction for splitRects iteration
            freeRects = splitRects.filter(r => r.w > 0 && r.h > 0);
        }

        const toNextPow2 = (v: number) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))));
        return { packed, width: toNextPow2(maxWidth), height: toNextPow2(maxHeight) };
    }, [sprites, maxSize, padding]);

    // --- Update Preview ---
    useEffect(() => {
        let active = true;
        const update = async () => {
            if (sprites.length === 0) {
                setPreviewUrl(null); setAtlasSize({ w: 0, h: 0 }); setPackedCount(0); return;
            }
            setIsPreviewGenerating(true);
            const result = packSprites();
            if (!result || !active) { setIsPreviewGenerating(false); return; }

            const { packed, width, height } = result;
            currentPackedResult.current = result;
            setAtlasSize({ w: width, h: height });
            setPackedCount(packed.length);

            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d')!;
            ctx.imageSmoothingEnabled = false;

            packed.forEach(p => {
                if (p.sprite.imgElement) {
                    ctx.drawImage(p.sprite.imgElement, Math.round(p.x), Math.round(p.y));
                }
            });

            if (!active) return;
            const blob: Blob | null = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
            if (blob && active) {
                const url = URL.createObjectURL(blob);
                setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
            }
            setIsPreviewGenerating(false);
        };

        const timer = setTimeout(update, 400);
        return () => { active = false; clearTimeout(timer); };
    }, [sprites, packSprites, maxSize, padding]);

    // --- Export ---
    const handleExport = async () => {
        if (!currentPackedResult.current) return;
        setIsPacking(true);
        const { packed, width, height } = currentPackedResult.current;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;

        packed.forEach(p => {
            if (p.sprite.imgElement) ctx.drawImage(p.sprite.imgElement, Math.round(p.x), Math.round(p.y));
        });

        const baseName = exportName.trim() || 'custom_font';
        const imgBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        
        if (!imgBlob) { setIsPacking(false); return; }

        const lineHeight = Math.max(...packed.map(p => p.sprite.height));
        const baseLine = Math.round(lineHeight * 0.8);
        
        let fontContent = '';
        let fileExt = 'fnt';

        if (exportFormat === 'text') {
            fontContent = `info face="${baseName}" size=${lineHeight} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=0,0,0,0 spacing=1,1 outline=0
common lineHeight=${lineHeight} base=${baseLine} scaleW=${width} scaleH=${height} pages=1 packed=0 alphaChnl=1 redChnl=0 greenChnl=0 blueChnl=0
page id=0 file="${baseName}.png"
chars count=${packed.length}`;
            packed.forEach(p => {
                const s = p.sprite;
                fontContent += `\nchar id=${s.ascii}   x=${Math.round(p.x)}     y=${Math.round(p.y)}     width=${s.width}     height=${s.height}     xoffset=0     yoffset=0     xadvance=${s.width}     page=0  chnl=15`;
            });
        } else if (exportFormat === 'xml') {
            fontContent = `<?xml version="1.0"?>
<font>
  <info face="${baseName}" size="${lineHeight}" bold="0" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1" outline="0"/>
  <common lineHeight="${lineHeight}" base="${baseLine}" scaleW="${width}" scaleH="${height}" pages="1" packed="0" alphaChnl="1" redChnl="0" greenChnl="0" blueChnl="0"/>
  <pages>
    <page id="0" file="${baseName}.png" />
  </pages>
  <chars count="${packed.length}">
${packed.map(p => `    <char id="${p.sprite.ascii}" x="${Math.round(p.x)}" y="${Math.round(p.y)}" width="${p.sprite.width}" height="${p.sprite.height}" xoffset="0" yoffset="0" xadvance="${p.sprite.width}" page="0" chnl="15" />`).join('\n')}
  </chars>
</font>`;
        } else if (exportFormat === 'json') {
            fileExt = 'json';
            const jsonData = {
                info: { face: baseName, size: lineHeight },
                common: { lineHeight, base: baseLine, scaleW: width, scaleH: height, pages: 1 },
                pages: [{ id: 0, file: `${baseName}.png` }],
                chars: packed.map(p => ({
                    id: p.sprite.ascii,
                    char: p.sprite.char,
                    x: Math.round(p.x),
                    y: Math.round(p.y),
                    width: p.sprite.width,
                    height: p.sprite.height,
                    xoffset: 0,
                    yoffset: 0,
                    xadvance: p.sprite.width
                }))
            };
            fontContent = JSON.stringify(jsonData, null, 2);
        }

        const zip = new JSZip();
        zip.file(`${baseName}.png`, imgBlob);
        zip.file(`${baseName}.${fileExt}`, fontContent);
        const content = await zip.generateAsync({ type: 'blob' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${baseName}.zip`;
        link.click();
        
        setIsPacking(false);
    };

    // --- Pan/Zoom Helpers ---
    const onPanStart = (e: React.MouseEvent) => {
        if (!viewportRef.current) return;
        setIsPanning(true);
        setPanStart({ x: e.pageX, y: e.pageY, scrollLeft: viewportRef.current.scrollLeft, scrollTop: viewportRef.current.scrollTop });
    };

    const onPanMove = (e: React.MouseEvent) => {
        if (!isPanning || !viewportRef.current) return;
        e.preventDefault();
        const dx = e.pageX - panStart.x;
        const dy = e.pageY - panStart.y;
        viewportRef.current.scrollLeft = panStart.scrollLeft - dx;
        viewportRef.current.scrollTop = panStart.scrollTop - dy;
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (!previewUrl) return;
        const delta = e.deltaY * -0.001;
        const newZoom = Math.min(Math.max(0.05, zoom + delta), 4);
        setZoom(newZoom);
    };

    const commonHeaderClass = "h-14 flex items-center px-4 border-b border-gray-200 bg-white shrink-0";
    const titleFontClass = "text-sm font-black text-gray-800 uppercase tracking-wider";

    const duplicateChars = useMemo(() => {
        const counts: Record<string, number> = {};
        sprites.forEach(s => { if (s.char) counts[s.char] = (counts[s.char] || 0) + 1; });
        return Object.entries(counts).filter(([_, count]) => count > 1).map(([char]) => char);
    }, [sprites]);

    return (
        <div className="flex h-[calc(100vh-12rem)] min-h-[600px] border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm font-sans">
            
            {/* 左侧: 字符映射 */}
            <div 
                className={`w-72 border-r border-gray-100 flex flex-col bg-gray-50/30 ${isDragging ? 'bg-primary-50/40' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); }}
            >
                <div className={commonHeaderClass}>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className={titleFontClass}>{t('bf.mapping_title')}</span>
                        <span className="text-[10px] font-bold text-primary-600 mt-0.5 uppercase tracking-tighter">{t('tp.file_count')}: {sprites.length}</span>
                    </div>
                    <button onClick={() => document.getElementById('bf-add-files')?.click()} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm">
                        <Plus size={16} />
                    </button>
                    <input id="bf-add-files" type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ''; }} />
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {sprites.map(s => (
                        <div key={s.id} className={`group flex items-center gap-2 p-2 bg-white border rounded-xl transition-all ${s.char ? 'border-gray-100' : 'border-red-200 bg-red-50/30'}`}>
                            <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                <img src={s.dataUrl} className="max-w-full max-h-full object-contain" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[9px] text-gray-400 font-mono truncate">{s.name}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <input 
                                        type="text" 
                                        maxLength={1}
                                        value={s.char}
                                        onChange={e => updateCharMapping(s.id, e.target.value)}
                                        placeholder={t('bf.char_hint')}
                                        className={`w-32 px-2 py-1 text-xs text-center font-bold bg-gray-50 border rounded outline-none focus:ring-1 focus:ring-primary-500 transition-colors ${duplicateChars.includes(s.char) ? 'border-amber-300 text-amber-700' : 'border-gray-200'}`}
                                    />
                                    {s.char && (
                                        <span className="text-[10px] text-gray-400 font-mono shrink-0">
                                            U+{s.char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => { URL.revokeObjectURL(s.dataUrl); setSprites(prev => prev.filter(x => x.id !== s.id)); }} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    {sprites.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 py-20 px-6 text-center">
                            <Type size={32} className="mb-4 text-gray-400" />
                            <span className="text-xs font-bold uppercase tracking-widest">{t('bf.empty_hint')}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 中间: 图集预览 */}
            <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden min-w-0 relative">
                <div className={commonHeaderClass}>
                    <div className="flex items-center gap-2.5 tracking-wider">
                        <div className={`p-1 rounded bg-white shadow-sm ${isPreviewGenerating ? 'animate-spin text-primary-500' : 'text-gray-400'}`}>
                            <RefreshCw size={14} />
                        </div>
                        <span className={titleFontClass}>{t('tp.preview_atlas')}</span>
                    </div>
                    <div className="flex-1"></div>
                    {duplicateChars.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full animate-pulse mr-2">
                            <AlertCircle size={10} />
                            {t('bf.duplicate_char', { char: duplicateChars[0] })}
                        </div>
                    )}
                    {atlasSize.w > 0 && (
                        <div className="text-[10px] font-mono font-black text-primary-700 bg-primary-50 border border-primary-100 px-3 py-1 rounded-full shadow-sm">
                            {atlasSize.w} x {atlasSize.h}
                        </div>
                    )}
                </div>

                <div 
                    ref={viewportRef}
                    className={`flex-1 overflow-auto relative select-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} grid pattern-checkered-large`}
                    onMouseDown={onPanStart}
                    onMouseMove={onPanMove}
                    onMouseUp={() => setIsPanning(false)}
                    onMouseLeave={() => setIsPanning(false)}
                    onWheel={handleWheel}
                >
                    <style>{`.pattern-checkered-large { background-image: conic-gradient(#e5e7eb 90deg, #f3f4f6 90deg 180deg, #e5e7eb 180deg 270deg, #f3f4f6 270deg); background-size: 32px 32px; }`}</style>
                    <div 
                        className="m-auto flex items-center justify-center p-32 pointer-events-none"
                        style={{ minWidth: `${atlasSize.w * zoom}px`, minHeight: `${atlasSize.h * zoom}px` }}
                    >
                        {previewUrl ? (
                            <div 
                                className={`relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-1 border transition-all duration-300 origin-center ${imageBg === 'white' ? 'bg-white border-gray-200' : 'bg-slate-800 border-slate-700'}`}
                                style={{ width: `${atlasSize.w}px`, height: `${atlasSize.h}px`, transform: `scale(${zoom})`, flexShrink: 0 }}
                            >
                                <img src={previewUrl} alt="Atlas Preview" className="w-full h-full block" style={{ imageRendering: zoom > 1 ? 'pixelated' : 'auto' }} />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-300 opacity-30">
                                <Box size={64} className="mb-4" />
                                <span className="text-[10px] uppercase font-black tracking-[0.4em]">{t('tp.status_ready')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Zoom Controls */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20 px-4">
                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-1.5 shadow-xl pointer-events-auto">
                        <div className="flex bg-gray-100/50 p-1 rounded-xl relative group/bg">
                            <button onClick={() => setImageBg('white')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${imageBg === 'white' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>{t('tp.bg_white')}</button>
                            <button onClick={() => setImageBg('dark')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${imageBg === 'dark' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>{t('tp.bg_dark')}</button>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/bg:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold shadow-lg">
                                {t('bf.bg_tooltip')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                        </div>
                        <div className="w-px h-6 bg-gray-200"></div>
                        <div className="flex items-center gap-0.5">
                            <button onClick={() => setZoom(prev => Math.max(0.05, prev - 0.1))} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"><ZoomOut size={16} /></button>
                            <div className="px-2 text-[10px] font-black text-gray-700 min-w-[50px] text-center font-mono">{(zoom * 100).toFixed(0)}%</div>
                            <button onClick={() => setZoom(prev => Math.min(4, prev + 0.1))} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg"><ZoomIn size={16} /></button>
                            <button onClick={() => setZoom(1)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg ml-1" title="1:1 Size"><Minimize size={16} /></button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧: 设置与导出 */}
            <div className="w-72 border-l border-gray-100 flex flex-col bg-white">
                <div className={commonHeaderClass}>
                    <Settings size={18} className="text-primary-600 mr-2" />
                    <span className={titleFontClass}>{t('bf.settings')}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('bf.format')}</label>
                            <select value={exportFormat} onChange={e => setExportFormat(e.target.value as ExportFormat)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer font-bold">
                                <option value="text">{t('bf.format_text')}</option>
                                <option value="xml">{t('bf.format_xml')}</option>
                                <option value="json">{t('bf.format_json')}</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.max_size')}</label>
                            <select value={maxSize} onChange={e => setMaxSize(parseInt(e.target.value))} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer">
                                {[512, 1024, 2048, 4096].map(v => <option key={v} value={v}>{v} x {v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.padding')}</label>
                            <input type="number" min={0} value={padding} onChange={e => setPadding(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none" />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 shrink-0 space-y-4">
                    <div>
                        <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('bf.export_name')}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={exportName} 
                                onChange={e => setExportName(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                                className="w-full p-2 pl-8 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none font-mono"
                            />
                            <FileText size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        </div>
                    </div>

                    <button 
                        onClick={handleExport}
                        disabled={sprites.length === 0 || isPacking || packedCount === 0 || duplicateChars.length > 0}
                        className="w-full py-4 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-primary-100 active:scale-[0.98] uppercase tracking-widest"
                    >
                        {isPacking ? (
                            <RefreshCw className="animate-spin" size={18} />
                        ) : (
                            <Download size={18} />
                        )}
                        {t('bf.export_btn')}
                    </button>
                    
                    {duplicateChars.length > 0 && (
                         <p className="text-[9px] text-amber-600 font-bold text-center">{t('bf.duplicate_char', { char: duplicateChars.join(', ') })}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BitmapFontGenerator;
