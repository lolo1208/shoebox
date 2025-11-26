import React, { useState } from 'react';
import { Copy, FileJson, Trash2, Minimize2, Check } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const JsonFormatter: React.FC = () => {
  const [input, setInput] = useLocalStorage<string>('tool-json-input', '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const formatJson = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const minifyJson = () => {
    try {
      if (!input.trim()) return;
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(input);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => {
    setInput('');
    setError(null);
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={formatJson}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors font-medium text-sm"
        >
          <FileJson size={16} />
          格式化 (Format)
        </button>
        <button
          onClick={minifyJson}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium text-sm"
        >
          <Minimize2 size={16} />
          压缩 (Minify)
        </button>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors font-medium text-sm ml-auto"
        >
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? '已复制' : '复制'}
        </button>
        <button
          onClick={clear}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-red-600 rounded-md hover:bg-red-50 hover:border-red-200 transition-colors font-medium text-sm"
        >
          <Trash2 size={16} />
          清空
        </button>
      </div>

      <div className="relative flex-1 min-h-[400px]">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="在此粘贴 JSON..."
          className={`
            w-full h-full p-4 font-mono text-sm bg-gray-50 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all
            ${error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-primary-500'}
          `}
          spellCheck={false}
        />
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md shadow-sm">
            <strong>Invalid JSON:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default JsonFormatter;