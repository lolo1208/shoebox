/**
 * Globalping 开放 API 封装。
 * 文档：https://globalping.io/docs/api.globalping.io
 */

const API_BASE = 'https://api.globalping.io/v1';

export type CheckType = 'ping' | 'http' | 'dns' | 'traceroute' | 'mtr';

export interface ProbeLocation {
  continent: string;
  region: string;
  country: string;
  city: string;
  asn: number;
  network: string;
}

export interface ProbeResult {
  probe: ProbeLocation;
  result: any;
}

export interface MeasurementResult {
  id: string;
  type: string;
  status: 'in-progress' | 'finished';
  createdAt: string;
  updatedAt: string;
  probesCount: number;
  results: ProbeResult[];
}

export interface RateLimitData {
  limit: number;
  remaining: number;
  reset: number;
}

export interface CreateMeasurementBody {
  target: string;
  type: CheckType;
  limit: number;
  locations: Array<{ magic: string } | { continent: string } | { country: string }>;
  measurementOptions: Record<string, unknown>;
}

/** 去掉协议、路径与端口，得到 Globalping 接受的目标 */
export function normalizeTarget(input: string): string {
  return input
    .trim()
    .replace(/^[a-zA-Z]+:\/\//, '')
    .split('/')[0]
    .replace(/:\d+$/, '');
}

/** 读取当前 IP 的测量配额 */
export async function fetchRateLimit(signal?: AbortSignal): Promise<RateLimitData | null> {
  const res = await fetch(`${API_BASE}/limits`, { signal });
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.rateLimit?.measurements?.create;
  return info ? { limit: info.limit, remaining: info.remaining, reset: info.reset } : null;
}

/** 创建测量任务，返回任务 ID */
export async function createMeasurement(body: CreateMeasurementBody, signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${API_BASE}/measurements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    if (res.status === 429) throw new Error('429: Quota Exceeded');
    if (res.status === 422) {
      const errData = await res.json().catch(() => ({}));
      if (errData.error?.type === 'too_many_probes') throw new Error(`Too many probes (${body.limit})`);
      if (errData.error?.params?.target) throw new Error('Invalid target');
      throw new Error('Validation Error');
    }
    throw new Error(`API Error: ${res.status}`);
  }

  const data = await res.json();
  if (!data.id) throw new Error('No ID returned');
  return data.id as string;
}

/** 拉取测量结果 */
export async function fetchMeasurement(id: string, signal?: AbortSignal): Promise<MeasurementResult> {
  const res = await fetch(`${API_BASE}/measurements/${id}`, { signal });
  if (!res.ok) throw new Error('Poll failed');
  return res.json();
}
