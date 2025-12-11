
/// <reference lib="dom" />
import React, { useRef, useState, useEffect } from 'react';
import { Download, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { marked } from 'marked';
import html2canvas from 'html2canvas';
import Logo from '../Logo';
import hljs from 'highlight.js';

// Define styles as a constant to ensure clean parsing by both Browser and html2canvas
// We avoid complex selectors like ':not()' which can cause html2canvas to drop rules.
const MARKDOWN_STYLES = `
/* GitHub Light Theme for Highlight.js */
.hljs { color: #24292e; background: #ffffff; }
.hljs-doctag, .hljs-keyword, .hljs-meta .hljs-keyword, .hljs-template-tag, .hljs-template-variable, .hljs-type, .hljs-variable.language_ { color: #d73a49; }
.hljs-title, .hljs-title.class_, .hljs-title.class_.inherited__, .hljs-title.function_ { color: #6f42c1; }
.hljs-attr, .hljs-attribute, .hljs-literal, .hljs-meta, .hljs-number, .hljs-operator, .hljs-variable, .hljs-selector-attr, .hljs-selector-class, .hljs-selector-id { color: #005cc5; }
.hljs-regexp, .hljs-string, .hljs-meta .hljs-string { color: #032f62; }
.hljs-built_in, .hljs-symbol { color: #e36209; }
.hljs-comment, .hljs-code, .hljs-formula { color: #6a737d; }
.hljs-name, .hljs-quote, .hljs-selector-tag, .hljs-selector-pseudo { color: #22863a; }
.hljs-subst { color: #24292e; }
.hljs-section { color: #005cc5; font-weight: bold; }
.hljs-bullet { color: #735c0f; }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
.hljs-addition { color: #22863a; background-color: #f0fff4; }
.hljs-deletion { color: #b31d28; background-color: #ffeef0; }

/* Custom Markdown Styles */
.markdown-body { font-family: -apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji"; }
.markdown-body h1 { font-size: 2em; font-weight: 700; margin-bottom: 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; color: #1e293b; }
.markdown-body h2 { font-size: 1.5em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: #334155; }
.markdown-body h3 { font-size: 1.25em; font-weight: 600; margin-top: 1em; margin-bottom: 0.5em; color: #334155; }
.markdown-body p { margin-bottom: 1em; line-height: 1.6; color: #475569; }
.markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
.markdown-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
.markdown-body blockquote { border-left: 4px solid #e2e8f0; padding-left: 1em; color: #64748b; font-style: italic; background-color: #f8fafc; padding-top: 0.5em; padding-bottom: 0.5em; }

/* Inline Code - Optimized for html2canvas */
/* We use 'inline-block' to ensure background renders correctly in the screenshot */
.markdown-body code { 
    background-color: rgba(175, 184, 193, 0.2);
    padding: 0.2em 0.4em; 
    border-radius: 6px; 
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; 
    font-size: 85%;
    color: #24292e;
    margin: 0;
    display: inline-block; 
    vertical-align: middle;
}

/* Code Blocks - Override inline code styles */
.markdown-body pre { background: #f6f8fa; padding: 1em; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; border: 1px solid #e1e4e8; }
.markdown-body pre code { 
    background-color: transparent; 
    color: inherit; 
    padding: 0; 
    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace; 
    font-size: 90%;
    display: block;
    margin: 0;
    border-radius: 0;
}

.markdown-body img { max-width: 100%; height: auto; border-radius: 8px; }
.markdown-body hr { border: 0; border-top: 1px solid #e2e8f0; margin: 2em 0; }
.markdown-body strong { font-weight: 600; color: #0f172a; }
.markdown-body a { color: #006add; text-decoration: underline; }
`;

const MarkdownToImage: React.FC = () => {
  const [input, setInput] = useLocalStorage<string>('tool-md-img-input', '# Hello Shoebox\n\nThis is a **markdown** to image tool.\n\n```typescript\n// Sample Code\nconst hello: string = "world";\nconsole.log(hello);\n```\n\n- Simple\n- Fast\n- Beautiful\n\nTry inline code: `const a = 1;` looks great now.');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMarkedReady, setIsMarkedReady] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Configure marked with a robust renderer
    const renderer = new marked.Renderer();
    
    renderer.code = (codeOrToken: any, langStr?: string) => {
      let code = '';
      let lang = '';
      
      if (typeof codeOrToken === 'object' && codeOrToken !== null && 'text' in codeOrToken) {
        code = codeOrToken.text || '';
        lang = codeOrToken.lang || '';
      } else {
        code = String(codeOrToken || '');
        lang = String(langStr || '');
      }

      try {
        const language = lang || '';
        const validLang = hljs.getLanguage(language) ? language : 'plaintext';
        const highlighted = hljs.highlight(code, { language: validLang }).value;
        return `<pre><code class="hljs language-${validLang}">${highlighted}</code></pre>`;
      } catch (e) {
        console.warn('Highlighting failed for block:', e);
        return `<pre><code class="hljs">${code}</code></pre>`;
      }
    };
    
    marked.use({
      renderer: renderer,
      breaks: true,
      gfm: true,
    });

    setIsMarkedReady(true);
  }, []);

  const getHtml = () => {
    try {
      const result = marked.parse(input);
      if (result instanceof Promise) {
        return 'Parsing...'; 
      }
      return result;
    } catch (e) {
      console.error('Markdown parsing error:', e);
      return '<p style="color:red">Error parsing markdown. Please check your syntax.</p>';
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
        onclone: (doc) => {
            // 1. Fix Pre tag overflow in screenshot
            const preElements = doc.querySelectorAll('.markdown-body pre');
            preElements.forEach((el) => {
                (el as HTMLElement).style.overflow = 'visible';
            });
            
            // Note: Inline code 'display: inline-block' is now handled in CSS 
            // to ensure Preview matches Download exactly.
        }
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
          spellCheck={false}
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
            <div 
                ref={previewRef}
                className="bg-white p-8 rounded-none shadow-sm w-full markdown-body prose prose-sm prose-slate max-w-none"
            >
                {/* Only render content when marked is configured to avoid flash of un-highlighted code */}
                {isMarkedReady ? (
                  <div 
                     dangerouslySetInnerHTML={{ __html: getHtml() as string }} 
                     className="space-y-4"
                  />
                ) : (
                  <div className="flex items-center justify-center py-10 text-gray-400">
                    <RefreshCw className="animate-spin mr-2" size={20} />
                    Loading Renderer...
                  </div>
                )}
                
                {/* Embed styles directly */}
                <style>{MARKDOWN_STYLES}</style>

                {/* Footer branding for the image */}
                <div className="mt-8 pt-4 border-t border-gray-100 text-gray-400 text-xs font-mono flex items-center justify-between">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                            <Logo size={14} className="text-gray-400" />
                        </div>
                        <span style={{ lineHeight: '14px', paddingTop: '1px' }}>Generated by LOLO' Shoebox</span>
                    </div>
                    <span style={{ lineHeight: '14px' }}>{new Date().toLocaleDateString()}</span>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default MarkdownToImage;
