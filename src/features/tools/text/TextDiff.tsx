/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ChevronsUpDown,
  Columns2,
  Copy,
  Download,
  FileDiff,
  Rows3,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  diffKeys,
  diffLinesInline,
  diffTextSegments,
  toEntries,
  toUnifiedPatch,
  type DiffEntry,
  type DiffOp,
  type InlineSegment,
} from '@/lib/text/diff';

type Granularity = 'line' | 'word' | 'char';
type ViewMode = 'split' | 'unified';

interface Side {
  no: number | null;
  text: string;
  kind: 'equal' | 'delete' | 'insert' | 'blank';
  segs?: InlineSegment[];
}

interface Row {
  left: Side;
  right: Side;
}

interface UnifiedRow {
  oldNo: number | null;
  newNo: number | null;
  kind: DiffEntry['type'];
  text: string;
  segs?: InlineSegment[];
}

interface DiffState {
  ops: DiffOp[];
  entries: DiffEntry[];
  rows: Row[];
  unified: UnifiedRow[];
  segments: InlineSegment[];
  stats: { added: number; removed: number; same: number };
}

type DisplayItem<T> = { kind: 'row'; row: T } | { kind: 'gap'; key: string; rows: T[] };

const INLINE_RATIO_MIN = 0.3;
const INLINE_BUDGET = 400;
const MAX_RENDERED_ROWS = 8000;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_LINES = 100000;
const MAX_WORD_CHARS = 100000;
const MAX_CHAR_CHARS = 20000;
const MAX_INLINE_SEGMENTS = 20000;

/** Split on CRLF or LF so Windows and Unix files compare equal. */
const splitLines = (text: string): string[] => (text === '' ? [] : text.split(/\r?\n/));

function collapseRuns<T>(
  rows: T[],
  isEqual: (row: T) => boolean,
  context: number,
  enabled: boolean
): DisplayItem<T>[] {
  if (!enabled) return rows.map((row) => ({ kind: 'row', row }));

  const items: DisplayItem<T>[] = [];
  let i = 0;
  while (i < rows.length) {
    if (!isEqual(rows[i])) {
      items.push({ kind: 'row', row: rows[i] });
      i++;
      continue;
    }
    let j = i;
    while (j < rows.length && isEqual(rows[j])) j++;
    const len = j - i;
    if (len <= context * 2 + 1) {
      for (let k = i; k < j; k++) items.push({ kind: 'row', row: rows[k] });
    } else {
      for (let k = i; k < i + context; k++) items.push({ kind: 'row', row: rows[k] });
      items.push({ kind: 'gap', key: `gap-${i}`, rows: rows.slice(i + context, j - context) });
      for (let k = j - context; k < j; k++) items.push({ kind: 'row', row: rows[k] });
    }
    i = j;
  }
  return items;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${
            value === option.value
              ? 'bg-white text-primary-600 shadow-sm font-medium'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function Chip({ active, onClick, children }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
        active
          ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

const SAMPLE_A = `Hello Shoebox,
This is the original text.
It has three lines.
The diff tool runs fully in your browser.
Keep your data private!`;

const SAMPLE_B = `Hello Shoebox,
This is the modified text.
It has four lines now.
The diff tool runs fully offline in your browser.
Keep your data private!`;

const TextDiff: React.FC = () => {
  const { t } = useLanguage();

  const [left, setLeft] = useLocalStorage<string>('tool-diff-left', '');
  const [right, setRight] = useLocalStorage<string>('tool-diff-right', '');
  const [granularity, setGranularity] = useLocalStorage<Granularity>('tool-diff-granularity', 'line');
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('tool-diff-view', 'split');
  const [ignoreWhitespace, setIgnoreWhitespace] = useLocalStorage<boolean>('tool-diff-ignore-ws', false);
  const [ignoreCase, setIgnoreCase] = useLocalStorage<boolean>('tool-diff-ignore-case', false);
  const [inlineHighlight, setInlineHighlight] = useLocalStorage<boolean>('tool-diff-inline', true);
  const [collapseEqual, setCollapseEqual] = useLocalStorage<boolean>('tool-diff-collapse', false);
  const [contextLines, setContextLines] = useLocalStorage<number>('tool-diff-context', 3);

  const [state, setState] = useState<DiffState | null>(null);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const { copy, isCopied } = useClipboard(2000);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leftInputRef = useRef<HTMLInputElement>(null);
  const rightInputRef = useRef<HTMLInputElement>(null);

  const hasInput = left.length > 0 || right.length > 0;

  /* ---------------------------- diff computation --------------------------- */

  useEffect(() => {
    if (!hasInput) {
      setState(null);
      return;
    }

    const timer = setTimeout(() => {
      setError(null);
      const normalize = (line: string) => {
        let value = line;
        if (ignoreWhitespace) value = value.replace(/\s+/g, ' ').trim();
        if (ignoreCase) value = value.toLowerCase();
        return value;
      };

      if (granularity === 'line') {
        const aLines = splitLines(left);
        const bLines = splitLines(right);

        // Guard against freezing the tab on gigantic inputs.
        if (aLines.length + bLines.length > MAX_TOTAL_LINES) {
          setState(null);
          setError(t('diff.too_long_line', { n: MAX_TOTAL_LINES }));
          return;
        }

        const ops = diffKeys(aLines.map(normalize), bLines.map(normalize));
        const entries = toEntries(ops);

        // Group entries into equal / changed blocks once, then build only the
        // view that is actually on screen (halves the work and the inline diffs).
        type Block =
          | { kind: 'equal'; entry: DiffEntry }
          | { kind: 'change'; dels: DiffEntry[]; ins: DiffEntry[] };

        const blocks: Block[] = [];
        let cursor = 0;
        while (cursor < entries.length) {
          if (entries[cursor].type === 'equal') {
            blocks.push({ kind: 'equal', entry: entries[cursor] });
            cursor++;
            continue;
          }
          let runEnd = cursor;
          while (runEnd < entries.length && entries[runEnd].type !== 'equal') runEnd++;
          blocks.push({
            kind: 'change',
            dels: entries.slice(cursor, runEnd).filter((e) => e.type === 'delete'),
            ins: entries.slice(cursor, runEnd).filter((e) => e.type === 'insert'),
          });
          cursor = runEnd;
        }

        const rows: Row[] = [];
        const unified: UnifiedRow[] = [];
        let inlineBudget = INLINE_BUDGET;

        for (const block of blocks) {
          if (block.kind === 'equal') {
            const entry = block.entry;
            if (viewMode === 'split') {
              rows.push({
                left: { no: entry.aIdx + 1, text: aLines[entry.aIdx], kind: 'equal' },
                right: { no: entry.bIdx + 1, text: bLines[entry.bIdx], kind: 'equal' },
              });
            } else {
              unified.push({
                oldNo: entry.aIdx + 1,
                newNo: entry.bIdx + 1,
                kind: 'equal',
                text: aLines[entry.aIdx],
              });
            }
            continue;
          }

          const pairs = Math.min(block.dels.length, block.ins.length);
          const inline: { del?: InlineSegment[]; ins?: InlineSegment[] }[] = [];

          for (let k = 0; k < pairs; k++) {
            const del = block.dels[k];
            const add = block.ins[k];
            let leftSegs: InlineSegment[] | undefined;
            let rightSegs: InlineSegment[] | undefined;

            if (
              inlineHighlight &&
              inlineBudget > 0 &&
              aLines[del.aIdx].length + bLines[add.bIdx].length < 4000
            ) {
              inlineBudget--;
              const result = diffLinesInline(aLines[del.aIdx], bLines[add.bIdx]);
              if (result.ratio >= INLINE_RATIO_MIN) {
                leftSegs = result.left;
                rightSegs = result.right;
              }
            }
            inline.push({ del: leftSegs, ins: rightSegs });
          }

          if (viewMode === 'split') {
            const rowCount = Math.max(block.dels.length, block.ins.length);
            for (let k = 0; k < rowCount; k++) {
              const del = block.dels[k];
              const add = block.ins[k];
              rows.push({
                left: del
                  ? { no: del.aIdx + 1, text: aLines[del.aIdx], kind: 'delete', segs: inline[k]?.del }
                  : { no: null, text: '', kind: 'blank' },
                right: add
                  ? { no: add.bIdx + 1, text: bLines[add.bIdx], kind: 'insert', segs: inline[k]?.ins }
                  : { no: null, text: '', kind: 'blank' },
              });
            }
          } else {
            block.dels.forEach((del, k) =>
              unified.push({
                oldNo: del.aIdx + 1,
                newNo: null,
                kind: 'delete',
                text: aLines[del.aIdx],
                segs: inline[k]?.del,
              })
            );
            block.ins.forEach((add, k) =>
              unified.push({
                oldNo: null,
                newNo: add.bIdx + 1,
                kind: 'insert',
                text: bLines[add.bIdx],
                segs: inline[k]?.ins,
              })
            );
          }
        }

        setState({
          ops,
          entries,
          rows,
          unified,
          segments: [],
          stats: {
            added: countEntries(entries, 'insert'),
            removed: countEntries(entries, 'delete'),
            same: countEntries(entries, 'equal'),
          },
        });
      } else {
        const totalChars = left.length + right.length;
        const limit = granularity === 'word' ? MAX_WORD_CHARS : MAX_CHAR_CHARS;
        if (totalChars > limit) {
          setState(null);
          setError(t('diff.too_long_inline', { n: limit }));
          return;
        }

        const segments = diffTextSegments(left, right, granularity);
        const stats = { added: 0, removed: 0, same: 0 };
        for (const seg of segments) {
          if (seg.type === 'insert') stats.added += measure(seg.text, granularity);
          else if (seg.type === 'delete') stats.removed += measure(seg.text, granularity);
          else stats.same += measure(seg.text, granularity);
        }
        setState({
          ops: [],
          entries: [],
          rows: [],
          unified: [],
          segments,
          stats,
        });
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [left, right, granularity, ignoreWhitespace, ignoreCase, inlineHighlight, viewMode, hasInput]);

  useEffect(() => {
    setExpandedGaps(new Set());
  }, [left, right, granularity, collapseEqual, contextLines]);

  /* ------------------------------- handlers -------------------------------- */

  const handleFile = async (side: 'left' | 'right', file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError(t('diff.error_too_large'));
      return;
    }
    try {
      const text = await file.text();
      setError(null);
      if (side === 'left') setLeft(text);
      else setRight(text);
    } catch {
      setError(t('diff.error_read'));
    }
  };

  const handleDrop = (side: 'left' | 'right') => (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setDragging(null);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(side, file);
  };

  const swap = () => {
    const a = left;
    setLeft(right);
    setRight(a);
  };

  const loadSample = () => {
    setLeft(SAMPLE_A);
    setRight(SAMPLE_B);
  };

  /** Built on demand only — exporting is rare and O(n). */
  const buildPatch = (): string => {
    if (!state || granularity !== 'line') return '';
    return toUnifiedPatch(splitLines(left), splitLines(right), state.ops, {
      aLabel: t('diff.patch_a'),
      bLabel: t('diff.patch_b'),
      context: collapseEqual ? contextLines : 3,
    });
  };

  const copyPatch = async () => {
    if (!(await copy(buildPatch()))) setError(t('diff.error_copy'));
  };

  const downloadPatch = () => {
    const blob = new Blob([buildPatch()], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'diff.patch';
    link.click();
    URL.revokeObjectURL(url);
  };

  const toggleGap = (key: string) => {
    setExpandedGaps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* -------------------------------- rendering ------------------------------- */

  const splitItems = useMemo(
    () => (state ? collapseRuns(state.rows, isRowEqual, contextLines, collapseEqual) : []),
    [state, collapseEqual, contextLines]
  );
  const unifiedItems = useMemo(
    () => (state ? collapseRuns(state.unified, isUnifiedEqual, contextLines, collapseEqual) : []),
    [state, collapseEqual, contextLines]
  );

  const unitLabel =
    granularity === 'line' ? t('diff.unit.line') : granularity === 'word' ? t('diff.unit.word') : t('diff.unit.char');

  const renderSegments = (segs: InlineSegment[] | undefined, text: string, side: 'left' | 'right') => {
    if (!segs) return text === '' ? '\u00A0' : text;
    return segs.map((seg, index) => {
      if (seg.type === 'equal') return <span key={index}>{seg.text}</span>;
      const strong = side === 'left' ? 'delete' : 'insert';
      return (
        <span
          key={index}
          className={
            seg.type === strong
              ? side === 'left'
                ? 'bg-red-200/80 text-red-900 rounded-[2px]'
                : 'bg-green-200/80 text-green-900 rounded-[2px]'
              : 'opacity-60'
          }
        >
          {seg.text}
        </span>
      );
    });
  };

  const cellBg = (kind: Side['kind']) => {
    if (kind === 'delete') return 'bg-red-50';
    if (kind === 'insert') return 'bg-green-50';
    if (kind === 'blank') return 'bg-gray-50/70';
    return '';
  };

  const renderSplitRow = (row: Row, key: string) => (
    <div key={key} className="grid grid-cols-2 border-b border-gray-100/70">
      {(['left', 'right'] as const).map((side) => {
        const cell = row[side];
        return (
          <div
            key={side}
            className={`flex items-stretch min-w-0 ${cellBg(cell.kind)} ${side === 'right' ? 'border-l border-gray-100' : ''}`}
          >
            <span className="w-10 shrink-0 px-1 text-right text-[11px] leading-5 text-gray-300 select-none">
              {cell.no ?? ''}
            </span>
            <span className="flex-1 px-2 leading-5 text-gray-800 whitespace-pre-wrap break-all">
              {renderSegments(cell.segs, cell.text, side)}
            </span>
          </div>
        );
      })}
    </div>
  );

  const gapBar = (item: { key: string; rows: unknown[] }, expanded = false) => (
    <button
      key={`${item.key}-${expanded ? 'open' : 'closed'}`}
      onClick={() => toggleGap(item.key)}
      className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-primary-600 bg-primary-50/60 hover:bg-primary-50 border-b border-primary-100 transition-colors"
    >
      <ChevronsUpDown size={12} />
      {expanded ? t('diff.collapse_n', { n: item.rows.length }) : t('diff.expand', { n: item.rows.length })}
    </button>
  );

  const renderUnifiedRow = (row: UnifiedRow, key: string) => {
    const bg = row.kind === 'delete' ? 'bg-red-50' : row.kind === 'insert' ? 'bg-green-50' : '';
    const marker = row.kind === 'delete' ? '-' : row.kind === 'insert' ? '+' : ' ';
    const markerColor =
      row.kind === 'delete' ? 'text-red-500' : row.kind === 'insert' ? 'text-green-600' : 'text-gray-300';
    return (
      <div key={key} className={`flex items-stretch border-b border-gray-100/70 ${bg}`}>
        <span className="w-9 shrink-0 pr-1 text-right text-[11px] leading-5 text-gray-300 select-none">
          {row.oldNo ?? ''}
        </span>
        <span className="w-9 shrink-0 pr-1.5 text-right text-[11px] leading-5 text-gray-300 border-r border-gray-100 select-none">
          {row.newNo ?? ''}
        </span>
        <span className={`w-4 shrink-0 text-center leading-5 select-none ${markerColor}`}>{marker}</span>
        <span className="flex-1 px-1 leading-5 text-gray-800 whitespace-pre-wrap break-all">
          {renderSegments(row.segs, row.text, row.kind === 'delete' ? 'left' : 'right')}
        </span>
      </div>
    );
  };

  const renderLineDiff = () => {
    if (!state) return null;

    if (viewMode === 'split') {
      const tooMany = splitItems.length > MAX_RENDERED_ROWS;
      const items = tooMany ? splitItems.slice(0, MAX_RENDERED_ROWS) : splitItems;
      return (
        <>
          {tooMany && (
            <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
              {t('diff.truncated', { n: MAX_RENDERED_ROWS })}
            </div>
          )}
          <div className="grid grid-cols-2 sticky top-0 z-10 bg-gray-50 border-b border-gray-200 text-[11px] font-medium text-gray-500">
            <div className="px-3 py-1.5 text-left">{t('diff.original')}</div>
            <div className="px-3 py-1.5 text-left border-l border-gray-200">{t('diff.modified')}</div>
          </div>
          {items.flatMap((item, index) => {
            if (item.kind === 'row') return renderSplitRow(item.row, `r-${index}`);
            if (expandedGaps.has(item.key))
              return [
                gapBar(item, true),
                ...item.rows.map((row, k) => renderSplitRow(row, `${item.key}-${k}`)),
              ];
            return gapBar(item, false);
          })}
        </>
      );
    }

    const tooMany = unifiedItems.length > MAX_RENDERED_ROWS;
    const items = tooMany ? unifiedItems.slice(0, MAX_RENDERED_ROWS) : unifiedItems;
    return (
      <>
        {tooMany && (
          <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
            {t('diff.truncated', { n: MAX_RENDERED_ROWS })}
          </div>
        )}
        <div className="flex sticky top-0 z-10 bg-gray-50 border-b border-gray-200 text-[11px] font-medium text-gray-500">
          <span className="w-9 shrink-0 text-right pr-1">{t('diff.old')}</span>
          <span className="w-9 shrink-0 text-right pr-1.5">{t('diff.new')}</span>
          <span className="px-1 py-1.5">{t('diff.unified')}</span>
        </div>
        {items.flatMap((item, index) => {
          if (item.kind === 'row') return renderUnifiedRow(item.row, `u-${index}`);
          if (expandedGaps.has(item.key))
            return [
              gapBar(item, true),
              ...item.rows.map((row, k) => renderUnifiedRow(row, `${item.key}-${k}`)),
            ];
          return gapBar(item, false);
        })}
      </>
    );
  };

  const renderTextDiff = () => {
    if (!state) return null;
    const truncated = state.segments.length > MAX_INLINE_SEGMENTS;
    const segments = truncated ? state.segments.slice(0, MAX_INLINE_SEGMENTS) : state.segments;
    return (
      <>
        {truncated && (
          <div className="px-4 py-2 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
            {t('diff.segments_truncated', { n: MAX_INLINE_SEGMENTS })}
          </div>
        )}
        <div className="p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words text-gray-800">
          {segments.map((seg, index) => {
          if (seg.type === 'equal') return <span key={index}>{seg.text}</span>;
          if (seg.type === 'delete')
            return (
              <span key={index} className="bg-red-100 text-red-700 line-through decoration-red-400">
                {seg.text}
              </span>
            );
          return (
            <span key={index} className="bg-green-100 text-green-800 font-medium">
              {seg.text}
            </span>
          );
        })}
        </div>
      </>
    );
  };

  /* ---------------------------------- JSX ---------------------------------- */

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{t('diff.mode')}</span>
            <Segmented<Granularity>
              value={granularity}
              onChange={(value) => setGranularity(value)}
              options={[
                { value: 'line', label: t('diff.mode.line') },
                { value: 'word', label: t('diff.mode.word') },
                { value: 'char', label: t('diff.mode.char') },
              ]}
            />
          </div>

          {granularity === 'line' && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500">{t('diff.view')}</span>
              <Segmented<ViewMode>
                value={viewMode}
                onChange={(value) => setViewMode(value)}
                options={[
                  { value: 'split', label: t('diff.view.split'), icon: <Columns2 size={12} /> },
                  { value: 'unified', label: t('diff.view.unified'), icon: <Rows3 size={12} /> },
                ]}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <Chip active={ignoreWhitespace} onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}>
              {t('diff.opt.whitespace')}
            </Chip>
            <Chip active={ignoreCase} onClick={() => setIgnoreCase(!ignoreCase)}>
              {t('diff.opt.case')}
            </Chip>
            {granularity === 'line' && (
              <Chip active={inlineHighlight} onClick={() => setInlineHighlight(!inlineHighlight)}>
                {t('diff.opt.inline')}
              </Chip>
            )}
            {granularity === 'line' && (
              <Chip active={collapseEqual} onClick={() => setCollapseEqual(!collapseEqual)}>
                {t('diff.opt.collapse')}
              </Chip>
            )}
            {granularity === 'line' && collapseEqual && (
              <select
                value={contextLines}
                onChange={(event) => setContextLines(parseInt(event.target.value))}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:border-primary-300"
              >
                {[1, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {t('diff.opt.context', { n })}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['left', 'right'] as const).map((side) => {
          const value = side === 'left' ? left : right;
          const setValue = side === 'left' ? setLeft : setRight;
          const inputRef = side === 'left' ? leftInputRef : rightInputRef;
          const lines = value === '' ? 0 : value.split('\n').length;

          return (
            <div
              key={side}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-gray-800">
                    {side === 'left' ? t('diff.original') : t('diff.modified')}
                  </span>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {t('diff.line_count', { n: lines })} · {t('diff.char_count', { n: value.length })}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {side === 'right' && (
                    <button
                      onClick={swap}
                      title={t('diff.swap')}
                      className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      <ArrowLeftRight size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => inputRef.current?.click()}
                    title={t('diff.upload')}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Upload size={15} />
                  </button>
                  <button
                    onClick={() => setValue('')}
                    title={t('common.clear')}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".txt,.text,.md,.markdown,.json,.jsonc,.yaml,.yml,.xml,.csv,.log,.tsv,.ts,.tsx,.js,.jsx,.css,.scss,.html,.htm,.sql,.ini,.conf,.env,.diff,.patch,.gitignore,text/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleFile(side, file);
                      event.target.value = '';
                    }}
                  />
                </div>
              </div>

              <div className="relative">
                <textarea
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(side);
                  }}
                  onDragLeave={() => setDragging(null)}
                  onDrop={handleDrop(side)}
                  placeholder={t('diff.placeholder')}
                  spellCheck={false}
                  className="w-full h-56 p-3 font-mono text-xs leading-5 text-gray-800 bg-white resize-y focus:outline-none placeholder:text-gray-300"
                />
                {dragging === side && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary-50/80 border-2 border-dashed border-primary-300 rounded-b-2xl text-sm font-medium text-primary-600 pointer-events-none">
                    {t('diff.drop_hint')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Status line */}
      {error && (
        <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl">{error}</div>
      )}

      {!hasInput && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
          <FileDiff size={40} className="mx-auto text-gray-200" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-gray-500">{t('diff.empty')}</p>
          <button
            onClick={loadSample}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 border border-primary-100 rounded-lg hover:bg-primary-100 transition-colors"
          >
            <Wand2 size={13} />
            {t('diff.sample')}
          </button>
        </div>
      )}

      {/* Result */}
      {hasInput && state && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {state.stats.added === 0 && state.stats.removed === 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100 font-medium">
                  <Check size={12} />
                  {t('diff.identical')}
                </span>
              ) : (
                <>
                  <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 border border-green-100 font-medium">
                    +{state.stats.added} {unitLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-red-50 text-red-600 border border-red-100 font-medium">
                    -{state.stats.removed} {unitLabel}
                  </span>
                  <span className="text-gray-400">
                    {t('diff.same', { n: state.stats.same, unit: unitLabel })}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadSample}
                title={t('diff.sample')}
                className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white rounded-lg transition-colors"
              >
                <Sparkles size={15} />
              </button>
              <button
                onClick={copyPatch}
                disabled={granularity !== 'line'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCopied() ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                {t('diff.copy_patch')}
              </button>
              <button
                onClick={downloadPatch}
                disabled={granularity !== 'line'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={14} />
                {t('diff.download_patch')}
              </button>
            </div>
          </div>

          <div className="max-h-[65vh] overflow-auto font-mono text-xs">
            {granularity === 'line' ? renderLineDiff() : renderTextDiff()}
          </div>
        </div>
      )}
    </div>
  );
};

function countEntries(entries: DiffEntry[], type: DiffEntry['type']): number {
  let total = 0;
  for (const entry of entries) if (entry.type === type) total++;
  return total;
}

const isRowEqual = (row: Row) => row.left.kind === 'equal' && row.right.kind === 'equal';
const isUnifiedEqual = (row: UnifiedRow) => row.kind === 'equal';

function measure(text: string, granularity: Exclude<Granularity, 'line'>): number {
  if (granularity === 'char') return Array.from(text).length;
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

export default TextDiff;
