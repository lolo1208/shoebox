/// <reference lib="dom" />
import React, { useEffect, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileJson,
  FileType2,
  Minimize2,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import {
  isParseFailure,
  parseInput,
  smartJsonStringify,
  stringifyJson,
  stringifyJsonCompact,
  stringifyYaml,
  type FormatPreference,
  type ParseIssue,
  type ParsedDocument,
  type SortOrder,
} from '@/lib/text/jsonYaml';

/* ------------------------------------------------------------------ */
/* Tree renderer (shared by JSON and YAML)                             */
/* ------------------------------------------------------------------ */

interface JsonNodeProps {
  name?: string;
  value: unknown;
  isLast?: boolean;
  depth?: number;
  maxDepth?: number;
}

/**
 * Nodes deeper than `maxDepth` start collapsed, so a large document does not
 * create tens of thousands of DOM elements on first render.
 */
const JsonNode: React.FC<JsonNodeProps> = ({ name, value, isLast = true, depth = 0, maxDepth = 99 }) => {
  const [expanded, setExpanded] = useState(depth < maxDepth);

  const getType = (val: unknown) => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return 'array';
    if (val instanceof Date) return 'date';
    return typeof val;
  };

  const type = getType(value);
  const isObject = type === 'object' || type === 'array';
  const isEmpty = isObject && Object.keys(value as object).length === 0;

  const renderValue = (val: unknown, kind: string) => {
    if (val === null) return <span className="text-gray-400 font-bold">null</span>;
    if (kind === 'date') return <span className="text-green-600">"{new Date(val as Date).toISOString()}"</span>;
    if (kind === 'string') return <span className="text-green-600">"{String(val)}"</span>;
    if (kind === 'number') return <span className="text-blue-600">{String(val)}</span>;
    if (kind === 'boolean') return <span className="text-purple-600 font-bold">{String(val)}</span>;
    return <span>{String(val)}</span>;
  };

  if (isObject) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const isArray = Array.isArray(value);
    const bracketOpen = isArray ? '[' : '{';
    const bracketClose = isArray ? ']' : '}';

    return (
      <div className="font-mono text-sm leading-6">
        <div className="flex items-start hover:bg-gray-50 rounded px-1 -ml-1">
          <button
            onClick={() => !isEmpty && setExpanded(!expanded)}
            className={`mr-1 mt-1 text-gray-400 hover:text-gray-700 transition-colors ${isEmpty ? 'invisible' : ''}`}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

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

            {!expanded && (
              <span className="text-gray-500">
                {bracketClose}
                {!isLast && ','}
              </span>
            )}
          </div>
        </div>

        {expanded && !isEmpty && (
          <div style={{ paddingLeft: '1.5rem' }}>
            {keys.map((key, index) => (
              <JsonNode
                key={key}
                name={isArray ? undefined : key}
                value={record[key]}
                isLast={index === keys.length - 1}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ))}
          </div>
        )}

        {expanded && (
          <div className="pl-6 text-gray-500">
            {bracketClose}
            {!isLast && ','}
          </div>
        )}
      </div>
    );
  }

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

/* ------------------------------------------------------------------ */
/* Tool                                                                */
/* ------------------------------------------------------------------ */

const PREFERENCES: FormatPreference[] = ['auto', 'json', 'yaml'];

const JsonFormatter: React.FC = () => {
  const { t } = useLanguage();

  const [input, setInput] = useLocalStorage<string>('tool-json-input', '');
  const [indentSize, setIndentSize] = useLocalStorage<number>('tool-json-indent', 2);
  const [sortOrder, setSortOrder] = useLocalStorage<SortOrder>('tool-json-sort', 'none');
  const [preference, setPreference] = useLocalStorage<FormatPreference>('tool-json-pref', 'auto');
  const [treeDepth, setTreeDepth] = useLocalStorage<number>('tool-json-tree-depth', 2);

  const [doc, setDoc] = useState<ParsedDocument | null>(null);
  const [issue, setIssue] = useState<ParseIssue | null>(null);
  const [issueFormat, setIssueFormat] = useState<'json' | 'yaml' | null>(null);
  const { copy, isCopied } = useClipboard(2000);

  const hasInput = input.trim().length > 0;

  /* Live validation (debounced so typing stays smooth). */
  useEffect(() => {
    if (!hasInput) {
      setDoc(null);
      setIssue(null);
      return;
    }
    const timer = setTimeout(() => {
      const outcome = parseInput(input, preference);
      if (!isParseFailure(outcome)) {
        setDoc(outcome.document);
        setIssue(null);
        setIssueFormat(null);
      } else {
        setDoc(null);
        setIssue(outcome.issue);
        setIssueFormat(outcome.format);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [input, preference, hasInput]);

  /**
   * Actions parse the *current* text instead of the debounced `doc`, otherwise a
   * click within the debounce window would operate on stale data and overwrite
   * the user's fresh input.
   */
  const run = (transform: (data: unknown) => string) => {
    const outcome = parseInput(input, preference);
    if (isParseFailure(outcome)) {
      setDoc(null);
      setIssue(outcome.issue);
      setIssueFormat(outcome.format);
      return;
    }
    try {
      setInput(transform(outcome.document.data));
      setIssue(null);
    } catch (error) {
      setIssue({ message: (error as Error).message });
    }
  };

  const formatJson = () => run((data) => stringifyJson(data, indentSize, sortOrder));
  const smartFormat = () => run((data) => smartJsonStringify(data, indentSize, sortOrder));
  const minifyJson = () => run((data) => stringifyJsonCompact(data, sortOrder));
  const toYaml = () => run((data) => stringifyYaml(data, indentSize, sortOrder));

  const repairJson = () => {
    let fixed = input.trim();
    fixed = fixed.replace(/\/\/.*$/gm, '');
    fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
    fixed = fixed.replace(/,(\s*[\]}])/g, '$1');
    if (!fixed.includes('"') && fixed.includes("'")) {
      fixed = fixed.replace(/'/g, '"');
    }
    // Only rewrite the known booleans (a bare `f`/`t` shorthand is common in pasted JSON).
    fixed = fixed.replace(/:\s*(?:false|fals|f)\b/gi, ': false');
    fixed = fixed.replace(/:\s*(?:true|tru|t)\b/gi, ': true');

    const lines = fixed.split('\n');
    const fixedLines = lines.map((line) => {
      const quoteMatches = line.match(/(?<!\\)"/g);
      const count = quoteMatches ? quoteMatches.length : 0;
      if (count % 2 !== 0) {
        if (line.trim().endsWith(',')) {
          const index = line.lastIndexOf(',');
          return line.slice(0, index) + '"' + line.slice(index);
        }
        return line + '"';
      }
      return line;
    });
    fixed = fixedLines.join('\n');

    const stack: string[] = [];
    for (const char of fixed) {
      if (char === '{') stack.push('}');
      else if (char === '[') stack.push(']');
      else if (char === '}' || char === ']') {
        if (stack[stack.length - 1] === char) stack.pop();
      }
    }
    fixed += stack.reverse().join('');

    setInput(fixed);

    const outcome = parseInput(fixed, 'json');
    if (!isParseFailure(outcome)) {
      setDoc(outcome.document);
      setIssue(null);
      setIssueFormat(null);
    } else {
      setDoc(null);
      setIssue({ message: t('json.repair_fail') });
      setIssueFormat('json');
    }
  };


  const clear = () => {
    setInput('');
    setDoc(null);
    setIssue(null);
  };

  const effectiveFormat = doc?.format ?? issueFormat;
  const statusLabel = doc
    ? doc.format === 'yaml'
      ? t('json.status.valid_yaml')
      : t('json.status.valid_json')
    : null;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Input format */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-md px-2 py-1">
            <FileType2 size={14} className="text-gray-400" />
            <span className="text-[11px] text-gray-500">{t('json.pref.label')}</span>
            <div className="flex p-0.5 bg-gray-100 rounded">
              {PREFERENCES.map((item) => (
                <button
                  key={item}
                  onClick={() => setPreference(item)}
                  className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                    preference === item
                      ? 'bg-white text-primary-700 font-medium shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(`json.pref.${item}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="w-px h-6 bg-gray-300 hidden lg:block" />

          <button
            onClick={formatJson}
            disabled={!hasInput}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FileJson size={16} />
            {t('json.format')}
          </button>
          <button
            onClick={smartFormat}
            disabled={!hasInput}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles size={16} />
            {t('json.smart')}
          </button>
          <button
            onClick={minifyJson}
            disabled={!hasInput}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minimize2 size={16} />
            {t('json.minify')}
          </button>
          <button
            onClick={repairJson}
            disabled={!hasInput}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Wand2 size={16} />
            {t('json.repair')}
          </button>

          <div className="w-px h-6 bg-gray-300 hidden lg:block" />

          <button
            onClick={toYaml}
            disabled={!hasInput}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-md hover:bg-teal-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={15} />
            {t('json.to_yaml')}
          </button>

          <div className="flex-1" />

          <button
            onClick={() => void copy(input)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium"
          >
            {isCopied() ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
            {isCopied() ? t('common.copied') : t('common.copy')}
          </button>
          <button
            onClick={clear}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 text-red-600 rounded-md hover:bg-red-50 hover:border-red-200 transition-colors text-sm font-medium"
          >
            <Trash2 size={16} />
            {t('common.clear')}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Indent */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-md px-2 py-1">
            <Settings2 size={13} className="text-gray-400" />
            <select
              value={indentSize}
              onChange={(event) => setIndentSize(parseInt(event.target.value))}
              className="text-xs font-medium text-gray-600 bg-transparent border-none focus:ring-0 cursor-pointer"
            >
              <option value={2}>2 {t('json.indent')}</option>
              <option value={4}>4 {t('json.indent')}</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center bg-white border border-gray-200 rounded-md p-0.5">
            <button
              onClick={() => setSortOrder('none')}
              className={`p-1 rounded ${sortOrder === 'none' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              title={t('json.sort')}
            >
              <Settings2 size={14} />
            </button>
            <button
              onClick={() => setSortOrder('asc')}
              className={`p-1 rounded ${sortOrder === 'asc' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              title={t('json.sort_asc')}
            >
              <ArrowDownAZ size={14} />
            </button>
            <button
              onClick={() => setSortOrder('desc')}
              className={`p-1 rounded ${sortOrder === 'desc' ? 'bg-gray-100 text-gray-800' : 'text-gray-400 hover:text-gray-600'}`}
              title={t('json.sort_desc')}
            >
              <ArrowUpAZ size={14} />
            </button>
          </div>

          <div className="flex-1" />

          {/* Status */}
          {doc && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                <Check size={11} />
                {statusLabel}
              </span>
              {doc.format === 'yaml' && doc.documents > 1 && (
                <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                  {t('json.status.multi_doc', { n: doc.documents })}
                </span>
              )}
              <span className="text-gray-400">{t('json.char_count', { n: input.length })}</span>
            </div>
          )}
          {!doc && issue && !issue.empty && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100 font-medium text-[11px]">
              {issue.line
                ? t('json.status.error_at', { line: issue.line, column: issue.column ?? 0 })
                : t('json.status.error')}
            </span>
          )}
        </div>
      </div>

      {/* Split view */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
        {/* Input */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700">{t('json.input')}</label>
            {effectiveFormat && (
              <span className="text-[10px] font-mono uppercase tracking-wide text-gray-400">
                {effectiveFormat}
              </span>
            )}
          </div>
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('json.input_ph')}
              draggable={false}
              className={`w-full h-full p-4 font-mono text-sm bg-gray-50 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all text-gray-800 ${
                issue && !issue.empty
                  ? 'border-red-300 focus:border-red-400'
                  : 'border-gray-200 focus:border-primary-500'
              }`}
              spellCheck={false}
            />

            {issue && !issue.empty && (
              <div className="absolute bottom-4 left-4 right-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md shadow-sm">
                {issue.line ? (
                  <span className="font-medium mr-1">
                    {t('json.error_at', { line: issue.line, column: issue.column ?? 0 })}
                  </span>
                ) : null}
                {issue.message || t('json.invalid')}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-col justify-center text-gray-300">
          <ArrowRight size={24} />
        </div>

        {/* Tree */}
        <div className="flex-1 flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">{t('json.tree_view')}</label>
              {doc && (
                <span className="text-[10px] text-gray-400">
                  {doc.format === 'yaml' ? t('json.from_yaml') : t('json.from_json')}
                </span>
              )}
            </div>
            <select
              value={treeDepth}
              onChange={(event) => setTreeDepth(Number(event.target.value))}
              title={t('json.tree_depth')}
              className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-primary-300"
            >
              <option value={2}>{t('json.depth.2')}</option>
              <option value={3}>{t('json.depth.3')}</option>
              <option value={99}>{t('json.depth.all')}</option>
            </select>
          </div>
          <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 overflow-auto shadow-inner custom-scrollbar relative">
            {doc ? (
              <div className="min-w-fit">
                <JsonNode key={`tree-${treeDepth}`} value={doc.data} depth={0} maxDepth={treeDepth} />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                {issue && !issue.empty ? (
                  <>
                    <span className="text-red-400 font-medium">{t('json.invalid')}</span>
                    <button
                      onClick={repairJson}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium border border-amber-200 shadow-sm"
                    >
                      <Wand2 size={16} />
                      {t('json.try_repair')}
                    </button>
                  </>
                ) : (
                  <span>{t('common.waiting')}</span>
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
