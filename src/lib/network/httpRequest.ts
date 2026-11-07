/// <reference lib="dom" />

/**
 * HTTP 请求测试工具的数据层
 *  - direct：浏览器 fetch 直连，支持全部方法与请求体，受目标站 CORS 约束
 *  - probe：通过 Globalping 的全球探针在服务端发起请求，不受 CORS 限制（仅 GET/HEAD/OPTIONS）
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyType = 'none' | 'json' | 'form' | 'text';
export type AuthType = 'none' | 'bearer' | 'basic';
export type SendMode = 'direct' | 'probe';

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpDraft {
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyText: string;
  formFields: KeyValue[];
  authType: AuthType;
  authToken: string;
  authUser: string;
  authPass: string;
  redirect: 'follow' | 'manual';
  credentials: boolean;
  timeoutMs: number;
}

export interface HeaderPair {
  name: string;
  value: string;
}

export interface PreparedRequest {
  method: HttpMethod;
  url: string;
  headers: HeaderPair[];
  body?: string;
  options: {
    timeoutMs: number;
    redirect: 'follow' | 'manual';
    credentials: boolean;
  };
}

export interface HttpResult {
  mode: SendMode;
  status: number;
  statusText: string;
  headers: HeaderPair[];
  body: string;
  bodyBytes: number;
  durationMs: number;
  url: string;
  contentType?: string;
  imageUrl?: string;
  /** 探测模式下原始响应被截断 */
  truncated?: boolean;
  /** 探测模式：跳转链 / 解析地址 / TLS / 分段耗时 */
  timings?: Record<string, number>;
  tls?: { protocol?: string; issuer?: string; expiresAt?: string; authorized?: boolean };
  resolvedAddress?: string;
}

export type HttpErrorCode =
  | 'invalid'
  | 'timeout'
  | 'aborted'
  | 'cors'
  | 'network'
  | 'probe-failed'
  | 'probe-unsupported'
  | 'probe-timeout'
  | 'rate-limit';

export class HttpRequestError extends Error {
  code: HttpErrorCode;
  detail?: string;

  constructor(code: HttpErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'HttpRequestError';
    this.code = code;
    this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Key/Value 与 URL 工具
// ---------------------------------------------------------------------------

let kvSeed = 0;

export function createKeyValue(key = '', value = '', enabled = true): KeyValue {
  kvSeed += 1;
  return { id: `kv-${kvSeed}-${Date.now().toString(36)}`, key, value, enabled };
}

export function splitUrl(url: string): { base: string; query: string; hash: string } {
  const hashIndex = url.indexOf('#');
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) return { base: withoutHash, query: '', hash };
  return { base: withoutHash.slice(0, queryIndex), query: withoutHash.slice(queryIndex + 1), hash };
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
};

export function parseParams(query: string): KeyValue[] {
  if (!query.trim()) return [];
  return query
    .split('&')
    .filter((pair) => pair.trim().length > 0)
    .map((pair) => {
      const index = pair.indexOf('=');
      if (index === -1) return createKeyValue(safeDecode(pair), '');
      return createKeyValue(safeDecode(pair.slice(0, index)), safeDecode(pair.slice(index + 1)));
    });
}

export function composeUrl(url: string, params: KeyValue[]): string {
  const { base, hash } = splitUrl(url);
  if (!base.trim()) return url;
  const active = params.filter((param) => param.enabled && param.key.trim());
  if (active.length === 0) return base + hash;
  const query = active
    .map((param) => `${encodeURIComponent(param.key.trim())}=${encodeURIComponent(param.value)}`)
    .join('&');
  return `${base}?${query}${hash}`;
}

const base64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export function prepareRequest(draft: HttpDraft): PreparedRequest {
  const rawUrl = draft.url.trim();
  if (!rawUrl) throw new HttpRequestError('invalid', 'empty url');

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new HttpRequestError('invalid', 'invalid url');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HttpRequestError('invalid', 'only http/https supported');
  }

  const headers: HeaderPair[] = [];
  const setHeader = (name: string, value: string) => {
    const index = headers.findIndex((header) => header.name.toLowerCase() === name.toLowerCase());
    if (index >= 0) headers[index] = { name, value };
    else headers.push({ name, value });
  };

  for (const row of draft.headers) {
    const name = row.key.trim();
    if (!row.enabled || !name) continue;
    setHeader(name, row.value);
  }
  const hasHeader = (name: string) => headers.some((header) => header.name.toLowerCase() === name.toLowerCase());

  let body: string | undefined;
  let autoContentType: string | undefined;
  if (draft.bodyType === 'json') {
    body = draft.bodyText;
    autoContentType = 'application/json';
  } else if (draft.bodyType === 'form') {
    const search = new URLSearchParams();
    draft.formFields.forEach((field) => {
      if (field.enabled && field.key.trim()) search.append(field.key.trim(), field.value);
    });
    body = search.toString();
    autoContentType = 'application/x-www-form-urlencoded';
  } else if (draft.bodyType === 'text') {
    body = draft.bodyText;
    autoContentType = 'text/plain;charset=UTF-8';
  }

  // 浏览器规范不允许 GET/HEAD 携带请求体（连同自动 Content-Type 一起丢弃）
  if (draft.method === 'GET' || draft.method === 'HEAD') body = undefined;
  if (body !== undefined && autoContentType && !hasHeader('content-type')) {
    setHeader('Content-Type', autoContentType);
  }

  if (draft.authType === 'bearer' && draft.authToken.trim()) {
    setHeader('Authorization', `Bearer ${draft.authToken.trim()}`);
  } else if (draft.authType === 'basic' && (draft.authUser || draft.authPass)) {
    setHeader('Authorization', `Basic ${base64(`${draft.authUser}:${draft.authPass}`)}`);
  }

  // 浏览器规范不允许 GET/HEAD 携带请求体
  return {
    method: draft.method,
    url: parsed.toString(),
    headers,
    body,
    options: {
      timeoutMs: Math.min(Math.max(draft.timeoutMs || 15000, 1000), 120000),
      redirect: draft.redirect,
      credentials: draft.credentials,
    },
  };
}

const shellEscape = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

export function buildCurl(request: PreparedRequest): string {
  const parts = [`curl -X ${request.method} ${shellEscape(request.url)}`];
  request.headers.forEach((header) => {
    parts.push(`-H ${shellEscape(`${header.name}: ${header.value}`)}`);
  });
  if (request.body) parts.push(`--data-raw ${shellEscape(request.body)}`);
  return parts.join(' \\\n  ');
}

export function hasSensitiveHeader(request: PreparedRequest): boolean {
  return request.headers.some((header) => /^(authorization|cookie|x-api-key|api-key)$/i.test(header.name));
}

// ---------------------------------------------------------------------------
// 直连 fetch
// ---------------------------------------------------------------------------

export async function sendDirect(request: PreparedRequest, signal?: AbortSignal): Promise<HttpResult> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('timeout'));
  }, request.options.timeoutMs);
  const forward = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', forward);

  const started = performance.now();

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers.reduce<Record<string, string>>((acc, header) => {
        acc[header.name] = header.value;
        return acc;
      }, {}),
      body: request.body,
      signal: controller.signal,
      redirect: request.options.redirect,
      credentials: request.options.credentials ? 'include' : 'omit',
      mode: 'cors',
      cache: 'no-store',
    });

    const durationMs = Math.round(performance.now() - started);
    const contentType = response.headers.get('content-type') || undefined;

    if (response.type === 'opaqueredirect') {
      return {
        mode: 'direct',
        status: 0,
        statusText: 'opaqueredirect',
        headers: [],
        body: '',
        bodyBytes: 0,
        durationMs,
        url: request.url,
        contentType,
      };
    }

    const headers: HeaderPair[] = [];
    response.headers.forEach((value, name) => headers.push({ name, value }));

    let body = '';
    let bodyBytes = 0;
    let imageUrl: string | undefined;

    if (contentType && /^image\//i.test(contentType)) {
      const blob = await response.blob();
      imageUrl = URL.createObjectURL(blob);
      bodyBytes = blob.size;
    } else {
      body = await response.text();
      const declared = Number(response.headers.get('content-length'));
      bodyBytes = Number.isFinite(declared) && declared > 0 ? declared : new TextEncoder().encode(body).length;
    }

    return {
      mode: 'direct',
      status: response.status,
      statusText: response.statusText || statusLabel(response.status),
      headers,
      body,
      bodyBytes,
      durationMs,
      url: response.url || request.url,
      contentType,
      imageUrl,
    };
  } catch (error: any) {
    if (signal?.aborted) throw new HttpRequestError('aborted', 'request aborted');
    if (timedOut || controller.signal.aborted) {
      throw new HttpRequestError('timeout', 'request timed out', `${request.options.timeoutMs} ms`);
    }
    // 浏览器出于安全不区分 CORS 与网络故障，统一按 CORS / 网络错误提示
    throw new HttpRequestError('cors', 'request blocked or unreachable', error?.message || String(error));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

// ---------------------------------------------------------------------------
// Globalping 服务端探测
// ---------------------------------------------------------------------------

const PROBE_API = 'https://api.globalping.io/v1';
const PROBE_TIMEOUT = 35000;
const PROBE_REQUEST_TIMEOUT = 20000;
const PROBE_UNSUPPORTED_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** 全球探针只支持无请求体的方法 */
export const isProbeMethodSupported = (method: HttpMethod): boolean =>
  !PROBE_UNSUPPORTED_METHODS.includes(method);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function probeJson(url: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('probe timeout')), PROBE_REQUEST_TIMEOUT);

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (controller.signal.aborted) {
      throw new HttpRequestError('probe-timeout', 'probe request timed out');
    }
    throw new HttpRequestError('network', 'probe service unreachable', error?.message || String(error));
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) throw new HttpRequestError('rate-limit', 'probe rate limited');
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = JSON.stringify(body).slice(0, 200);
    } catch {
      /* ignore */
    }
    throw new HttpRequestError('probe-failed', `probe service returned ${response.status}`, detail);
  }
  return response.json();
}

export async function sendProbe(request: PreparedRequest, signal?: AbortSignal): Promise<HttpResult> {
  if (!isProbeMethodSupported(request.method)) {
    throw new HttpRequestError('probe-unsupported', 'method not supported by probe', request.method);
  }

  const parsed = new URL(request.url);
  const started = performance.now();

  const measurement = await probeJson(`${PROBE_API}/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      type: 'http',
      target: parsed.hostname,
      locations: [{ magic: 'World' }],
      measurementOptions: {
        protocol: parsed.protocol === 'http:' ? 'HTTP' : 'HTTPS',
        port: parsed.port ? Number(parsed.port) : undefined,
        request: {
          method: request.method,
          path: parsed.pathname || '/',
          query: parsed.search ? parsed.search.slice(1) : undefined,
          headers: request.headers.reduce<Record<string, string>>((acc, header) => {
            if (!/^(host|content-length|connection|accept-encoding)$/i.test(header.name)) {
              acc[header.name] = header.value;
            }
            return acc;
          }, {}),
        },
      },
    }),
  });

  const id = measurement?.id;
  if (!id) throw new HttpRequestError('probe-failed', 'probe created without id');

  const deadline = Date.now() + PROBE_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(1200);
    if (signal?.aborted) throw new HttpRequestError('aborted', 'request aborted');
    const data = await probeJson(`${PROBE_API}/measurements/${id}`);

    if (data?.status === 'failed') {
      const detail = data?.results?.[0]?.result?.rawOutput || '';
      throw new HttpRequestError('probe-failed', 'probe measurement failed', String(detail).slice(0, 200));
    }
    if (data?.status !== 'finished') continue;

    const result = data?.results?.[0]?.result;
    if (!result) throw new HttpRequestError('probe-failed', 'probe returned no result');

    const headers: HeaderPair[] = Object.entries(result.headers || {}).map(([name, value]) => ({
      name,
      value: Array.isArray(value) ? value.join(', ') : String(value),
    }));

    const body = typeof result.rawBody === 'string' ? result.rawBody : '';
    const declared = Number(result.headers?.['content-length']);
    const tls = result.tls
      ? {
          protocol: result.tls.protocol ? String(result.tls.protocol) : undefined,
          issuer: result.tls.issuer?.O || result.tls.issuer?.CN || undefined,
          expiresAt: result.tls.expiresAt ? String(result.tls.expiresAt) : undefined,
          authorized: typeof result.tls.authorized === 'boolean' ? result.tls.authorized : undefined,
        }
      : undefined;

    return {
      mode: 'probe',
      status: Number(result.statusCode) || 0,
      statusText: result.statusCodeName ? String(result.statusCodeName) : statusLabel(Number(result.statusCode) || 0),
      headers,
      body,
      bodyBytes: Number.isFinite(declared) && declared > 0 ? declared : new TextEncoder().encode(body).length,
      durationMs: Number(result.timings?.total) || Math.round(performance.now() - started),
      url: request.url,
      contentType: result.headers?.['content-type'] ? String(result.headers['content-type']) : undefined,
      truncated: result.truncated === true,
      timings: result.timings,
      tls,
      resolvedAddress: result.resolvedAddress ? String(result.resolvedAddress) : undefined,
    };
  }

  throw new HttpRequestError('probe-timeout', 'probe measurement timed out');
}

// ---------------------------------------------------------------------------
// 呈现辅助
// ---------------------------------------------------------------------------

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  418: "I'm a teapot",
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

export function statusLabel(status: number): string {
  return STATUS_TEXT[status] || (status === 0 ? 'OPAQUE' : '');
}

export { formatBytes } from '@/lib/format';

export { formatDuration } from '@/lib/format';

export function prettyJson(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return null;
  }
}

export function isJsonContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return /json|javascript|xml\+|graphql/i.test(contentType);
}

export const DEFAULT_DRAFT: HttpDraft = {
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  bodyType: 'none',
  bodyText: '',
  formFields: [createKeyValue()],
  authType: 'none',
  authToken: '',
  authUser: '',
  authPass: '',
  redirect: 'follow',
  credentials: false,
  timeoutMs: 15000,
};
