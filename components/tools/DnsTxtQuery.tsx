
import React, { useState } from 'react';
import { Globe, Search, Copy, Check, Info, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

type DnsProvider = 'aliyun' | 'google' | 'cloudflare';

interface DnsAnswer {
  name: string;
  type: number;
  data: string;
  TTL: number;
}

const DnsTxtQuery: React.FC = () => {
  const { t } = useLanguage();
  const [domain, setDomain] = useState('');
  const [provider, setProvider] = useState<DnsProvider>('aliyun');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const providers = [
    { id: 'aliyun', name: t('dns.provider_aliyun'), url: 'https://dns.alidns.com/resolve' },
    { id: 'google', name: t('dns.provider_google'), url: 'https://dns.google/resolve' },
    { id: 'cloudflare', name: t('dns.provider_cloudflare'), url: 'https://cloudflare-dns.com/dns-query' },
  ];

  const handleQuery = async () => {
    if (!domain.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults([]);

    const selectedProvider = providers.find(p => p.id === provider);
    if (!selectedProvider) return;

    try {
      const url = new URL(selectedProvider.url);
      url.searchParams.append('name', domain.trim());
      url.searchParams.append('type', 'TXT');
      // Some providers need this for JSON response
      url.searchParams.append('ct', 'application/dns-json');

      const headers: Record<string, string> = {
        'Accept': 'application/dns-json'
      };

      const response = await fetch(url.toString(), { 
        method: 'GET',
        headers,
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.Status !== 0) {
        setResults([]);
        return;
      }

      if (data.Answer) {
        const txtRecords = data.Answer
          .filter((ans: DnsAnswer) => ans.type === 16)
          .map((ans: DnsAnswer) => {
            // Remove surrounding quotes if present
            let text = ans.data;
            if (text.startsWith('"') && text.endsWith('"')) {
              text = text.substring(1, text.length - 1);
            }
            // Handle cases where multiple strings are joined with quotes
            return text.replace(/"\s+"/g, '');
          });
        setResults(txtRecords);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error('DNS Query Error:', err);
      setError(t('dns.status_error'));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-700 text-sm">
        <Info size={18} className="shrink-0 mt-0.5" />
        <p>
          DNS TXT 记录常用于域名所有权验证（如 Google Search Console, SSL 证书验证）以及 SPF/DKIM 等邮件安全配置。不同的 DNS 提供商可能会有不同的生效延迟。
        </p>
      </div>

      {/* Query Form */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('dns.domain')}</label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Globe size={16} />
              </div>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuery()}
                placeholder={t('dns.domain_ph')}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">{t('dns.provider')}</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as DnsProvider)}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm appearance-none cursor-pointer"
            >
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleQuery}
          disabled={loading || !domain.trim()}
          className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md active:scale-[0.98]"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          {loading ? t('dns.status_loading') : t('dns.query_btn')}
        </button>
      </div>

      {/* Results */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          {t('dns.result_title')}
          {results.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
              {results.length}
            </span>
          )}
        </h3>

        {loading ? (
          <div className="h-40 flex items-center justify-center text-gray-400">
            <Loader2 className="animate-spin mr-2" size={24} />
            <span>{t('dns.status_loading')}</span>
          </div>
        ) : error ? (
          <div className="p-8 border border-red-100 bg-red-50 rounded-2xl text-center">
            <AlertCircle className="mx-auto text-red-500 mb-3" size={32} />
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-3">
            {results.map((record, index) => (
              <div 
                key={index}
                className="group relative bg-white border border-gray-200 p-4 rounded-xl hover:border-primary-300 hover:shadow-md transition-all animate-fade-in"
              >
                <div className="font-mono text-sm text-gray-800 break-all pr-12">
                  {record}
                </div>
                <button
                  onClick={() => copyToClipboard(record, index)}
                  className="absolute right-3 top-3 p-2 bg-gray-50 text-gray-400 rounded-lg hover:text-primary-600 hover:bg-primary-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-primary-100"
                >
                  {copiedIndex === index ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            ))}
          </div>
        ) : domain.trim() && !loading && (
          <div className="p-12 border border-dashed border-gray-200 rounded-2xl text-center text-gray-400 bg-gray-50/50">
            <Search className="mx-auto mb-3 opacity-20" size={48} />
            <p>{t('dns.status_not_found')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DnsTxtQuery;
