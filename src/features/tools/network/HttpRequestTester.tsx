/// <reference lib="dom" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Eye,
  Globe,
  History,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Server,
  ShieldAlert,
  Sparkles,
  Terminal,
  Trash2,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import CopyButton from '@/components/ui/CopyButton';
import {
  buildCurl,
  composeUrl,
  createKeyValue,
  DEFAULT_DRAFT,
  formatBytes,
  formatDuration,
  hasSensitiveHeader,
  HTTP_METHODS,
  HttpRequestError,
  isJsonContentType,
  isProbeMethodSupported,
  parseParams,
  prepareRequest,
  prettyJson,
  sendDirect,
  sendProbe,
  splitUrl,
  statusLabel,
  type AuthType,
  type BodyType,
  type HttpDraft,
  type HttpMethod,
  type HttpResult,
  type KeyValue,
  type PreparedRequest,
  type SendMode,
} from '@/lib/network/httpRequest';

type RequestTab = 'params' | 'headers' | 'body' | 'auth' | 'options';
type ResponseTab = 'body' | 'headers' | 'timeline';

const EXAMPLES = [
  { label: 'httpbin GET', url: 'https://httpbin.org/get', method: 'GET' as HttpMethod },
  { label: 'httpbin POST', url: 'https://httpbin.org/post', method: 'POST' as HttpMethod },
  { label: 'GitHub API', url: 'https://api.github.com/repos/facebook/react', method: 'GET' as HttpMethod },
  { label: 'JSONPlaceholder', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET' as HttpMethod },
];

const HISTORY_KEY = 'shoebox-http-history';
const HISTORY_LIMIT = 10;
/** 超大响应体的渲染上限，避免长文本把页面卡死 */
const MAX_DISPLAY_BODY = 200000;

const METHOD_STYLE: Record<string, string> = {
  GET: 'text-green-700 bg-green-50 border-green-200',
  POST: 'text-amber-700 bg-amber-50 border-amber-200',
  PUT: 'text-blue-700 bg-blue-50 border-blue-200',
  PATCH: 'text-violet-700 bg-violet-50 border-violet-200',
  DELETE: 'text-red-700 bg-red-50 border-red-200',
  HEAD: 'text-gray-600 bg-gray-50 border-gray-200',
  OPTIONS: 'text-gray-600 bg-gray-50 border-gray-200',
};

const statusTone = (status: number) => {
  if (status === 0) return 'gray';
  if (status >= 500) return 'red';
  if (status >= 400) return 'amber';
  if (status >= 300) return 'blue';
  if (status >= 200) return 'green';
  return 'gray';
};

const TONE_STYLE: Record<string, string> = {
  green: 'bg-green-50 text-green-700 border-green-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
};

const ERROR_KEYS: Record<string, string> = {
  invalid: 'http_req.err_invalid',
  timeout: 'http_req.err_timeout',
  cors: 'http_req.err_cors',
  network: 'http_req.err_network',
  'probe-failed': 'http_req.err_probe',
  'probe-unsupported': 'http_req.err_probe_unsupported',
  'probe-timeout': 'http_req.err_probe_timeout',
  'rate-limit': 'http_req.err_rate_limit',
};

const inputClass =
  'w-full px-2.5 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-lg text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all';

const KeyValueEditor: React.FC<{
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}> = ({ rows, onChange, keyPlaceholder, valuePlaceholder }) => {
  const { t } = useLanguage();

  const update = (id: string, patch: Partial<KeyValue>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const remove = (id: string) => {
    const next = rows.filter((row) => row.id !== id);
    onChange(next.length > 0 ? next : [createKeyValue()]);
  };

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(event) => update(row.id, { enabled: event.target.checked })}
            className="w-4 h-4 shrink-0 accent-primary-600 cursor-pointer"
            title={t('http_req.enabled')}
          />
          <input
            value={row.key}
            onChange={(event) => update(row.id, { key: event.target.value })}
            placeholder={keyPlaceholder}
            spellCheck={false}
            className={`${inputClass} w-[34%]`}
          />
          <input
            value={row.value}
            onChange={(event) => update(row.id, { value: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && index === rows.length - 1) {
                onChange([...rows, createKeyValue()]);
              }
            }}
            placeholder={valuePlaceholder}
            spellCheck={false}
            className={`${inputClass} flex-1 min-w-0`}
          />
          <button
            onClick={() => remove(row.id)}
            className="p-1.5 text-gray-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors shrink-0"
            title={t('http_req.remove')}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, createKeyValue()])}
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 px-1.5 py-1 rounded-md hover:bg-primary-50 transition-colors"
      >
        <Plus size={13} />
        {t('http_req.add')}
      </button>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({
  active,
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
      active
        ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
        : 'bg-white border-transparent text-gray-500 hover:bg-gray-50'
    }`}
  >
    {children}
  </button>
);

const TimelineRow: React.FC<{ label: string; value?: number; total: number; tone?: string }> = ({
  label,
  value,
  total,
  tone = 'bg-primary-400',
}) => {
  const percent = total > 0 && value && value > 0 ? Math.max(2, Math.min(100, (value / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-gray-500">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right font-mono text-[11px] text-gray-600">
        {value === undefined ? '—' : `${Math.round(value)} ms`}
      </span>
    </div>
  );
};

const HttpRequestTester: React.FC = () => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<HttpDraft>({
    ...DEFAULT_DRAFT,
    headers: [createKeyValue()],
    formFields: [createKeyValue()],
  });
  const [requestTab, setRequestTab] = useState<RequestTab>('params');
  const [responseTab, setResponseTab] = useState<ResponseTab>('body');
  const [bodyView, setBodyView] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [loading, setLoading] = useState<SendMode | null>(null);
  const [result, setResult] = useState<HttpResult | null>(null);
  const [error, setError] = useState<{ code: string; detail?: string } | null>(null);
  const [history, setHistory] = useLocalStorage<HttpDraft[]>(HISTORY_KEY, []);
  const [showHistory, setShowHistory] = useState(false);
  const [showCurl, setShowCurl] = useState(false);
  const imageUrlRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      abortRef.current?.abort();
    },
    []
  );

  const patch = useCallback((partial: Partial<HttpDraft>) => {
    setDraft((prev) => ({ ...prev, ...partial }));
  }, []);

  /** URL 输入框是单一真相源：改写 URL 时同步解析出参数行 */
  const handleUrlChange = (value: string) => {
    const { query } = splitUrl(value);
    patch({ url: value, params: parseParams(query) });
  };

  /** 参数行被编辑时回写 URL */
  const handleParamsChange = (rows: KeyValue[]) => {
    patch({ params: rows, url: composeUrl(draft.url, rows) });
  };

  const prepared = useMemo<PreparedRequest | null>(() => {
    try {
      return prepareRequest(draft);
    } catch {
      return null;
    }
  }, [draft]);

  const send = async (mode: SendMode) => {
    if (loading) return;
    setError(null);

    let request: PreparedRequest;
    try {
      request = prepareRequest(draft);
    } catch (err: any) {
      setError({ code: err instanceof HttpRequestError ? err.code : 'invalid', detail: err?.detail });
      return;
    }

    setLoading(mode);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const data =
        mode === 'probe'
          ? await sendProbe(request, controller.signal)
          : await sendDirect(request, controller.signal);

      if (abortRef.current !== controller) return;

      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = data.imageUrl;

      setResult(data);
      setResponseTab('body');
      const hasBody = !!data.body || !!data.imageUrl;
      setBodyView(
        !hasBody
          ? 'raw'
          : data.imageUrl || (data.contentType && /html/i.test(data.contentType))
            ? 'preview'
            : prettyJson(data.body)
              ? 'pretty'
              : 'raw'
      );
      setHistory((prev) => {
        const rest = prev.filter((item) => !(item.method === draft.method && item.url === draft.url));
        return [draft, ...rest].slice(0, HISTORY_LIMIT);
      });
    } catch (err: any) {
      if (abortRef.current !== controller) return;
      // 用户主动取消：保留上一次响应，不弹错误
      if (err?.code !== 'aborted') {
        setResult(null);
        setError({ code: err?.code || 'network', detail: err?.detail });
      }
    } finally {
      if (abortRef.current === controller) {
        setLoading(null);
        abortRef.current = null;
      }
    }
  };

  const prettyBody = useMemo(
    () => (result && result.body.length <= MAX_DISPLAY_BODY ? prettyJson(result.body) : null),
    [result]
  );
  const displayBody = useMemo(() => {
    if (!result) return '';
    return result.body.length > MAX_DISPLAY_BODY ? result.body.slice(0, MAX_DISPLAY_BODY) : result.body;
  }, [result]);
  const bodyClipped = !!result && result.body.length > MAX_DISPLAY_BODY;
  const curl = useMemo(() => (prepared ? buildCurl(prepared) : ''), [prepared]);
  const sensitive = prepared ? hasSensitiveHeader(prepared) : false;
  const isHtml = !!result?.contentType && /html/i.test(result.contentType);
  const isImage = !!result?.imageUrl;
  const hasBody = !!result && (!!result.body || !!result.imageUrl);

  const downloadBody = () => {
    if (!result) return;
    const name = (() => {
      try {
        const base = new URL(result.url).pathname.split('/').filter(Boolean).pop() || 'response';
        return base.includes('.') ? base : `${base}.txt`;
      } catch {
        return 'response.txt';
      }
    })();

    // 图片响应直接从 Blob URL 下载，文本响应重新打包
    const href = result.imageUrl || URL.createObjectURL(new Blob([result.body], { type: result.contentType || 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = name;
    anchor.click();
    setTimeout(() => {
      if (!result.imageUrl) URL.revokeObjectURL(href);
    }, 1000);
  };

  const activeHeaderCount = draft.headers.filter((row) => row.enabled && row.key.trim()).length;
  const activeParamCount = draft.params.filter((row) => row.enabled && row.key.trim()).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-4 animate-fade-in">
      {/* 请求栏 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative shrink-0">
            <select
              value={draft.method}
              onChange={(event) => patch({ method: event.target.value as HttpMethod })}
              className={`appearance-none cursor-pointer pl-3 pr-8 py-3 rounded-xl border text-xs font-bold font-mono w-full sm:w-[104px] focus:outline-none focus:ring-2 focus:ring-primary-100 ${METHOD_STYLE[draft.method]}`}
            >
              {HTTP_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 opacity-60" />
          </div>

          <div className="relative flex-1">
            <input
              value={draft.url}
              onChange={(event) => handleUrlChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') send('direct');
              }}
              placeholder={t('http_req.url_ph')}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full pl-3 pr-9 py-3 text-sm font-mono bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all"
            />
            {draft.url && (
              <button
                onClick={() => handleUrlChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={() => send('direct')}
            disabled={!!loading || !draft.url.trim()}
            className="px-5 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-[0.99] disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md transition-all shrink-0"
          >
            {loading === 'direct' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {loading === 'direct' ? t('http_req.sending') : t('http_req.send')}
          </button>

          <button
            onClick={() => send('probe')}
            disabled={!!loading || !draft.url.trim() || !isProbeMethodSupported(draft.method)}
            className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium flex items-center justify-center gap-2 hover:border-primary-200 hover:text-primary-600 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
            title={isProbeMethodSupported(draft.method) ? t('http_req.probe_tip') : t('http_req.probe_unsupported_tip')}
          >
            {loading === 'probe' ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
            <span className="hidden sm:inline">{t('http_req.probe')}</span>
          </button>

          {loading && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="px-4 py-3 rounded-xl border border-red-100 bg-red-50/60 text-red-600 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-50 transition-all shrink-0"
            >
              <X size={16} />
              <span className="hidden sm:inline">{t('http_req.cancel')}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          <span>{t('http_req.try')}</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              onClick={() => {
                patch({ url: example.url, method: example.method, params: [] });
                setRequestTab('params');
              }}
              className="px-2 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all"
            >
              {example.label}
            </button>
          ))}
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-all"
          >
            <History size={12} />
            {t('http_req.history')}
            <ChevronDown size={12} className={`transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showHistory && (
          <div className="border-t border-gray-100 pt-2 space-y-1">
            {history.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">{t('http_req.history_empty')}</p>
            ) : (
              <>
                {history.map((item, index) => (
                  <div key={`${item.method}-${item.url}-${index}`} className="flex items-center gap-2 group">
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[10px] font-bold font-mono shrink-0 ${
                        METHOD_STYLE[item.method] || METHOD_STYLE.GET
                      }`}
                    >
                      {item.method}
                    </span>
                    <button
                      onClick={() => {
                        setDraft({ ...DEFAULT_DRAFT, ...item });
                        setShowHistory(false);
                      }}
                      className="min-w-0 flex-1 text-left text-xs font-mono text-gray-600 truncate hover:text-primary-600 transition-colors"
                      title={item.url}
                    >
                      {item.url}
                    </button>
                    <button
                      onClick={() => setHistory((prev) => prev.filter((_, i) => i !== index))}
                      className="p-1 text-gray-200 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setHistory([])}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors pt-1"
                >
                  {t('http_req.history_clear')}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* 请求配置 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
          <TabButton active={requestTab === 'params'} onClick={() => setRequestTab('params')}>
            {t('http_req.tab_params')}
            {activeParamCount > 0 && <span className="ml-1 opacity-60">{activeParamCount}</span>}
          </TabButton>
          <TabButton active={requestTab === 'headers'} onClick={() => setRequestTab('headers')}>
            {t('http_req.tab_headers')}
            {activeHeaderCount > 0 && <span className="ml-1 opacity-60">{activeHeaderCount}</span>}
          </TabButton>
          <TabButton active={requestTab === 'body'} onClick={() => setRequestTab('body')}>
            {t('http_req.tab_body')}
            {draft.bodyType !== 'none' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-500 inline-block align-middle" />}
          </TabButton>
          <TabButton active={requestTab === 'auth'} onClick={() => setRequestTab('auth')}>
            {t('http_req.tab_auth')}
            {draft.authType !== 'none' && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary-500 inline-block align-middle" />}
          </TabButton>
          <TabButton active={requestTab === 'options'} onClick={() => setRequestTab('options')}>
            {t('http_req.tab_options')}
          </TabButton>
        </div>

        <div className="p-4">
          {requestTab === 'params' && (
            <KeyValueEditor
              rows={draft.params}
              onChange={handleParamsChange}
              keyPlaceholder={t('http_req.param_key')}
              valuePlaceholder={t('http_req.param_value')}
            />
          )}

          {requestTab === 'headers' && (
            <div className="space-y-3">
              <KeyValueEditor
                rows={draft.headers}
                onChange={(rows) => patch({ headers: rows })}
                keyPlaceholder={t('http_req.header_key')}
                valuePlaceholder={t('http_req.header_value')}
              />
              <p className="text-[11px] text-gray-400">{t('http_req.headers_note')}</p>
            </div>
          )}

          {requestTab === 'body' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(['none', 'json', 'form', 'text'] as BodyType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => patch({ bodyType: type })}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                      draft.bodyType === type
                        ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {t(`http_req.body_${type}`)}
                  </button>
                ))}
              </div>

              {draft.bodyType === 'none' && <p className="text-xs text-gray-400 py-4">{t('http_req.body_none_note')}</p>}

              {draft.bodyType === 'form' && (
                <KeyValueEditor
                  rows={draft.formFields}
                  onChange={(rows) => patch({ formFields: rows })}
                  keyPlaceholder={t('http_req.param_key')}
                  valuePlaceholder={t('http_req.param_value')}
                />
              )}

              {(draft.bodyType === 'json' || draft.bodyType === 'text') && (
                <>
                  <textarea
                    value={draft.bodyText}
                    onChange={(event) => patch({ bodyText: event.target.value })}
                    placeholder={draft.bodyType === 'json' ? '{\n  "name": "value"\n}' : t('http_req.body_ph')}
                    spellCheck={false}
                    className="w-full h-40 px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all resize-y"
                  />
                  {draft.bodyType === 'json' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const pretty = prettyJson(draft.bodyText);
                          if (pretty) patch({ bodyText: pretty });
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all"
                      >
                        <Sparkles size={13} />
                        {t('http_req.json_format')}
                      </button>
                      {draft.bodyText.trim() &&
                        (prettyJson(draft.bodyText) ? (
                          <span className="text-[11px] text-green-600 inline-flex items-center gap-1">
                            <Check size={12} /> {t('http_req.json_valid')}
                          </span>
                        ) : (
                          <span className="text-[11px] text-red-500 inline-flex items-center gap-1">
                            <AlertCircle size={12} /> {t('http_req.json_invalid')}
                          </span>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {requestTab === 'auth' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {(['none', 'bearer', 'basic'] as AuthType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => patch({ authType: type })}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                      draft.authType === type
                        ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {t(`http_req.auth_${type}`)}
                  </button>
                ))}
              </div>

              {draft.authType === 'bearer' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-gray-400">{t('http_req.auth_token')}</label>
                  <input
                    value={draft.authToken}
                    onChange={(event) => patch({ authToken: event.target.value })}
                    placeholder={t('http_req.auth_token_ph')}
                    spellCheck={false}
                    className={inputClass}
                  />
                </div>
              )}

              {draft.authType === 'basic' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-gray-400">{t('http_req.auth_user')}</label>
                    <input
                      value={draft.authUser}
                      onChange={(event) => patch({ authUser: event.target.value })}
                      className={inputClass}
                      spellCheck={false}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-gray-400">{t('http_req.auth_pass')}</label>
                    <input
                      value={draft.authPass}
                      onChange={(event) => patch({ authPass: event.target.value })}
                      type="password"
                      className={inputClass}
                    />
                  </div>
                </div>
              )}

              {draft.authType === 'none' && <p className="text-xs text-gray-400 py-3">{t('http_req.auth_none_note')}</p>}
            </div>
          )}

          {requestTab === 'options' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400">{t('http_req.timeout')}</label>
                <div className="relative">
                  <input
                    type="number"
                    min={1000}
                    max={120000}
                    step={1000}
                    value={draft.timeoutMs || ''}
                    onChange={(event) => patch({ timeoutMs: Number(event.target.value) })}
                    className={`${inputClass} pr-10`}
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">ms</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-gray-400">{t('http_req.redirect')}</label>
                <select
                  value={draft.redirect}
                  onChange={(event) => patch({ redirect: event.target.value as 'follow' | 'manual' })}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  <option value="follow">{t('http_req.redirect_follow')}</option>
                  <option value="manual">{t('http_req.redirect_manual')}</option>
                </select>
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-600 sm:col-span-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.credentials}
                  onChange={(event) => patch({ credentials: event.target.checked })}
                  className="mt-0.5 w-4 h-4 shrink-0 accent-primary-600"
                />
                <span>
                  {t('http_req.credentials')}
                  <span className="block text-[11px] text-gray-400">{t('http_req.credentials_note')}</span>
                </span>
              </label>
              <p className="text-[11px] text-gray-400 sm:col-span-2">{t('http_req.cors_note')}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-3 py-2">
          <button
            onClick={() => setShowCurl((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition-colors"
          >
            <Terminal size={12} />
            {t('http_req.curl_preview')}
            <ChevronDown size={12} className={`transition-transform ${showCurl ? 'rotate-180' : ''}`} />
          </button>
          {showCurl && (
            <div className="mt-2 space-y-2">
              <pre className="overflow-auto rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre-wrap break-all">
                {curl || t('http_req.curl_empty')}
              </pre>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton text={curl} label={t('http_req.copy_curl')} icon={<Terminal size={13} />} />
                {sensitive && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                    <ShieldAlert size={12} />
                    {t('http_req.sensitive')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 错误 */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-red-700">{t(ERROR_KEYS[error.code] || 'http_req.err_network')}</p>
              {error.detail && <p className="text-xs text-red-400 break-all mt-1">{error.detail}</p>}
            </div>
          </div>

          {error.code === 'cors' && isProbeMethodSupported(draft.method) && (
            <div className="pl-6 space-y-2">
              <p className="text-[11px] text-red-500/80">{t('http_req.cors_desc')}</p>
              <button
                onClick={() => send('probe')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 transition-all"
              >
                <Globe size={13} />
                {t('http_req.probe_fallback')}
              </button>
            </div>
          )}

          {error.code === 'cors' && !isProbeMethodSupported(draft.method) && (
            <p className="pl-6 text-[11px] text-red-500/80">{t('http_req.cors_desc_method')}</p>
          )}
        </div>
      )}

      {/* 响应 */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden animate-slide-up">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-gray-100">
            <span
              className={`px-2 py-1 rounded-lg border text-xs font-bold font-mono ${TONE_STYLE[statusTone(result.status)]}`}
            >
              {result.status === 0 ? '—' : result.status} {result.statusText || statusLabel(result.status)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Clock size={12} />
              {formatDuration(result.durationMs)}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Download size={12} />
              {formatBytes(result.bodyBytes)}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] ${
                result.mode === 'probe'
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-primary-50 text-primary-700 border-primary-100'
              }`}
            >
              {result.mode === 'probe' ? <Globe size={11} /> : <Server size={11} />}
              {result.mode === 'probe' ? t('http_req.source_probe') : t('http_req.source_direct')}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                onClick={() => send(result.mode)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all"
              >
                <RefreshCw size={13} />
                <span className="hidden sm:inline">{t('http_req.resend')}</span>
              </button>
              {result.body ? <CopyButton text={result.body} label={t('http_req.copy_body')} /> : null}
              <button
                onClick={downloadBody}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all"
                title={t('http_req.download')}
              >
                <Download size={13} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <TabButton active={responseTab === 'body'} onClick={() => setResponseTab('body')}>
              {t('http_req.rtab_body')}
            </TabButton>
            <TabButton active={responseTab === 'headers'} onClick={() => setResponseTab('headers')}>
              {t('http_req.rtab_headers')}
              <span className="ml-1 opacity-60">{result.headers.length}</span>
            </TabButton>
            <TabButton active={responseTab === 'timeline'} onClick={() => setResponseTab('timeline')}>
              {t('http_req.rtab_timeline')}
            </TabButton>

            {responseTab === 'body' && hasBody && (prettyBody || isHtml || isImage) && (
              <div className="ml-auto flex items-center gap-1.5">
                {prettyBody && (
                  <TabButton active={bodyView === 'pretty'} onClick={() => setBodyView('pretty')}>
                    <span className="inline-flex items-center gap-1">
                      <Sparkles size={11} />
                      {t('http_req.view_pretty')}
                    </span>
                  </TabButton>
                )}
                <TabButton active={bodyView === 'raw'} onClick={() => setBodyView('raw')}>
                  {t('http_req.view_raw')}
                </TabButton>
                {(isHtml || isImage) && (
                  <TabButton active={bodyView === 'preview'} onClick={() => setBodyView('preview')}>
                    <span className="inline-flex items-center gap-1">
                      <Eye size={11} />
                      {t('http_req.view_preview')}
                    </span>
                  </TabButton>
                )}
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4">
            {responseTab === 'body' && (
              <>
                {result.truncated && (
                  <p className="mb-2 text-[11px] text-amber-600 inline-flex items-center gap-1">
                    <Info size={12} />
                    {t('http_req.truncated')}
                  </p>
                )}
                {result.status === 0 && (
                  <p className="mb-2 text-[11px] text-amber-600 inline-flex items-start gap-1">
                    <Info size={12} className="mt-0.5 shrink-0" />
                    {t('http_req.opaque_redirect')}
                  </p>
                )}
                {isImage && bodyView === 'preview' ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-center">
                    <img src={result.imageUrl} alt="response" className="max-h-[28rem] max-w-full rounded-lg" />
                  </div>
                ) : isHtml && bodyView === 'preview' && hasBody ? (
                  <iframe
                    title="response-preview"
                    sandbox=""
                    srcDoc={displayBody}
                    className="w-full h-[28rem] rounded-xl border border-gray-200 bg-white"
                  />
                ) : (
                  <pre className="max-h-[30rem] overflow-auto rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre-wrap break-all">
                    {bodyView === 'pretty' && prettyBody ? prettyBody : displayBody || t('http_req.empty_body')}
                  </pre>
                )}
                {bodyClipped && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    {t('http_req.body_clipped', { shown: formatBytes(MAX_DISPLAY_BODY), total: formatBytes(result.bodyBytes) })}
                  </p>
                )}
                {isJsonContentType(result.contentType) && !prettyBody && result.body && (
                  <p className="mt-2 text-[11px] text-gray-400">{t('http_req.json_parse_failed')}</p>
                )}
              </>
            )}

            {responseTab === 'headers' && (
              <div className="space-y-2">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  {result.headers.length === 0 ? (
                    <p className="p-4 text-xs text-gray-400">{t('http_req.no_headers')}</p>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-gray-100">
                        {[...result.headers]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((header, index) => (
                            <tr key={`${header.name}-${index}`} className="hover:bg-gray-50/70">
                              <td className="w-2/5 px-3 py-1.5 font-mono text-gray-500 align-top break-all">
                                {header.name}
                              </td>
                              <td className="px-3 py-1.5 font-mono text-gray-800 break-all">{header.value}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {result.mode === 'direct' && (
                  <p className="text-[11px] text-gray-400">{t('http_req.headers_scope_note')}</p>
                )}
              </div>
            )}

            {responseTab === 'timeline' && (
              <div className="space-y-2.5">
                {result.timings ? (
                  <>
                    <TimelineRow
                      label={t('http_req.time_dns')}
                      value={result.timings.dns}
                      total={result.timings.total || result.durationMs}
                    />
                    <TimelineRow
                      label={t('http_req.time_tcp')}
                      value={result.timings.tcp}
                      total={result.timings.total || result.durationMs}
                      tone="bg-sky-400"
                    />
                    <TimelineRow
                      label={t('http_req.time_tls')}
                      value={result.timings.tls}
                      total={result.timings.total || result.durationMs}
                      tone="bg-indigo-400"
                    />
                    <TimelineRow
                      label={t('http_req.time_first_byte')}
                      value={result.timings.firstByte}
                      total={result.timings.total || result.durationMs}
                      tone="bg-amber-400"
                    />
                    <TimelineRow
                      label={t('http_req.time_download')}
                      value={result.timings.download}
                      total={result.timings.total || result.durationMs}
                      tone="bg-emerald-400"
                    />
                    <div className="pt-1.5 border-t border-gray-100 flex items-center justify-between text-xs">
                      <span className="text-gray-500">{t('http_req.time_total')}</span>
                      <span className="font-mono text-gray-800">
                        {formatDuration(result.timings.total || result.durationMs)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-500">{t('http_req.time_total')}</span>
                    <span className="font-mono text-gray-800">{formatDuration(result.durationMs)}</span>
                  </div>
                )}

                {result.resolvedAddress && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                    <span className="text-gray-500">{t('http_req.resolved_ip')}</span>
                    <span className="font-mono text-gray-800">{result.resolvedAddress}</span>
                  </div>
                )}
                <div className="flex items-start justify-between gap-3 text-xs pt-2 border-t border-gray-100">
                  <span className="text-gray-500 shrink-0">{t('http_req.final_url')}</span>
                  <span className="font-mono text-gray-800 break-all text-right">{result.url}</span>
                </div>
                {result.tls && (
                  <div className="space-y-1 pt-2 border-t border-gray-100 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">{t('http_req.tls')}</span>
                      <span className="font-mono text-gray-800">
                        {result.tls.protocol}
                        {result.tls.authorized === false && (
                          <span className="ml-1.5 text-red-500">{t('http_req.tls_invalid')}</span>
                        )}
                      </span>
                    </div>
                    {result.tls.issuer && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t('http_req.tls_issuer')}</span>
                        <span className="text-gray-800 truncate max-w-[60%] text-right">{result.tls.issuer}</span>
                      </div>
                    )}
                    {result.tls.expiresAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">{t('http_req.tls_expires')}</span>
                        <span className="font-mono text-gray-800">{result.tls.expiresAt.slice(0, 10)}</span>
                      </div>
                    )}
                  </div>
                )}
                {result.mode === 'direct' && (
                  <p className="text-[11px] text-gray-400 pt-1">{t('http_req.timeline_direct_note')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-12 px-6 text-center text-gray-400">
          <ArrowRightLeft className="mx-auto mb-3 opacity-20" size={40} />
          <p className="text-sm">{t('http_req.empty')}</p>
          <p className="text-[11px] mt-1.5 max-w-md mx-auto leading-relaxed">{t('http_req.empty_note')}</p>
        </div>
      )}

      {loading && !result && (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 rounded-2xl bg-gray-100" />
          <div className="h-48 rounded-2xl bg-gray-100" />
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-gray-400 leading-relaxed">
        <Info size={13} className="mt-0.5 shrink-0" />
        {t('http_req.footnote')}
      </p>
    </div>
  );
};

export default HttpRequestTester;
