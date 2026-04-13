
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';

type KeyType = 'hex' | 'base64' | 'base64url' | 'utf8';

const KeyGenerator: React.FC = () => {
  const { t } = useLanguage();
  const [type, setType] = useLocalStorage<KeyType>('tool-key-gen-type', 'hex');
  const [length, setLength] = useLocalStorage<number>('tool-key-gen-length', 32);
  const [count, setCount] = useLocalStorage<number>('tool-key-gen-count', 5);
  const [keys, setKeys] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const generateKeys = useCallback(() => {
    const newKeys: string[] = [];
    for (let i = 0; i < count; i++) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      
      let key = '';
      if (type === 'hex') {
        key = Array.from(array)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      } else if (type === 'base64') {
        key = btoa(String.fromCharCode(...array));
      } else if (type === 'base64url') {
        key = btoa(String.fromCharCode(...array))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
      } else if (type === 'utf8') {
        // Generate random printable ASCII characters (33-126)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        for (let j = 0; j < length; j++) {
          key += chars.charAt(array[j] % chars.length);
        }
      }
      newKeys.push(key);
    }
    setKeys(newKeys);
  }, [type, length, count]);

  useEffect(() => {
    generateKeys();
  }, [generateKeys]);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = () => {
    navigator.clipboard.writeText(keys.join('\n'));
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t('key.type')}</label>
          <div className="flex flex-wrap gap-2">
            {(['hex', 'base64', 'base64url', 'utf8'] as KeyType[]).map((tType) => (
              <button
                key={tType}
                onClick={() => setType(tType)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  type === tType
                    ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {t(`key.${tType}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {t('key.length')}
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({t('key.bits', { n: length * 8 })})
            </span>
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="8"
              max="128"
              step="8"
              value={length}
              onChange={(e) => setLength(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <span className="text-sm font-mono text-gray-600 w-8">{length}</span>
          </div>
          <div className="flex gap-2">
            {[16, 32, 64, 128].map(l => (
              <button
                key={l}
                onClick={() => setLength(l)}
                className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
              >
                {l}B
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">{t('key.count')}</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="20"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            />
            <span className="text-sm font-mono text-gray-600 w-8">{count}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
          <ShieldCheck size={14} />
          <span className="text-xs font-medium">Securely generated in-browser</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copyAll}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
          >
            {copiedIndex === -1 ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {t('uuid.copy_all')}
          </button>
          <button
            onClick={generateKeys}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors shadow-sm"
          >
            <RefreshCw size={16} />
            {t('key.generate')}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-3">
        {keys.map((key, index) => (
          <div 
            key={index}
            className="group flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 hover:border-primary-200 hover:shadow-md transition-all animate-slide-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <div className="flex-1 font-mono text-sm break-all text-gray-800 selection:bg-primary-100">
              {key}
            </div>
            <button
              onClick={() => copyToClipboard(key, index)}
              className={`p-2 rounded-lg transition-all ${
                copiedIndex === index 
                  ? 'bg-green-50 text-green-600' 
                  : 'bg-gray-50 text-gray-400 group-hover:text-primary-600 group-hover:bg-primary-50'
              }`}
              title={t('common.copy')}
            >
              {copiedIndex === index ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeyGenerator;
