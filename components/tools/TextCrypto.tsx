
import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Copy, Check, Shield, AlertCircle } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import CryptoJS from 'crypto-js';
import { useLanguage } from '../../contexts/LanguageContext';

type CryptoAlgo = 'AES' | 'DES' | 'TripleDES' | 'Rabbit' | 'RC4';

const TextCrypto: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useLocalStorage<'encrypt' | 'decrypt'>('tool-crypto-tab', 'encrypt');
  const [algo, setAlgo] = useLocalStorage<CryptoAlgo>('tool-crypto-algo', 'AES');
  const [key, setKey] = useLocalStorage<string>('tool-crypto-key', '');
  
  // Separate states for encrypt and decrypt
  const [encryptInput, setEncryptInput] = useState('');
  const [decryptInput, setDecryptInput] = useState('');
  const [encryptOutput, setEncryptOutput] = useState('');
  const [decryptOutput, setDecryptOutput] = useState('');
  const [encryptError, setEncryptError] = useState('');
  const [decryptError, setDecryptError] = useState('');
  
  const [copied, setCopied] = useState(false);

  const inputText = activeTab === 'encrypt' ? encryptInput : decryptInput;
  const setInputText = activeTab === 'encrypt' ? setEncryptInput : setDecryptInput;
  const outputText = activeTab === 'encrypt' ? encryptOutput : decryptOutput;
  const setOutputText = activeTab === 'encrypt' ? setEncryptOutput : setDecryptOutput;
  const error = activeTab === 'encrypt' ? encryptError : decryptError;
  const setError = activeTab === 'encrypt' ? setEncryptError : setDecryptError;

  // Clear output when inputs change (optional, but keep it consistent with previous logic, maybe just for the current mode)
  useEffect(() => {
    setOutputText('');
    setError('');
  }, [algo, key, inputText]);

  const handleProcess = () => {
    if (!inputText || !key) return;
    setError('');
    
    try {
      let result = '';
      if (activeTab === 'encrypt') {
        const encrypted = CryptoJS[algo].encrypt(inputText, key);
        result = encrypted.toString();
      } else {
        const decrypted = CryptoJS[algo].decrypt(inputText, key);
        const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedText && inputText) {
          throw new Error('Decryption resulted in empty string');
        }
        result = decryptedText;
      }
      setOutputText(result);
    } catch (e) {
      console.error('Crypto error:', e);
      setError(t('crypto.error_decrypt'));
      setOutputText('');
    }
  };

  const copyToClipboard = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const algos: CryptoAlgo[] = ['AES', 'DES', 'TripleDES', 'Rabbit', 'RC4'];

  const inputLabel = activeTab === 'encrypt' ? t('crypto.input_encrypt_label') : t('crypto.input_decrypt_label');
  const inputPlaceholder = activeTab === 'encrypt' ? t('crypto.input_encrypt_ph') : t('crypto.input_decrypt_ph');
  const outputLabel = activeTab === 'encrypt' ? t('crypto.output_encrypt_label') : t('crypto.output_decrypt_label');

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Settings Column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Mode Switcher */}
          <div className="flex p-1 bg-gray-100 rounded-xl w-full">
            <button
              onClick={() => setActiveTab('encrypt')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'encrypt' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Lock size={16} />
              {t('crypto.mode_encrypt')}
            </button>
            <button
              onClick={() => setActiveTab('decrypt')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'decrypt' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Unlock size={16} />
              {t('crypto.mode_decrypt')}
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Shield size={14} className="text-primary-500" />
                {t('crypto.algo')}
              </label>
              <select
                value={algo}
                onChange={(e) => setAlgo(e.target.value as CryptoAlgo)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm appearance-none"
              >
                {algos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">{t('crypto.key')}</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t('crypto.key_ph')}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm"
              />
            </div>

            <button
              onClick={handleProcess}
              disabled={!inputText || !key}
              className={`w-full py-5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 shadow-md ${
                activeTab === 'encrypt'
                  ? 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-gray-300'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-gray-300'
              }`}
            >
              {activeTab === 'encrypt' ? <Lock size={18} /> : <Unlock size={18} />}
              {activeTab === 'encrypt' ? t('crypto.encrypt_btn') : t('crypto.decrypt_btn')}
            </button>
          </div>
        </div>

        {/* Text Area Column */}
        <div className="lg:col-span-2 flex flex-col h-full gap-4">
          {/* Input Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <label className="text-sm font-medium text-gray-700 font-mono flex justify-between mb-2">
              <span>{inputLabel}</span>
              <span className="text-xs text-gray-400 font-normal">{inputText.length} chars</span>
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={inputPlaceholder}
              className="flex-1 w-full min-h-[150px] p-4 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm resize-none shadow-sm"
            />
          </div>

          {/* Result Area */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 font-mono">{outputLabel}</label>
              {outputText && (
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              )}
            </div>
            
            <div className="flex-1 relative group min-h-[150px]">
              <div className={`absolute inset-0 p-4 font-mono text-sm break-all rounded-2xl border transition-all overflow-auto ${
                error 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : outputText 
                    ? 'bg-gray-50 border-gray-200 text-gray-800' 
                    : 'bg-gray-50/50 border-gray-100 border-dashed text-gray-300 flex items-center justify-center italic'
              }`}>
                {error ? (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                ) : outputText ? (
                  outputText
                ) : (
                  t('common.waiting')
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextCrypto;
