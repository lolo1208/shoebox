/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  AppWindow,
  Check,
  Copy,
  Download,
  FileImage,
  Globe,
  RefreshCw,
  Smartphone,
  Upload,
  X,
} from 'lucide-react';
import JSZip from 'jszip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import { downloadBlob } from '@/lib/download';

type FitMode = 'contain' | 'cover';
type Platform = 'web' | 'ios' | 'android';

interface IconConfig {
  padding: number;
  radius: number;
  bgColor: string;
  transparent: boolean;
  fit: FitMode;
}

interface IconEntry {
  platform: Platform;
  size: number;
  names: string[];
}

interface RenderedIcon {
  size: number;
  url: string;
  blob: Blob;
}

const PLATFORM_ORDER: Platform[] = ['web', 'ios', 'android'];

const PLATFORM_SIZES: Record<Platform, number[]> = {
  web: [16, 32, 48, 64, 96, 128, 256],
  ios: [120, 152, 167, 180, 1024],
  android: [48, 72, 96, 144, 192, 512],
};

// Defaults cover the standard kit of every platform; users can trim per platform.
const DEFAULT_SELECTION: Record<Platform, number[]> = {
  web: [...PLATFORM_SIZES.web],
  ios: [...PLATFORM_SIZES.ios],
  android: [...PLATFORM_SIZES.android],
};

const PLATFORM_ICON: Record<Platform, React.ComponentType<{ size?: number | string; className?: string }>> = {
  web: Globe,
  ios: Apple,
  android: Smartphone,
};

const ANDROID_DENSITY: Record<number, string> = {
  48: 'mdpi',
  72: 'hdpi',
  96: 'xhdpi',
  144: 'xxhdpi',
  192: 'xxxhdpi',
};

// Only the classic small sizes go into the .ico; large PNGs are linked separately.
const ICO_SIZES = [16, 32, 48, 64];
const CHECKERBOARD =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScyMCcgaGVpZ2h0PScyMCcgZmlsbC1vcGFjaXR5PScwLjEnPjxyZWN0IHg9JzEwJyB3aWR0aD0nMTAnIGhlaWdodD0nMTAnIC8+PHJlY3QgeT0nMTAnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCcgLz48L3N2Zz4=";

// One rendered image can be written under several platform-specific names.
const outputNames = (platform: Platform, size: number): string[] => {
  if (platform === 'web') return [`favicon-${size}x${size}.png`];
  if (platform === 'ios') {
    return [size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}x${size}.png`];
  }
  const names: string[] = [];
  if (size === 192) names.push('android-chrome-192x192.png');
  if (size === 512) names.push('android-chrome-512x512.png');
  const density = ANDROID_DENSITY[size];
  if (density) names.push(`android/mipmap-${density}/ic_launcher.png`);
  if (!names.length) names.push(`android/ic_launcher-${size}x${size}.png`);
  return names;
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = url;
  });

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
};

const composeAt = (img: HTMLImageElement, size: number, cfg: IconConfig): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.beginPath();
  roundRectPath(ctx, 0, 0, size, size, (cfg.radius / 100) * size);
  ctx.clip();

  if (!cfg.transparent) {
    ctx.fillStyle = cfg.bgColor;
    ctx.fillRect(0, 0, size, size);
  }

  const pad = (cfg.padding / 100) * size;
  const box = Math.max(1, size - pad * 2);
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const ratio = iw / ih;

  let dw: number;
  let dh: number;
  if (cfg.fit === 'contain') {
    if (ratio >= 1) {
      dw = box;
      dh = box / ratio;
    } else {
      dh = box;
      dw = box * ratio;
    }
  } else if (ratio >= 1) {
    dh = box;
    dw = box * ratio;
  } else {
    dw = box;
    dh = box / ratio;
  }

  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
  ctx.restore();

  return canvas;
};

// Supersample then halve repeatedly: much cleaner edges at 16/32 px than a single downscale.
const renderIcon = (img: HTMLImageElement, size: number, cfg: IconConfig): HTMLCanvasElement => {
  // Small icons get 4x supersampling, large ones 2x is plenty (keeps the UI responsive).
  const ss = Math.min(2048, Math.max(size * (size <= 64 ? 4 : 2), 16));
  let canvas = composeAt(img, ss, cfg);

  while (canvas.width >= size * 2) {
    const nextSize = Math.round(canvas.width / 2);
    const next = document.createElement('canvas');
    next.width = nextSize;
    next.height = nextSize;
    const ctx = next.getContext('2d');
    if (!ctx) break;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, nextSize, nextSize);
    canvas = next;
  }

  if (canvas.width !== size) {
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const ctx = out.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(canvas, 0, 0, size, size);
    }
    canvas = out;
  }

  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('png-encode-failed'))),
      'image/png'
    );
  });

// ICO container with PNG payloads (supported by every modern browser).
const buildIco = (entries: { size: number; data: Uint8Array }[]): Uint8Array => {
  const headerSize = 6 + entries.length * 16;
  const totalSize = entries.reduce((sum, e) => sum + e.data.length, headerSize);
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  let offset = headerSize;
  entries.forEach((entry, index) => {
    const pos = 6 + index * 16;
    const dim = entry.size >= 256 ? 0 : entry.size;
    view.setUint8(pos, dim);
    view.setUint8(pos + 1, dim);
    view.setUint8(pos + 2, 0);
    view.setUint8(pos + 3, 0);
    view.setUint16(pos + 4, 1, true);
    view.setUint16(pos + 6, 32, true);
    view.setUint32(pos + 8, entry.data.length, true);
    view.setUint32(pos + 12, offset, true);
    offset += entry.data.length;
  });

  const bytes = new Uint8Array(buffer);
  let cursor = headerSize;
  entries.forEach((entry) => {
    bytes.set(entry.data, cursor);
    cursor += entry.data.length;
  });

  return bytes;
};

const FaviconGenerator: React.FC = () => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [sourceW, setSourceW] = useState(0);
  const [sourceH, setSourceH] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const [platforms, setPlatforms] = useState<Platform[]>(PLATFORM_ORDER);
  const [selection, setSelection] = useState<Record<Platform, number[]>>(DEFAULT_SELECTION);

  const [padding, setPadding] = useState(6);
  const [radius, setRadius] = useState(0);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [fit, setFit] = useState<FitMode>('contain');

  const [appName, setAppName] = useState("LOLO' Shoebox");
  const [shortName, setShortName] = useState('Shoebox');
  const [themeColor, setThemeColor] = useState('#ffffff');

  const [previews, setPreviews] = useState<RenderedIcon[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const { copy, isCopied } = useClipboard(1600);

  const previewUrlsRef = useRef<string[]>([]);

  const cfg: IconConfig = useMemo(
    () => ({ padding, radius, bgColor, transparent, fit }),
    [padding, radius, bgColor, transparent, fit]
  );

  // Every icon to export, grouped by platform in a stable order.
  const entries: IconEntry[] = useMemo(() => {
    const list: IconEntry[] = [];
    PLATFORM_ORDER.forEach((platform) => {
      if (!platforms.includes(platform)) return;
      [...selection[platform]]
        .sort((a, b) => a - b)
        .forEach((size) => list.push({ platform, size, names: outputNames(platform, size) }));
    });
    return list;
  }, [platforms, selection]);

  const uniqueSizes = useMemo(
    () => Array.from(new Set(entries.map((entry) => entry.size))).sort((a, b) => a - b),
    [entries]
  );

  const previewBySize = useMemo(() => {
    const map = new Map<number, RenderedIcon>();
    previews.forEach((item) => map.set(item.size, item));
    return map;
  }, [previews]);

  const icoSizes = useMemo(() => {
    if (!platforms.includes('web')) return [];
    const webSizes = entries.filter((e) => e.platform === 'web').map((e) => e.size);
    // No Web size selected means no .ico — keep output exactly what the user picked.
    if (!webSizes.length) return [];
    const classic = webSizes.filter((size) => ICO_SIZES.includes(size));
    // No classic size selected: still ship a usable .ico based on the smallest pick.
    return classic.length ? classic : [Math.min(...webSizes)];
  }, [platforms, entries]);

  const manifestIcons = useMemo(() => {
    if (!platforms.includes('android')) return [];
    return entries
      .filter((e) => e.platform === 'android' && (e.size === 192 || e.size === 512))
      .map((e) => ({ src: `/${e.names[0]}`, sizes: `${e.size}x${e.size}`, type: 'image/png' }));
  }, [platforms, entries]);

  const manifestText = useMemo(
    () =>
      JSON.stringify(
        {
          name: appName || 'My Site',
          short_name: shortName || 'App',
          icons: manifestIcons,
          theme_color: themeColor,
          background_color: transparent ? '#ffffff' : bgColor,
          display: 'standalone',
        },
        null,
        2
      ),
    [appName, shortName, manifestIcons, themeColor, transparent, bgColor]
  );

  const exportSummary = useMemo(() => {
    let files = 1; // README.txt
    let bytes = 0;
    entries.forEach((entry) => {
      const blob = previewBySize.get(entry.size)?.blob;
      if (!blob) return;
      files += entry.names.length;
      bytes += blob.size * entry.names.length;
    });
    if (icoSizes.length) {
      files += 1;
      bytes += icoSizes.reduce((sum, size) => sum + (previewBySize.get(size)?.blob.size || 0), 0);
    }
    if (manifestIcons.length) files += 1;
    return { files, kb: Math.max(1, Math.round(bytes / 1024)) };
  }, [entries, previewBySize, icoSizes, manifestIcons]);

  const htmlSnippet = useMemo(() => {
    const lines: string[] = [];
    if (platforms.includes('web')) {
      if (icoSizes.length) {
        lines.push('<link rel="icon" href="/favicon.ico" sizes="any">');
      }
      [...selection.web]
        .sort((a, b) => a - b)
        .forEach((size) => {
          lines.push(
            `<link rel="icon" type="image/png" sizes="${size}x${size}" href="/${outputNames('web', size)[0]}">`
          );
        });
    }
    if (platforms.includes('ios')) {
      [...selection.ios]
        .sort((a, b) => a - b)
        .forEach((size) => {
          const name = outputNames('ios', size)[0];
          lines.push(`<link rel="apple-touch-icon" sizes="${size}x${size}" href="/${name}">`);
        });
      lines.push(`<meta name="apple-mobile-web-app-title" content="${shortName || appName || 'App'}">`);
    }
    if (manifestIcons.length) {
      lines.push('<link rel="manifest" href="/site.webmanifest">');
      lines.push(`<meta name="theme-color" content="${themeColor}">`);
    }
    return lines.join('\n');
  }, [platforms, selection, manifestIcons, icoSizes, shortName, appName, themeColor]);

  const acceptFile = (next: File) => {
    setLoadError(false);
    setFile(next);
  };

  // Load the picked file into an <img> we can draw from.
  useEffect(() => {
    if (!file) return;

    const url = URL.createObjectURL(file);
    let cancelled = false;

    loadImage(url)
      .then((img) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setSourceUrl(url);
        setImgEl(img);
        setSourceW(img.naturalWidth || img.width || 0);
        setSourceH(img.naturalHeight || img.height || 0);
      })
      .catch(() => {
        if (cancelled) return;
        URL.revokeObjectURL(url);
        setLoadError(true);
        setImgEl(null);
        setSourceUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Debounced preview rendering (one canvas per unique pixel size).
  useEffect(() => {
    if (!imgEl || !uniqueSizes.length) {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
      setPreviews([]);
      setIsGenerating(false);
      return;
    }

    let cancelled = false;
    setIsGenerating(true);

    const timer = window.setTimeout(async () => {
      try {
        const rendered: RenderedIcon[] = [];
        for (const size of uniqueSizes) {
          const blob = await canvasToBlob(renderIcon(imgEl, size, cfg));
          if (cancelled) {
            rendered.forEach((item) => URL.revokeObjectURL(item.url));
            return;
          }
          rendered.push({ size, blob, url: URL.createObjectURL(blob) });
        }
        if (cancelled) {
          rendered.forEach((item) => URL.revokeObjectURL(item.url));
          return;
        }

        const previous = previewUrlsRef.current;
        previewUrlsRef.current = rendered.map((item) => item.url);
        setPreviews(rendered);
        previous.forEach((url) => URL.revokeObjectURL(url));
        setIsGenerating(false);
      } catch (error) {
        console.error(error);
        if (!cancelled) setIsGenerating(false);
      }
    }, 140);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [imgEl, uniqueSizes, cfg]);

  const togglePlatform = (platform: Platform) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  const toggleSize = (platform: Platform, size: number) => {
    setSelection((prev) => {
      const list = prev[platform];
      const next = list.includes(size)
        ? list.filter((s) => s !== size)
        : [...list, size].sort((a, b) => a - b);
      return { ...prev, [platform]: next };
    });
  };

  const selectAllSizes = (platform: Platform) => {
    setSelection((prev) => ({ ...prev, [platform]: [...PLATFORM_SIZES[platform]] }));
  };

  const clearSizes = (platform: Platform) => {
    setSelection((prev) => ({ ...prev, [platform]: [] }));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!dropped.type.startsWith('image/')) {
      setLoadError(true);
      return;
    }
    acceptFile(dropped);
  };

  const resetSource = () => {
    setFile(null);
    setImgEl(null);
    setSourceUrl(null);
    setSourceW(0);
    setSourceH(0);
    setLoadError(false);
  };

  const handleDownloadZip = async () => {
    if (!imgEl || !entries.length) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const blobs = new Map<number, Blob>();

      for (const size of uniqueSizes) {
        blobs.set(size, await canvasToBlob(renderIcon(imgEl, size, cfg)));
      }

      entries.forEach((entry) => {
        const blob = blobs.get(entry.size);
        if (!blob) return;
        entry.names.forEach((name) => zip.file(name, blob));
      });

      if (icoSizes.length) {
        const icoEntries: { size: number; data: Uint8Array }[] = [];
        for (const size of icoSizes) {
          let blob = blobs.get(size);
          if (!blob) {
            blob = await canvasToBlob(renderIcon(imgEl, size, cfg));
            blobs.set(size, blob);
          }
          icoEntries.push({ size, data: new Uint8Array(await blob.arrayBuffer()) });
        }
        zip.file('favicon.ico', buildIco(icoEntries));
      }

      if (manifestIcons.length) {
        zip.file('site.webmanifest', manifestText);
      }

      zip.file(
        'README.txt',
        [
          "Favicon kit generated locally by LOLO' Shoebox.",
          '',
          'Files:',
          ...(icoSizes.length
            ? [`  favicon.ico          - multi-size icon (${icoSizes.map((s) => `${s}px`).join(', ')})`]
            : []),
          ...entries.flatMap((entry) =>
            entry.names.map((name) => `  ${name.padEnd(36)} ${entry.size}x${entry.size} PNG (${entry.platform})`)
          ),
          ...(manifestIcons.length ? ['  site.webmanifest     - PWA manifest'] : []),
          '',
          'Android mipmap files go to app/src/main/res/mipmap-<density>/.',
          '',
          'HTML (paste inside <head>):',
          htmlSnippet,
          '',
        ].join('\n')
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadBlob(zipBlob, 'favicon-kit.zip');
    } catch (error) {
      console.error(error);
      alert(t('common.error'));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadSingle = (entry: IconEntry) => {
    const blob = previewBySize.get(entry.size)?.blob;
    if (!blob) return;
    // Folder paths are meaningless in a single download; flatten them but keep the density.
    const primary = entry.names[0];
    const fileName = primary.includes('/') ? primary.split('/').slice(-2).join('-') : primary;
    downloadBlob(blob, fileName);
  };

  const handleCopyHtml = () => {
    void copy(htmlSnippet);
  };

  const preview16 = previewBySize.get(16) || previews[0];
  const preview32 = previewBySize.get(32) || previews[0];
  const displayName = shortName || appName || 'My Site';
  const iosTransparentHint = transparent && platforms.includes('ios');
  const maxTarget = uniqueSizes.length ? Math.max(...uniqueSizes) : 0;
  const sourceShortEdge = sourceW && sourceH ? Math.min(sourceW, sourceH) : 0;
  const upscaleHint = sourceShortEdge > 0 && maxTarget > sourceShortEdge;

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(event) => {
          const picked = (event.target as HTMLInputElement).files?.[0];
          if (picked) acceptFile(picked);
          event.target.value = '';
        }}
      />

      {/* Left: settings */}
      <div className="w-full lg:w-80 shrink-0 space-y-6">
        {!file ? (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
              ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
            `}
          >
            <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
              <AppWindow size={32} />
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">{t('fav.select')}</p>
            <p className="text-sm text-gray-500 px-6">{t('fav.select_desc')}</p>
            {loadError && (
              <p className="mt-3 text-xs text-red-600">{t('fav.bad_file')}</p>
            )}
          </div>
        ) : (
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`bg-white border rounded-xl p-5 relative transition-colors ${isDragging ? 'border-primary-400 ring-2 ring-primary-100' : 'border-gray-200'}`}
          >
            <button
              onClick={resetSource}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600"
              aria-label={t('common.clear')}
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4 pr-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title={t('fav.replace')}
                className="w-11 h-11 bg-primary-50 rounded-lg flex items-center justify-center text-primary-600 shrink-0 overflow-hidden hover:ring-2 hover:ring-primary-300 transition-all"
              >
                {sourceUrl ? (
                  <img src={sourceUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <FileImage size={22} />
                )}
              </button>
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-sm truncate">{file.name}</h3>
                <p className="text-xs text-gray-500">
                  {t('fav.source_size', { w: sourceW, h: sourceH })}
                </p>
              </div>
            </div>

            {loadError && (
              <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                {t('fav.bad_file')}
              </p>
            )}

            <div className="pt-4 border-t border-gray-100 space-y-4">
              {/* Platforms */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  {t('fav.platforms')}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {PLATFORM_ORDER.map((platform) => {
                    const Icon = PLATFORM_ICON[platform];
                    const active = platforms.includes(platform);
                    return (
                      <button
                        key={platform}
                        onClick={() => togglePlatform(platform)}
                        aria-pressed={active}
                        className={`
                          flex flex-col items-center gap-1 py-2 rounded-lg border transition-all
                          ${active
                            ? 'bg-primary-50 border-primary-300 text-primary-700'
                            : 'bg-white border-gray-200 text-gray-500 hover:border-primary-300'}
                        `}
                      >
                        <Icon size={16} />
                        <span className="text-[11px] font-medium">{t(`fav.platform.${platform}`)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sizes per platform */}
              {PLATFORM_ORDER.filter((platform) => platforms.includes(platform)).map((platform) => (
                <div key={platform} className="rounded-lg border border-gray-200 bg-gray-50/70 p-2.5">
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-[11px] font-semibold text-gray-700">
                      {t(`fav.platform.${platform}`)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selectAllSizes(platform)}
                        className="text-[10px] text-primary-600 hover:text-primary-700"
                      >
                        {t('fav.select_all')}
                      </button>
                      <button
                        onClick={() => clearSizes(platform)}
                        className="text-[10px] text-gray-400 hover:text-gray-600"
                      >
                        {t('common.clear')}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PLATFORM_SIZES[platform].map((size) => {
                      const active = selection[platform].includes(size);
                      return (
                        <button
                          key={size}
                          onClick={() => toggleSize(platform, size)}
                          aria-pressed={active}
                          className={`
                            px-2 py-1 rounded-md text-[11px] font-medium border transition-all
                            ${active
                              ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'}
                          `}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <p className="text-[11px] text-gray-400 leading-snug -mt-1">{t('fav.sizes_tip')}</p>

              {upscaleHint && (
                <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-2 leading-snug -mt-1">
                  {t('fav.upscale_tip', { n: sourceShortEdge, max: maxTarget })}
                </p>
              )}

              {/* Padding */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{t('fav.padding')}</span>
                  <span className="font-mono text-gray-400">{padding}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={30}
                  value={padding}
                  aria-label={t('fav.padding')}
                  onChange={(event) => setPadding(Number(event.target.value))}
                  className="w-full accent-primary-600"
                />
              </div>

              {/* Radius */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{t('fav.radius')}</span>
                  <span className="font-mono text-gray-400">{radius}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={radius}
                  aria-label={t('fav.radius')}
                  onChange={(event) => setRadius(Number(event.target.value))}
                  className="w-full accent-primary-600"
                />
              </div>

              {/* Fit */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">{t('fav.fit')}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['contain', 'cover'] as FitMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setFit(mode)}
                      aria-pressed={fit === mode}
                      className={`
                        py-1.5 rounded-lg text-xs font-medium border transition-all
                        ${fit === mode
                          ? 'bg-primary-50 border-primary-300 text-primary-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'}
                      `}
                    >
                      {t(`fav.fit_${mode}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1.5">
                  {t('fav.background')}
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTransparent(true)}
                    aria-pressed={transparent}
                    className={`
                      flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                      ${transparent
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'}
                    `}
                  >
                    {t('fav.transparent')}
                  </button>
                  <button
                    onClick={() => setTransparent(false)}
                    aria-pressed={!transparent}
                    className={`
                      flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all
                      ${!transparent
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'}
                    `}
                  >
                    {t('fav.solid')}
                  </button>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(event) => {
                      setBgColor(event.target.value);
                      setTransparent(false);
                    }}
                    className={`w-9 h-9 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer ${transparent ? 'opacity-50' : ''}`}
                    aria-label={t('fav.background')}
                  />
                </div>
                <p className={`mt-2 text-[11px] leading-snug ${iosTransparentHint ? 'text-amber-600' : 'text-gray-400'}`}>
                  {t('fav.apple_tip')}
                </p>
              </div>

              {/* Manifest meta (Android PWA only) */}
              {platforms.includes('android') && (
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <label className="text-xs font-medium text-gray-600 block">{t('fav.meta')}</label>
                  <input
                    value={appName}
                    onChange={(event) => setAppName(event.target.value)}
                    placeholder={t('fav.app_name')}
                    aria-label={t('fav.app_name')}
                    className="w-full p-2 border border-gray-300 rounded-lg text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      value={shortName}
                      onChange={(event) => setShortName(event.target.value)}
                      placeholder={t('fav.short_name')}
                      aria-label={t('fav.short_name')}
                      className="flex-1 min-w-0 p-2 border border-gray-300 rounded-lg text-xs"
                    />
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(event) => setThemeColor(event.target.value)}
                      className="w-9 h-9 shrink-0 rounded-lg border border-gray-200 bg-white p-1 cursor-pointer"
                      aria-label={t('fav.theme_color')}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: preview + export */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-gray-50 border border-gray-200 rounded-xl flex-1 flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center z-10">
            <span className="font-semibold text-gray-700">{t('fav.preview')}</span>
            {imgEl && (
              <span className="text-xs text-gray-500">
                {isGenerating ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" />
                    {t('common.processing')}
                  </span>
                ) : (
                  `${entries.length} PNG${icoSizes.length ? ` · ico ${icoSizes.join('/')}` : ''}`
                )}
              </span>
            )}
          </div>

          <div className="flex-1 p-4 md:p-6 overflow-auto space-y-5">
            {!imgEl ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-400">
                <Upload size={48} className="mb-2 opacity-20" />
                <span>{t('fav.waiting')}</span>
              </div>
            ) : !entries.length ? (
              <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-gray-400">
                <AppWindow size={48} className="mb-2 opacity-20" />
                <span>{t('fav.no_sizes')}</span>
              </div>
            ) : (
              <>
                {/* Browser mock */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                  <div className="flex items-end gap-1 bg-gray-100 px-2 pt-2">
                    <div className="flex items-center gap-2 bg-white rounded-t-lg px-3 py-2 w-52 border border-b-0 border-gray-200">
                      {preview16 && (
                        <img
                          src={preview16.url}
                          width={16}
                          height={16}
                          alt="favicon 16"
                          className="shrink-0"
                        />
                      )}
                      <span className="text-xs text-gray-700 truncate">{displayName}</span>
                      <X size={10} className="text-gray-400 ml-auto shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 text-gray-400">
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 border-t border-gray-200">
                    <div className="flex-1 bg-gray-100 rounded-full h-6 flex items-center px-3 gap-2">
                      {preview16 && (
                        <img src={preview16.url} width={12} height={12} alt="" className="opacity-70" />
                      )}
                      <span className="text-[10px] text-gray-400 truncate">
                        https://example.com
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 px-3 py-2 border-t border-gray-100 bg-gray-50">
                    {preview32 && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img src={preview32.url} width={16} height={16} alt="" />
                        <span className="text-[10px] text-gray-500 truncate">{displayName}</span>
                      </div>
                    )}
                    {preview32 && (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <img src={preview32.url} width={16} height={16} alt="" />
                        <span className="text-[10px] text-gray-500 truncate">
                          {displayName} · Docs
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Icon groups, one per platform */}
                {PLATFORM_ORDER.filter((platform) => platforms.includes(platform)).map((platform) => {
                  const group = entries.filter((entry) => entry.platform === platform);
                  if (!group.length) return null;
                  const Icon = PLATFORM_ICON[platform];
                  return (
                    <div key={platform}>
                      <div className="flex items-baseline justify-between mb-2 gap-2">
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <Icon size={13} />
                          {t(`fav.platform.${platform}`)}
                          <span className="font-normal text-gray-400">
                            ({group.length})
                          </span>
                        </span>
                        <span className="text-[11px] text-gray-400 truncate">
                          {t(`fav.platform.${platform}.desc`)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {group.map((entry) => {
                          const preview = previewBySize.get(entry.size);
                          const displaySize = Math.min(entry.size, 72);
                          return (
                            <button
                              key={`${entry.platform}-${entry.size}`}
                              onClick={() => handleDownloadSingle(entry)}
                              title={entry.names.join('\n')}
                              className="group bg-white border border-gray-200 rounded-xl p-3 flex flex-col items-center gap-2 hover:border-primary-300 hover:shadow-sm transition-all"
                            >
                              <div
                                className="h-24 w-full flex items-center justify-center rounded-lg"
                                style={{ backgroundImage: `url("${CHECKERBOARD}")` }}
                              >
                                {preview && (
                                  <img
                                    src={preview.url}
                                    alt={`${entry.size}x${entry.size}`}
                                    style={{ width: displaySize, height: displaySize }}
                                    className="max-w-full max-h-full"
                                  />
                                )}
                              </div>
                              <div className="text-center w-full">
                                <div className="text-[11px] font-medium text-gray-700 truncate">
                                  {entry.names[0]}
                                </div>
                                <div className="text-[10px] text-gray-400">
                                  {entry.size}×{entry.size}
                                  {preview ? ` · ${(preview.blob.size / 1024).toFixed(1)} KB` : ''}
                                  {entry.names.length > 1 ? ` · +${entry.names.length - 1}` : ''}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* HTML snippet */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-600 block">{t('fav.html')}</span>
                      <span className="text-[11px] text-gray-400">{t('fav.html_tip')}</span>
                    </div>
                    <button
                      onClick={handleCopyHtml}
                      className="shrink-0 flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700 transition-colors"
                    >
                      {isCopied() ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                      {isCopied() ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <pre className="bg-gray-900 text-gray-100 text-[11px] leading-relaxed p-3 rounded-lg overflow-x-auto">
                    <code>{htmlSnippet}</code>
                  </pre>
                </div>

                {/* Manifest preview */}
                {manifestIcons.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-gray-600 block mb-2">
                      site.webmanifest
                    </span>
                    <pre className="bg-white border border-gray-200 text-gray-700 text-[11px] leading-relaxed p-3 rounded-lg overflow-x-auto">
                      <code>{manifestText}</code>
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-200 z-10 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleDownloadZip}
              disabled={!imgEl || isDownloading || !entries.length}
              className={`
                flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium shadow-sm transition-all
                ${imgEl && entries.length
                  ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
              `}
            >
              {isDownloading ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : (
                <Download size={20} />
              )}
              {isDownloading ? t('common.processing') : t('fav.download')}
            </button>
            <div className="hidden sm:flex flex-col justify-center text-[11px] text-gray-400 px-1">
              <span>{t('fav.download_hint')}</span>
              <span className="font-mono">
                {t('fav.export_summary', { files: exportSummary.files, size: exportSummary.kb })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FaviconGenerator;
