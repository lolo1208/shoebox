/// <reference lib="dom" />
import React, { useMemo, useState } from 'react';
import { Check, Copy, Search, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClipboard } from '@/hooks/useClipboard';
import {
  GROUP_LABEL,
  GROUP_STYLE,
  HTTP_STATUS_CODES,
  STATUS_GROUPS,
  type StatusGroup,
} from '@/lib/http/status';

const HttpStatusCode: React.FC = () => {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<StatusGroup | 'all'>('all');
  const { copy, isCopied } = useClipboard(1500);

  const results = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return HTTP_STATUS_CODES.filter((item) => {
      if (group !== 'all' && item.group !== group) return false;
      if (!keyword) return true;
      return (
        String(item.code).includes(keyword) ||
        item.phrase.toLowerCase().includes(keyword) ||
        item.zh.toLowerCase().includes(keyword) ||
        item.en.toLowerCase().includes(keyword)
      );
    });
  }, [query, group]);

  const copyCode = (code: number, phrase: string) => void copy(`${code} ${phrase}`, code);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('http.search_ph')}
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setGroup('all')}
            className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
              group === 'all'
                ? 'bg-primary-50 border-primary-200 text-primary-700 font-medium'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
            }`}
          >
            {t('http.all')}
            <span className="ml-1.5 opacity-60">{HTTP_STATUS_CODES.length}</span>
          </button>

          {STATUS_GROUPS.map((item) => {
            const count = HTTP_STATUS_CODES.filter((code) => code.group === item).length;
            const style = GROUP_STYLE[item];
            const active = group === item;
            return (
              <button
                key={item}
                onClick={() => setGroup(active ? 'all' : item)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all flex items-center gap-1.5 ${
                  active ? `${style.badge} font-medium` : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                {t(`http.class.${item}`)}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}

          <span className="ml-auto text-xs text-gray-400">{t('http.count', { n: results.length })}</span>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {results.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">{t('http.empty')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {results.map((item) => {
              const style = GROUP_STYLE[item.group];
              const description = language === 'zh' ? item.zh : item.en;
              return (
                <div
                  key={item.code}
                  className="group flex items-start gap-4 px-4 py-3 hover:bg-gray-50/80 transition-colors"
                >
                  <div
                    className={`shrink-0 w-14 h-7 mt-0.5 rounded-md border flex items-center justify-center font-mono text-sm font-semibold ${style.badge}`}
                  >
                    {item.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-gray-900">{item.phrase}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${style.badge} opacity-80`}>
                        {GROUP_LABEL[item.group][language]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-gray-500">{description}</p>
                  </div>
                  <button
                    onClick={() => copyCode(item.code, item.phrase)}
                    title={t('http.copy')}
                    className="shrink-0 mt-1 p-1.5 text-gray-300 hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100"
                  >
                    {isCopied(item.code) ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HttpStatusCode;
