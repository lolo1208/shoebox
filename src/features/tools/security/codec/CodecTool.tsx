import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Check, Copy, Download, Eraser, ShieldCheck, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useClipboard } from '@/hooks/useClipboard';
import { downloadBlob } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import {
  DEFAULT_CODEC_OPTIONS,
  runCodec,
  suggestCodec,
  type CodecDirection,
  type CodecFamily,
  type CodecInput,
  type CodecOptions as CodecOptionsValue,
} from '@/lib/codec';
import CodecOptions from './components/CodecOptions';
import CodecPanel from './components/CodecPanel';
import FileSourcePicker, { type PickedFile } from './components/FileSourcePicker';
import { CODEC_SAMPLES } from './samples';

const FAMILIES: CodecFamily[] = ['base64', 'base32', 'url'];
const DIRECTIONS: CodecDirection[] = ['encode', 'decode'];
const SOURCES = ['text', 'file'] as const;

type InputSource = (typeof SOURCES)[number];
type FileError = { key: 'too_large' | 'read_failed'; params: Record<string, string | number> };

/** 文件体积上限，避免把超大文件整读进内存 */
const MAX_FILE_SIZE = 32 * 1024 * 1024;
/** 结果预览上限，超出部分只影响渲染，不影响复制与下载 */
const PREVIEW_LIMIT = 120_000;
/** 未选文件时复用的空字节，保持 memo 依赖稳定 */
const EMPTY_BYTES = new Uint8Array(0);

const ICON_BUTTON =
  'inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded-lg text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-500';

/**
 * Base64 / Base32 / URL 编解码工具。
 * 计算逻辑全部在 `@/lib/codec`，本组件只负责状态、布局与文案。
 */
const CodecTool: React.FC = () => {
  const { t } = useLanguage();
  const [family, setFamily] = useLocalStorage<CodecFamily>('tool-codec-family', 'base64');
  const [direction, setDirection] = useLocalStorage<CodecDirection>('tool-codec-direction', 'encode');
  const [source, setSource] = useLocalStorage<InputSource>('tool-codec-source', 'text');
  const [storedOptions, setOptions] = useLocalStorage<CodecOptionsValue>('tool-codec-options', DEFAULT_CODEC_OPTIONS);
  const [input, setInput] = useLocalStorage<string>('tool-codec-input', '');

  // 文件内容只放在内存里：既避免 localStorage 配额问题，也符合“不上传”的定位
  const [file, setFile] = useState<(PickedFile & { bytes: Uint8Array }) | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<FileError | null>(null);
  // 自增令牌，用于丢弃“读取过程中被移除/替换”的过期结果
  const readToken = useRef(0);

  const { copy, isCopied } = useClipboard(1600);

  // 参数结构随版本演进，读取本地存储时补齐缺失字段
  const options = useMemo(() => ({ ...DEFAULT_CODEC_OPTIONS, ...storedOptions }), [storedOptions]);
  const fileMode = direction === 'encode' && family !== 'url' && source === 'file';

  // 大段输入时让文本域保持可输入，转换在低优先级渲染中完成
  const deferredInput = useDeferredValue(input);
  const pending = !fileMode && deferredInput !== input;

  const payload: CodecInput = fileMode ? file?.bytes ?? EMPTY_BYTES : deferredInput;
  const result = useMemo(() => runCodec(payload, family, direction, options), [payload, family, direction, options]);

  const suggestion = useMemo(
    () => (!fileMode && direction === 'decode' && deferredInput.trim() && deferredInput.length <= 10_000 ? suggestCodec(deferredInput) : null),
    [fileMode, direction, deferredInput],
  );

  const updateOptions = (patch: Partial<CodecOptionsValue>) => setOptions({ ...options, ...patch });

  /* ------------------------------- 文件读取 ------------------------------- */

  const handlePick = useCallback(async (picked: File) => {
    const token = ++readToken.current;
    setFileError(null);

    if (picked.size > MAX_FILE_SIZE) {
      setFile(null);
      setFileError({ key: 'too_large', params: { size: formatBytes(MAX_FILE_SIZE) } });
      return;
    }

    setReading(true);
    try {
      const buffer = await picked.arrayBuffer();
      if (readToken.current !== token) return;
      setFile({ name: picked.name, size: picked.size, bytes: new Uint8Array(buffer) });
    } catch {
      if (readToken.current !== token) return;
      setFile(null);
      setFileError({ key: 'read_failed', params: {} });
    } finally {
      if (readToken.current === token) setReading(false);
    }
  }, []);

  const clearFile = () => {
    readToken.current++;
    setReading(false);
    setFile(null);
    setFileError(null);
  };

  /* -------------------------------- 结果呈现 ------------------------------- */

  const truncated = result.output.length > PREVIEW_LIMIT;
  const preview = truncated ? result.output.slice(0, PREVIEW_LIMIT) : result.output;

  const errorText = result.error ? t(`codec.err.${result.error.code}`, result.error.params) : null;
  const noteTexts = result.notes.map((note) => t(`codec.note.${note.code}`, note.params));
  if (truncated) noteTexts.push(t('codec.note.truncated', { limit: PREVIEW_LIMIT }));

  const outputMeta = pending
    ? t('codec.pending')
    : result.ok && result.output
      ? direction === 'encode'
        ? t('codec.meta.chars', { n: result.outputBytes })
        : t('codec.meta.bytes', { n: result.outputBytes })
      : undefined;

  const canDownload = result.ok && !!result.output;
  const binaryResult = options.outputView === 'hex' || result.notes.some((note) => note.code === 'binary_hex');

  const handleDownload = () => {
    if (!canDownload) return;

    // 解码方向保存原始字节，编码方向保存编码后的文本
    if (direction === 'decode' && result.bytes) {
      const { buffer, byteOffset, byteLength } = result.bytes;
      // 拷贝出独立的 ArrayBuffer：字节视图可能只是更大缓冲区的一段
      const data = buffer.slice(byteOffset, byteOffset + byteLength) as ArrayBuffer;
      const type = binaryResult ? 'application/octet-stream' : 'text/plain;charset=utf-8';
      downloadBlob(new Blob([data], { type }), binaryResult ? 'decoded.bin' : 'decoded.txt');
      return;
    }

    downloadBlob(new Blob([result.output], { type: 'text/plain;charset=utf-8' }), 'encoded.txt');
  };

  /* -------------------------------- 交互动作 ------------------------------- */

  const handleSample = () => {
    if (source === 'file') setSource('text');
    setInput(CODEC_SAMPLES[family][direction]);
  };

  const handleClear = () => {
    // 文件模式下“清空”只移除文件，避免误删已输入的文本
    if (fileMode) clearFile();
    else setInput('');
  };

  /** 用结果继续计算：把输出搬到输入框并翻转方向 */
  const handleSwap = () => {
    if (!result.ok || !result.output) return;
    if (source === 'file') setSource('text');
    setInput(result.output);
    setDirection(direction === 'encode' ? 'decode' : 'encode');
  };

  const swapLabel = direction === 'encode' ? t('codec.swap.to_decode') : t('codec.swap.to_encode');
  const showSourceSwitch = direction === 'encode' && family !== 'url';
  const inputMeta = fileMode
    ? file
      ? t('codec.meta.bytes', { n: file.size })
      : undefined
    : t('codec.meta.chars', { n: input.length });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-4 animate-fade-in">
      {/* 编码族 / 方向 / 来源 / 参数 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-gray-100 rounded-lg">
            {FAMILIES.map((item) => (
              <button
                key={item}
                onClick={() => setFamily(item)}
                aria-pressed={family === item}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  family === item ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`codec.family.${item}`)}
              </button>
            ))}
          </div>

          <div className="flex p-1 bg-gray-100 rounded-lg">
            {DIRECTIONS.map((item) => (
              <button
                key={item}
                onClick={() => setDirection(item)}
                aria-pressed={direction === item}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  direction === item ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t(`codec.direction.${item}`)}
              </button>
            ))}
          </div>

          {showSourceSwitch && (
            <div className="flex p-1 bg-gray-100 rounded-lg">
              {SOURCES.map((item) => (
                <button
                  key={item}
                  onClick={() => setSource(item)}
                  aria-pressed={source === item}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    source === item ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t(`codec.source.${item}`)}
                </button>
              ))}
            </div>
          )}

          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-green-600">
            <ShieldCheck size={12} />
            {t('codec.local')}
          </span>
        </div>

        <CodecOptions
          family={family}
          direction={direction}
          options={options}
          byteInput={fileMode}
          onChange={updateOptions}
          onReset={() => setOptions(DEFAULT_CODEC_OPTIONS)}
        />
      </div>

      {/* 输入 / 输出 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CodecPanel
          title={t('codec.input_label')}
          label={t('codec.input_label')}
          meta={inputMeta}
          value={input}
          onChange={setInput}
          editable={!fileMode}
          body={
            fileMode ? (
              <FileSourcePicker
                file={file}
                reading={reading}
                errorText={fileError ? t(`codec.file_error.${fileError.key}`, fileError.params) : null}
                onPick={(picked) => void handlePick(picked)}
                onClear={clearFile}
              />
            ) : undefined
          }
          placeholder={
            direction === 'encode' && options.inputFormat === 'hex' && family !== 'url'
              ? t('codec.input_ph_hex')
              : t('codec.input_ph')
          }
          actions={
            <>
              {!fileMode && (
                <button onClick={handleSample} className={ICON_BUTTON}>
                  <Sparkles size={12} />
                  {t('codec.sample')}
                </button>
              )}
              <button
                onClick={handleClear}
                disabled={fileMode ? !file : !input}
                className={ICON_BUTTON}
              >
                <Eraser size={12} />
                {t('codec.clear')}
              </button>
            </>
          }
          footer={
            suggestion && suggestion !== family ? (
              <button
                onClick={() => setFamily(suggestion)}
                className="inline-flex items-center gap-1.5 text-[11px] text-primary-600 hover:text-primary-700"
              >
                <Sparkles size={12} />
                {t('codec.hint.suggest', { name: t(`codec.family.${suggestion}`) })}
              </button>
            ) : null
          }
        />

        <CodecPanel
          title={t('codec.output_label')}
          meta={outputMeta}
          value={preview}
          placeholder={t('codec.output_ph')}
          errorText={errorText}
          noteTexts={noteTexts}
          actions={
            <>
              <button
                onClick={() => void copy(result.output, 'output')}
                disabled={!result.ok || !result.output}
                className={ICON_BUTTON}
              >
                {isCopied('output') ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                {isCopied('output') ? t('common.copied') : t('common.copy')}
              </button>
              <button onClick={handleSwap} disabled={!result.ok || !result.output} className={ICON_BUTTON} title={swapLabel}>
                <ArrowRightLeft size={12} />
                {swapLabel}
              </button>
              <button onClick={handleDownload} disabled={!canDownload} className={ICON_BUTTON} title={t('codec.download_tip')}>
                <Download size={12} />
                {t('codec.download')}
              </button>
            </>
          }
        />
      </div>
    </div>
  );
};

export default CodecTool;
