/// <reference lib="dom" />
import React, { useEffect, useRef, useState } from 'react';
import { Download, QrCode as QrIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const QrCodeGenerator: React.FC = () => {
  const [text, setText] = useLocalStorage<string>('tool-qr-text', 'https://shoebox.lolo.link');
  const [size, setSize] = useLocalStorage<number>('tool-qr-size', 256);
  const [fgColor, setFgColor] = useLocalStorage<string>('tool-qr-fg', '#000000');
  const [bgColor, setBgColor] = useLocalStorage<string>('tool-qr-bg', '#ffffff');
  const [dataUrl, setDataUrl] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const generateQr = async () => {
      if (!text) {
        setDataUrl('');
        return;
      }
      try {
        // Generate to Data URL for image tag
        const url = await QRCode.toDataURL(text, {
          width: size,
          margin: 1,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });
        setDataUrl(url);

        // Also draw to hidden canvas for clean download if needed, 
        // though DataURL is enough for img src.
      } catch (err) {
        console.error(err);
      }
    };

    // Debounce slightly to avoid rapid updates on slider drag
    const timer = setTimeout(generateQr, 100);
    return () => clearTimeout(timer);
  }, [text, size, fgColor, bgColor]);

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
      {/* Configuration */}
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">内容 (文本或 URL)</label>
          <textarea
            value={text}
            onChange={(e) => setText((e.target as HTMLTextAreaElement).value)}
            placeholder="输入链接或文本..."
            className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all resize-none text-gray-800"
          />
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
                外观设置
            </h3>
            
            <div className="space-y-4">
                <div>
                    <div className="flex justify-between mb-2">
                        <label className="text-sm font-medium text-gray-600">尺寸: {size}px</label>
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
                        <label className="block text-sm font-medium text-gray-600 mb-2">前景色</label>
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
                        <label className="block text-sm font-medium text-gray-600 mb-2">背景色</label>
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
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 lg:max-w-md">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center min-h-[400px] h-full">
            {text ? (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                    <img src={dataUrl} alt="QR Code" className="max-w-full" />
                </div>
            ) : (
                <div className="text-gray-400 flex flex-col items-center">
                    <QrIcon size={48} className="mb-2 opacity-50" />
                    <span>输入内容以生成二维码</span>
                </div>
            )}
            
            {text && (
                <button
                    onClick={handleDownload}
                    className="mt-8 flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm hover:shadow-md"
                >
                    <Download size={18} />
                    下载图片
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

export default QrCodeGenerator;