/// <reference lib="dom" />

/**
 * WHOIS / RDAP 查询数据层
 *  - 主引擎：RDAP（注册局标准接口，结构化数据），通过 rdap.org 的 IANA bootstrap 自动路由
 *  - 备引擎：部分 ccTLD（.cn / .de / .io ...）没有 RDAP 服务，回退到 whois.vu 的文本 WHOIS
 */

export type WhoisKind = 'domain' | 'ip' | 'autnum';
export type WhoisSource = 'rdap' | 'whois';

export type WhoisErrorCode =
  | 'invalid'
  | 'unsupported'
  | 'not-found'
  | 'network'
  | 'timeout'
  | 'rate-limit'
  | 'server';

export class WhoisError extends Error {
  code: WhoisErrorCode;
  detail?: string;

  constructor(code: WhoisErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'WhoisError';
    this.code = code;
    this.detail = detail;
  }
}

export interface WhoisField {
  label: string;
  value: string;
}

export interface WhoisContact {
  handle?: string;
  roles: string[];
  name?: string;
  org?: string;
  emails: string[];
  phones: string[];
  address?: string;
  url?: string;
  ianaId?: string;
  remarks: string[];
}

export interface WhoisEvent {
  action: string;
  date: string;
}

export interface WhoisNotice {
  title: string;
  description: string[];
  links: string[];
}

export interface WhoisNetwork {
  start?: string;
  end?: string;
  version?: string;
  name?: string;
  type?: string;
  country?: string;
  parentHandle?: string;
  cidrs: string[];
}

export interface WhoisRdapRecord {
  mode: 'rdap';
  kind: WhoisKind;
  query: string;
  name: string;
  ldhName?: string;
  unicodeName?: string;
  handle?: string;
  status: string[];
  events: WhoisEvent[];
  nameservers: { host: string; ipv4: string[]; ipv6: string[] }[];
  dnssecSigned?: boolean;
  contacts: WhoisContact[];
  network?: WhoisNetwork;
  autnum?: { start?: number; end?: number };
  remarks: string[];
  notices: WhoisNotice[];
  raw: unknown;
  source: 'rdap';
  sourceUrl?: string;
  fetchedAt: number;
}

export interface WhoisTextRecord {
  mode: 'text';
  kind: 'domain';
  query: string;
  name: string;
  available?: boolean;
  status: string[];
  fields: WhoisField[];
  created?: number;
  updated?: number;
  expires?: number;
  raw: string;
  source: 'whois';
  fetchedAt: number;
}

export type WhoisResult = WhoisRdapRecord | WhoisTextRecord;

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------

type Dict = { zh: string; en: string };

/** 公开资料里出现的 EPP / RDAP 状态说明 */
export const EPP_STATUS: Record<string, Dict> = {
  ok: { zh: '正常，无特殊限制', en: 'Normal, no special status codes' },
  active: { zh: '正常使用中', en: 'Active' },
  inactive: { zh: '未激活，缺少 DNS 委派', en: 'Inactive, no DNS delegation' },
  associated: { zh: '已关联，但尚未委派', en: 'Associated but not delegated' },
  connect: { zh: '已注册（DENIC）', en: 'Registered (DENIC)' },
  clientdeleteprohibited: { zh: '注册商禁止删除', en: 'Registrar lock: delete prohibited' },
  clienttransferprohibited: { zh: '注册商禁止转移', en: 'Registrar lock: transfer prohibited' },
  clientupdateprohibited: { zh: '注册商禁止修改', en: 'Registrar lock: update prohibited' },
  clientrenewprohibited: { zh: '注册商禁止续费', en: 'Registrar lock: renew prohibited' },
  clienthold: { zh: '注册商暂停解析', en: 'Registrar hold' },
  serverdeleteprohibited: { zh: '注册局禁止删除', en: 'Registry lock: delete prohibited' },
  servertransferprohibited: { zh: '注册局禁止转移', en: 'Registry lock: transfer prohibited' },
  serverupdateprohibited: { zh: '注册局禁止修改', en: 'Registry lock: update prohibited' },
  serverrenewprohibited: { zh: '注册局禁止续费', en: 'Registry lock: renew prohibited' },
  serverhold: { zh: '注册局暂停解析', en: 'Registry hold' },
  pendingdelete: { zh: '待删除', en: 'Pending delete' },
  pendingtransfer: { zh: '待转移', en: 'Pending transfer' },
  pendingrenew: { zh: '待续费', en: 'Pending renew' },
  pendingcreate: { zh: '待创建', en: 'Pending create' },
  pendingupdate: { zh: '待更新', en: 'Pending update' },
  pendingrestore: { zh: '待恢复', en: 'Pending restore' },
  redemptionperiod: { zh: '赎回宽限期', en: 'Redemption period' },
  autorenewperiod: { zh: '自动续费宽限期', en: 'Auto-renew grace period' },
  addperiod: { zh: '新增宽限期', en: 'Add grace period' },
  renewperiod: { zh: '续费宽限期', en: 'Renew grace period' },
  transferperiod: { zh: '转移宽限期', en: 'Transfer grace period' },
  reserved: { zh: '保留域名', en: 'Reserved' },
  locked: { zh: '已锁定', en: 'Locked' },
  validated: { zh: '已通过验证', en: 'Validated' },
  failed: { zh: '已失效', en: 'Failed' },
};

export const ROLE_LABEL: Record<string, Dict> = {
  registrar: { zh: '注册商', en: 'Registrar' },
  sponsoring: { zh: '赞助注册商', en: 'Sponsoring registrar' },
  registrant: { zh: '注册人', en: 'Registrant' },
  administrative: { zh: '管理联系人', en: 'Administrative' },
  technical: { zh: '技术联系人', en: 'Technical' },
  abuse: { zh: '滥用投诉', en: 'Abuse' },
  billing: { zh: '账单联系人', en: 'Billing' },
  reseller: { zh: '代理商', en: 'Reseller' },
  noc: { zh: '网络运营中心', en: 'NOC' },
  notifications: { zh: '通知联系人', en: 'Notifications' },
  dns: { zh: 'DNS 运维', en: 'DNS' },
};

export const EVENT_LABEL: Record<string, Dict> = {
  registration: { zh: '注册时间', en: 'Registered' },
  expiration: { zh: '到期时间', en: 'Expires' },
  'last changed': { zh: '最后变更', en: 'Last changed' },
  'last update of rdap database': { zh: '注册库更新', en: 'Registry DB update' },
  transfer: { zh: '转移时间', en: 'Transferred' },
  reregistration: { zh: '重新注册', en: 'Re-registered' },
  deletion: { zh: '删除时间', en: 'Deleted' },
  'registrar expiration': { zh: '注册商到期', en: 'Registrar expiry' },
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[\s_\-]/g, '');

export function describeStatus(status: string, lang: string): string {
  const item = EPP_STATUS[normalizeKey(status)];
  if (!item) return '';
  return lang === 'zh' ? item.zh : item.en;
}

export function labelForRole(role: string, lang: string): string {
  const item = ROLE_LABEL[normalizeKey(role)];
  if (item) return lang === 'zh' ? item.zh : item.en;
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function labelForEvent(action: string, lang: string): string {
  const item = EVENT_LABEL[action.toLowerCase()];
  if (item) return lang === 'zh' ? item.zh : item.en;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

/** EPP 状态的驼峰写法，用于展示与复制 */
export function eppStatusText(status: string): string {
  const trimmed = status.trim();
  if (!trimmed) return trimmed;
  if (/[A-Z]/.test(trimmed) && !/\s/.test(trimmed)) return trimmed;
  return trimmed
    .split(/\s+/)
    .map((part, index) => (index === 0 ? part.toLowerCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

const REDACTED = /^(redacted|redacted for privacy|not disclosed|data protected|statutory masking enabled|privacy service provided|withheld for privacy|none|null|n\/a|-+)$/i;

export function isRedacted(value?: string): boolean {
  if (!value) return true;
  return REDACTED.test(value.trim());
}

function isIPv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isIPv6(value: string): boolean {
  if (!value.includes(':')) return false;
  // 至少两个冒号，避开 host:port 写法（如 1.2.3.4:80）
  if ((value.match(/:/g) || []).length < 2) return false;
  return /^[0-9a-fA-F:.%]+$/.test(value);
}

function toAsciiHost(host: string): string {
  if (/^[\x00-\x7f]+$/.test(host)) return host.toLowerCase();
  try {
    return new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return host.toLowerCase();
  }
}

export interface NormalizedQuery {
  kind: WhoisKind;
  value: string;
}

export function normalizeQuery(raw: string): NormalizedQuery {
  let text = (raw || '').trim();
  if (!text) throw new WhoisError('invalid', 'empty query');

  const scheme = text.match(/^[a-z][a-z0-9+.-]*:\/\//i);
  if (scheme) text = text.slice(scheme[0].length).trim();

  // 保留 CIDR 写法，其余去掉路径与查询串
  if (!/^[^/\s]+\/\d{1,3}$/.test(text)) text = text.split(/[/?#]/)[0];
  text = text.replace(/\.$/, '');

  const asn = text.match(/^(?:as|asn)[\s-]*(\d{1,10})$/i);
  if (asn) return { kind: 'autnum', value: asn[1] };

  if (/^\d{1,10}$/.test(text)) return { kind: 'autnum', value: text };

  const cidr = text.match(/^(.+\/\d{1,3})$/);
  if (cidr && (isIPv4(cidr[1].split('/')[0]) || isIPv6(cidr[1].split('/')[0]))) {
    return { kind: 'ip', value: cidr[1] };
  }

  if (isIPv4(text) || isIPv6(text)) return { kind: 'ip', value: text };

  const host = toAsciiHost(text.replace(/^www\./i, ''));
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) || host.length > 253) {
    throw new WhoisError('invalid', `invalid host: ${text}`);
  }
  return { kind: 'domain', value: host };
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const RDAP_TIMEOUT = 15000;
const WHOIS_TIMEOUT = 20000;

async function fetchWithTimeout(url: string, signal: AbortSignal | undefined, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout);
  const forward = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', forward);

  try {
    return await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
      headers: {
        Accept: 'application/rdap+json, application/json',
        // 浏览器禁止设置 UA（会静默忽略），但部分 RDAP 前端的 UA 风控需要它
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new WhoisError('timeout', 'request timed out');
    throw new WhoisError('network', 'network error', String((error as Error)?.message || error));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forward);
  }
}

// ---------------------------------------------------------------------------
// RDAP parsing
// ---------------------------------------------------------------------------

const collectText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(collectText).filter(Boolean).join(' ');
  return '';
};

const cleanOptional = (value?: string): string | undefined => {
  const text = (value || '').trim();
  if (!text || isRedacted(text)) return undefined;
  return text;
};

function parseVcard(vcard: unknown): Pick<WhoisContact, 'name' | 'org' | 'emails' | 'phones' | 'address' | 'url'> {
  const out: Pick<WhoisContact, 'name' | 'org' | 'emails' | 'phones' | 'address' | 'url'> = { emails: [], phones: [] };
  if (!Array.isArray(vcard) || !Array.isArray(vcard[1])) return out;

  for (const entry of vcard[1] as unknown[]) {
    if (!Array.isArray(entry)) continue;
    const key = String(entry[0] || '').toLowerCase();
    const params = (entry[1] || {}) as Record<string, unknown>;
    const value = entry[3];

    if (key === 'fn') out.name = cleanOptional(collectText(value));
    else if (key === 'org') out.org = cleanOptional(collectText(value));
    else if (key === 'email') {
      const email = cleanOptional(collectText(value));
      if (email) out.emails.push(email);
    } else if (key === 'tel') {
      const phone = cleanOptional(collectText(value).replace(/^tel:/i, ''));
      if (phone) out.phones.push(phone);
    } else if (key === 'adr') {
      const label = params && typeof params.label === 'string' ? params.label : '';
      const address = cleanOptional(label || collectText(value).replace(/\s+/g, ' '));
      if (address) out.address = address;
    } else if (key === 'url') {
      out.url = cleanOptional(collectText(value));
    }
  }

  return out;
}

function collectRemarks(node: any): string[] {
  const list: string[] = [];
  if (Array.isArray(node?.remarks)) {
    for (const remark of node.remarks) {
      const text = collectText(remark?.description);
      if (text) list.push(text);
    }
  }
  return list;
}

function parseEntity(entity: any): WhoisContact {
  const vcard = parseVcard(entity?.vcardArray);
  const publicIds: any[] = Array.isArray(entity?.publicIds) ? entity.publicIds : [];
  const iana = publicIds.find((item) => /iana/i.test(String(item?.type || '')));
  const links: any[] = Array.isArray(entity?.links) ? entity.links : [];
  const site =
    links.find((link) => link?.type === 'text/html' && link?.href)?.href ||
    links.find((link) => link?.rel === 'about' && link?.href)?.href;

  return {
    handle: entity?.handle ? String(entity.handle) : undefined,
    roles: Array.isArray(entity?.roles) ? entity.roles.map((role: unknown) => String(role).toLowerCase()) : [],
    name: vcard.name,
    org: vcard.org,
    emails: vcard.emails || [],
    phones: vcard.phones || [],
    address: vcard.address,
    url: vcard.url || (typeof site === 'string' ? site : undefined),
    ianaId: iana?.identifier ? String(iana.identifier) : undefined,
    remarks: collectRemarks(entity),
  };
}

function walkEntities(entities: any, target: WhoisContact[], depth = 0): void {
  if (!Array.isArray(entities) || depth > 4) return;
  for (const entity of entities) {
    if (!entity || typeof entity !== 'object') continue;
    const parsed = parseEntity(entity);
    // 同一个联系人可能被多个父实体重复引用，用内容签名去重
    const signature = [
      parsed.handle || '',
      parsed.roles.join(','),
      parsed.name || '',
      parsed.org || '',
      parsed.emails.join(','),
    ].join('|');
    const duplicate = target.some(
      (item) =>
        [item.handle || '', item.roles.join(','), item.name || '', item.org || '', item.emails.join(',')].join('|') ===
        signature
    );
    if (!duplicate) target.push(parsed);
    walkEntities(entity.entities, target, depth + 1);
  }
}

function parseEvents(events: any): WhoisEvent[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter((event) => event?.eventAction && event?.eventDate)
    .map((event) => ({ action: String(event.eventAction), date: String(event.eventDate) }));
}

/** 只解析 notices；remarks 另有字段，避免在 UI 中重复展示 */
function parseNotices(node: any): WhoisNotice[] {
  const list: WhoisNotice[] = [];
  if (!Array.isArray(node?.notices)) return list;

  for (const item of node.notices) {
    const description = collectText(item?.description);
    if (!description) continue;
    list.push({
      title: item?.title ? String(item.title) : 'Notice',
      description: (Array.isArray(item.description) ? item.description : [description]).map((line: unknown) => String(line)),
      links: Array.isArray(item.links)
        ? item.links.map((link: any) => link?.href).filter((href: unknown) => typeof href === 'string')
        : [],
    });
  }
  return list;
}

export function parseRdap(data: any, kind: WhoisKind, query: string, sourceUrl?: string): WhoisRdapRecord {
  const contacts: WhoisContact[] = [];
  walkEntities(data?.entities, contacts);

  const nameservers = (Array.isArray(data?.nameservers) ? data.nameservers : [])
    .map((ns: any) => ({
      host: String(ns?.ldhName || ns?.unicodeName || '').trim(),
      ipv4: Array.isArray(ns?.ipAddresses?.v4) ? ns.ipAddresses.v4.map(String) : [],
      ipv6: Array.isArray(ns?.ipAddresses?.v6) ? ns.ipAddresses.v6.map(String) : [],
    }))
    .filter((ns: { host: string }) => !!ns.host);

  const cidrs = (Array.isArray(data?.cidr0_cidrs) ? data.cidr0_cidrs : [])
    .map((cidr: any) => {
      const prefix = cidr?.v4prefix || cidr?.v6prefix;
      return prefix ? `${prefix}/${cidr.length}` : '';
    })
    .filter(Boolean);

  const network: WhoisNetwork | undefined =
    kind === 'ip'
      ? {
          start: data?.startAddress ? String(data.startAddress) : undefined,
          end: data?.endAddress ? String(data.endAddress) : undefined,
          version: data?.ipVersion ? String(data.ipVersion) : undefined,
          name: cleanOptional(collectText(data?.name)),
          type: data?.type ? String(data.type) : undefined,
          country: data?.country ? String(data.country) : undefined,
          parentHandle: data?.parentHandle ? String(data.parentHandle) : undefined,
          cidrs,
        }
      : undefined;

  const autnum =
    kind === 'autnum'
      ? {
          start: typeof data?.startAutnum === 'number' ? data.startAutnum : undefined,
          end: typeof data?.endAutnum === 'number' ? data.endAutnum : undefined,
        }
      : undefined;

  const ldhName = data?.ldhName ? String(data.ldhName) : undefined;
  const unicodeName = data?.unicodeName ? String(data.unicodeName) : undefined;
  const displayName =
    kind === 'domain'
      ? ldhName || unicodeName || query
      : kind === 'ip'
        ? query
        : `AS${autnum?.start ?? query}`;

  return {
    mode: 'rdap',
    kind,
    query,
    name: displayName,
    ldhName,
    unicodeName,
    handle: data?.handle ? String(data.handle) : undefined,
    status: Array.isArray(data?.status) ? data.status.map(String) : [],
    events: parseEvents(data?.events),
    nameservers,
    dnssecSigned: typeof data?.secureDNS?.delegationSigned === 'boolean' ? data.secureDNS.delegationSigned : undefined,
    contacts,
    network,
    autnum,
    remarks: collectRemarks(data),
    notices: parseNotices(data),
    raw: data,
    source: 'rdap',
    sourceUrl,
    fetchedAt: Date.now(),
  };
}

async function requestRdap(url: string, signal: AbortSignal | undefined): Promise<{ data: unknown; url: string }> {
  const response = await fetchWithTimeout(url, signal, RDAP_TIMEOUT);

  if (response.ok) {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new WhoisError('server', 'invalid RDAP payload', `HTTP ${response.status}`);
    }
    return { data, url: response.url || url };
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    /* ignore */
  }
  const title = typeof body?.title === 'string' ? body.title : '';
  const description = typeof body?.description === 'string' ? body.description : '';

  if (response.status === 404) {
    if (/no rdap service/i.test(title) || /no rdap service/i.test(description)) {
      throw new WhoisError('unsupported', title || 'no RDAP service for this TLD');
    }
    throw new WhoisError('not-found', title || 'not found');
  }
  if (response.status === 429) throw new WhoisError('rate-limit', 'rate limited');
  throw new WhoisError('server', title || `HTTP ${response.status}`, `HTTP ${response.status}`);
}

async function fetchRdap(kind: WhoisKind, value: string, signal?: AbortSignal): Promise<WhoisRdapRecord> {
  const urls = [`https://rdap.org/${kind}/${value}`];

  if (kind === 'domain') {
    const tld = value.split('.').pop() || '';
    if (tld === 'com' || tld === 'net') urls.push(`https://rdap.verisign.com/${tld}/v1/domain/${value}`);
  } else if (kind === 'ip' && !value.includes('/')) {
    urls.push(`https://rdap.arin.net/registry/ip/${value}`);
  } else if (kind === 'autnum') {
    urls.push(`https://rdap.arin.net/registry/autnum/${value}`);
  }

  let lastError: WhoisError | null = null;

  for (const url of urls) {
    try {
      const { data, url: finalUrl } = await requestRdap(url, signal);
      return parseRdap(data, kind, value, finalUrl);
    } catch (error) {
      if (signal?.aborted) throw error;
      const normalized =
        error instanceof WhoisError ? error : new WhoisError('network', 'network error', String(error));
      // 保留主入口（rdap.org）的错误语义，同时继续尝试备用入口
      if (!lastError) lastError = normalized;
    }
  }

  throw lastError || new WhoisError('network', 'network error');
}

// ---------------------------------------------------------------------------
// 文本 WHOIS（ccTLD 回退）
// ---------------------------------------------------------------------------

export function parseWhoisText(raw: string): WhoisField[] {
  const fields: WhoisField[] = [];
  const index = new Map<string, number>();

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/^\s*([%#>]|>>>)/.test(line)) continue;

    // 两种常见格式：`Label: value` 与 JPRS 风格 `[Label]   value`
    const colonMatch = line.match(/^\s*([A-Za-z][A-Za-z0-9 _\-/.]{1,45}?)\s*:\s*(.+)$/);
    const bracketMatch = colonMatch ? null : line.match(/^\s*\[([^\]\n]{1,40})\]\s{2,}(.+)$/);
    const match = colonMatch || bracketMatch;
    if (!match) continue;

    const label = match[1].trim();
    const value = match[2].trim();
    if (!value) continue;
    if (!isKnownWhoisField(label)) continue;

    const key = label.toLowerCase().replace(/\s+/g, ' ');
    const existing = index.get(key);
    if (existing !== undefined) {
      const field = fields[existing];
      if (!field.value.split('\n').includes(value)) field.value = `${field.value}\n${value}`;
    } else {
      index.set(key, fields.length);
      fields.push({ label, value });
    }
  }

  return fields;
}

/** 只保留注册局记录里真正有意义的字段，过滤文本 WHOIS 里大段法律声明 */
const WHOIS_FIELD_PATTERNS: RegExp[] = [
  /^domain( name)?$/i,
  /^(registry )?domain id$/i,
  /^(roid|sid)$/i,
  /^whois server$/i,
  /^registrar(whois ?server)?$/i,
  /^sponsoring registrar$/i,
  /^registrar (iana id|url|whois server|abuse contact email|abuse contact phone|registration expiration date|information)$/i,
  /^registrant contact email$/i,
  /^(registrant|admin|administrative|tech|technical|billing|reseller)(\s+(contact\s+)?(name|organization|org|email|e-mail|phone|fax|street|address|city|state(\/province)?|postal code|postalcode|country|id|handle|role))?$/i,
  /^(name ?servers?|nserver)$/i,
  /^(domain )?status(es)?$/i,
  /^state$/i,
  /^(creation|created|registration|registered)(\s+(date|time|on))?$/i,
  /^(updated|last updated?|last modified|modified|changed)(\s+(date|time|on))?$/i,
  /^(registry |registrar )?(expiry|expiration|expires)(\s+(date|time|on))?$/i,
  /^paid-till$/i,
  /^(dnssec|dnskey)$/i,
  /^country$/i,
  // JPRS 风格的无前缀联系人字段
  /^(name|email|e-mail|phone|fax|web page|organization|address|postal address)$/i,
  // 日文 / 中文注册局常见字段
  /^(登録年月日|有効期限|最終更新|状態)$/,
];

const isKnownWhoisField = (label: string): boolean =>
  label.length <= 42 && WHOIS_FIELD_PATTERNS.some((pattern) => pattern.test(label));

const pickField = (fields: WhoisField[], pattern: RegExp): string | undefined => {
  const hit = fields.find((field) => pattern.test(field.label));
  return hit?.value.split('\n')[0].trim();
};

/** 文本 WHOIS 的日期写法很杂，统一成时间戳（失败返 undefined） */
const parseLooseDate = (value?: string): number | undefined => {
  if (!value) return undefined;
  let text = value.trim().replace(/\([^)]*\)/g, '').trim();
  if (!text) return undefined;
  text = text
    .replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/, '$1-$2-$3')
    .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/, '$1T$2');
  const time = new Date(text).getTime();
  return Number.isFinite(time) ? time : undefined;
};

async function fetchTextWhois(domain: string, signal?: AbortSignal): Promise<WhoisTextRecord> {
  const url = `https://api.whois.vu/?q=${encodeURIComponent(domain)}`;
  const response = await fetchWithTimeout(url, signal, WHOIS_TIMEOUT);

  if (!response.ok) {
    if (response.status === 429) throw new WhoisError('rate-limit', 'rate limited');
    throw new WhoisError('server', 'whois service error', `HTTP ${response.status}`);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new WhoisError('server', 'invalid whois payload');
  }

  const raw = typeof data?.whois === 'string' ? data.whois : '';
  if (!raw.trim()) throw new WhoisError('not-found', 'empty whois response');
  if (/rate limit|too many requests|quota exceeded|valid key required/i.test(raw)) {
    throw new WhoisError('rate-limit', raw.split('\n')[0]);
  }
  if (/unable to service request|no entries found/i.test(raw) && !/domain|registrar/i.test(raw)) {
    throw new WhoisError('not-found', 'no records');
  }

  const fields = parseWhoisText(raw);
  const statuses = (Array.isArray(data?.statuses) ? data.statuses.map(String) : [])
    .map((status) => status.trim())
    .filter(Boolean);
  if (statuses.length === 0) {
    const fromFields = pickField(fields, /^(domain )?status(es)?$|^状態$/i);
    if (fromFields) {
      fromFields
        .split('\n')
        .map((line) => line.split(/[\s,]+/)[0])
        .filter(Boolean)
        .forEach((status) => statuses.push(status));
    }
  }

  const noRecord =
    fields.length === 0 && /no matching record|no data found|not found|no entries found/i.test(raw);
  const available = data?.available === 'yes' ? true : data?.available === 'no' ? false : noRecord ? true : undefined;

  const domainField = pickField(fields, /^domain( name)?$/i);

  return {
    mode: 'text',
    kind: 'domain',
    query: domain,
    name: domainField || (data?.domain ? String(data.domain) : domain),
    available,
    status: statuses,
    fields: available === true ? [] : fields,
    created:
      (typeof data?.created === 'number' ? data.created * 1000 : undefined) ??
      parseLooseDate(
        pickField(fields, /^(creation|created|registration|registered)(\s+(date|time|on))?$|^登録年月日$|^注册时间$/i)
      ),
    updated:
      (typeof data?.updated === 'number' ? data.updated * 1000 : undefined) ??
      parseLooseDate(
        pickField(fields, /^(updated|last updated?|last modified|modified|changed)(\s+(date|time|on))?$|^最終更新$|^最后更新$/i)
      ),
    expires:
      (typeof data?.expires === 'number' ? data.expires * 1000 : undefined) ??
      parseLooseDate(
        pickField(fields, /^(registry |registrar )?(expiry|expiration|expires)(\s+(date|time|on))?$|^有効期限$|^到期时间$/i)
      ),
    raw,
    source: 'whois',
    fetchedAt: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export async function lookupWhois(raw: string, signal?: AbortSignal): Promise<WhoisResult> {
  const { kind, value } = normalizeQuery(raw);

  try {
    return await fetchRdap(kind, value, signal);
  } catch (error) {
    const rdapError = error instanceof WhoisError ? error : new WhoisError('network', 'network error');
    if (signal?.aborted || rdapError.code === 'invalid' || kind !== 'domain') throw rdapError;

    // ccTLD / 老后缀往往没有 RDAP，回退文本 WHOIS
    try {
      return await fetchTextWhois(value, signal);
    } catch (fallbackError) {
      if (signal?.aborted) throw fallbackError;
      const preferFallback = rdapError.code === 'unsupported' || rdapError.code === 'not-found';
      throw preferFallback ? fallbackError : rdapError;
    }
  }
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDate(value: string | number | undefined, lang: string): string {
  if (value === undefined || value === null || value === '') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function daysUntil(value: string | number | undefined): number | null {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export function findEvent(events: WhoisEvent[], action: string): string | undefined {
  const target = action.toLowerCase();
  return events.find((event) => event.action.toLowerCase() === target)?.date;
}

export function buildReport(record: WhoisResult): string {
  if (record.mode === 'text') return record.raw.trim();

  const lines: string[] = [];
  const push = (label: string, value?: string) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  if (record.kind === 'domain') push('Domain Name', record.unicodeName || record.ldhName || record.name);
  if (record.kind === 'ip') push('IP Address', record.name);
  if (record.kind === 'autnum') push('AS Number', record.name);
  if (record.handle) push('Handle', record.handle);

  if (record.network?.start && record.network?.end) {
    push('IP Range', `${record.network.start} - ${record.network.end}`);
  }
  if (record.network?.cidrs?.length) push('CIDR', record.network.cidrs.join(', '));
  if (record.network?.name) push('Net Name', record.network.name);
  if (record.network?.type) push('Net Type', record.network.type);
  if (record.network?.country) push('Country', record.network.country);

  const registrar = record.contacts.find(
    (contact) => contact.roles.includes('registrar') || contact.roles.includes('sponsoring')
  );
  if (registrar) {
    push('Registrar', registrar.org || registrar.name);
    push('Registrar IANA ID', registrar.ianaId);
  }

  const registered = findEvent(record.events, 'registration');
  const expires = findEvent(record.events, 'expiration');
  const changed = findEvent(record.events, 'last changed');
  push('Creation Date', registered);
  push('Registry Expiry Date', expires);
  push('Updated Date', changed);

  record.status.forEach((status) =>
    push(record.kind === 'domain' ? 'Domain Status' : 'Status', eppStatusText(status))
  );
  record.nameservers.forEach((ns) => push('Name Server', ns.host));
  record.remarks.forEach((remark) => push('Remark', remark));

  if (record.dnssecSigned !== undefined) push('DNSSEC', record.dnssecSigned ? 'signed' : 'unsigned');

  return lines.join('\n');
}
