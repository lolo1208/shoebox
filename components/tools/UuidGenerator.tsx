/// <reference lib="dom" />
import React, { useState } from 'react';
import { Copy, RefreshCw, Check, Plus, Minus, ArrowRightLeft } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import CryptoJS from 'crypto-js';

type UuidMode = 'v4' | 'v5';

const DEFAULT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const UuidGenerator: React.FC = () => {
  const [mode, setMode] = useLocalStorage<UuidMode>('tool-uuid-mode', 'v4');
  
  // v4 State
  const [uuids, setUuids] = useState<string[]>([]);
  const [count, setCount] = useLocalStorage<number>('tool-uuid-v4-count', 5);
  
  // v5 State
  const [contentInput, setContentInput] = useLocalStorage<string>('tool-uuid-v5-input', '');
  const [contentUuid, setContentUuid] = useState('');
  const [namespace, setNamespace] = useLocalStorage<string>('tool-uuid-v5-ns', ''); 
  
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedV5, setCopiedV5] = useState(false);

  // --- Logic for V4 (Random) ---
  const generateUUIDv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const generateBatchV4 = () => {
    const newUuids = Array.from({ length: count }, () => generateUUIDv4());
    setUuids(newUuids);
  };

  // --- Logic for V5 (SHA1 based) ---
  const generateUUIDv5 = (name: string, ns: string) => {
    // Use default namespace if empty
    const effectiveNs = ns.trim() || DEFAULT_NAMESPACE;

    try {
      // 1. Convert Namespace Hex to WordArray
      const nsHex = effectiveNs.replace(/-/g, '');
      const nsWords = CryptoJS.enc.Hex.parse(nsHex);
      
      // 2. Convert Name (Content) to WordArray (UTF-8)
      const nameWords = CryptoJS.enc.Utf8.parse(name);
      
      // 3. Concatenate: Namespace + Name
      const combined = nsWords.concat(nameWords);
      
      // 4. SHA1 Hash
      const hash = CryptoJS.SHA1(combined);
      const hex = hash.toString(CryptoJS.enc.Hex);
      
      // 5. Format as UUID and set Version/Variant
      const raw = hex.substring(0, 32);
      
      const p1 = raw.substring(0, 8);
      const p2 = raw.substring(8, 12);
      const p3 = raw.substring(12, 16);
      const p4 = raw.substring(16, 20);
      const p5 = raw.substring(20, 32);
      
      const p3Arr = p3.split('');
      p3Arr[0] = '5'; // Version 5
      const p3Final = p3Arr.join('');
      
      const p4Arr = p4.split('');
      const firstNibble = parseInt(p4Arr[0], 16);
      p4Arr[0] = ((firstNibble & 0x3) | 0x8).toString(16);
      const p4Final = p4Arr.join('');
      
      return `${p1}-${p2}-${p3Final}-${p4Final}-${p5}`;
    } catch (e) {
      console.error(e);
      return "Invalid Namespace UUID";
    }
  };

  // Generate V4 on load if empty
  React.useEffect(() => {
    if (uuids.length === 0) {
        generateBatchV4();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Generate V5 on input change
  React.useEffect(() => {
    if (contentInput) {
        const uuid = generateUUIDv5(contentInput, namespace);
        setContentUuid(uuid);
    } else {
        setContentUuid('');
    }
  }, [contentInput, namespace]);

  const copyOne = (uuid: string, index: number) => {
    (navigator as any).clipboard.writeText(uuid);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const copyV5 = () => {
    if (!contentUuid) return;
    (navigator as any).clipboard.writeText(contentUuid);
    setCopiedV5(true);
    setTimeout(() => setCopiedV5(false), 1500);
  };

  const copyAll = () => {
    (navigator as any).clipboard.writeText(uuids.join('\n'));
    setCopiedIndex(-1); 
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const adjustCount = (delta: number) => {
    setCount(prev => Math.max(1, Math.min(50, prev + delta)));
  };

  return (
    <div className="w-full space-y-6">
      {/* Mode Switcher */}
      <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setMode('v4')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            mode === 'v4' 
              ? 'bg-white text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          随机生成 (v4)
        </button>
        <button
          onClick={() => setMode('v5')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            mode === 'v5' 
              ? 'bg-white text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          基于内容生成 (v5)
        </button>
      </div>

      {mode === 'v4' ? (
        <div className="animate-fade-in space-y-6">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                <span className="text-gray-700 font-medium">生成数量:</span>
                <div className="flex items-center rounded-lg border border-gray-300 bg-white">
                    <button onClick={() => adjustCount(-1)} className="p-2 hover:bg-gray-100 text-gray-600 rounded-l-lg border-r border-gray-300">
                        <Minus size={16} />
                    </button>
                    <div className="w-12 text-center font-mono text-gray-900">{count}</div>
                    <button onClick={() => adjustCount(1)} className="p-2 hover:bg-gray-100 text-gray-600 rounded-r-lg border-l border-gray-300">
                        <Plus size={16} />
                    </button>
                </div>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                <button 
                    onClick={generateBatchV4}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <RefreshCw size={18} />
                    重新生成
                </button>
                <button 
                    onClick={copyAll}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    {copiedIndex === -1 ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    复制全部
                </button>
                </div>
            </div>

            <div className="space-y-2">
                {uuids.map((uuid, index) => (
                <div key={`${uuid}-${index}`} className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm transition-all">
                    <span className="font-mono text-gray-600 text-sm select-none w-6 text-right opacity-50">{index + 1}.</span>
                    <div className="font-mono text-gray-800 flex-1 break-all">{uuid}</div>
                    <button 
                    onClick={() => copyOne(uuid, index)}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                    title="Copy"
                    >
                    {copiedIndex === index ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                    </button>
                </div>
                ))}
            </div>
        </div>
      ) : (
        <div className="animate-fade-in space-y-6">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">输入内容 (Name)</label>
                    <input 
                        type="text"
                        value={contentInput}
                        onChange={(e) => setContentInput((e.target as HTMLInputElement).value)}
                        placeholder="输入你想要转换成 UUID 的字符串..."
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all text-gray-800"
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Namespace UUID (可选)</label>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={namespace}
                            onChange={(e) => setNamespace((e.target as HTMLInputElement).value)}
                            placeholder={`默认: ${DEFAULT_NAMESPACE}`}
                            className="flex-1 p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all font-mono text-gray-600"
                        />
                        <button 
                            onClick={() => setNamespace('')}
                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                            title="重置为默认 DNS Namespace"
                        >
                            重置
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">若留空，则默认使用 DNS Namespace。相同的输入内容在相同的 Namespace 下永远生成相同的 UUID。</p>
                </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700">生成的 UUID (v5)</label>
                <div className="relative">
                    <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-primary-700 font-semibold break-all min-h-[56px] flex items-center justify-center text-lg">
                        {contentUuid || <span className="text-gray-400 font-normal text-base italic">等待输入...</span>}
                    </div>
                    {contentUuid && (
                        <button 
                            onClick={copyV5}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-gray-500 border border-gray-200 rounded-lg shadow-sm hover:text-primary-600 hover:border-primary-200 transition-colors"
                        >
                            {copiedV5 ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                        </button>
                    )}
                </div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg flex items-start gap-3 text-sm text-orange-800">
                <ArrowRightLeft size={20} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">关于 UUID v5</p>
                    <p className="opacity-90 mt-1">
                        UUID v5 是基于 SHA-1 哈希算法的。它利用一个命名空间 (Namespace) 和一个名称 (Name) 来生成唯一的 UUID。如果命名空间和名称相同，生成的 UUID 永远相同。这非常适合为外部系统的 ID 生成固定的唯一标识符。
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default UuidGenerator;