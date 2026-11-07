/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { Download, ImagePlus, QrCode as QrIcon, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  drawQrModules,
  roundedRectPath,
  type QrEyeShape,
  type QrGradientDir,
  type QrModuleShape,
} from '@/lib/image/qrRender';

type QrStyle = 'classic' | 'fancy';
type ModuleShape = QrModuleShape;
type EyeShape = QrEyeShape;
type GradientDir = QrGradientDir;

interface ColorPreset {
  id: string;
  fg: string;
  fg2: string;
  bg: string;
  bg2: string;
}

const PRESETS: ColorPreset[] = [
  { id: 'ink', fg: '#111827', fg2: '#4b5563', bg: '#ffffff', bg2: '#f3f4f6' },
  { id: 'indigo', fg: '#4338ca', fg2: '#06b6d4', bg: '#ffffff', bg2: '#eef2ff' },
  { id: 'sunset', fg: '#ea580c', fg2: '#db2777', bg: '#fff7ed', bg2: '#ffffff' },
  { id: 'forest', fg: '#065f46', fg2: '#14b8a6', bg: '#f0fdfa', bg2: '#ffffff' },
];

const QrCodeGenerator: React.FC = () => {
  const { t } = useLanguage();
  const [text, setText] = useLocalStorage<string>('tool-qr-text', 'https://shoebox.lolo.link');
  const [size, setSize] = useLocalStorage<number>('tool-qr-size', 256);
  const [fgColor, setFgColor] = useLocalStorage<string>('tool-qr-fg', '#000000');
  const [bgColor, setBgColor] = useLocalStorage<string>('tool-qr-bg', '#ffffff');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoSize, setLogoSize] = useState(22);

  // 美化选项
  const [style, setStyle] = useLocalStorage<QrStyle>('tool-qr-style', 'classic');
  const [moduleShape, setModuleShape] = useLocalStorage<ModuleShape>('tool-qr-module', 'rounded');
  const [eyeShape, setEyeShape] = useLocalStorage<EyeShape>('tool-qr-eye', 'rounded');
  const [gradient, setGradient] = useLocalStorage<boolean>('tool-qr-gradient', true);
  const [fgColor2, setFgColor2] = useLocalStorage<string>('tool-qr-fg2', '#06b6d4');
  const [gradientDir, setGradientDir] = useLocalStorage<GradientDir>('tool-qr-dir', 'diagonal');
  const [bgGradient, setBgGradient] = useLocalStorage<boolean>('tool-qr-bg-gradient', false);
  const [bgColor2, setBgColor2] = useLocalStorage<string>('tool-qr-bg2', '#eef2ff');
  const [transparentBg, setTransparentBg] = useLocalStorage<boolean>('tool-qr-transparent', false);

  const [dataUrl, setDataUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  const fancy = style === 'fancy';

  useEffect(() => {
    let cancelled = false;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });

    const generateQr = async () => {
      if (!text) {
        setDataUrl('');
        setError('');
        return;
      }

      try {
        const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
        const count = qr.modules.size;
        const modules = qr.modules.data;

        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        drawQrModules(ctx, count, modules, {
          size,
          quiet: fancy ? 2 : 1,
          fgColor,
          fgColor2,
          bgColor,
          bgColor2,
          gradient: fancy && gradient,
          bgGradient: fancy && bgGradient,
          gradientDir,
          moduleShape: fancy ? moduleShape : 'square',
          eyeShape: fancy ? eyeShape : 'square',
          transparentBg,
        });

        // 中间头像
        if (logoUrl) {
          try {
            const avatar = await loadImage(logoUrl);
            const logoPx = size * logoSize / 100;
            const padding = Math.max(4, Math.round(size * 0.018));
            const box = logoPx + padding * 2;
            const x = (size - box) / 2;
            const y = (size - box) / 2;

            ctx.save();
            ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
            ctx.shadowBlur = Math.max(2, size * 0.012);
            ctx.fillStyle = transparentBg ? '#ffffff' : bgColor;
            roundedRectPath(ctx, x, y, box, box, [
              Math.max(4, size * 0.03),
              Math.max(4, size * 0.03),
              Math.max(4, size * 0.03),
              Math.max(4, size * 0.03),
            ]);
            ctx.fill();
            ctx.restore();

            ctx.save();
            const imageX = size / 2 - logoPx / 2;
            const imageY = size / 2 - logoPx / 2;
            const logoRadius = Math.max(2, size * 0.02);
            roundedRectPath(ctx, imageX, imageY, logoPx, logoPx, [
              logoRadius,
              logoRadius,
              logoRadius,
              logoRadius,
            ]);
            ctx.clip();
            ctx.drawImage(avatar, imageX, imageY, logoPx, logoPx);
            ctx.restore();
          } catch {
            // 头像加载失败时忽略，保留纯二维码
          }
        }

        if (!cancelled) {
          setDataUrl(canvas.toDataURL('image/png'));
          setError('');
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDataUrl('');
          setError(t('qr.error'));
        }
      }
    };

    const timer = setTimeout(generateQr, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    text, size, fgColor, bgColor, logoUrl, logoSize,
    fancy, moduleShape, eyeShape, gradient, fgColor2, gradientDir,
    bgGradient, bgColor2, transparentBg, t,
  ]);

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = 'qrcode.png';
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const applyPreset = (preset: ColorPreset) => {
    setFgColor(preset.fg);
    setFgColor2(preset.fg2);
    setBgColor(preset.bg);
    setBgColor2(preset.bg2);
    setGradient(true);
    setBgGradient(false);
    setTransparentBg(false);
  };

  const shapeButton = (
    value: ModuleShape | EyeShape,
    current: ModuleShape | EyeShape,
    onSelect: (v: string) => void,
    label: string
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => onSelect(value)}
      className={`px-2 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
        current === value
          ? 'border-primary-500 bg-primary-50 text-primary-700'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">{t('qr.content')}</label>
          <textarea
            value={text}
            onChange={(e) => setText((e.target as HTMLTextAreaElement).value)}
            placeholder={t('qr.empty')}
            className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all resize-none text-gray-800"
          />
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
                {t('qr.appearance')}
            </h3>

            <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
              {(['classic', 'fancy'] as QrStyle[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStyle(value)}
                  className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                    style === value ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(value === 'classic' ? 'qr.style_classic' : 'qr.style_fancy')}
                </button>
              ))}
            </div>

            <div className="space-y-4">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-600">{t('qr.size')}: {size}px</label>
                    </div>
                    <input
                        type="range"
                        min="128"
                        max="1024"
                        step="32"
                        value={size}
                        onChange={(e) => setSize(parseInt((e.target as HTMLInputElement).value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                </div>

                <div className="flex gap-6">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          {fancy && gradient ? t('qr.fg_color_start') : t('qr.fg_color')}
                        </label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={fgColor}
                                onChange={(e) => setFgColor((e.target as HTMLInputElement).value)}
                                className="w-10 h-10 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer"
                            />
                            <span className="text-sm font-mono text-gray-500 uppercase">{fgColor}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          {fancy && bgGradient && !transparentBg ? t('qr.bg_color_start') : t('qr.bg_color')}
                        </label>
                         <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={bgColor}
                                onChange={(e) => setBgColor((e.target as HTMLInputElement).value)}
                                className="w-10 h-10 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer disabled:opacity-40"
                                disabled={transparentBg}
                            />
                            <span className="text-sm font-mono text-gray-500 uppercase">{bgColor}</span>
                        </div>
                    </div>
                </div>

                {fancy && (
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">{t('qr.presets')}</label>
                      <div className="flex flex-wrap gap-2">
                        {PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                            title={t(`qr.preset_${preset.id}`)}
                          >
                            <span
                              className="w-5 h-5 rounded-full border border-white shadow-sm"
                              style={{ backgroundImage: `linear-gradient(135deg, ${preset.fg}, ${preset.fg2})` }}
                            />
                            <span className="text-xs text-gray-600 group-hover:text-primary-700">{t(`qr.preset_${preset.id}`)}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('qr.module_shape')}</label>
                        <div className="flex gap-1.5">
                          {shapeButton('square', moduleShape, (v) => setModuleShape(v as ModuleShape), t('qr.shape_square'))}
                          {shapeButton('rounded', moduleShape, (v) => setModuleShape(v as ModuleShape), t('qr.shape_rounded'))}
                          {shapeButton('dot', moduleShape, (v) => setModuleShape(v as ModuleShape), t('qr.shape_dot'))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('qr.eye_shape')}</label>
                        <div className="flex gap-1.5">
                          {shapeButton('square', eyeShape, (v) => setEyeShape(v as EyeShape), t('qr.shape_square'))}
                          {shapeButton('rounded', eyeShape, (v) => setEyeShape(v as EyeShape), t('qr.shape_rounded'))}
                          {shapeButton('circle', eyeShape, (v) => setEyeShape(v as EyeShape), t('qr.shape_circle'))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={gradient}
                          onChange={(e) => setGradient((e.target as HTMLInputElement).checked)}
                          className="w-4 h-4 accent-primary-600"
                        />
                        {t('qr.gradient')}
                      </label>
                      {gradient && (
                        <div className="flex flex-wrap items-center gap-4 pl-6">
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={fgColor2}
                              onChange={(e) => setFgColor2((e.target as HTMLInputElement).value)}
                              className="w-9 h-9 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer"
                            />
                            <span className="text-sm font-mono text-gray-500 uppercase">{fgColor2}</span>
                          </div>
                          <select
                            value={gradientDir}
                            onChange={(e) => setGradientDir((e.target as HTMLSelectElement).value as GradientDir)}
                            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                          >
                            <option value="diagonal">{t('qr.dir_diagonal')}</option>
                            <option value="horizontal">{t('qr.dir_horizontal')}</option>
                            <option value="vertical">{t('qr.dir_vertical')}</option>
                          </select>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={bgGradient}
                          onChange={(e) => setBgGradient((e.target as HTMLInputElement).checked)}
                          disabled={transparentBg}
                          className="w-4 h-4 accent-primary-600 disabled:opacity-40"
                        />
                        {t('qr.bg_gradient')}
                      </label>
                      {bgGradient && !transparentBg && (
                        <div className="flex items-center gap-2 pl-6">
                          <input
                            type="color"
                            value={bgColor2}
                            onChange={(e) => setBgColor2((e.target as HTMLInputElement).value)}
                            className="w-9 h-9 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer"
                          />
                          <span className="text-sm font-mono text-gray-500 uppercase">{bgColor2}</span>
                        </div>
                      )}

                      <label className="flex items-center gap-2 text-sm font-medium text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={transparentBg}
                          onChange={(e) => setTransparentBg((e.target as HTMLInputElement).checked)}
                          className="w-4 h-4 accent-primary-600"
                        />
                        {t('qr.transparent_bg')}
                      </label>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed">{t('qr.fancy_hint')}</p>
                  </div>
                )}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <label className="block text-sm font-medium text-gray-600">{t('qr.logo')}</label>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                  <ImagePlus size={16} />{t('qr.logo_upload')}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600"><X size={16} />{t('qr.logo_remove')}</button>}
              </div>
              {logoUrl && <div>
                <label className="block text-sm text-gray-600 mb-2">{t('qr.logo_size')}: {logoSize}%</label>
                <input type="range" min="14" max="30" step="1" value={logoSize} onChange={(e) => setLogoSize(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600" />
              </div>}
            </div>
        </div>
      </div>

      <div className="flex-1 lg:max-w-md">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px] h-full">
            {text ? (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    {dataUrl ? (
                      <img
                        src={dataUrl}
                        alt="QR Code"
                        className="max-w-full rounded"
                        style={transparentBg ? {
                          backgroundImage:
                            'linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%), linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%)',
                          backgroundSize: '16px 16px',
                          backgroundPosition: '0 0, 8px 8px',
                        } : undefined}
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-gray-300">
                        <QrIcon size={36} />
                      </div>
                    )}
                </div>
            ) : (
                <div className="text-gray-400 flex flex-col items-center">
                    <QrIcon size={48} className="mb-2 opacity-50" />
                    <span>{t('qr.empty')}</span>
                </div>
            )}

            {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}

            {text && dataUrl && (
                <button
                    onClick={handleDownload}
                    className="mt-8 flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm hover:shadow-md"
                >
                    <Download size={18} />
                    {t('qr.download')}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default QrCodeGenerator;
