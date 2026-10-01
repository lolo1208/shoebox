
/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import { Download, ImagePlus, QrCode as QrIcon, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLanguage } from '../../contexts/LanguageContext';

const QrCodeGenerator: React.FC = () => {
  const { t } = useLanguage();
  const [text, setText] = useLocalStorage<string>('tool-qr-text', 'https://shoebox.lolo.link');
  const [size, setSize] = useLocalStorage<number>('tool-qr-size', 256);
  const [fgColor, setFgColor] = useLocalStorage<string>('tool-qr-fg', '#000000');
  const [bgColor, setBgColor] = useLocalStorage<string>('tool-qr-bg', '#ffffff');
  const [dataUrl, setDataUrl] = useState<string>('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [logoSize, setLogoSize] = useState(22);
  
  useEffect(() => {
    const generateQr = async () => {
      if (!text) {
        setDataUrl('');
        return;
      }
      try {
        const url = await QRCode.toDataURL(text, {
          width: size,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });
        if (!logoUrl) {
          setDataUrl(url);
          return;
        }
        const qrImage = new Image();
        qrImage.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(qrImage, 0, 0, size, size);
          const avatar = new Image();
          avatar.onload = () => {
            const logoPx = size * logoSize / 100;
            const padding = Math.max(4, Math.round(size * 0.018));
            const box = logoPx + padding * 2;
            const x = (size - box) / 2;
            const y = (size - box) / 2;
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.roundRect(x, y, box, box, Math.max(4, size * 0.025));
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            const imageX = size / 2 - logoPx / 2;
            const imageY = size / 2 - logoPx / 2;
            ctx.roundRect(imageX, imageY, logoPx, logoPx, Math.max(2, size * 0.018));
            ctx.clip();
            ctx.drawImage(avatar, imageX, imageY, logoPx, logoPx);
            ctx.restore();
            setDataUrl(canvas.toDataURL('image/png'));
          };
          avatar.onerror = () => setDataUrl(url);
          avatar.src = logoUrl;
        };
        qrImage.src = url;
      } catch (err) {
        console.error(err);
      }
    };

    const timer = setTimeout(generateQr, 100);
    return () => clearTimeout(timer);
  }, [text, size, fgColor, bgColor, logoUrl, logoSize]);

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
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('qr.fg_color')}</label>
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
                        <label className="block text-sm font-medium text-gray-600 mb-2">{t('qr.bg_color')}</label>
                         <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={bgColor}
                                onChange={(e) => setBgColor((e.target as HTMLInputElement).value)}
                                className="w-10 h-10 p-1 bg-white border border-gray-200 rounded-lg cursor-pointer"
                            />
                            <span className="text-sm font-mono text-gray-500 uppercase">{bgColor}</span>
                        </div>
                    </div>
                </div>
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
                    <img src={dataUrl} alt="QR Code" className="max-w-full" />
                </div>
            ) : (
                <div className="text-gray-400 flex flex-col items-center">
                    <QrIcon size={48} className="mb-2 opacity-50" />
                    <span>{t('qr.empty')}</span>
                </div>
            )}
            
            {text && (
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
