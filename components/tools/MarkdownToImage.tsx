/// <reference lib="dom" />
import React, { useRef, useState, useEffect } from 'react';
import { Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import Logo from '../Logo';

const MarkdownToImage: React.FC = () => {
  const [input, setInput] = useLocalStorage<string>('tool-md-img-input', '# Hello Shoebox\n\nThis is a **markdown** to image tool.\n\n- Simple\n- Fast\n- Beautiful');
  const [isGenerating, setIsGenerating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Parse Markdown to HTML
  const getHtml = () => {
    try {
      return marked.parse(input);
    } catch (e) {
      return 'Error parsing markdown';
    }
  };

  const handleDownload = async () => {
    if (!previewRef.current) return;
    setIsGenerating(true);

    try {
      // Small delay to ensure styles are applied
      await new Promise(resolve => setTimeout(resolve, 100));

      const canvas = await html2canvas(previewRef.current, {
        scale: 2, // Retina support (2x resolution)
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const link = document.createElement('a');
      link.download = 'lolo-shoebox-markdown.jpg';
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Generation failed', err);
      alert('Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-[600px]">
      {/* Editor Side */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex justify-between items-center">
             <label className="text-sm font-medium text-gray-700">Markdown 编辑</label>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput((e.target as HTMLTextAreaElement).value)}
          className="flex-1 w-full p-4 font-mono text-sm bg-gray-50 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all text-gray-800"
          placeholder="# Type your markdown here..."
        />
      </div>

      {/* Preview Side */}
      <div className="flex-1 flex flex-col space-y-4">
        <div className="flex justify-between items-center">
             <label className="text-sm font-medium text-gray-700">实时预览</label>
             <button
                onClick={handleDownload}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
             >
                {isGenerating ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                下载图片
             </button>
        </div>
        
        <div className="flex-1 bg-gray-100 border border-gray-200 rounded-xl p-4 overflow-auto flex items-start justify-center">
            {/* 
               Changes: Removed max-w-[500px]. Added w-full.
            */}
            <div 
                ref={previewRef}
                className="bg-white p-8 rounded-none shadow-sm w-full markdown-body prose prose-sm prose-slate max-w-none"
            >
                {/* 
                   Using 'prose' from Tailwind Typography would be ideal, 
                   but since we rely on CDN tailwind without plugins in this specific environment,
                   we'll rely on some basic inline/style tag CSS or the prose class if user installs plugin locally.
                   For now, we add basic HTML rendering.
                */}
                <div 
                   dangerouslySetInnerHTML={{ __html: getHtml() as string }} 
                   className="space-y-4"
                />
                
                {/* Custom Styling for the rendered MD content within this block to ensure it looks good without tailwind-typography plugin */}
                <style>{`
                    .markdown-body h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; color: #1e293b; }
                    .markdown-body h2 { font-size: 1.5em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: #334155; }
                    .markdown-body h3 { font-size: 1.25em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: #334155; }
                    .markdown-body p { margin-bottom: 1em; line-height: 1.6; color: #475569; }
                    .markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
                    .markdown-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
                    .markdown-body blockquote { border-left: 4px solid #e2e8f0; padding-left: 1em; color: #64748b; font-style: italic; }
                    .markdown-body code { background: #f1f5f9; padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; color: #0f172a; }
                    .markdown-body pre { background: #1e293b; padding: 1em; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; }
                    .markdown-body pre code { background: transparent; color: #e2e8f0; padding: 0; }
                    .markdown-body img { max-width: 100%; height: auto; border-radius: 8px; }
                    .markdown-body hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2em 0; }
                    .markdown-body strong { font-weight: 600; color: #0f172a; }
                    .markdown-body a { color: #006add; text-decoration: underline; }
                `}</style>

                {/* Footer branding for the image */}
                <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between text-gray-400 text-xs font-mono">
                    <span className="flex items-center gap-1">
                        <Logo size={12} className="text-gray-400" />
                        Generated by LOLO' Shoebox
                    </span>
                    <span>{new Date().toLocaleDateString()}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownToImage;