/// <reference lib="dom" />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Check,
  ClipboardPaste,
  Copy,
  Delete,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import {
  BASE_META,
  BASE_ORDER,
  BIT_WIDTHS,
  OP_SYMBOL,
  bitCount,
  byteSwap,
  compute,
  DivideByZeroError,
  formatForCopy,
  formatValue,
  parseValue,
  rotate,
  toSigned,
  wrap,
  type Base,
  type BinaryOp,
  type BitWidth,
} from '@/lib/math/programmerCalc';

const KEYPAD_ROWS: string[][] = [
  ['A', 'B', 'C', 'D'],
  ['E', 'F', 'AC', '\u232b'],
  ['7', '8', '9', '\u00f7'],
  ['4', '5', '6', '\u00d7'],
  ['1', '2', '3', '\u2212'],
  ['0', '\u00b1', '+', '='],
];

const BASE_KEYS: Record<Base, number> = {
  hex: 16,
  dec: 10,
  oct: 8,
  bin: 2,
};

const ProgrammerCalculator: React.FC = () => {
  const { t } = useLanguage();

  const [bits, setBits] = useState<BitWidth>(32);
  const [signed, setSigned] = useState(false);
  const [base, setBase] = useState<Base>('hex');

  const [value, setValue] = useState<bigint>(0n);
  const [accumulator, setAccumulator] = useState<bigint | null>(null);
  const [pending, setPending] = useState<BinaryOp | null>(null);
  const [fresh, setFresh] = useState(true);
  const [lastExpression, setLastExpression] = useState('');
  const [error, setError] = useState('');
  const { copy, isCopied } = useClipboard(1500);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => containerRef.current?.focus({ preventScroll: true }), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const radix = BASE_KEYS[base];

  const fmt = (input: bigint, targetBase: Base = base) => formatValue(input, targetBase, bits, signed);

  let expression = lastExpression;
  if (pending !== null && accumulator !== null) {
    const head = `${fmt(accumulator)} ${OP_SYMBOL[pending]}`;
    expression = fresh ? head : `${head} ${fmt(value)}`;
  }

  const changeBits = (next: BitWidth) => {
    setBits(next);
    setValue((prev) => wrap(prev, next));
    setAccumulator((prev) => (prev === null ? null : wrap(prev, next)));
    setError('');
  };

  const changeBase = (next: Base) => {
    setBase(next);
    setError('');
  };

  const inputDigit = (digit: string) => {
    const numeric = BigInt(parseInt(digit, 16));
    setValue((prev) => (fresh ? wrap(numeric, bits) : wrap(prev * BigInt(radix) + numeric, bits)));
    setFresh(false);
    setLastExpression('');
    setError('');
  };

  const pressBackspace = () => {
    if (fresh) return;
    setValue((prev) => wrap(prev / BigInt(radix), bits));
    setFresh(false);
    setLastExpression('');
    setError('');
  };

  const pressClear = () => {
    setValue(0n);
    setAccumulator(null);
    setPending(null);
    setFresh(true);
    setLastExpression('');
    setError('');
  };

  const pressNegate = () => {
    setValue((prev) => wrap(-prev, bits));
    setFresh(true);
    setLastExpression('');
    setError('');
  };

  const pressNot = () => {
    setValue((prev) => wrap(~prev, bits));
    setFresh(true);
    setLastExpression('');
    setError('');
  };

  const pressBinary = (op: BinaryOp) => {
    setError('');
    setLastExpression('');
    const operand = value;

    if (pending !== null && accumulator !== null) {
      if (fresh) {
        setPending(op);
        return;
      }
      try {
        const result = compute(accumulator, pending, operand, bits, signed);
        setValue(result);
        setAccumulator(result);
        setPending(op);
        setFresh(true);
      } catch (err) {
        if (err instanceof DivideByZeroError) setError(t('pcalc.div_zero'));
        setAccumulator(null);
        setPending(null);
        setFresh(true);
      }
      return;
    }

    setAccumulator(operand);
    setPending(op);
    setFresh(true);
  };

  const pressEquals = () => {
    if (pending === null || accumulator === null) return;
    try {
      const result = compute(accumulator, pending, value, bits, signed);
      setLastExpression(`${fmt(accumulator)} ${OP_SYMBOL[pending]} ${fmt(value)} =`);
      setValue(result);
      setAccumulator(null);
      setPending(null);
      setFresh(true);
      setError('');
    } catch (err) {
      if (err instanceof DivideByZeroError) setError(t('pcalc.div_zero'));
      setAccumulator(null);
      setPending(null);
      setFresh(true);
    }
  };

  const toggleBit = (index: number) => {
    setValue((prev) => wrap(prev ^ (1n << BigInt(index)), bits));
    setFresh(true);
    setLastExpression('');
    setError('');
  };

  const applyQuick = (fn: (input: bigint) => bigint) => {
    setValue((prev) => fn(prev));
    setFresh(true);
    setLastExpression('');
    setError('');
  };

  const pasteValue = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return;
      const negative = text.startsWith('-');
      const body = text.replace(/^[+-]\s*/, '');
      const lower = body.toLowerCase();
      const detectedBase: Base = lower.startsWith('0x')
        ? 'hex'
        : lower.startsWith('0o')
          ? 'oct'
          : lower.startsWith('0b')
            ? 'bin'
            : base;
      const parsed = parseValue(body, detectedBase);
      if (parsed === null) {
        setError(t('pcalc.invalid_value'));
        return;
      }
      setValue(wrap(negative ? -parsed : parsed, bits));
      setFresh(true);
      setLastExpression('');
      setError('');
    } catch {
      setError(t('pcalc.paste_failed'));
    }
  };

  const copyText = async (key: string, text: string) => {
    if (!(await copy(text, key))) setError(t('pcalc.copy_failed'));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key;

    if ((event.ctrlKey || event.metaKey) && !event.altKey && key.toLowerCase() === 'c') {
      event.preventDefault();
      void copyText('display', formatForCopy(value, base, bits, signed));
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (/^[0-9]$/.test(key)) {
      if (Number(key) < radix) {
        event.preventDefault();
        inputDigit(key);
      }
      return;
    }
    if (base === 'hex' && /^[a-fA-F]$/.test(key)) {
      event.preventDefault();
      inputDigit(key.toUpperCase());
      return;
    }

    const binaryKeys: Record<string, BinaryOp> = {
      '+': 'add',
      '-': 'sub',
      '*': 'mul',
      '/': 'div',
      '%': 'mod',
      '&': 'and',
      '|': 'or',
      '^': 'xor',
      '<': 'shl',
      '>': 'shr',
    };

    if (binaryKeys[key]) {
      event.preventDefault();
      pressBinary(binaryKeys[key]);
      return;
    }

    switch (key) {
      case '~':
        event.preventDefault();
        pressNot();
        break;
      case '=':
      case 'Enter':
        event.preventDefault();
        pressEquals();
        break;
      case 'Backspace':
        event.preventDefault();
        pressBackspace();
        break;
      case 'Escape':
        event.preventDefault();
        pressClear();
        break;
      default:
        break;
    }
  };

  const nibbleGroups = useMemo(
    () => Array.from({ length: bits / 4 }, (_, index) => bits / 4 - 1 - index),
    [bits]
  );

  const conversionRows = BASE_ORDER.map((itemBase) => ({
    base: itemBase,
    display: formatValue(value, itemBase, bits, signed),
    copy: formatForCopy(value, itemBase, bits, signed),
  }));

  const signedValue = toSigned(value, bits);
  const unsignedValue = wrap(value, bits);
  const setBitTotal = bitCount(value, bits);
  const activeMeta = BASE_META[base];

  const keyClass =
    'h-11 rounded-xl text-sm font-medium border transition-all active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed select-none';

  return (
    <div
      ref={containerRef}
      className="space-y-4 animate-fade-in rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={t('tool.pcalc.name')}
    >
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase mr-1">{t('pcalc.base')}</span>
          {BASE_ORDER.map((item) => (
            <button
              key={item}
              data-testid={`pcalc-base-${item}`}
              onClick={() => changeBase(item)}
              aria-pressed={base === item}
              className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-all ${
                base === item
                  ? 'bg-primary-50 border-primary-300 text-primary-700 font-semibold'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {BASE_META[item].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-wide text-gray-400 uppercase mr-1">{t('pcalc.width')}</span>
          {BIT_WIDTHS.map((width) => (
            <button
              key={width}
              data-testid={`pcalc-width-${width}`}
              onClick={() => changeBits(width)}
              aria-pressed={bits === width}
              className={`px-3 py-1.5 text-xs rounded-lg border font-mono transition-all ${
                bits === width
                  ? 'bg-primary-50 border-primary-300 text-primary-700 font-semibold'
                  : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {width}
            </button>
          ))}
          <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden ml-1">
            <button
              onClick={() => {
                setSigned(false);
                setError('');
              }}
              aria-pressed={!signed}
              className={`px-3 py-1.5 text-xs transition-colors ${
                !signed ? 'bg-primary-50 text-primary-700 font-semibold' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t('pcalc.unsigned')}
            </button>
            <button
              onClick={() => {
                setSigned(true);
                setError('');
              }}
              aria-pressed={signed}
              className={`px-3 py-1.5 text-xs transition-colors border-l border-gray-200 ${
                signed ? 'bg-primary-50 text-primary-700 font-semibold' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t('pcalc.signed')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] items-start">
        {/* Calculator */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="rounded-2xl bg-gray-900 px-4 py-4">
            <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-gray-400">
              <span>
                {activeMeta.label} · {t('pcalc.bits_unit', { n: bits })}
              </span>
              <div className="flex items-center gap-2">
                {isCopied('display') ? (
                  <span className="flex items-center gap-1 text-primary-300 normal-case">
                    <Check size={12} />
                    {t('common.copied')}
                  </span>
                ) : (
                  <span className="text-primary-300">{signed ? t('pcalc.signed') : t('pcalc.unsigned')}</span>
                )}
                <button
                  onClick={pasteValue}
                  title={t('pcalc.paste_hint')}
                  aria-label={t('pcalc.paste_hint')}
                  className="p-1 -mr-1 rounded-md text-gray-500 hover:text-primary-300 hover:bg-white/10 transition-colors"
                >
                  <ClipboardPaste size={14} />
                </button>
              </div>
            </div>
            <div className="mt-1 h-5 text-xs font-mono text-primary-300 truncate" title={expression || undefined}>{expression || '\u00a0'}</div>
            <div
              className={`font-mono leading-tight text-white break-all select-all ${
                base === 'bin' ? 'text-base sm:text-xl' : 'text-2xl sm:text-[28px]'
              }`}
              data-testid="pcalc-display"
              aria-live="polite"
            >
              {fmt(value)}
            </div>
            {error ? (
              <div className="mt-1 text-xs text-red-400">{error}</div>
            ) : (
              <div className="mt-1 text-[11px] text-gray-500 font-mono">
                {t('pcalc.bits_set', { n: setBitTotal })}
              </div>
            )}
          </div>

          {/* Bitwise operators */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(
              [
                ['and', 'AND'],
                ['or', 'OR'],
                ['xor', 'XOR'],
              ] as [BinaryOp, string][]
            ).map(([op, label]) => (
              <button
                key={op}
                onClick={() => pressBinary(op)}
                className={`${keyClass} bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={pressNot}
              className={`${keyClass} bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100`}
              title={t('pcalc.not_hint')}
            >
              NOT
            </button>
            <button
              onClick={() => pressBinary('shl')}
              className={`${keyClass} bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100`}
              title={t('pcalc.shl_hint')}
            >
              {'<<'}
            </button>
            <button
              onClick={() => pressBinary('shr')}
              className={`${keyClass} bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100`}
              title={t('pcalc.shr_hint')}
            >
              {'>>'}
            </button>
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-4 gap-2" data-testid="pcalc-keypad">
            {KEYPAD_ROWS.flatMap((row) =>
              row.map((key) => {
                if (key === 'AC') {
                  return (
                    <button
                      key={key}
                      onClick={pressClear}
                      className={`${keyClass} bg-red-50 border-red-100 text-red-500 hover:bg-red-100 font-mono`}
                    >
                      AC
                    </button>
                  );
                }
                if (key === '\u232b') {
                  return (
                    <button
                      key={key}
                      onClick={pressBackspace}
                      className={`${keyClass} bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 flex items-center justify-center`}
                      title={t('pcalc.backspace')}
                    >
                      <Delete size={16} />
                    </button>
                  );
                }
                if (key === '\u00b1') {
                  return (
                    <button
                      key={key}
                      onClick={pressNegate}
                      className={`${keyClass} bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100`}
                      title={t('pcalc.negate_hint')}
                    >
                      &plusmn;
                    </button>
                  );
                }
                if (key === '=') {
                  return (
                    <button
                      key={key}
                      onClick={pressEquals}
                      className={`${keyClass} bg-primary-600 border-primary-600 text-white hover:bg-primary-500 font-mono text-lg`}
                    >
                      =
                    </button>
                  );
                }
                if (['\u00f7', '\u00d7', '\u2212', '+'].includes(key)) {
                  const op: BinaryOp =
                    key === '\u00f7' ? 'div' : key === '\u00d7' ? 'mul' : key === '\u2212' ? 'sub' : 'add';
                  return (
                    <button
                      key={key}
                      onClick={() => pressBinary(op)}
                      className={`${keyClass} bg-primary-50 border-primary-100 text-primary-700 hover:bg-primary-100 font-mono text-base`}
                    >
                      {key}
                    </button>
                  );
                }

                const isHexLetter = /^[A-F]$/.test(key);
                const disabled = isHexLetter ? base !== 'hex' : parseInt(key, 10) >= radix;
                return (
                  <button
                    key={key}
                    onClick={() => inputDigit(key)}
                    disabled={disabled}
                    title={isHexLetter && disabled ? t('pcalc.hex_only') : undefined}
                    className={`${keyClass} ${
                      disabled
                        ? 'bg-white border-gray-100 text-gray-300'
                        : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                    } font-mono`}
                  >
                    {key}
                  </button>
                );
              })
            )}
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">{t('pcalc.keyboard')}</p>
        </div>

        {/* Conversions + info */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{t('pcalc.conversions')}</h3>
              <button
                onClick={() => copyText('all', conversionRows.map((row) => row.copy).join('\n'))}
                className="text-[11px] text-gray-400 hover:text-primary-600 transition-colors flex items-center gap-1"
              >
                {isCopied('all') ? <Check size={12} /> : <Copy size={12} />}
                {isCopied('all') ? t('common.copied') : t('pcalc.copy_all')}
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {conversionRows.map((row) => {
                const active = row.base === base;
                return (
                  <div
                    key={row.base}
                    className={`group flex items-center gap-3 px-4 py-3 transition-colors ${
                      active ? 'bg-primary-50/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <button
                      onClick={() => changeBase(row.base)}
                      className={`w-12 shrink-0 text-left text-[11px] font-mono font-semibold ${
                        active ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                      title={t('pcalc.use_base')}
                    >
                      {BASE_META[row.base].label}
                    </button>
                    <button
                      onClick={() => changeBase(row.base)}
                      data-testid={`pcalc-conv-${row.base}`}
                      title={t('pcalc.use_base')}
                      className="min-w-0 flex-1 text-left font-mono text-sm text-gray-800 break-all leading-relaxed"
                    >
                      {row.display}
                    </button>
                    <button
                      onClick={() => copyText(row.base, row.copy)}
                      className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-primary-600 hover:bg-white transition-colors"
                      title={isCopied(row.base) ? t('common.copied') : t('common.copy')}
                      aria-label={isCopied(row.base) ? t('common.copied') : t('common.copy')}
                    >
                      {isCopied(row.base) ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-gray-100 grid grid-cols-3 gap-2">
              <button
                onClick={() => applyQuick((prev) => byteSwap(prev, bits))}
                disabled={bits === 8}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
              >
                <ArrowLeftRight size={13} />
                {t('pcalc.byte_swap')}
              </button>
              <button
                onClick={() => applyQuick((prev) => rotate(prev, bits, 1))}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RotateCw size={13} />
                {t('pcalc.rotate_left')}
              </button>
              <button
                onClick={() => applyQuick((prev) => rotate(prev, bits, -1))}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={13} />
                {t('pcalc.rotate_right')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">{t('pcalc.info')}</h3>
            <dl className="space-y-2 text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t('pcalc.unsigned_value')}</dt>
                <dd className="font-mono text-gray-800 break-all text-right">{unsignedValue.toString(10)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t('pcalc.signed_value')}</dt>
                <dd className="font-mono text-gray-800 break-all text-right">{signedValue.toString(10)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t('pcalc.bits_set_label')}</dt>
                <dd className="font-mono text-gray-800 text-right">
                  {setBitTotal} / {bits}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-gray-400 shrink-0">{t('pcalc.bytes')}</dt>
                <dd className="font-mono text-gray-800 text-right">{bits / 8}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Bit grid */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800">{t('pcalc.bits_title')}</h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary-600" />1
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-200" />0
            </span>
            <span className="hidden sm:inline">{t('pcalc.bits_subtitle')}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {nibbleGroups
            .reduce<number[][]>((acc, nibble, index) => {
              if (index % 2 === 0) acc.push([nibble]);
              else acc[acc.length - 1].push(nibble);
              return acc;
            }, [])
            .map((pair, byteIndex) => (
              <div
                key={`byte-${byteIndex}`}
                className="flex gap-1 rounded-xl bg-gray-50 border border-gray-100 p-1"
              >
                {pair.map((nibble) => {
                  const nibbleValue = Number((value >> BigInt(nibble * 4)) & 0xfn);
                  return (
                    <div
                      key={nibble}
                      className="flex flex-col items-center gap-0.5"
                      title={`bit ${nibble * 4 + 3} \u2013 ${nibble * 4}`}
                    >
                      <div className="flex gap-1">
                        {[3, 2, 1, 0].map((offset) => {
                          const bitIndex = nibble * 4 + offset;
                          const isSet = ((value >> BigInt(bitIndex)) & 1n) === 1n;
                          return (
                            <button
                              key={bitIndex}
                              onClick={() => toggleBit(bitIndex)}
                              aria-pressed={isSet}
                              aria-label={`bit ${bitIndex} ${isSet ? '1' : '0'}`}
                              title={`bit ${bitIndex}`}
                              className={`w-5 h-7 sm:w-6 sm:h-8 rounded-md font-mono text-[10px] sm:text-[11px] border transition-colors ${
                                isSet
                                  ? 'bg-primary-600 border-primary-600 text-white hover:bg-primary-500'
                                  : 'bg-white border-gray-200 text-gray-300 hover:border-primary-200 hover:text-primary-400'
                              }`}
                            >
                              {isSet ? '1' : '0'}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-gray-300 font-mono">{nibbleValue.toString(16).toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ProgrammerCalculator;
