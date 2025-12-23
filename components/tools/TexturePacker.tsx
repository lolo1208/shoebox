
/// <reference lib="dom" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
    LayoutGrid, Download, Trash2, RefreshCw, X, 
    Settings, Layers, Plus, Zap, ImageIcon, Box, Cpu, ChevronDown, AlertCircle,
    ZoomIn, ZoomOut, Maximize, Minimize, FileText, Info
} from 'lucide-react';
import JSZip from 'jszip';
// @ts-ignore
import UPNG from 'upng-js';
import CryptoJS from 'crypto-js';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLanguage } from '../../contexts/LanguageContext';

interface Sprite {
    id: string;
    hash: string;
    file: File;
    name: string;
    width: number;
    height: number;
    dataUrl: string;
    trimmedX: number;
    trimmedY: number;
    trimmedW: number;
    trimmedH: number;
    imgElement?: HTMLImageElement; 
}

interface PackedSprite {
    sprite: Sprite;
    x: number;
    y: number;
    rotated: boolean;
    atlasW: number; // The physical width in atlas (swapped if rotated)
    atlasH: number; // The physical height in atlas (swapped if rotated)
}

interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const TexturePacker: React.FC = () => {
    const { t } = useLanguage();

    // --- Settings ---
    const [engine, setEngine] = useLocalStorage<string>('tool-tp-engine', 'cocos');
    const [algorithm, setAlgorithm] = useLocalStorage<'maxrects' | 'basic'>('tool-tp-algo', 'maxrects');
    const [maxSize, setMaxSize] = useLocalStorage<number>('tool-tp-max-size', 2048);
    const [padding, setPadding] = useLocalStorage<number>('tool-tp-padding', 2);
    const [extrude, setExtrude] = useLocalStorage<number>('tool-tp-extrude', 1);
    const [trim, setTrim] = useLocalStorage<boolean>('tool-tp-trim', true);
    const [allowRotation, setAllowRotation] = useLocalStorage<boolean>('tool-tp-rotation', true);
    const [pngCompress, setPngCompress] = useLocalStorage<boolean>('tool-tp-png-compress', false);
    const [pngColors, setPngColors] = useLocalStorage<number>('tool-tp-png-colors', 256);
    const [atlasName, setAtlasName] = useLocalStorage<string>('tool-tp-atlas-name', 'atlas');
    const [imageBg, setImageBg] = useLocalStorage<'white' | 'dark'>('tool-tp-img-bg', 'white');

    // --- State ---
    const [sprites, setSprites] = useState<Sprite[]>([]);
    const [isPacking, setIsPacking] = useState(false);
    const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [atlasSize, setAtlasSize] = useState({ w: 0, h: 0 });
    const [duplicateCount, setDuplicateCount] = useState(0);
    const [packedCount, setPackedCount] = useState(0);

    // --- View State (Zoom/Pan) ---
    const [zoom, setZoom] = useState(1);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

    const currentPackedResult = useRef<{ packed: PackedSprite[], width: number, height: number } | null>(null);

    useEffect(() => {
        return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // --- File Handlers ---
    const processFiles = async (files: File[]) => {
        const newSprites: Sprite[] = [];
        let duplicates = 0;
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            const buffer = await file.arrayBuffer();
            const hash = CryptoJS.MD5(CryptoJS.lib.WordArray.create(buffer)).toString();
            
            if (sprites.some(s => s.hash === hash) || newSprites.some(s => s.hash === hash)) {
                duplicates++; continue;
            }

            const sprite = await loadAndAnalyzeSprite(file, hash);
            newSprites.push(sprite);
        }

        if (duplicates > 0) {
            setDuplicateCount(duplicates);
            setTimeout(() => setDuplicateCount(0), 4000);
        }
        setSprites(prev => [...prev, ...newSprites]);
    };

    const loadAndAnalyzeSprite = (file: File, hash: string): Promise<Sprite> => {
        return new Promise((resolve) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })!;
                ctx.drawImage(img, 0, 0);

                let trimmedX = 0, trimmedY = 0, trimmedW = img.width, trimmedH = img.height;
                if (trim) {
                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    const pixels = imageData.data;
                    let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
                    let hasAlpha = false;
                    for (let y = 0; y < img.height; y++) {
                        for (let x = 0; x < img.width; x++) {
                            const alpha = pixels[(y * img.width + x) * 4 + 3];
                            if (alpha > 5) {
                                hasAlpha = true;
                                if (x < minX) minX = x; if (y < minY) minY = y;
                                if (x > maxX) maxX = x; if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (hasAlpha) {
                        trimmedX = minX; trimmedY = minY;
                        trimmedW = maxX - minX + 1; trimmedH = maxY - minY + 1;
                    }
                }
                resolve({
                    id: Math.random().toString(36).substr(2, 9),
                    hash, file, name: file.name.replace(/\.[^/.]+$/, ""),
                    width: img.width, height: img.height, dataUrl: url,
                    trimmedX, trimmedY, trimmedW, trimmedH,
                    imgElement: img
                });
            };
            img.src = url;
        });
    };

    // --- Packing Algorithms ---
    const packMaxRects = (sortedSprites: Sprite[], maxW: number, maxH: number, pad: number, ext: number, rot: boolean) => {
        let freeRects: Rect[] = [{ x: pad, y: pad, w: maxW - pad * 2, h: maxH - pad * 2 }];
        const packed: PackedSprite[] = [];
        let maxWidth = 0;
        let maxHeight = 0;

        for (const sprite of sortedSprites) {
            let bestRect: Rect | null = null;
            let bestShortSideFit = Number.MAX_VALUE;
            let bestLongSideFit = Number.MAX_VALUE;
            let rotated = false;
            const sw = sprite.trimmedW + ext * 2;
            const sh = sprite.trimmedH + ext * 2;

            for (const rect of freeRects) {
                if (rect.w >= sw && rect.h >= sh) {
                    const leftoverW = rect.w - sw; const leftoverH = rect.h - sh;
                    const shortSide = Math.min(leftoverW, leftoverH); const longSide = Math.max(leftoverW, leftoverH);
                    if (shortSide < bestShortSideFit || (shortSide === bestShortSideFit && longSide < bestLongSideFit)) {
                        bestRect = rect; bestShortSideFit = shortSide; bestLongSideFit = longSide; rotated = false;
                    }
                }
                if (rot && rect.w >= sh && rect.h >= sw) {
                    const leftoverW = rect.w - sh; const leftoverH = rect.h - sw;
                    const shortSide = Math.min(leftoverW, leftoverH); const longSide = Math.max(leftoverW, leftoverH);
                    if (shortSide < bestShortSideFit || (shortSide === bestShortSideFit && longSide < bestLongSideFit)) {
                        bestRect = rect; bestShortSideFit = shortSide; bestLongSideFit = longSide; rotated = true;
                    }
                }
            }

            if (!bestRect) continue;
            const realW = rotated ? sh : sw; const realH = rotated ? sw : sh;
            packed.push({ sprite, x: bestRect.x, y: bestRect.y, rotated, atlasW: realW, atlasH: realH });
            maxWidth = Math.max(maxWidth, bestRect.x + realW + pad);
            maxHeight = Math.max(maxHeight, bestRect.y + realH + pad);

            const splitRects: Rect[] = [];
            for (const r of freeRects) {
                if (r.x < bestRect.x + realW && r.x + r.w > bestRect.x && r.y < bestRect.y + realH && r.y + r.h > bestRect.y) {
                    if (bestRect.x + realW < r.x + r.w) splitRects.push({ x: bestRect.x + realW, y: r.y, w: r.x + r.w - (bestRect.x + realW), h: r.h });
                    if (bestRect.x > r.x) splitRects.push({ x: r.x, y: r.y, w: bestRect.x - r.x, h: r.h });
                    if (bestRect.y + realH < r.y + r.h) splitRects.push({ x: r.x, y: bestRect.y + realH, w: r.w, h: r.y + r.h - (bestRect.y + realH) });
                    if (bestRect.y > r.y) splitRects.push({ x: r.x, y: r.y, w: r.w, h: bestRect.y - r.y });
                } else { splitRects.push(r); }
            }
            freeRects = [];
            for (let i = 0; i < splitRects.length; i++) {
                let keep = true;
                for (let j = 0; j < splitRects.length; j++) {
                    if (i === j) continue;
                    const a = splitRects[i], b = splitRects[j];
                    if (b.x <= a.x && b.y <= a.y && b.x + b.w >= a.x + a.w && b.y + b.h >= a.y + a.h) { keep = false; break; }
                }
                if (keep) freeRects.push(splitRects[i]);
            }
        }
        return { packed, width: maxWidth, height: maxHeight };
    };

    const packBasic = (sortedSprites: Sprite[], maxW: number, maxH: number, pad: number, ext: number, rot: boolean) => {
        let currentX = pad, currentY = pad, shelfHeight = 0, maxWidth = 0, maxHeight = 0;
        const packed: PackedSprite[] = [];
        for (const sprite of sortedSprites) {
            let sw = sprite.trimmedW + ext * 2, sh = sprite.trimmedH + ext * 2, rotated = false;
            if (rot) {
                if ((sh < sw && currentX + sh + pad <= maxW) || (currentX + sw + pad > maxW && currentX + sh + pad <= maxW)) {
                    [sw, sh] = [sh, sw]; rotated = true;
                }
            }
            if (currentX + sw + pad > maxW) {
                currentX = pad; currentY += shelfHeight + pad; shelfHeight = 0;
            }
            if (currentY + sh + pad > maxH) continue;
            packed.push({ sprite, x: currentX, y: currentY, rotated, atlasW: sw, atlasH: sh });
            currentX += sw + pad;
            shelfHeight = Math.max(shelfHeight, sh);
            maxWidth = Math.max(maxWidth, currentX);
            maxHeight = Math.max(maxHeight, currentY + shelfHeight);
        }
        return { packed, width: maxWidth, height: maxHeight };
    };

    const packSprites = useCallback(() => {
        if (sprites.length === 0) return null;
        const sorted = [...sprites].sort((a, b) => Math.max(b.trimmedW, b.trimmedH) - Math.max(a.trimmedW, a.trimmedH));
        const result = algorithm === 'maxrects' 
            ? packMaxRects(sorted, maxSize, maxSize, padding, extrude, allowRotation)
            : packBasic(sorted, maxSize, maxSize, padding, extrude, allowRotation);
        
        if (result.width <= 0) return null;
        const toNextPow2 = (v: number) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, v))));
        return { packed: result.packed, width: toNextPow2(result.width), height: toNextPow2(result.height) };
    }, [sprites, algorithm, maxSize, padding, extrude, allowRotation]);

    // --- Drawing Logic (Robust Off-screen Canvas Method) ---
    // This function handles Rotation, Trim, Placement and Extrusion perfectly
    const drawToCanvas = useCallback((ctx: CanvasRenderingContext2D, packed: PackedSprite[], ext: number) => {
        ctx.imageSmoothingEnabled = false;

        for (const p of packed) {
            const img = p.sprite.imgElement;
            if (!img) continue;
            
            // 1. Source parameters
            const { trimmedX: sx, trimmedY: sy, trimmedW: sw, trimmedH: sh } = p.sprite;

            // 2. Prepare Temp Source Canvas (Trimmed Image)
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = sw;
            srcCanvas.height = sh;
            const srcCtx = srcCanvas.getContext('2d')!;
            srcCtx.imageSmoothingEnabled = false;
            srcCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

            // 3. Prepare Sprite Canvas (Rotated if needed)
            const drawW = p.rotated ? sh : sw;
            const drawH = p.rotated ? sw : sh;
            
            const spriteCanvas = document.createElement('canvas');
            spriteCanvas.width = drawW;
            spriteCanvas.height = drawH;
            const spriteCtx = spriteCanvas.getContext('2d')!;
            spriteCtx.imageSmoothingEnabled = false;

            if (p.rotated) {
                // Rotate 90 degrees CW: Move origin, rotate, draw
                spriteCtx.translate(drawW, 0);
                spriteCtx.rotate(Math.PI / 2);
                spriteCtx.drawImage(srcCanvas, 0, 0);
            } else {
                spriteCtx.drawImage(srcCanvas, 0, 0);
            }

            // 4. Draw to Main Atlas
            // Force integer coordinates to avoid sub-pixel blurring
            const targetX = Math.round(p.x);
            const targetY = Math.round(p.y);

            ctx.drawImage(spriteCanvas, targetX, targetY);

            // 5. Apply Extrusion (Copy edges)
            // Since spriteCanvas is already rotated (physical appearance), we just copy its edges
            if (ext > 0) {
                // Top edge
                ctx.drawImage(spriteCanvas, 0, 0, drawW, 1, targetX, targetY - ext, drawW, ext);
                // Bottom edge
                ctx.drawImage(spriteCanvas, 0, drawH - 1, drawW, 1, targetX, targetY + drawH, drawW, ext);
                // Left edge
                ctx.drawImage(spriteCanvas, 0, 0, 1, drawH, targetX - ext, targetY, ext, drawH);
                // Right edge
                ctx.drawImage(spriteCanvas, drawW - 1, 0, 1, drawH, targetX + drawW, targetY, ext, drawH);
                
                // Corners
                ctx.drawImage(spriteCanvas, 0, 0, 1, 1, targetX - ext, targetY - ext, ext, ext); // TL
                ctx.drawImage(spriteCanvas, drawW - 1, 0, 1, 1, targetX + drawW, targetY - ext, ext, ext); // TR
                ctx.drawImage(spriteCanvas, 0, drawH - 1, 1, 1, targetX - ext, targetY + drawH, ext, ext); // BL
                ctx.drawImage(spriteCanvas, drawW - 1, drawH - 1, 1, 1, targetX + drawW, targetY + drawH, ext, ext); // BR
            }
        }
    }, []);

    // --- Auto Fit Logic ---
    const handleAutoFit = useCallback(() => {
        if (!viewportRef.current || atlasSize.w === 0) return;
        const vw = viewportRef.current.clientWidth - 128; // Padding
        const vh = viewportRef.current.clientHeight - 128;
        const scale = Math.min(1, vw / atlasSize.w, vh / atlasSize.h);
        setZoom(Math.max(0.1, scale));
        // Reset scroll
        viewportRef.current.scrollLeft = 0;
        viewportRef.current.scrollTop = 0;
    }, [atlasSize]);

    // --- Unified Update Preview ---
    useEffect(() => {
        let active = true;
        const updatePreview = async () => {
            if (sprites.length === 0) {
                setPreviewUrl(null); setAtlasSize({ w: 0, h: 0 }); setPackedCount(0); return;
            }
            setIsPreviewGenerating(true);
            const result = packSprites();
            if (!result || !active) { setIsPreviewGenerating(false); return; }

            const { packed, width, height } = result;
            currentPackedResult.current = result;
            
            const isFirstLoad = atlasSize.w === 0;
            setAtlasSize({ w: width, h: height });
            setPackedCount(packed.length);

            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d')!;

            // Use the robust drawing function
            drawToCanvas(ctx, packed, extrude);

            if (!active) return;
            try {
                const blob: Blob | null = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
                if (blob && active) {
                    const url = URL.createObjectURL(blob);
                    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url; });
                    if (isFirstLoad) {
                        setTimeout(handleAutoFit, 100);
                    }
                }
            } catch (e) {
                console.error("Failed to generate preview blob", e);
            }
            
            setIsPreviewGenerating(false);
        };

        const timer = setTimeout(updatePreview, 400);
        return () => { active = false; clearTimeout(timer); };
    }, [sprites, packSprites, trim, padding, extrude, maxSize, allowRotation, algorithm, drawToCanvas]);

    // --- Export ---
    const handleFinalPack = async () => {
        if (!currentPackedResult.current) return;
        setIsPacking(true);
        const { packed, width, height } = currentPackedResult.current;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;

        // Use the robust drawing function (same as preview)
        drawToCanvas(ctx, packed, extrude);

        const baseFilename = atlasName.trim() || 'atlas';

        let plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>frames</key>
        <dict>`;

        packed.forEach(p => {
            // Integer rounding for cleaner coordinates
            const x = Math.round(p.x);
            const y = Math.round(p.y);
            
            const offX = Math.round((p.sprite.trimmedX + p.sprite.trimmedW / 2) - p.sprite.width / 2);
            const offY = Math.round(p.sprite.height / 2 - (p.sprite.trimmedY + p.sprite.trimmedH / 2));
            
            // Cocos Creator (Format 3) requirement: 
            // textureRect should ALWAYS be the un-rotated dimension (logical size).
            // The engine swaps it at runtime if textureRotated is true.
            const w = p.sprite.trimmedW;
            const h = p.sprite.trimmedH;

            plist += `
            <key>${p.sprite.name}.png</key>
            <dict>
                <key>aliases</key><array/>
                <key>spriteOffset</key><string>{${offX},${offY}}</string>
                <key>spriteSize</key><string>{${p.sprite.trimmedW},${p.sprite.trimmedH}}</string>
                <key>spriteSourceSize</key><string>{${p.sprite.width},${p.sprite.height}}</string>
                <key>textureRect</key><string>{{${x},${y}},{${w},${h}}}</string>
                <key>textureRotated</key><${p.rotated ? 'true' : 'false'}/>
            </dict>`;
        });

        plist += `\n        </dict>\n        <key>metadata</key>\n        <dict>\n            <key>format</key><integer>3</integer>\n            <key>pixelFormat</key><string>RGBA8888</string>\n            <key>premultiplyAlpha</key><false/>\n            <key>realTextureFileName</key><string>${baseFilename}.png</string>\n            <key>size</key><string>{${width},${height}}</string>\n            <key>smartupdate</key><string>$TexturePacker:SmartUpdate:00000000000000000000000000000000$</string>\n            <key>textureFileName</key><string>${baseFilename}.png</string>\n        </dict>\n    </dict>\n</plist>`;

        let finalImageBlob: Blob | null = null;
        if (pngCompress) {
            const imageData = ctx.getImageData(0, 0, width, height);
            const pngBuffer = UPNG.encode([imageData.data.buffer], width, height, pngColors);
            finalImageBlob = new Blob([pngBuffer], { type: 'image/png' });
        } else {
            finalImageBlob = await new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
        }

        if (finalImageBlob) {
            const zip = new JSZip();
            zip.file(`${baseFilename}.png`, finalImageBlob); 
            zip.file(`${baseFilename}.plist`, plist);
            const zipContent = await zip.generateAsync({ type: "blob" });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipContent);
            link.download = `${baseFilename}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        }
        setIsPacking(false);
    };

    // --- Interaction Handlers ---
    const onPanStart = (e: React.MouseEvent) => {
        if (!viewportRef.current) return;
        setIsPanning(true);
        setPanStart({
            x: e.pageX,
            y: e.pageY,
            scrollLeft: viewportRef.current.scrollLeft,
            scrollTop: viewportRef.current.scrollTop
        });
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

    return (
        <div className="flex h-[calc(100vh-12rem)] min-h-[600px] border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm font-sans">
            
            {/* 左侧: 碎图列表 */}
            <div 
                className={`w-72 border-r border-gray-100 flex flex-col transition-all bg-gray-50/30 ${isDragging ? 'bg-primary-50/40' : ''}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files) processFiles(Array.from(e.dataTransfer.files)); }}
            >
                <div className={commonHeaderClass}>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className={titleFontClass}>{t('tp.upload_title')}</span>
                        <span className="text-[10px] font-bold text-primary-600 mt-0.5 uppercase tracking-tighter">{t('tp.file_count')}: {sprites.length}</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                        <button onClick={() => document.getElementById('tp-add-files')?.click()} className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm active:scale-95">
                            <Plus size={16} />
                        </button>
                        <input id="tp-add-files" type="file" multiple accept="image/*" className="hidden" onChange={e => { if (e.target.files) processFiles(Array.from(e.target.files)); e.target.value = ''; }} />
                        <button onClick={() => { sprites.forEach(s => URL.revokeObjectURL(s.dataUrl)); setSprites([]); }} disabled={sprites.length === 0} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-20 transition-all">
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                    {sprites.map(s => (
                        <div key={s.id} className="group flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-xl hover:border-primary-200 hover:shadow-sm transition-all relative">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 pattern-checkered">
                                <img src={s.dataUrl} className="max-w-full h-full object-contain" alt="" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-gray-700 truncate" title={s.name}>{s.name}</div>
                                <div className="text-[9px] text-gray-400 font-mono mt-0.5 flex flex-col">
                                    <span>{s.width}x{s.height}</span>
                                    {trim && <span className="text-primary-500 font-bold">{s.trimmedW}x{s.trimmedH}</span>}
                                </div>
                            </div>
                            <button onClick={() => { URL.revokeObjectURL(s.dataUrl); setSprites(prev => prev.filter(x => x.id !== s.id)); }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110">
                                <X size={10} strokeWidth={3} />
                            </button>
                        </div>
                    ))}
                    {sprites.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 py-10 opacity-50">
                            <ImageIcon size={24} className="mb-3" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-center px-4">{t('tp.upload_desc')}</span>
                        </div>
                    )}
                </div>
                {duplicateCount > 0 && (
                    <div className="mx-2 mb-2 bg-amber-50 border border-amber-100 rounded-lg p-2 flex items-center gap-2 text-amber-700 animate-slide-up shrink-0">
                        <Zap size={12} className="shrink-0" />
                        <span className="text-[10px] font-bold leading-tight">{t('tp.duplicate_skipped', { n: duplicateCount })}</span>
                    </div>
                )}
            </div>

            {/* 中间: 实时预览 */}
            <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden min-w-0 relative">
                <div className={commonHeaderClass}>
                    <div className="flex items-center gap-2.5 tracking-wider">
                        <div className={`p-1 rounded bg-white shadow-sm ${isPreviewGenerating ? 'animate-spin text-primary-500' : 'text-gray-400'}`}>
                            <RefreshCw size={14} />
                        </div>
                        <span className={titleFontClass}>{t('tp.preview_atlas')}</span>
                    </div>
                    <div className="flex-1"></div>
                    {packedCount < sprites.length && sprites.length > 0 && !isPreviewGenerating && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full animate-pulse mr-2">
                            <AlertCircle size={10} />
                            {t('tp.not_packed_warning', { n: sprites.length - packedCount })}
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
                    <style>{`.pattern-checkered-large { background-image: conic-gradient(#e5e7eb 90deg, #f3f4f6 90deg 180deg, #e5e7eb 180deg 270deg, #f3f4f6 270deg); background-size: 32px 32px; } .pattern-checkered { background-image: conic-gradient(#e5e7eb 90deg, #f3f4f6 90deg 180deg, #e5e7eb 180deg 270deg, #f3f4f6 270deg); background-size: 10px 10px; }`}</style>
                    
                    {/* 使用 margin: auto 配合 grid 解决缩放导致的滚动边界问题 */}
                    <div 
                        className="m-auto flex items-center justify-center p-32 pointer-events-none"
                        style={{ 
                            minWidth: `${atlasSize.w * zoom}px`, 
                            minHeight: `${atlasSize.h * zoom}px` 
                        }}
                    >
                        {previewUrl ? (
                            <div 
                                className={`relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-1 border transition-all duration-300 origin-center ${imageBg === 'white' ? 'bg-white border-gray-200' : 'bg-slate-900 border-slate-700'}`}
                                style={{ 
                                    width: `${atlasSize.w}px`,
                                    height: `${atlasSize.h}px`,
                                    transform: `scale(${zoom})`,
                                    flexShrink: 0
                                }}
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

                {/* Floating Controls Overlay */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none z-20 px-4">
                    <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-1.5 shadow-xl pointer-events-auto animate-slide-up">
                        {/* Image Background Selection with Tooltip */}
                        <div className="flex bg-gray-100/50 p-1 rounded-xl relative group/tool">
                            <button onClick={() => setImageBg('white')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${imageBg === 'white' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>{t('tp.bg_white')}</button>
                            <button onClick={() => setImageBg('dark')} className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${imageBg === 'dark' ? 'bg-white shadow-sm text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}>{t('tp.bg_dark')}</button>
                            
                            {/* Short Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover/tool:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold shadow-lg">
                                {t('tp.bg_tooltip')}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                        </div>

                        <div className="w-px h-6 bg-gray-200"></div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-0.5">
                            <button onClick={() => setZoom(prev => Math.max(0.05, prev - 0.1))} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all">
                                <ZoomOut size={16} />
                            </button>
                            <div className="px-2 text-[10px] font-black text-gray-700 min-w-[50px] text-center font-mono select-none">
                                {(zoom * 100).toFixed(0)}%
                            </div>
                            <button onClick={() => setZoom(prev => Math.min(4, prev + 0.1))} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all">
                                <ZoomIn size={16} />
                            </button>
                            <button onClick={() => setZoom(1)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all ml-1" title="1:1 Size">
                                <Minimize size={16} />
                            </button>
                            <button onClick={handleAutoFit} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition-all" title="Auto Fit">
                                <Maximize size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右侧: 设置 */}
            <div className="w-72 border-l border-gray-100 flex flex-col bg-white">
                <div className={commonHeaderClass}>
                    <Settings size={18} className="text-primary-600 mr-2" />
                    <span className={titleFontClass}>{t('tp.settings')}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.engine')}</label>
                            <select value={engine} onChange={e => setEngine(e.target.value)} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer">
                                <option value="cocos">Cocos Creator</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.algorithm')}</label>
                            <div className="relative group">
                                <select value={algorithm} onChange={e => setAlgorithm(e.target.value as any)} className="w-full p-2 pl-8 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none appearance-none cursor-pointer">
                                    <option value="maxrects">{t('tp.algo.maxrects')}</option>
                                    <option value="basic">{t('tp.algo.basic')}</option>
                                </select>
                                <Cpu size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.max_size')}</label>
                            <select value={maxSize} onChange={e => setMaxSize(parseInt(e.target.value))} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none cursor-pointer">
                                {[512, 1024, 2048, 4096, 8192].map(v => <option key={v} value={v}>{v} x {v}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.padding')}</label>
                                <input type="number" value={padding} onChange={e => setPadding(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none" />
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.extrude')}</label>
                                <input type="number" value={extrude} onChange={e => setExtrude(parseInt(e.target.value) || 0)} className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none" />
                            </div>
                        </div>

                        <div className="space-y-2.5 pt-2">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={trim} onChange={e => setTrim(e.target.checked)} className="rounded text-primary-600 border-gray-300 w-4 h-4 transition-all" />
                                <span className="text-xs text-gray-600 group-hover:text-primary-600 font-bold uppercase tracking-tight">{t('tp.trim')}</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={allowRotation} onChange={e => setAllowRotation(e.target.checked)} className="rounded text-primary-600 border-gray-300 w-4 h-4 transition-all" />
                                <span className="text-xs text-gray-600 group-hover:text-primary-600 font-bold uppercase tracking-tight">{t('tp.rotation')}</span>
                            </label>
                        </div>
                        <div className="pt-4 border-t border-gray-100 space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" checked={pngCompress} onChange={e => setPngCompress(e.target.checked)} className="rounded text-primary-600 border-gray-300 w-4 h-4" />
                                <span className="text-xs text-gray-600 group-hover:text-primary-600 font-black uppercase tracking-tight">{t('tp.png_compress')}</span>
                            </label>
                            {pngCompress && (
                                <div className="animate-fade-in space-y-2 pl-7">
                                    <div className="flex justify-between text-[9px] text-gray-400 font-black uppercase">
                                        <span>{t('tp.max_colors')}</span>
                                        <span className="text-primary-600">{pngColors}</span>
                                    </div>
                                    <input type="range" min="2" max="256" step="2" value={pngColors} onChange={e => setPngColors(parseInt(e.target.value))} className="w-full h-1 bg-gray-100 rounded-lg accent-primary-600 cursor-pointer" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 shrink-0 space-y-4">
                    <div>
                        <label className="text-[10px] text-gray-400 font-black uppercase block mb-1.5 tracking-tighter">{t('tp.atlas_name')}</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={atlasName} 
                                onChange={e => setAtlasName(e.target.value.replace(/[^a-zA-Z0-9_\-]/g, ''))}
                                placeholder={t('tp.atlas_name_ph')}
                                className="w-full p-2 pl-8 bg-white border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none font-mono"
                            />
                            <FileText size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                        </div>
                    </div>

                    <button 
                        onClick={handleFinalPack}
                        disabled={sprites.length === 0 || isPacking}
                        className="w-full py-4 bg-primary-600 text-white rounded-xl font-black text-sm hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl shadow-primary-100 active:scale-[0.98] uppercase tracking-widest"
                    >
                        {isPacking ? (
                            <RefreshCw className="animate-spin" size={18} />
                        ) : (
                            <Download size={18} />
                        )}
                        {t('tp.pack_btn')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TexturePacker;
