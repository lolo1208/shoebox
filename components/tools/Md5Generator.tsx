/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Copy, Hash, Check, FileSearch, FileText, X, Loader2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import CryptoJS from 'crypto-js';

const Md5Generator: React.FC = () => {
  const [activeTab, setActiveTab] = useLocalStorage<'text' | 'file'>('tool-md5-tab', 'text');
  
  // Text State
  const [textInput, setTextInput] = useLocalStorage<string>('tool-md5-text', '');
  
  // File State
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  
  // Result State
  const [hash, setHash] = useState('');
  const [copied, setCopied] = useState(false);

  // Text Calculation
  useEffect(() => {
    if (activeTab === 'text') {
      if (textInput) {
        try {
          const calculated = CryptoJS.MD5(textInput).toString();
          setHash(calculated);
        } catch (e) {
          setHash("Error calculating hash");
        }
      } else {
        setHash('');
      }
    }
  }, [textInput, activeTab]);

  // File Calculation Logic
  const calculateFileMd5 = async (selectedFile: File) => {
    setIsCalculating(true);
    setProgress(0);
    setHash('');

    const chunkSize = 2 * 1024 * 1024; // 2MB chunks
    const chunks = Math.ceil(selectedFile.size / chunkSize);
    let currentChunk = 0;
    
    // Create incremental MD5 hasher
    const algo = CryptoJS.algo.MD5.create();
    const fileReader = new FileReader();

    fileReader.onerror = () => {
      setIsCalculating(false);
      setHash('Error reading file');
    };

    const readNextChunk = () => {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, selectedFile.size);
      const blob = selectedFile.slice(start, end);
      fileReader.readAsArrayBuffer(blob);
    };

    fileReader.onload = (e) => {
      if (!e.target?.result) return;
      
      const arrayBuffer = e.target.result as ArrayBuffer;
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      algo.update(wordArray);
      
      currentChunk++;
      const currentProgress = Math.min((currentChunk / chunks) * 100, 100);
      setProgress(currentProgress);

      if (currentChunk < chunks) {
        // Use setTimeout to allow UI updates (prevent freezing)
        setTimeout(readNextChunk, 0);
      } else {
        const finalHash = algo.finalize().toString();
        setHash(finalHash);
        setIsCalculating(false);
      }
    };

    readNextChunk();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      calculateFileMd5(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      calculateFileMd5(selectedFile);
    }
  };

  const copyToClipboard = () => {
    if (!hash) return;
    (navigator as any).clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetFile = () => {
    setFile(null);
    setHash('');
    setProgress(0);
  };

  return (
    <div className="w-full space-y-6">
      {/* Tab Switcher */}
      <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('text')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'text' 
              ? 'bg-white text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          文本 MD5
        </button>
        <button
          onClick={() => setActiveTab('file')}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
            activeTab === 'file' 
              ? 'bg-white text-primary-600 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          文件 MD5
        </button>
      </div>

      {activeTab === 'text' ? (
        <div className="space-y-2 animate-fade-in">
          <label className="block text-sm font-medium text-gray-700">输入文本</label>
          <textarea
            value={textInput}
            onChange={(e) => setTextInput((e.target as HTMLTextAreaElement).value)}
            placeholder="输入文本以计算 MD5..."
            className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all resize-none text-gray-800"
          />
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* Always render input to prevent file access errors */}
          <input 
            id="md5-file-upload" 
            type="file" 
            className="hidden" 
            onChange={handleFileSelect}
          />

          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer
                ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 group'}
              `}
              onClick={() => document.getElementById('md5-file-upload')?.click()}
            >
              <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                  <FileSearch size={32} />
              </div>
              <p className="text-xl font-bold text-gray-800 mb-2">选择文件</p>
              <p className="text-sm text-gray-500">支持任意文件格式，本地计算不上传</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary-50 text-primary-600 rounded-lg">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{file.name}</h3>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button 
                  onClick={resetFile}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              {isCalculating ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Calculating...</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary-500 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-3 py-1.5 rounded-lg w-fit">
                  <Check size={16} />
                  计算完成
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">MD5 结果 (32位小写)</label>
        <div className="relative">
          <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 break-all min-h-[56px] flex items-center">
            {hash ? (
               hash 
            ) : (
               <div className="flex items-center text-gray-400 italic gap-2">
                 {isCalculating ? <Loader2 className="animate-spin" size={16}/> : null}
                 {isCalculating ? '计算中...' : '等待输入...'}
               </div>
            )}
          </div>
          {hash && (
            <button
              onClick={copyToClipboard}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white text-gray-500 rounded-lg shadow-sm border border-gray-200 hover:text-primary-600 hover:border-primary-200 transition-all"
            >
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Md5Generator;