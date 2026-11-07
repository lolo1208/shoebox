/// <reference lib="dom" />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  Globe,
  Hourglass,
  Info,
  Layers,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import CopyButton from '@/components/ui/CopyButton';
import {
  buildReport,
  daysUntil,
  describeStatus,
  eppStatusText,
  findEvent,
  formatDate,
  isRedacted,
  labelForRole,
  lookupWhois,
  normalizeQuery,
  type WhoisContact,
  type WhoisRdapRecord,
  type WhoisResult,
} from '@/lib/network/whois';

const EXAMPLES = ['example.com', 'google.com', '8.8.8.8', 'AS15169'];
const HISTORY_KEY = 'shoebox-whois-history';
const HISTORY_LIMIT = 8;

type ErrorState = { code: string; detail?: string };

const ERROR_KEYS: Record<string, string> = {
  invalid: 'whois.err_invalid',
  unsupported: 'whois.err_unsupported',
  'not-found': 'whois.err_not_found',
  network: 'whois.err_network',
  timeout: 'whois.err_timeout',
  'rate-limit': 'whois.err_rate_limit',
  server: 'whois.err_server',
};

const kindLabelKey = (kind: string) =>
  kind === 'ip' ? 'whois.kind_ip' : kind === 'autnum' ? 'whois.kind_autnum' : 'whois.kind_domain';

const expiryTone = (days: number | null) => {
  if (days === null) return 'bg-gray-100 text-gray-600 border-gray-200';
  if (days <= 30) return 'bg-red-50 text-red-600 border-red-200';
  if (days <= 90) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-green-50 text-green-700 border-green-200';
};

const Section: React.FC<{
  icon: React.ReactNode;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, aside, children }) => (
  <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
      <span className="text-gray-400">{icon}</span>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {aside && <div className="ml-auto text-xs text-gray-400">{aside}</div>}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-4">
    <div className="w-40 shrink-0 text-xs text-gray-400 sm:text-right">{label}</div>
    <div className="min-w-0 flex-1 text-sm text-gray-800 break-words">{children}</div>
  </div>
);

const ContactCard: React.FC<{ contact: WhoisContact }> = ({ contact }) => {
  const { t, language } = useLanguage();
  const hidden =
    isRedacted(contact.name) &&
    isRedacted(contact.org) &&
    contact.emails.length === 0 &&
    contact.phones.length === 0 &&
    isRedacted(contact.address);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3.5 space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {(contact.roles.length > 0 ? contact.roles : ['contact']).map((role) => (
          <span
            key={role}
            className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary-50 text-primary-700 border border-primary-100"
          >
            {labelForRole(role, language)}
          </span>
        ))}
        {contact.handle && <span className="ml-auto font-mono text-[11px] text-gray-400">{contact.handle}</span>}
      </div>

      {hidden ? (
        <p className="text-xs text-gray-400">{t('whois.redacted')}</p>
      ) : (
        <div className="space-y-1.5 text-sm">
          {contact.org && !isRedacted(contact.org) && (
            <div className="flex items-start gap-2 text-gray-800">
              <Building2 size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span className="break-words font-medium">{contact.org}</span>
            </div>
          )}
          {contact.name && !isRedacted(contact.name) && (
            <div className="flex items-start gap-2 text-gray-600">
              <Users size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span className="break-words">{contact.name}</span>
            </div>
          )}
          {contact.emails.map((email) => (
            <div key={email} className="flex items-start gap-2 text-gray-600">
              <Mail size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <a href={`mailto:${email}`} className="break-all hover:text-primary-600 hover:underline">
                {email}
              </a>
            </div>
          ))}
          {contact.phones.map((phone) => (
            <div key={phone} className="flex items-start gap-2 text-gray-600">
              <Phone size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="break-all font-mono text-xs hover:text-primary-600 hover:underline">
                {phone}
              </a>
            </div>
          ))}
          {contact.address && !isRedacted(contact.address) && (
            <div className="flex items-start gap-2 text-gray-600">
              <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
              <span className="whitespace-pre-line break-words">{contact.address}</span>
            </div>
          )}
          {contact.url && (
            <a
              href={contact.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              <ArrowUpRight size={13} />
              {contact.url}
            </a>
          )}
        </div>
      )}
    </div>
  );
};

/** 概览：名称、状态、关键日期与生命周期 */
const OverviewCard: React.FC<{ record: WhoisResult }> = ({ record }) => {
  const { t, language } = useLanguage();
  const isRdap = record.mode === 'rdap';

  const registered = isRdap ? findEvent(record.events, 'registration') : record.created;
  const expires = isRdap ? findEvent(record.events, 'expiration') : record.expires;
  const changed = isRdap
    ? findEvent(record.events, 'last changed') || findEvent(record.events, 'transfer')
    : record.updated;
  const registryUpdate = isRdap ? findEvent(record.events, 'last update of rdap database') : undefined;

  const remaining = daysUntil(expires);
  const regTime = registered ? new Date(registered).getTime() : NaN;
  const expTime = expires ? new Date(expires).getTime() : NaN;
  const span = Number.isFinite(regTime) && Number.isFinite(expTime) && expTime > regTime ? expTime - regTime : 0;
  const used = span > 0 ? Math.min(100, Math.max(0, ((Date.now() - regTime) / span) * 100)) : 0;

  const dates = [
    { key: 'registered', label: t('whois.registered'), value: registered, icon: <CalendarDays size={13} /> },
    { key: 'expires', label: t('whois.expires'), value: expires, icon: <Hourglass size={13} /> },
    { key: 'changed', label: t('whois.updated'), value: changed, icon: <RefreshCw size={13} /> },
    { key: 'registry', label: t('whois.registry_update'), value: registryUpdate, icon: <Database size={13} /> },
  ].filter((item) => !!item.value);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
            {record.kind === 'ip' ? <Layers size={20} /> : record.kind === 'autnum' ? <Server size={20} /> : <Globe size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 break-all font-mono">{record.name}</h2>
              <CopyButton text={record.name} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                {t(kindLabelKey(record.kind))}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                {record.source === 'rdap' ? t('whois.source_rdap') : t('whois.source_whois')}
              </span>
              {isRdap && record.handle && (
                <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 font-mono">
                  {record.handle}
                </span>
              )}
              {isRdap && record.dnssecSigned !== undefined && (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                    record.dnssecSigned
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}
                >
                  <ShieldCheck size={11} />
                  DNSSEC {record.dnssecSigned ? t('whois.dnssec_signed') : t('whois.dnssec_unsigned')}
                </span>
              )}
              {isRdap && record.unicodeName && record.ldhName && record.unicodeName !== record.ldhName && (
                <span className="px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                  {record.unicodeName}
                </span>
              )}
            </div>
          </div>
        </div>

        {record.status.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {record.status.map((status) => {
              const description = describeStatus(status, language);
              return (
                <span
                  key={status}
                  title={description || undefined}
                  className="px-2 py-1 text-[11px] font-mono rounded-md bg-gray-50 text-gray-600 border border-gray-200"
                >
                  {eppStatusText(status)}
                </span>
              );
            })}
          </div>
        )}

        {record.mode === 'text' && record.available === true && (
          <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>{t('whois.available_yes')}</span>
          </div>
        )}
      </div>

      {dates.length > 0 && (
        <div className="border-t border-gray-100 px-4 sm:px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {dates.map((item) => (
              <div key={item.key} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  {item.icon}
                  {item.label}
                </div>
                <div className="mt-1 text-sm font-medium text-gray-800 break-words">
                  {formatDate(item.value, language) || '—'}
                </div>
                {item.key === 'expires' && remaining !== null && (
                  <span className={`mt-1.5 inline-block px-1.5 py-0.5 text-[10px] rounded border ${expiryTone(remaining)}`}>
                    {remaining >= 0
                      ? t('whois.days_left', { days: remaining })
                      : t('whois.expired_days', { days: Math.abs(remaining) })}
                  </span>
                )}
              </div>
            ))}
          </div>

          {span > 0 && (
            <div className="mt-3.5">
              <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5">
                <span>{t('whois.lifecycle')}</span>
                <span>{t('whois.lifecycle_used', { percent: Math.round(used) })}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    remaining !== null && remaining <= 30 ? 'bg-red-400' : remaining !== null && remaining <= 90 ? 'bg-amber-400' : 'bg-primary-500'
                  }`}
                  style={{ width: `${Math.max(2, used)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const NetworkCard: React.FC<{ record: WhoisRdapRecord }> = ({ record }) => {
  const { t } = useLanguage();
  const network = record.network;
  const autnum = record.autnum;
  if (!network && !autnum) return null;

  return (
    <Section icon={<Layers size={16} />} title={t('whois.network')}>
      <div className="divide-y divide-gray-50">
        {network?.start && network?.end && (
          <FieldRow label={t('whois.ip_range')}>
            <span className="font-mono text-xs">
              {network.start} – {network.end}
            </span>
          </FieldRow>
        )}
        {network?.cidrs && network.cidrs.length > 0 && (
          <FieldRow label={t('whois.cidr')}>
            <span className="font-mono text-xs">{network.cidrs.join(', ')}</span>
          </FieldRow>
        )}
        {network?.name && <FieldRow label={t('whois.net_name')}>{network.name}</FieldRow>}
        {network?.type && <FieldRow label={t('whois.net_type')}>{network.type}</FieldRow>}
        {network?.country && <FieldRow label={t('whois.country')}>{network.country}</FieldRow>}
        {network?.parentHandle && (
          <FieldRow label={t('whois.parent')}>
            <span className="font-mono text-xs">{network.parentHandle}</span>
          </FieldRow>
        )}
        {autnum && (
          <FieldRow label={t('whois.asn_range')}>
            <span className="font-mono text-xs">
              AS{autnum.start}
              {autnum.end && autnum.end !== autnum.start ? ` – AS${autnum.end}` : ''}
            </span>
          </FieldRow>
        )}
      </div>
    </Section>
  );
};

const NameserverCard: React.FC<{ record: WhoisRdapRecord }> = ({ record }) => {
  const { t } = useLanguage();
  if (record.nameservers.length === 0) return null;

  return (
    <Section
      icon={<Server size={16} />}
      title={t('whois.nameservers')}
      aside={`${record.nameservers.length}`}
    >
      <div className="space-y-1.5">
        {record.nameservers.map((ns) => (
          <div
            key={ns.host}
            className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/60 px-2.5 py-1.5"
          >
            <span className="font-mono text-xs text-gray-800 break-all">{ns.host}</span>
            {[...ns.ipv4, ...ns.ipv6].length > 0 && (
              <span className="font-mono text-[10px] text-gray-400 break-all">
                {[...ns.ipv4, ...ns.ipv6].join(' · ')}
              </span>
            )}
            <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={ns.host} className="p-1 rounded-md text-gray-400 hover:text-primary-600 hover:bg-white" />
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
};

const TextFieldsCard: React.FC<{ record: Extract<WhoisResult, { mode: 'text' }> }> = ({ record }) => {
  const { t } = useLanguage();
  if (record.fields.length === 0) return null;

  return (
    <Section icon={<Layers size={16} />} title={t('whois.fields')} aside={`${record.fields.length}`}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        {record.fields.map((field, index) => (
          <div key={`${field.label}-${index}`} className="py-1.5 border-b border-gray-50 last:border-0">
            <div className="text-[11px] text-gray-400">{field.label}</div>
            <div className="text-xs text-gray-800 font-mono whitespace-pre-line break-all">{field.value}</div>
          </div>
        ))}
      </div>
    </Section>
  );
};

const WhoisLookup: React.FC = () => {
  const { t, language } = useLanguage();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<WhoisResult | null>(null);
  const [error, setError] = useState<ErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [history, setHistory] = useLocalStorage<string[]>(HISTORY_KEY, []);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runQuery = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError(null);
      setResult(null);
      setShowRaw(false);

      try {
        const data = await lookupWhois(query, controller.signal);
        if (abortRef.current !== controller) return;
        setResult(data);
        setShowRaw(data.mode === 'text');
        setInput(query);
        setHistory((prev) => [query, ...prev.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, HISTORY_LIMIT));
      } catch (err: any) {
        if (abortRef.current !== controller) return;
        setError({ code: err?.code || 'network', detail: err?.detail || err?.message });
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [setHistory]
  );

  const inputHint = (() => {
    const text = input.trim();
    if (!text) return '';
    try {
      const { kind } = normalizeQuery(text);
      return t(kindLabelKey(kind));
    } catch {
      return t('whois.err_invalid');
    }
  })();

  const downloadRaw = () => {
    if (!result) return;
    const isRdap = result.mode === 'rdap';
    const payload = isRdap ? JSON.stringify(result.raw, null, 2) : result.raw;
    const blob = new Blob([payload], { type: isRdap ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${result.name.replace(/[^\w.-]+/g, '_')}.${isRdap ? 'rdap.json' : 'whois.txt'}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const rawText = result ? (result.mode === 'rdap' ? JSON.stringify(result.raw, null, 2) : result.raw) : '';
  const isRegistrarRole = (roles: string[]) => roles.includes('registrar') || roles.includes('sponsoring');
  const contacts = result?.mode === 'rdap' ? result.contacts.filter((c) => !isRegistrarRole(c.roles)) : [];
  const registrars = result?.mode === 'rdap' ? result.contacts.filter((c) => isRegistrarRole(c.roles)) : [];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-5 animate-fade-in">
      {/* 查询区 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runQuery(input);
              }}
              placeholder={t('whois.input_ph')}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="w-full pl-9 pr-20 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 font-mono focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {input ? (
                <>
                  <span className="hidden sm:block text-[10px] text-gray-400 px-1">{inputHint}</span>
                  <button
                    onClick={() => setInput('')}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => runQuery(input)}
            disabled={loading || !input.trim()}
            className="px-6 py-3 rounded-xl bg-primary-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-[0.99] disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md transition-all shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {loading ? t('whois.querying') : t('whois.query_btn')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-gray-400">{t('whois.try')}</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => runQuery(example)}
              className="px-2 py-0.5 rounded-md border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all font-mono"
            >
              {example}
            </button>
          ))}
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3 text-xs">
            <span className="text-gray-400">{t('whois.recent')}</span>
            {history.map((item) => (
              <button
                key={item}
                onClick={() => runQuery(item)}
                className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-gray-600 hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-all font-mono"
              >
                {item}
              </button>
            ))}
            <button
              onClick={() => setHistory([])}
              className="ml-auto p-1 text-gray-300 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
              title={t('whois.clear')}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-gray-400 leading-relaxed">
          <Info size={13} className="mt-0.5 shrink-0" />
          {t('whois.tip')}
        </p>
      </div>

      {/* 加载骨架 */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          <div className="h-28 rounded-2xl bg-gray-100" />
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="h-24 rounded-2xl bg-gray-100" />
        </div>
      )}

      {/* 错误 */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-100 bg-red-50/70 p-6 text-center space-y-2">
          <AlertCircle className="mx-auto text-red-500" size={28} />
          <p className="text-sm font-medium text-red-700">{t(ERROR_KEYS[error.code] || 'whois.err_network')}</p>
          {error.code !== 'invalid' && error.detail && (
            <p className="text-xs text-red-400 break-all">{error.detail}</p>
          )}
          {error.code !== 'invalid' && (
            <p className="text-[11px] text-red-400/80">{t('whois.err_hint')}</p>
          )}
        </div>
      )}

      {/* 结果 */}
      {result && !loading && (
        <div className="space-y-4">
          <OverviewCard record={result} />

          {result.mode === 'rdap' ? (
            <>
              {registrars.length > 0 && (
                <Section icon={<Building2 size={16} />} title={t('whois.registrar')}>
                  <div className="space-y-2">
                    {registrars.map((contact, index) => (
                      <div key={contact.handle || index} className="space-y-1">
                        {contact.ianaId && (
                          <p className="text-[11px] text-gray-400">
                            {t('whois.iana_id')}: <span className="font-mono">{contact.ianaId}</span>
                          </p>
                        )}
                        <ContactCard contact={contact} />
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              <NetworkCard record={result} />
              <NameserverCard record={result} />

              {contacts.length > 0 && (
                <Section icon={<Users size={16} />} title={t('whois.contacts')} aside={`${contacts.length}`}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {contacts.map((contact, index) => (
                      <ContactCard key={`${contact.handle || contact.roles.join('-')}-${index}`} contact={contact} />
                    ))}
                  </div>
                </Section>
              )}

              {(result.remarks.length > 0 || result.notices.length > 0) && (
                <details className="group bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none list-none">
                    <Info size={16} className="text-gray-400" />
                    <span className="text-sm font-semibold text-gray-800">{t('whois.remarks')}</span>
                    <ChevronDown size={15} className="ml-auto text-gray-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    {result.remarks.map((remark, index) => (
                      <p key={index} className="text-xs text-gray-600 whitespace-pre-line break-words">
                        {remark}
                      </p>
                    ))}
                    {result.notices.map((notice, index) => (
                      <div key={index} className="space-y-1">
                        <p className="text-xs font-medium text-gray-700">{notice.title}</p>
                        {notice.description.map((line, lineIndex) => (
                          <p key={lineIndex} className="text-[11px] text-gray-500 whitespace-pre-line break-words">
                            {line}
                          </p>
                        ))}
                        {notice.links.map((link) => (
                          <a
                            key={link}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline break-all"
                          >
                            <ArrowUpRight size={11} />
                            {link}
                          </a>
                        ))}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <TextFieldsCard record={result} />
          )}

          {/* 原始数据 */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <button
                onClick={() => setShowRaw((prev) => !prev)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-800"
              >
                <Database size={16} className="text-gray-400" />
                {t('whois.raw')}
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${showRaw ? 'rotate-180' : ''}`} />
              </button>
              <div className="ml-auto flex items-center gap-1.5">
                <CopyButton text={buildReport(result)} label={t('whois.copy_report')} />
                <CopyButton text={rawText} label={t('whois.copy_raw')} />
                <button
                  onClick={downloadRaw}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 transition-all"
                  title={t('whois.download')}
                >
                  <Download size={13} />
                </button>
              </div>
            </div>
            {showRaw && (
              <pre className="max-h-[26rem] overflow-auto border-t border-gray-100 bg-gray-50/70 p-4 text-[11px] leading-relaxed font-mono text-gray-700 whitespace-pre-wrap break-all">
                {rawText}
              </pre>
            )}
          </div>

          <p className="text-center text-[11px] text-gray-400">
            {result.source === 'rdap' ? t('whois.source_rdap_note') : t('whois.source_whois_note')}
            {result.mode === 'rdap' && result.sourceUrl && (
              <>
                {' · '}
                <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-600 hover:underline">
                  {(() => {
                    try {
                      return new URL(result.sourceUrl).hostname;
                    } catch {
                      return result.sourceUrl;
                    }
                  })()}
                </a>
              </>
            )}
            {' · '}
            {formatDate(result.fetchedAt, language)}
          </p>
        </div>
      )}

      {/* 空状态 */}
      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-14 text-center text-gray-400">
          <Globe className="mx-auto mb-3 opacity-20" size={44} />
          <p className="text-sm">{t('whois.empty')}</p>
        </div>
      )}
    </div>
  );
};

export default WhoisLookup;
