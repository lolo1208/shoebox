/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import {
  ScanEye,
  Download,
  RefreshCw,
  X,
  Image as ImageIcon,
  Undo2,
  Redo2,
  Trash2,
  Plus,
  Maximize,
  Copy,
  Check,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import { drawCensorScene } from '@/lib/image/censorRender';
import {
  HEX_RE,
  PREVIEW_MAX,
  MIN_SIZE,
  clamp,
  uid,
  snapshot,
  normalizeMode,
  normalizeShape,
  safeHex,
  clampNumber,
  pickStyle,
  type CensorMode as Mode,
  type CensorShape as Shape,
  type CensorHandle as Handle,
  type CensorRegionStyle as RegionStyle,
  type CensorRegion as Region,
  type CensorDrag as Drag,
} from '@/lib/image/censor';

const HANDLES: { h: Handle; cls: string }[] = [
  { h: 'nw', cls: '-left-1.5 -top-1.5 cursor-nwse-resize' },
  { h: 'n', cls: 'left-1/2 -translate-x-1/2 -top-1.5 cursor-ns-resize' },
  { h: 'ne', cls: '-right-1.5 -top-1.5 cursor-nesw-resize' },
  { h: 'e', cls: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
  { h: 'se', cls: '-right-1.5 -bottom-1.5 cursor-nwse-resize' },
  { h: 's', cls: 'left-1/2 -translate-x-1/2 -bottom-1.5 cursor-ns-resize' },
  { h: 'sw', cls: '-left-1.5 -bottom-1.5 cursor-nesw-resize' },
  { h: 'w', cls: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize' },
];

const CHECKERBOARD =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

const PixelateCensor: React.FC = () => {
  const { t } = useLanguage();

  // Defaults for new regions (persisted). Each region stores its own copy,
  // so editing a region never changes the others.
  const [defaultMode, setDefaultMode] = useLocalStorage<Mode>('tool-px-mode', 'pixelate');
  const [defaultShape, setDefaultShape] = useLocalStorage<Shape>('tool-px-shape', 'rect');
  const [defaultBlockPct, setDefaultBlockPct] = useLocalStorage<number>('tool-px-block', 1.6);
  const [defaultBlurPct, setDefaultBlurPct] = useLocalStorage<number>('tool-px-blur', 0.8);
  const [defaultColor, setDefaultColor] = useLocalStorage<string>('tool-px-color', '#000000');
  const [format, setFormat] = useLocalStorage<string>('tool-px-format', 'png');
  const [quality, setQuality] = useLocalStorage<number>('tool-px-quality', 0.92);

  // File / image
  const [file, setFile] = useState<File | null>(null);
  const [imgInfo, setImgInfo] = useState<{ w: number; h: number } | null>(null);
  const [isDropOver, setIsDropOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Regions
  const [regions, setRegions] = useState<Region[]>([]);
  const regionsRef = useRef<Region[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragBaseRef = useRef<Region[] | null>(null);
  const dragPushedRef = useRef(false);

  // History
  const historyRef = useRef<Region[][]>([]);
  const futureRef = useRef<Region[][]>([]);
  const [, bumpHistory] = useState(0);
  const lastNudgeRef = useRef(0);
  const editFocusRef = useRef(false);
  const styleEditRef = useRef(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // The settings panel edits the selected region, or the defaults when nothing is selected.
  const selectedRegion = regions.find((r) => r.id === selectedId) || null;
  const defaults: RegionStyle = {
    mode: normalizeMode(defaultMode),
    shape: normalizeShape(defaultShape),
    blockPct: clampNumber(defaultBlockPct, 0.4, 10, 1.6),
    blurPct: clampNumber(defaultBlurPct, 0.1, 4, 0.8),
    color: safeHex(defaultColor),
  };
  const active: RegionStyle = selectedRegion ? pickStyle(selectedRegion) : defaults;
  const activeColorText = selectedRegion
    ? String(selectedRegion.color ?? '')
    : String(defaultColor ?? '');
  const activeColorSafe = safeHex(activeColorText);
  const colorPickerValue =
    activeColorSafe.length === 4
      ? `#${activeColorSafe[1]}${activeColorSafe[1]}${activeColorSafe[2]}${activeColorSafe[2]}${activeColorSafe[3]}${activeColorSafe[3]}`
      : activeColorSafe;

  const showNotice = (text: string, error = true) => setNotice({ text, error });

  // Tools stay mounted when the user switches away, so global listeners must ignore hidden instances.
  const isToolVisible = () => {
    const el = rootRef.current;
    return !!el && el.getClientRects().length > 0;
  };

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    editFocusRef.current = false;
  }, [selectedId]);

  // A slider drag / color picking session is a single undo step.
  useEffect(() => {
    const endStyleEdit = () => {
      styleEditRef.current = false;
    };
    window.addEventListener('pointerup', endStyleEdit);
    window.addEventListener('keyup', endStyleEdit);
    window.addEventListener('blur', endStyleEdit);
    return () => {
      window.removeEventListener('pointerup', endStyleEdit);
      window.removeEventListener('keyup', endStyleEdit);
      window.removeEventListener('blur', endStyleEdit);
    };
  }, []);

  // Make sure the drop overlay never gets stuck if the drag ends outside the tool.
  useEffect(() => {
    const resetDrop = () => {
      setIsDropOver(false);
    };
    window.addEventListener('dragend', resetDrop);
    window.addEventListener('drop', resetDrop);
    const onWindowDragLeave = (e: DragEvent) => {
      if (e.relatedTarget === null) resetDrop();
    };
    window.addEventListener('dragleave', onWindowDragLeave);
    return () => {
      window.removeEventListener('dragend', resetDrop);
      window.removeEventListener('drop', resetDrop);
      window.removeEventListener('dragleave', onWindowDragLeave);
    };
  }, []);

  const updateRegions = (next: Region[]) => {
    regionsRef.current = next;
    setRegions(next);
  };

  const pushHistory = (base: Region[]) => {
    historyRef.current = [...historyRef.current.slice(-49), snapshot(base)];
    futureRef.current = [];
    bumpHistory((v) => v + 1);
  };

  const undo = () => {
    const history = historyRef.current;
    if (!history.length) return;
    const prev = history[history.length - 1];
    futureRef.current = [snapshot(regionsRef.current), ...futureRef.current].slice(0, 50);
    historyRef.current = history.slice(0, -1);
    updateRegions(snapshot(prev));
    setSelectedId((sel) => (prev.some((r) => r.id === sel) ? sel : null));
    bumpHistory((v) => v + 1);
  };

  const redo = () => {
    const future = futureRef.current;
    if (!future.length) return;
    const next = future[0];
    historyRef.current = [...historyRef.current, snapshot(regionsRef.current)].slice(-50);
    futureRef.current = future.slice(1);
    updateRegions(snapshot(next));
    setSelectedId((sel) => (next.some((r) => r.id === sel) ? sel : null));
    bumpHistory((v) => v + 1);
  };

  // Load image
  useEffect(() => {
    if (!file) {
      sourceImgRef.current = null;
      setImgInfo(null);
      updateRegions([]);
      setSelectedId(null);
      historyRef.current = [];
      futureRef.current = [];
      bumpHistory((v) => v + 1);
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        showNotice(t('px.load_failed'));
        setFile(null);
        return;
      }
      sourceImgRef.current = img;
      setImgInfo({ w: img.naturalWidth, h: img.naturalHeight });
      updateRegions([]);
      setSelectedId(null);
      historyRef.current = [];
      futureRef.current = [];
      bumpHistory((v) => v + 1);
    };
    img.onerror = () => {
      showNotice(t('px.load_failed'));
      setFile(null);
    };
    img.src = url;

    return () => {
      img.onload = null;
      img.onerror = null;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Live preview: at most one pending frame, always drawing the latest state.
  const drawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imgInfo) return;
    drawCensorScene(canvas, sourceImgRef.current, regionsRef.current, Math.min(1, PREVIEW_MAX / Math.max(imgInfo.w, imgInfo.h)), format === 'jpeg');
  };
  const drawPreviewRef = useRef(drawPreview);
  drawPreviewRef.current = drawPreview;
  const previewFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!imgInfo) return;
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      drawPreviewRef.current();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgInfo, regions, format]);

  useEffect(() => {
    return () => {
      if (previewFrameRef.current !== null) cancelAnimationFrame(previewFrameRef.current);
    };
  }, []);

  const toImageCoords = (clientX: number, clientY: number) => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !imgInfo) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * imgInfo.w, 0, imgInfo.w),
      y: clamp(((clientY - rect.top) / rect.height) * imgInfo.h, 0, imgInfo.h),
    };
  };

  // Drag handling
  useEffect(() => {
    if (!drag || !imgInfo) return;

    const onMove = (e: PointerEvent) => {
      const pos = toImageCoords(e.clientX, e.clientY);
      const dx = pos.x - drag.ox;
      const dy = pos.y - drag.oy;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      if (!dragPushedRef.current) {
        if (dragBaseRef.current) pushHistory(dragBaseRef.current);
        dragPushedRef.current = true;
      }

      if (drag.kind === 'create') {
        const x = Math.min(drag.ox, pos.x);
        const y = Math.min(drag.oy, pos.y);
        const w = Math.abs(pos.x - drag.ox);
        const h = Math.abs(pos.y - drag.oy);
        updateRegions(regionsRef.current.map((r) => (r.id === drag.id ? { ...r, x, y, w, h } : r)));
        return;
      }

      if (drag.kind === 'move') {
        const nx = clamp(drag.rect.x + dx, 0, Math.max(0, imgInfo.w - drag.rect.w));
        const ny = clamp(drag.rect.y + dy, 0, Math.max(0, imgInfo.h - drag.rect.h));
        updateRegions(regionsRef.current.map((r) => (r.id === drag.id ? { ...r, x: nx, y: ny } : r)));
        return;
      }

      const { rect, handle } = drag;
      let left = rect.x;
      let top = rect.y;
      let right = rect.x + rect.w;
      let bottom = rect.y + rect.h;
      if (handle.includes('w')) left = clamp(rect.x + dx, 0, right - MIN_SIZE);
      if (handle.includes('e')) right = clamp(rect.x + rect.w + dx, left + MIN_SIZE, imgInfo.w);
      if (handle.includes('n')) top = clamp(rect.y + dy, 0, bottom - MIN_SIZE);
      if (handle.includes('s')) bottom = clamp(rect.y + rect.h + dy, top + MIN_SIZE, imgInfo.h);
      updateRegions(
        regionsRef.current.map((r) =>
          r.id === drag.id
            ? { ...r, x: left, y: top, w: right - left, h: bottom - top }
            : r
        )
      );
    };

    const onUp = () => {
      if (drag.kind === 'create') {
        const created = regionsRef.current.find((r) => r.id === drag.id);
        if (!created || created.w < MIN_SIZE || created.h < MIN_SIZE) {
          updateRegions(regionsRef.current.filter((r) => r.id !== drag.id));
          setSelectedId(null);
          if (dragPushedRef.current) {
            historyRef.current = historyRef.current.slice(0, -1);
            bumpHistory((v) => v + 1);
          }
        }
      }
      dragPushedRef.current = false;
      dragBaseRef.current = null;
      document.body.style.userSelect = '';
      setDrag(null);
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, imgInfo]);

  const beginCreate = (pos: { x: number; y: number }) => {
    // New regions inherit the style of the current selection, or the saved defaults.
    const rect: Region = { id: uid(), ...active, x: pos.x, y: pos.y, w: 1, h: 1 };
    dragBaseRef.current = snapshot(regionsRef.current);
    dragPushedRef.current = false;
    updateRegions([...regionsRef.current, rect]);
    setSelectedId(rect.id);
    setDrag({ kind: 'create', id: rect.id, ox: pos.x, oy: pos.y });
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!imgInfo || e.button !== 0) return;
    e.preventDefault();
    beginCreate(toImageCoords(e.clientX, e.clientY));
  };

  const onRegionPointerDown = (e: React.PointerEvent, rect: Region) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = toImageCoords(e.clientX, e.clientY);
    // Hold Alt to start a new region on top of an existing one.
    if (e.altKey) {
      beginCreate(pos);
      return;
    }
    setSelectedId(rect.id);
    dragBaseRef.current = snapshot(regionsRef.current);
    dragPushedRef.current = false;
    setDrag({ kind: 'move', id: rect.id, ox: pos.x, oy: pos.y, rect: { ...rect } });
  };

  const onHandlePointerDown = (e: React.PointerEvent, rect: Region, handle: Handle) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = toImageCoords(e.clientX, e.clientY);
    setSelectedId(rect.id);
    dragBaseRef.current = snapshot(regionsRef.current);
    dragPushedRef.current = false;
    setDrag({ kind: 'resize', id: rect.id, handle, ox: pos.x, oy: pos.y, rect: { ...rect } });
  };

  const addRegion = (coverAll: boolean) => {
    if (!imgInfo) return;
    const w = coverAll ? imgInfo.w : Math.round(imgInfo.w * 0.35);
    const h = coverAll ? imgInfo.h : Math.round(imgInfo.h * 0.35);
    const rect: Region = {
      id: uid(),
      ...active,
      x: Math.round((imgInfo.w - w) / 2),
      y: Math.round((imgInfo.h - h) / 2),
      w,
      h,
    };
    pushHistory(regionsRef.current);
    updateRegions([...regionsRef.current, rect]);
    setSelectedId(rect.id);
  };

  const deleteRegion = (id: string) => {
    pushHistory(regionsRef.current);
    updateRegions(regionsRef.current.filter((r) => r.id !== id));
    setSelectedId((sel) => (sel === id ? null : sel));
  };

  const clearRegions = () => {
    if (!regionsRef.current.length) return;
    pushHistory(regionsRef.current);
    updateRegions([]);
    setSelectedId(null);
  };

  const handleFile = (next: File | null | undefined) => {
    if (!next) return;
    if (!next.type.startsWith('image/')) {
      showNotice(t('px.invalid_file'));
      return;
    }
    setNotice(null);
    setFile(next);
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types || []).includes('Files');

  const onRootDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    setIsDropOver(true);
  };

  const onRootDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    // Covers browsers that fire a stray dragleave while still over the tool.
    setIsDropOver(true);
  };

  const onRootDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (inside) return;
    setIsDropOver(false);
  };

  const onRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropOver(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((type) => type.startsWith('image/'));
        if (!type) continue;
        const blob = await item.getType(type);
        const ext = type.split('/')[1] || 'png';
        handleFile(new File([blob], `clipboard.${ext}`, { type }));
        return;
      }
      showNotice(t('px.invalid_file'));
    } catch {
      showNotice(t('px.paste_denied'));
    }
  };

  const nudgeSelected = (dx: number, dy: number) => {
    if (!selectedId || !imgInfo) return;
    const region = regionsRef.current.find((r) => r.id === selectedId);
    if (!region) return;
    // Coalesce rapid key presses into a single undo step.
    if (Date.now() - lastNudgeRef.current > 700) pushHistory(regionsRef.current);
    lastNudgeRef.current = Date.now();
    updateRegions(
      regionsRef.current.map((r) =>
        r.id === region.id
          ? {
              ...r,
              x: clamp(r.x + dx, 0, imgInfo.w - r.w),
              y: clamp(r.y + dy, 0, imgInfo.h - r.h),
            }
          : r
      )
    );
  };

  // Keyboard shortcuts (ignored while this tool is hidden by the app shell)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isToolVisible()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (selectedId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        deleteRegion(selectedId);
        return;
      }
      if (
        selectedId &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') nudgeSelected(-step, 0);
        else if (e.key === 'ArrowRight') nudgeSelected(step, 0);
        else if (e.key === 'ArrowUp') nudgeSelected(0, -step);
        else nudgeSelected(0, step);
        return;
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, imgInfo]);

  // Paste image from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!isToolVisible()) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/'));
      if (!item) return;
      const pasted = item.getAsFile();
      if (pasted) handleFile(pasted);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildCanvas = (opaque: boolean) => {
    const img = sourceImgRef.current;
    if (!img) return null;
    const canvas = document.createElement('canvas');
    drawCensorScene(canvas, img, regionsRef.current, 1, opaque);
    return canvas;
  };

  const handleDownload = () => {
    if (!sourceImgRef.current) return;
    setIsProcessing(true);
    try {
      const canvas = buildCanvas(format === 'jpeg');
      if (!canvas) {
        setIsProcessing(false);
        return;
      }
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const base = (file?.name || 'image').replace(/\.[^.]+$/, '');
      canvas.toBlob(
        (blob) => {
          setIsProcessing(false);
          if (!blob) {
            showNotice(t('px.export_failed'));
            return;
          }
          const link = document.createElement('a');
          link.download = `${base}_censored.${ext}`;
          link.href = URL.createObjectURL(blob);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(link.href), 1000);
        },
        mime,
        quality
      );
    } catch {
      setIsProcessing(false);
      showNotice(t('px.export_failed'));
    }
  };

  const handleCopy = () => {
    if (!sourceImgRef.current) return;
    try {
      const canvas = buildCanvas(false);
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) {
          showNotice(t('px.copy_failed'));
          return;
        }
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          showNotice(t('px.copy_failed'));
        }
      }, 'image/png');
    } catch {
      showNotice(t('px.copy_failed'));
    }
  };

  const beginFieldEdit = () => {
    if (editFocusRef.current) return;
    editFocusRef.current = true;
    pushHistory(regionsRef.current);
  };

  const endFieldEdit = () => {
    editFocusRef.current = false;
  };

  const applyRegionField = (field: 'x' | 'y' | 'w' | 'h', raw: string) => {
    if (!selectedRegion || !imgInfo || raw.trim() === '') return;
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) return;
    const r = selectedRegion;
    let next: Region;
    if (field === 'x') next = { ...r, x: clamp(value, 0, imgInfo.w - r.w) };
    else if (field === 'y') next = { ...r, y: clamp(value, 0, imgInfo.h - r.h) };
    else if (field === 'w') next = { ...r, w: clamp(value, MIN_SIZE, imgInfo.w - r.x) };
    else next = { ...r, h: clamp(value, MIN_SIZE, imgInfo.h - r.y) };
    updateRegions(regionsRef.current.map((item) => (item.id === r.id ? next : item)));
  };

  const beginStyleEdit = () => {
    // Defaults are preferences, not image content, so only region edits enter history.
    if (!selectedRegion) return;
    if (styleEditRef.current) return;
    styleEditRef.current = true;
    pushHistory(regionsRef.current);
  };

  const endStyleEdit = () => {
    styleEditRef.current = false;
  };

  const patchActiveStyle = (patch: Partial<RegionStyle>) => {
    if (selectedRegion) {
      updateRegions(
        regionsRef.current.map((region) =>
          region.id === selectedRegion.id ? { ...region, ...patch } : region
        )
      );
      return;
    }
    if (patch.mode !== undefined) setDefaultMode(patch.mode);
    if (patch.shape !== undefined) setDefaultShape(patch.shape);
    if (patch.blockPct !== undefined) setDefaultBlockPct(patch.blockPct);
    if (patch.blurPct !== undefined) setDefaultBlurPct(patch.blurPct);
    if (patch.color !== undefined) setDefaultColor(patch.color);
  };

  const chooseMode = (next: Mode) => {
    if (active.mode === next) return;
    if (selectedRegion) pushHistory(regionsRef.current);
    patchActiveStyle({ mode: next });
  };

  const chooseShape = (next: Shape) => {
    if (active.shape === next) return;
    if (selectedRegion) pushHistory(regionsRef.current);
    patchActiveStyle({ shape: next });
  };

  const commitActiveColor = () => {
    const value = String(activeColorText).trim();
    const normalized = value.startsWith('#') ? value : `#${value}`;
    patchActiveStyle({ color: HEX_RE.test(normalized) ? normalized.toLowerCase() : '#000000' });
    endStyleEdit();
  };

  const applyStyleToAll = () => {
    if (!selectedRegion) return;
    const style = pickStyle(selectedRegion);
    pushHistory(regionsRef.current);
    updateRegions(regionsRef.current.map((region) => ({ ...region, ...style })));
  };

  const shortSide = imgInfo ? Math.min(imgInfo.w, imgInfo.h) : 0;
  const blockPx = Math.max(2, Math.round((shortSide * active.blockPct) / 100));
  const blurPx = Math.max(1, Math.round((shortSide * active.blurPct) / 100));
  const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard && typeof ClipboardItem !== 'undefined';

  const segmented = (isActive: boolean) =>
    `py-1.5 text-xs font-medium rounded-md transition-colors ${
      isActive ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-800'
    }`;

  return (
    <div
      ref={rootRef}
      data-tool="pixelate-censor"
      className="relative flex flex-col lg:flex-row gap-6"
      onDragEnter={onRootDragEnter}
      onDragOver={onRootDragOver}
      onDragLeave={onRootDragLeave}
      onDrop={onRootDrop}
    >
      {notice && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-fade-in">
          <div
            role="alert"
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg shadow-lg text-xs font-medium text-white text-center max-w-xs ${
              notice.error ? 'bg-red-500' : 'bg-gray-800'
            }`}
          >
            <AlertTriangle size={14} className="shrink-0" />
            {notice.text}
          </div>
        </div>
      )}

      {isDropOver && (
        <div className="absolute inset-0 z-40 rounded-xl bg-primary-600/10 border-2 border-dashed border-primary-500 flex items-center justify-center pointer-events-none">
          <div className="bg-white/95 shadow-lg rounded-xl px-5 py-3 flex items-center gap-2 text-sm font-semibold text-primary-700">
            <ImageIcon size={18} />
            {t('px.drop_here')}
          </div>
        </div>
      )}

      <input
        id="px-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFile((e.target as HTMLInputElement).files?.[0]);
          (e.target as HTMLInputElement).value = '';
        }}
      />

      {/* Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-4">
        {!file ? (
          <div
            onClick={() => document.getElementById('px-upload')?.click()}
            className={`h-72 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
              isDropOver
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'
            }`}
          >
            <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
              <ScanEye size={30} />
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">{t('px.open')}</p>
            <p className="text-sm text-gray-500 px-6">{t('px.drop_tip')}</p>
          </div>
        ) : (
          <>
            {/* File card */}
            <div className="relative border border-gray-200 rounded-xl p-4">
              <button
                onClick={() => setFile(null)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-700"
                title={t('px.remove_image')}
                aria-label={t('px.remove_image')}
              >
                <X size={18} />
              </button>
              <div className="flex items-center gap-3 pr-7">
                <div className="w-11 h-11 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0">
                  <ImageIcon size={22} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-gray-900 truncate">{file.name}</h3>
                  <p className="text-xs text-gray-500">
                    {imgInfo ? `${imgInfo.w} × ${imgInfo.h} px` : t('common.processing')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => document.getElementById('px-upload')?.click()}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t('px.change_image')}
                </button>
                <button
                  onClick={pasteFromClipboard}
                  className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t('px.paste')}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">{t('px.paste_tip')}</p>
            </div>

            {/* Settings card */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-gray-800 leading-snug">
                    {selectedRegion
                      ? t('px.region_settings', {
                          index: regions.findIndex((r) => r.id === selectedRegion.id) + 1,
                        })
                      : t('px.default_settings')}
                  </h4>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                    {selectedRegion ? t('px.region_hint') : t('px.default_hint')}
                  </p>
                </div>
                {selectedRegion && (
                  <button
                    onClick={() => setSelectedId(null)}
                    className="shrink-0 text-[11px] px-2 py-0.5 rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50"
                  >
                    {t('px.deselect')}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('px.mode')}</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['pixelate', 'blur', 'solid'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => chooseMode(m)}
                      className={segmented(active.mode === m)}
                      aria-pressed={active.mode === m}
                    >
                      {t(`px.mode.${m}`)}
                    </button>
                  ))}
                </div>
              </div>

              {active.mode === 'pixelate' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">{t('px.strength')}</label>
                    <span className="text-xs text-primary-600">
                      {active.blockPct.toFixed(1)}% · ≈{blockPx}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={10}
                    step={0.2}
                    value={active.blockPct}
                    onPointerDown={beginStyleEdit}
                    onKeyDown={beginStyleEdit}
                    onChange={(e) => patchActiveStyle({ blockPct: parseFloat((e.target as HTMLInputElement).value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                  />
                </div>
              )}

              {active.mode === 'blur' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">{t('px.blur')}</label>
                    <span className="text-xs text-primary-600">
                      {active.blurPct.toFixed(1)}% · ≈{blurPx}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={4}
                    step={0.1}
                    value={active.blurPct}
                    onPointerDown={beginStyleEdit}
                    onKeyDown={beginStyleEdit}
                    onChange={(e) => patchActiveStyle({ blurPct: parseFloat((e.target as HTMLInputElement).value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                  />
                </div>
              )}

              {active.mode === 'solid' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm text-gray-600">{t('px.color')}</label>
                    <span className="text-xs font-mono text-gray-400">{activeColorSafe}</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={colorPickerValue}
                      onPointerDown={beginStyleEdit}
                      onFocus={beginStyleEdit}
                      onChange={(e) => patchActiveStyle({ color: (e.target as HTMLInputElement).value })}
                      onBlur={endStyleEdit}
                      className="h-9 w-12 p-1 bg-white border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={activeColorText}
                      onChange={(e) => patchActiveStyle({ color: (e.target as HTMLInputElement).value })}
                      onFocus={beginStyleEdit}
                      onBlur={commitActiveColor}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      spellCheck={false}
                      className={`flex-1 p-2 border rounded-lg text-sm font-mono ${
                        HEX_RE.test(activeColorText) ? 'border-gray-300' : 'border-red-300 text-red-600'
                      }`}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('px.shape')}</label>
                <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
                  {(['rect', 'ellipse'] as Shape[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => chooseShape(s)}
                      className={segmented(active.shape === s)}
                      aria-pressed={active.shape === s}
                    >
                      {t(`px.shape.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {selectedRegion && regions.length > 1 && (
                <button
                  onClick={applyStyleToAll}
                  className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-medium border border-primary-200 text-primary-600 bg-primary-50/60 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Layers size={14} /> {t('px.apply_all')}
                </button>
              )}

              <div className="pt-1 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2 pt-3">
                  {t('px.format')}
                </label>
                <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: 'png', label: 'PNG' },
                    { id: 'jpeg', label: 'JPG' },
                  ].map((f) => (
                    <button key={f.id} onClick={() => setFormat(f.id)} className={segmented(format === f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                {format === 'jpeg' && (
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <label className="text-sm text-gray-600">{t('px.quality')}</label>
                      <span className="text-xs text-primary-600">{Math.round(quality * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1}
                      step={0.01}
                      value={quality}
                      onChange={(e) => setQuality(parseFloat((e.target as HTMLInputElement).value))}
                      className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Regions card */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  {t('px.regions')}
                  <span className="ml-1.5 text-xs text-gray-400">({regions.length})</span>
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={undo}
                    disabled={!historyRef.current.length}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    title={`${t('px.undo')} (Ctrl+Z)`}
                    aria-label={t('px.undo')}
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    onClick={redo}
                    disabled={!futureRef.current.length}
                    className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    title={`${t('px.redo')} (Ctrl+Shift+Z)`}
                    aria-label={t('px.redo')}
                  >
                    <Redo2 size={16} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => addRegion(false)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Plus size={14} /> {t('px.add_region')}
                </button>
                <button
                  onClick={() => addRegion(true)}
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  <Maximize size={14} /> {t('px.cover_all')}
                </button>
              </div>

              {regions.length > 0 ? (
                <div className="mt-3 space-y-1 max-h-48 overflow-auto pr-1">
                  {regions.map((r, index) => (
                    <div
                      key={r.id}
                      data-region-row={r.id}
                      onClick={() => setSelectedId(r.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                        selectedId === r.id
                          ? 'bg-primary-50 ring-1 ring-primary-200'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <span className="w-5 h-5 shrink-0 rounded bg-primary-600/10 text-primary-700 text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 whitespace-nowrap">
                        {t(`px.mode.${normalizeMode(r.mode)}`)}
                      </span>
                      <span className="flex-1 text-xs text-gray-600 font-mono truncate">
                        {Math.round(r.w)} × {Math.round(r.h)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteRegion(r.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title={t('px.delete')}
                        aria-label={t('px.delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-gray-400 leading-relaxed">{t('px.regions_empty')}</p>
              )}

              {regions.length > 0 && (
                <button
                  onClick={clearRegions}
                  className="mt-3 w-full px-2 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {t('px.clear')}
                </button>
              )}

              {selectedRegion && imgInfo && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-600">{t('px.position')}</span>
                    <span className="text-[11px] text-gray-400 font-mono">
                      #{regions.findIndex((r) => r.id === selectedRegion.id) + 1}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['x', 'y', 'w', 'h'] as const).map((field) => (
                      <label
                        key={field}
                        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-100"
                      >
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{field}</span>
                        <input
                          type="number"
                          value={Math.round(selectedRegion[field])}
                          onFocus={beginFieldEdit}
                          onBlur={endFieldEdit}
                          onChange={(e) => applyRegionField(field, (e.target as HTMLInputElement).value)}
                          aria-label={field}
                          className="w-full min-w-0 bg-transparent text-xs text-gray-700 outline-none"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 min-w-0">
        <div className="bg-gray-50 border border-gray-200 rounded-xl flex flex-col overflow-hidden min-h-[500px]">
          <div className="px-4 py-3 border-b border-gray-200 bg-white flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-gray-700 text-sm">{t('px.preview')}</span>
            {file && <span className="text-xs text-gray-400">{t('px.shortcut')}</span>}
          </div>

          <div
            className="flex-1 relative overflow-auto flex items-center justify-center p-6"
            style={{ backgroundImage: `url("${CHECKERBOARD}")` }}
          >
            {imgInfo ? (
              <div
                className="relative inline-block shadow-lg touch-none select-none"
                style={{ lineHeight: 0 }}
                onPointerDown={onCanvasPointerDown}
              >
                <canvas
                  ref={previewCanvasRef}
                  className="block max-w-full max-h-[70vh] cursor-crosshair"
                  draggable={false}
                  role="img"
                  aria-label={t('px.preview')}
                />
                {regions.map((r) => (
                  <div
                    key={r.id}
                    data-region-id={r.id}
                    onPointerDown={(e) => onRegionPointerDown(e, r)}
                    className={`absolute border-2 cursor-move touch-none ${
                      normalizeShape(r.shape) === 'ellipse' ? 'rounded-[50%]' : ''
                    } ${selectedId === r.id ? 'border-primary-500' : 'border-white/90'}`}
                    style={{
                      left: `${(r.x / imgInfo.w) * 100}%`,
                      top: `${(r.y / imgInfo.h) * 100}%`,
                      width: `${(r.w / imgInfo.w) * 100}%`,
                      height: `${(r.h / imgInfo.h) * 100}%`,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
                    }}
                  >
                    {selectedId === r.id &&
                      HANDLES.map((handle) => (
                        <div
                          key={handle.h}
                          onPointerDown={(e) => onHandlePointerDown(e, r, handle.h)}
                          className={`absolute w-3 h-3 bg-white border-2 border-primary-500 rounded-sm z-10 touch-none ${handle.cls}`}
                        />
                      ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 flex flex-col items-center text-sm">
                <ScanEye size={48} className="mb-2 opacity-20" />
                <span>{file ? t('common.processing') : t('common.waiting')}</span>
                {!file && <span className="text-xs mt-1">{t('px.drop_tip')}</span>}
              </div>
            )}
          </div>

          {file && (
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="mb-3 text-xs text-gray-500 flex items-center gap-1.5">
                <ScanEye size={14} className="text-primary-500 shrink-0" />
                <span>{t('px.hint')}</span>
              </div>
              <div className="flex gap-3">
                {canCopy && (
                  <button
                    onClick={handleCopy}
                    disabled={!imgInfo}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                  >
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  disabled={!imgInfo || isProcessing}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all ${
                    imgInfo && !isProcessing
                      ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
                  {isProcessing ? t('common.processing') : t('common.download')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PixelateCensor;
