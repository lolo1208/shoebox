/// <reference lib="dom" />
import React, { useState, useEffect } from 'react';
import { Copy, FileJson, Trash2, Minimize2, Check, Wand2, ChevronRight, ChevronDown, ArrowRight, Sparkles, ArrowDownAZ, ArrowUpAZ, AlignLeft, Settings2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// --- Recursive JSON Tree Viewer ---

interface JsonNodeProps {
  name?: string;
  value: any;
  isLast?: boolean;
  depth?: number;
}

const JsonNode: React.FC<JsonNodeProps> = ({ name, value, isLast = true, depth = 0 }) => {
  const [expanded, setExpanded] = useState(true);

  // Helper to determine type for coloring
  const getType = (val: any) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val;
  };

  const type = getType(value);
  const isObject = type === 'object' || type === 'array';
  const isEmpty = isObject && Object.keys(value).length === 0;

  // Indentation for nested levels
  const indent = depth * 1.5; 

  const renderValue = (val: any, type: string) => {
    if (val === null) return <span className="text-gray-400 font-bold">null</span>;
    if (type === 'string') return <span className="text-green-600">"{val}"</span>;
    if (type === 'number') return <span className="text-blue-600">{val}</span>;
    if (type === 'boolean') return <span className="text-purple-600 font-bold">{val.toString()}</span>;
    return <span>{String(val)}</span>;
  };

  if (isObject) {
    const keys = Object.keys(value);
    const isArray = Array.isArray(value);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    return (
      <div className="font-mono text-sm leading-6">
        <div className="flex items-start hover:bg-gray-50 rounded px-1 -ml-1">
          {/* Toggle Button */}
          <button 
            onClick={() => !isEmpty && setExpanded(!expanded)}
            className={`mr-1 mt-1 text-gray-400 hover:text-gray-700 transition-colors ${isEmpty ? 'invisible' : ''}`}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          
          {/* Key & Open Bracket */}
          <div className="flex-1 break-all">
            {name && <span className="text-gray-800 font-semibold">"{name}": </span>}
            <span className="text-gray-500">{bracketOpen}</span>
            
            {!expanded && (
               <button 
                  onClick={() => setExpanded(true)}
                  className="mx-1 text-gray-400 bg-gray-100 px-1 rounded text-xs hover:bg-gray-200"
               >
                  {isArray ? `Array(${keys.length})` : `Object{...}`}
               </button>
            )}

            {!expanded && <span className="text-gray-500">{bracketClose}{!isLast && ','}</span>}
          </div>
        </div>

        {/* Children */}
        {expanded && !isEmpty && (
           <div style={{ paddingLeft: '1.5rem' }}>
              {keys.map((key, index) => (
                <JsonNode 
                  key={key} 
                  name={isArray ? undefined : key} // Arrays don't show keys
                  value={value[key]} 
                  isLast={index === keys.length - 1} 
                  depth={depth + 1}
                />
              ))}
           </div>
        )}

        {/* Closing Bracket (Separate line if expanded) */}
        {expanded && (
           <div className="pl-6 text-gray-500">
              {bracketClose}{!isLast && ','}
           </div>
        )}
      </div>
    );
  }

  // Primitive Values
  return (
    <div className="font-mono text-sm leading-6 hover:bg-gray-50 rounded px-1 -ml-1 pl-7 flex break-all">
        <div>
            {name && <span className="text-gray-800 font-semibold mr-1">"{name}":</span>}
            {renderValue(value, type)}
            {!isLast && <span className="text-gray-500">,</span>}
        </div>
    </div>
  );
};

// --- Main Component ---

const JsonFormatter: React.FC = () => {
  const [input, setInput] = useLocalStorage<string>('tool-json-input', '');
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Settings
  const [indentSize, setIndentSize] = useLocalStorage<number>('tool-json-indent', 2);
  const [sortOrder, setSortOrder] = useLocalStorage<'none' | 'asc' | 'desc'>('tool-json-sort', 'none');

  // Auto-parse when input changes (with debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!input.trim()) {
        setParsedData(null);
        setError(null);
        return;
      }
      try {
        // Strip comments before parsing for the tree view only
        const cleanInput = input.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const parsed = JSON.parse(cleanInput);
        setParsedData(parsed);
        setError(null);
      } catch (e) {
        setParsedData(null);
        setError((e as Error).message);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [input]);

  // Helper: Sort Object Keys Recursive
  const sortObject = (obj: any, order: 'asc' | 'desc'): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) {
          return obj.map(item => sortObject(item, order));
      }
      const keys = Object.keys(obj);
      if (order === 'asc') keys.sort();
      if (order === 'desc') keys.sort().reverse();
      
      return keys.reduce((acc: any, key) => {
          acc[key] = sortObject(obj[key], order);
          return acc;
      }, {});
  };

  const getProcessedData = () => {
      if (!input.trim()) throw new Error("Input is empty");
      // Basic cleanup for parsing
      const cleanInput = input.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      let parsed = JSON.parse(cleanInput);
      
      if (sortOrder !== 'none') {
          parsed = sortObject(parsed, sortOrder);
      }
      return parsed;
  };

  const formatJson = () => {
    try {
      const parsed = getProcessedData();
      setInput(JSON.stringify(parsed, null, indentSize));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const minifyJson = () => {
    try {
      const parsed = getProcessedData();
      setInput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // --- Smart Format Logic ---
  const smartFormat = () => {
      try {
        const parsed = getProcessedData();
        const MAX_INLINE_LENGTH = 80;

        const stringifySmart = (node: any, level: number): string => {
            const indentStr = ' '.repeat(indentSize * level);
            const nextIndentStr = ' '.repeat(indentSize * (level + 1));
            
            // Try compact first
            const compact = JSON.stringify(node);
            if (compact.length <= MAX_INLINE_LENGTH) {
                return compact.replace(/:/g, ': '); // Add space after colon for readability
            }

            if (Array.isArray(node)) {
                const items = node.map(item => stringifySmart(item, level + 1));
                return `[\n${items.map(i => nextIndentStr + i).join(',\n')}\n${indentStr}]`;
            } else if (typeof node === 'object' && node !== null) {
                const keys = Object.keys(node);
                const items = keys.map(key => {
                    const valStr = stringifySmart(node[key], level + 1);
                    return `${nextIndentStr}"${key}": ${valStr}`;
                });
                return `{\n${items.join(',\n')}\n${indentStr}}`;
            }
            
            return JSON.stringify(node);
        };

        setInput(stringifySmart(parsed, 0));
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
  };

  const copyToClipboard = () => {
    (navigator as any).clipboard.writeText(input);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clear = () => {
    setInput('');
    setError(null);
    setParsedData(null);
  };

  // --- Auto Repair Logic ---
  const repairJson = () => {
      let fixed = input.trim();
      
      // 1. Remove comments (Single line // and Multi line /* */)
      fixed = fixed.replace(/\/\/.*$/gm, '');
      fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');

      // 2. Remove trailing commas
      fixed = fixed.replace(/,(\s*[\]}])/g, '$1');

      // 3. Replace single quotes with double quotes (basic heuristic)
      if (!fixed.includes('"') && fixed.includes("'")) {
          fixed = fixed.replace(/'/g, '"');
      }

      // 4. Fix truncated booleans (e.g., "key": fal -> "key": false)
      // Match ": [whitespace] f[any chars]" or ": [whitespace] t[any chars]" up to comma or end of line
      // Note: This is a heuristic and might be aggressive, but valid for this specific request.
      fixed = fixed.replace(/:\s*f[a-z]*/gi, ': false');
      fixed = fixed.replace(/:\s*t[a-z]*/gi, ': true');

      // 5. Fix missing closing quotes for strings
      // Strategy: Check lines. If a line has an odd number of " (and not escaped), append "
      // Also handles the user case: "key": "value (EOF) -> adds "
      const lines = fixed.split('\n');
      const fixedLines = lines.map(line => {
          // Count non-escaped quotes
          // Regex finds " that are NOT preceded by \
          const quoteMatches = line.match(/(?<!\\)"/g);
          const count = quoteMatches ? quoteMatches.length : 0;
          if (count % 2 !== 0) {
              // Odd number of quotes, likely missing the closing one
              // We append it before any trailing comma if exists, or at end
              if (line.trim().endsWith(',')) {
                  const idx = line.lastIndexOf(',');
                  return line.slice(0, idx) + '"' + line.slice(idx);
              }
              return line + '"';
          }
          return line;
      });
      fixed = fixedLines.join('\n');

      // 6. Balance Brackets/Braces (Stack based)
      const stack: string[] = [];
      const opens = ['{', '['];
      const closes = ['}', ']'];
      
      // Simple scan to find unclosed structures
      for (const char of fixed) {
          if (opens.includes(char)) {
              stack.push(char === '{' ? '}' : ']');
          } else if (closes.includes(char)) {
              // Try to pop matching
              const last = stack[stack.length - 1];
              if (last === char) {
                  stack.pop();
              }
          }
      }
      
      // Append missing closures in reverse order
      const closers = stack.reverse().join('');
      fixed += closers;

      setInput(fixed);
      
      // Try verify
      try {
          JSON.parse(fixed);
          setError(null); // Fixed!
      } catch(e) {
          setError("尝试修复后仍无法解析，请检查语法。");
      }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200">
        <div className="flex gap-2 items-center flex-wrap">
            <button
            onClick={formatJson}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm"
            >
            <FileJson size={16} />
            格式化
            </button>
            <button
            onClick={smartFormat}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors text-sm font-medium"
            title="智能格式化：短数组/对象保持在一行"
            >
            <Sparkles size={16} />
            智能美化
            </button>
            <button
            onClick={minifyJson}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
            >
            <Minimize2 size={16} />
            压缩
            </button>
            <button
            onClick={repairJson}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md hover:bg-amber-100 transition-colors text-sm font-medium"
            title="去除注释、补全引号、修复括号、移除多余逗号"
            >
            <Wand2 size={16} />
            自动纠错
            </button>
        </div>

        <div className="w-px h-6 bg-gray-300 hidden lg:block"></div>

        <div className="flex gap-2 items-center flex-wrap">
            {/* Indent Setting */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1">
                <AlignLeft size={14} className="text-gray-400" />
                <select 
                    value={indentSize} 
                    onChange={(e) => setIndentSize(parseInt((e.target as HTMLSelectElement).value))}
                    className="text-xs font-medium text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                    <option value={2}>2 空格</option>
                    <option value={4}>4 空格</option>
                </select>
            </div>

            {/* Sort Setting */}
            <div className="flex items-center bg-white border border-gray-200 rounded-md p-0.5">
                <button
                    onClick={() => setSortOrder('none')}
                    className={`p-1 rounded ${sortOrder === 'none' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                    title="不排序"
                >
                    <Settings2 size={14} />
                </button>
                <button
                    onClick={() => setSortOrder('asc')}
                    className={`p-1 rounded ${sortOrder === 'asc' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Key 升序 (A-Z)"
                >
                    <ArrowDownAZ size={14} />
                </button>
                <button
                    onClick={() => setSortOrder('desc')}
                    className={`p-1 rounded ${sortOrder === 'desc' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
                    title="Key 降序 (Z-A)"
                >
                    <ArrowUpAZ size={14} />
                </button>
            </div>
        </div>
        
        <div className="flex-1"></div>

        <div className="flex gap-2">
            <button
            onClick={copyToClipboard}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
            >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {copied ? '已复制' : '复制'}
            </button>
            <button
            onClick={clear}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-red-600 rounded-md hover:bg-red-50 hover:border-red-200 transition-colors text-sm font-medium"
            >
            <Trash2 size={16} />
            清空
            </button>
        </div>
      </div>

      {/* Main Split View */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
         {/* Left: Input */}
         <div className="flex-1 flex flex-col min-h-[300px]">
             <label className="text-sm font-medium text-gray-700 mb-2">输入 JSON</label>
             <div className="flex-1 relative">
                 <textarea
                    value={input}
                    onChange={(e) => setInput((e.target as HTMLTextAreaElement).value)}
                    placeholder='在此粘贴 JSON... (支持去除 // 注释)'
                    className={`
                        w-full h-full p-4 font-mono text-sm bg-gray-50 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all text-gray-800
                        ${error ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-primary-500'}
                    `}
                    spellCheck={false}
                 />
                 {error && (
                    <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md shadow-sm">
                        <strong>Syntax Error:</strong> {error}
                    </div>
                 )}
             </div>
         </div>

         {/* Middle Arrow (Visual only on large screens) */}
         <div className="hidden lg:flex flex-col justify-center text-gray-300">
             <ArrowRight size={24} />
         </div>

         {/* Right: Tree View */}
         <div className="flex-1 flex flex-col min-h-[300px]">
             <label className="text-sm font-medium text-gray-700 mb-2">树状预览</label>
             <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 overflow-auto shadow-inner custom-scrollbar relative">
                 {parsedData ? (
                     <div className="min-w-fit">
                        <JsonNode value={parsedData} />
                     </div>
                 ) : (
                     <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                         {error ? (
                             <>
                                <span className="text-red-400 font-medium">无法解析内容</span>
                                <button 
                                    onClick={repairJson}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium border border-amber-200 shadow-sm"
                                >
                                    <Wand2 size={16} />
                                    尝试自动纠错
                                </button>
                             </>
                         ) : (
                             <span>等待有效的 JSON 输入...</span>
                         )}
                     </div>
                 )}
             </div>
         </div>
      </div>
    </div>
  );
};

export default JsonFormatter;