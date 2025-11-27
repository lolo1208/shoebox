/// <reference lib="dom" />
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Check } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const PasswordGenerator: React.FC = () => {
  // Use persistent state for all configurations and the result
  const [password, setPassword] = useLocalStorage<string>('tool-pwd-result', '');
  const [length, setLength] = useLocalStorage<number>('tool-pwd-length', 16);
  const [includeUppercase, setIncludeUppercase] = useLocalStorage<boolean>('tool-pwd-upper', true);
  const [includeLowercase, setIncludeLowercase] = useLocalStorage<boolean>('tool-pwd-lower', true);
  const [includeNumbers, setIncludeNumbers] = useLocalStorage<boolean>('tool-pwd-number', true);
  const [includeSymbols, setIncludeSymbols] = useLocalStorage<boolean>('tool-pwd-symbol', true);
  
  const [copied, setCopied] = useState(false);

  const generatePassword = useCallback(() => {
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = '0123456789';
    const symbolChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    let charSet = '';
    if (includeUppercase) charSet += uppercaseChars;
    if (includeLowercase) charSet += lowercaseChars;
    if (includeNumbers) charSet += numberChars;
    if (includeSymbols) charSet += symbolChars;

    if (charSet === '') {
      setPassword('');
      return;
    }

    let generatedPassword = '';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);

    for (let i = 0; i < length; i++) {
      generatedPassword += charSet.charAt(array[i] % charSet.length);
    }

    setPassword(generatedPassword);
    setCopied(false);
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols, setPassword]);

  // Only generate on mount if empty, otherwise keep previous
  useEffect(() => {
    if (!password) {
      generatePassword();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyToClipboard = () => {
    if (!password) return;
    (navigator as any).clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full space-y-8">
      {/* Display Area */}
      <div className="relative group">
        <div className="w-full p-6 text-center bg-gray-50 border border-gray-200 rounded-xl text-3xl font-mono text-gray-800 break-all min-h-[100px] flex items-center justify-center">
           {password || <span className="text-gray-400 text-lg">请选择至少一种字符类型</span>}
        </div>
        <div className="absolute top-2 right-2 flex gap-2">
           <button 
             onClick={copyToClipboard}
             className="p-2 bg-white text-gray-500 rounded-lg shadow-sm border border-gray-200 hover:text-primary-600 hover:border-primary-200 transition-all"
             title="Copy"
           >
             {copied ? <Check size={20} className="text-green-500"/> : <Copy size={20} />}
           </button>
           <button 
             onClick={generatePassword}
             className="p-2 bg-white text-gray-500 rounded-lg shadow-sm border border-gray-200 hover:text-primary-600 hover:border-primary-200 transition-all"
             title="Regenerate"
           >
             <RefreshCw size={20} />
           </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-6">
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">密码长度: {length}</label>
          </div>
          <input
            type="range"
            min="4"
            max="64"
            value={length}
            onChange={(e) => setLength(parseInt((e.target as HTMLInputElement).value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>4</span>
            <span>32</span>
            <span>64</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeUppercase}
              onChange={(e) => setIncludeUppercase((e.target as HTMLInputElement).checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-gray-700">大写字母 (A-Z)</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeLowercase}
              onChange={(e) => setIncludeLowercase((e.target as HTMLInputElement).checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-gray-700">小写字母 (a-z)</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeNumbers}
              onChange={(e) => setIncludeNumbers((e.target as HTMLInputElement).checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-gray-700">数字 (0-9)</span>
          </label>
          <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includeSymbols}
              onChange={(e) => setIncludeSymbols((e.target as HTMLInputElement).checked)}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <span className="text-gray-700">特殊符号 (!@#$)</span>
          </label>
        </div>
        
        <button
            onClick={generatePassword}
            className="w-full py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-sm active:scale-[0.99] transform"
        >
            生成新密码
        </button>
      </div>
    </div>
  );
};

export default PasswordGenerator;