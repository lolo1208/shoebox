
/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Globe, Play, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, Info, Wifi, Server, RotateCw, MapPin, Sliders, Lock, Hash, Activity, ArrowUp, ArrowDown, Route, ChevronDown, BarChart2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// --- Constants ---
const API_BASE = 'https://api.globalping.io/v1';

// Available Regions
const AVAILABLE_REGIONS = [
    { id: 'world', label: '全球随机 (Global Random)', type: 'magic' },
    // Continents
    { id: 'AS', label: '亚太 (Asia)', type: 'continent' },
    { id: 'EU', label: '欧洲 (Europe)', type: 'continent' },
    { id: 'NA', label: '北美 (North America)', type: 'continent' },
    { id: 'OC', label: '大洋洲 (Oceania)', type: 'continent' },
    { id: 'SA', label: '南美 (South America)', type: 'continent' },
    { id: 'AF', label: '非洲 (Africa)', type: 'continent' },
    // Countries
    { id: 'CN', label: '中国 (CN)', type: 'country' },
    { id: 'HK', label: '香港 (HK)', type: 'country' },
    { id: 'TW', label: '台湾 (TW)', type: 'country' },
    { id: 'JP', label: '日本 (JP)', type: 'country' },
    { id: 'SG', label: '新加坡 (SG)', type: 'country' },
    { id: 'US', label: '美国 (US)', type: 'country' },
    { id: 'KR', label: '韩国 (KR)', type: 'country' },
    { id: 'DE', label: '德国 (DE)', type: 'country' },
    { id: 'GB', label: '英国 (UK)', type: 'country' },
    { id: 'FR', label: '法国 (FR)', type: 'country' },
    { id: 'RU', label: '俄罗斯 (RU)', type: 'country' },
    { id: 'BR', label: '巴西 (BR)', type: 'country' },
    { id: 'IN', label: '印度 (IN)', type: 'country' },
];

// --- Types ---

type CheckType = 'ping' | 'http' | 'dns' | 'traceroute' | 'mtr';

interface ProbeLocation {
  continent: string;
  region: string;
  country: string; // ISO 2 code
  city: string;
  asn: number;
  network: string;
}

interface MeasurementResult {
  id: string;
  type: string;
  status: 'in-progress' | 'finished';
  createdAt: string;
  updatedAt: string;
  probesCount: number;
  results: ProbeResult[];
}

interface ProbeResult {
  probe: ProbeLocation;
  result: any; // Dynamic based on type
}

interface RateLimitData {
  limit: number;
  remaining: number;
  reset: number;
}

// Internal State Types
interface NodeResult {
  location: ProbeLocation;
  status: 'pending' | 'success' | 'error';
  data: any; // Raw result data
  summary?: string; // Short summary text (e.g. Latency)
  latency?: number; // Used for color coding
  errorMsg?: string; // Explicit error message
}

interface HistoryData {
    host: string;
    port: string;
    selectedRegions: string[];
    results: NodeResult[];
    probeCount: number;
    protocol?: 'HTTP' | 'HTTPS';
}

// --- Helpers ---

const getCountryName = (code: string) => {
    if (!code || code === 'world') return '全球';
    try {
        return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code) || code;
    } catch (e) {
        return code;
    }
};

const FlagIcon: React.FC<{ code: string; type?: string; className?: string }> = ({ code, type, className = "" }) => {
    // Tooltip removed as requested
    // Handle Continents & World with Globe Icon
    if (!code || code === 'world' || type === 'magic' || type === 'continent') {
        let colorClass = "text-blue-500";
        if (code === 'AS') colorClass = "text-orange-500";
        if (code === 'EU') colorClass = "text-indigo-500";
        if (code === 'NA') colorClass = "text-green-500";
        if (code === 'OC') colorClass = "text-cyan-500";
        
        return <Globe size={16} className={`${colorClass} ${className}`} />;
    }

    return (
        <span 
            className={`fi fi-${code.toLowerCase()} w-5 h-3.5 rounded-[2px] shadow-sm bg-gray-100 bg-cover ${className}`} 
        />
    );
};

const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Sub-Components ---

const ResultRow: React.FC<{
    res: NodeResult;
    type: CheckType;
    getLatencyColorClass: (latency?: number) => string;
}> = ({ res, type, getLatencyColorClass }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    let bgClass = 'bg-white hover:bg-gray-50';
    let borderClass = 'border-gray-200';
    let statusIcon = <Clock size={16} className="text-gray-300 animate-pulse" />;
    let latencyColor = 'text-gray-600';

    if (res.status === 'success') {
        bgClass = 'bg-white hover:bg-gray-50';
        borderClass = 'border-gray-200'; 
        statusIcon = <CheckCircle2 size={16} className="text-green-500" />;
        latencyColor = getLatencyColorClass(res.latency);
    } else if (res.status === 'error') {
        bgClass = 'bg-red-50/50';
        borderClass = 'border-red-200';
        statusIcon = <XCircle size={16} className="text-red-500" />;
        latencyColor = 'text-red-500';
    }

    const cnName = getCountryName(res.location.country);
    const displayLoc = res.location.country === 'world' 
        ? '全球 (Global)' 
        : `${cnName} (${res.location.country}) - ${res.location.city}`;

    const hasTracerouteData = (type === 'traceroute' || type === 'mtr') && res.status === 'success' && res.data.hops && res.data.hops.length > 0;
    const hasErrorData = res.status === 'error' && !!res.errorMsg;
    
    const canExpand = hasTracerouteData || hasErrorData;

    return (
        <div className={`flex flex-col rounded-lg border ${borderClass} ${bgClass} shadow-sm transition-all overflow-hidden`}>
            {/* Header Row */}
            <div 
                className={`flex items-center min-h-[3.5rem] px-4 py-2 gap-4 ${canExpand ? 'cursor-pointer' : ''}`}
                onClick={() => canExpand && setIsExpanded(!isExpanded)}
            >
                {/* Left: Flag & Location Info - Fixed Width */}
                <div className="flex items-center gap-3 w-60 sm:w-80 shrink-0 overflow-hidden">
                    <div className="w-8 h-6 flex items-center justify-center bg-gray-50 border border-black/5 rounded shadow-sm shrink-0">
                        {/* Result always uses country code from probe data, so type is undefined (default to country) */}
                        <FlagIcon code={res.location.country} className="w-full h-full object-cover rounded-[1px]" />
                    </div>
                    
                    <div className="flex flex-col min-w-0">
                        <div className="font-bold text-gray-800 text-sm truncate leading-tight" title={displayLoc}>
                            {displayLoc}
                        </div>
                        <div className="text-[10px] text-gray-400 truncate leading-tight mt-0.5" title={res.location.network}>
                            {res.location.network}
                        </div>
                    </div>
                </div>

                {/* Middle: Result Data - Flex Fill */}
                <div className="flex-1 min-w-0 flex items-center h-full overflow-hidden">
                    {res.status === 'pending' ? (
                        <div className="flex items-center gap-1.5 text-gray-400 text-xs">
                            <Loader2 size={12} className="animate-spin" />
                            <span>检测中...</span>
                        </div>
                    ) : res.status === 'error' ? (
                        <div className="flex flex-col min-w-0">
                            <span className="text-red-500 text-xs font-medium truncate" title={res.errorMsg}>
                                {res.errorMsg ? res.errorMsg.split('\n')[0] : '检测失败'}
                            </span>
                            {res.errorMsg && res.errorMsg.includes('\n') && (
                                <span className="text-[9px] text-red-300 truncate">点击展开查看详情</span>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-between w-full gap-4">
                            {/* Main Data Content */}
                            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                {type === 'dns' && res.data?.answers ? (
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {res.data.answers.length > 0 ? (
                                            <>
                                                <span className="shrink-0 font-bold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded text-[10px] border border-primary-100">
                                                    {res.data.answers[0].type}
                                                </span>
                                                
                                                <div className="flex items-center gap-1 text-gray-700 font-mono text-xs truncate min-w-0" title={res.data.answers[0].value}>
                                                    <span className="truncate select-all">{res.data.answers[0].value}</span>
                                                </div>

                                                <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-500 font-medium px-1.5 py-0.5 rounded border border-gray-100 bg-gray-50 shrink-0" title={`TTL: ${res.data.answers[0].ttl}秒`}>
                                                    <Clock size={10} className="text-gray-400"/>
                                                    <span>{res.data.answers[0].ttl}s</span>
                                                </div>

                                                {res.data.answers.length > 1 && (
                                                    <span className="shrink-0 text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full" title={`共 ${res.data.answers.length} 条记录`}>
                                                        +{res.data.answers.length - 1}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-gray-400 text-xs">无 DNS 记录</span>
                                        )}
                                    </div>
                                ) : type === 'http' ? (
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {/* Status Code */}
                                        <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded border ${res.data.statusCode >= 400 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                            {res.data.statusCode}
                                        </span>

                                        {/* Resolved IP */}
                                        {res.data.resolvedAddress && (
                                            <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px] shrink-0" title={`解析 IP: ${res.data.resolvedAddress}`}>
                                                <Hash size={12} className="text-gray-400"/>
                                                {res.data.resolvedAddress}
                                            </div>
                                        )}

                                        {/* TLS Info */}
                                        {res.data.tls && (
                                            <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[10px] font-medium shrink-0" title={`加密协议: ${res.data.tls.protocol} (${res.data.tls.cipherName || res.data.tls.cipher})`}>
                                                <Lock size={10} />
                                                <span>{res.data.tls.protocol}</span>
                                            </div>
                                        )}

                                        {/* Server Header */}
                                        {res.data.headers && (res.data.headers['server'] || res.data.headers['Server']) && (
                                            <div className="hidden sm:flex items-center gap-1.5 text-gray-400 text-[11px] truncate min-w-0">
                                                <div className="w-px h-3 bg-gray-200 mx-1"></div>
                                                <Server size={12} className="shrink-0" />
                                                <span className="truncate" title={`Server: ${res.data.headers['server'] || res.data.headers['Server']}`}>
                                                    {res.data.headers['server'] || res.data.headers['Server']}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : type === 'traceroute' ? (
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {/* Target IP */}
                                        <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px] shrink-0" title={`目标 IP: ${res.data.resolvedAddress}`}>
                                            <Hash size={12} className="text-gray-400"/>
                                            {res.data.resolvedAddress || 'N/A'}
                                        </div>

                                        {/* Hops Count Badge */}
                                        <div className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-100 shrink-0">
                                            <Route size={10} />
                                            <span>{res.data.hops?.length || 0} Hops</span>
                                        </div>
                                    </div>
                                ) : type === 'mtr' ? (
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {/* Target IP */}
                                        <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px] shrink-0" title={`目标 IP: ${res.data.resolvedAddress}`}>
                                            <Hash size={12} className="text-gray-400"/>
                                            {res.data.resolvedAddress || 'N/A'}
                                        </div>

                                        {/* Loss Badge */}
                                        {(() => {
                                            const lastHop = res.data.hops[res.data.hops.length - 1];
                                            const loss = lastHop?.stats?.loss || 0;
                                            return (
                                                <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${loss === 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                    <Activity size={10} />
                                                    <span>Loss: {loss.toFixed(1)}%</span>
                                                </div>
                                            );
                                        })()}
                                        
                                        {/* Jitter Badge (if available in last hop stats) */}
                                        {(() => {
                                            const lastHop = res.data.hops[res.data.hops.length - 1];
                                            const jitter = lastHop?.stats?.jAvg;
                                            if (typeof jitter === 'number') {
                                                return (
                                                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-gray-50 text-gray-500 border-gray-100 shrink-0">
                                                        <BarChart2 size={10} />
                                                        <span>Jitter: {jitter.toFixed(1)}ms</span>
                                                    </div>
                                                )
                                            }
                                            return null;
                                        })()}
                                    </div>
                                ) : (
                                    // Ping Info
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {/* Resolved IP */}
                                        {res.data.resolvedAddress && (
                                            <div className="flex items-center gap-1 text-gray-500 font-mono text-[11px] shrink-0" title={`解析 IP: ${res.data.resolvedAddress}`}>
                                                <Hash size={12} className="text-gray-400"/>
                                                {res.data.resolvedAddress}
                                            </div>
                                        )}

                                        {/* Packet Loss */}
                                        {res.data.stats && (
                                            <div className={`flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${
                                                (res.data.stats.loss || 0) === 0 
                                                    ? 'bg-green-50 text-green-600 border-green-100' 
                                                    : 'bg-red-50 text-red-600 border-red-100'
                                            }`} title={`丢包率: ${res.data.stats.loss?.toFixed(0)}%`}>
                                                <Activity size={10} />
                                                <span>{res.data.stats.loss?.toFixed(0)}%</span>
                                            </div>
                                        )}

                                        {/* Min/Max RTT */}
                                        {res.data.stats && (
                                            <div className="hidden sm:flex items-center gap-2 text-[10px] text-gray-400 font-mono shrink-0" title="Min / Max Latency">
                                                <div className="w-px h-3 bg-gray-200"></div>
                                                <span className="flex items-center gap-0.5">
                                                    <ArrowDown size={10} className="text-green-500" />
                                                    {res.data.stats.min?.toFixed(0)}
                                                </span>
                                                <span className="flex items-center gap-0.5">
                                                    <ArrowUp size={10} className="text-red-400" />
                                                    {res.data.stats.max?.toFixed(0)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* DNS Resolver Info (Right side of Middle) */}
                            {type === 'dns' && res.data?.resolver && (
                                <div className="hidden sm:flex shrink-0 items-center gap-1.5 text-gray-400 text-[10px] bg-gray-50 px-2 py-1 rounded border border-gray-100 select-none">
                                    <Server size={10} />
                                    <span className="font-mono">via {res.data.resolver}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Latency & Status - Fixed Width */}
                <div className="w-20 sm:w-24 flex items-center justify-end gap-3 shrink-0 pl-2 border-l border-gray-50 sm:border-transparent h-8 sm:h-auto">
                    {res.status === 'success' ? (
                        <span className={`font-mono font-bold text-sm ${latencyColor}`}>{res.summary}</span>
                    ) : (
                        <span></span>
                    )}
                    <div className="hidden sm:block">
                        {statusIcon}
                    </div>
                    {canExpand && (
                        <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                </div>
            </div>

            {/* Expanded Content: Error Log or Traceroute/MTR Details */}
            {canExpand && isExpanded && (
                <div className="bg-gray-50/50 border-t border-gray-100 p-2 sm:pl-[5.5rem] sm:pr-4 overflow-x-auto animate-fade-in">
                    {res.status === 'error' ? (
                        <div className="p-3 bg-red-50 border border-red-100 rounded text-xs font-mono text-red-700 whitespace-pre-wrap break-all relative">
                            <div className="font-bold mb-1 text-red-800 flex items-center gap-2">
                                <AlertTriangle size={12} />
                                错误详情 (Raw Output)
                            </div>
                            {res.errorMsg}
                        </div>
                    ) : type === 'mtr' ? (
                        <table className="w-full text-left text-xs font-mono">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-100/50">
                                    <th className="font-normal py-1.5 w-8 text-center">#</th>
                                    <th className="font-normal py-1.5">Host</th>
                                    <th className="font-normal py-1.5 text-right">Loss%</th>
                                    <th className="font-normal py-1.5 text-right">Snt</th>
                                    <th className="font-normal py-1.5 text-right">Last</th>
                                    <th className="font-normal py-1.5 text-right">Avg</th>
                                    <th className="font-normal py-1.5 text-right">Best</th>
                                    <th className="font-normal py-1.5 text-right">Wrst</th>
                                    <th className="font-normal py-1.5 text-right">StDev</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.data.hops.map((hop: any, i: number) => {
                                    const isTarget = hop.resolvedAddress === res.data.resolvedAddress;
                                    const stats = hop.stats || {};
                                    // Try to get last RTT from timings if available
                                    const lastRtt = hop.timings && hop.timings.length > 0 
                                        ? hop.timings[hop.timings.length - 1].rtt 
                                        : 0;

                                    return (
                                        <tr key={i} className={`border-b border-gray-100/50 last:border-0 hover:bg-white transition-colors ${isTarget ? 'bg-blue-50/50' : ''}`}>
                                            <td className="py-1.5 text-center text-gray-400">{i + 1}</td>
                                            <td className="py-1.5">
                                                <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 max-w-[200px] sm:max-w-none truncate">
                                                    <span className={`truncate ${isTarget ? 'font-bold text-primary-700' : 'text-gray-700'}`}>{hop.resolvedHostname || hop.resolvedAddress || '???'}</span>
                                                </div>
                                            </td>
                                            <td className={`py-1.5 text-right ${stats.loss > 0 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>{stats.loss?.toFixed(1)}%</td>
                                            <td className="py-1.5 text-right text-gray-500">{stats.total}</td>
                                            <td className="py-1.5 text-right text-gray-700">{lastRtt ? lastRtt.toFixed(1) : '-'}</td>
                                            <td className="py-1.5 text-right text-gray-700 font-medium">{stats.avg?.toFixed(1)}</td>
                                            <td className="py-1.5 text-right text-gray-500">{stats.min?.toFixed(1)}</td>
                                            <td className="py-1.5 text-right text-gray-500">{stats.max?.toFixed(1)}</td>
                                            <td className="py-1.5 text-right text-gray-400">{stats.stDev?.toFixed(1)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left text-xs font-mono">
                            <thead>
                                <tr className="text-gray-400 border-b border-gray-100/50">
                                    <th className="font-normal py-1.5 w-10 text-center">#</th>
                                    <th className="font-normal py-1.5">Host / IP</th>
                                    <th className="font-normal py-1.5 text-right w-32">Latency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {res.data.hops.map((hop: any, i: number) => {
                                    const isTarget = hop.resolvedAddress === res.data.resolvedAddress;
                                    return (
                                        <tr key={i} className={`border-b border-gray-100/50 last:border-0 hover:bg-white transition-colors ${isTarget ? 'bg-blue-50/50' : ''}`}>
                                            <td className="py-1.5 text-center text-gray-400">{i + 1}</td>
                                            <td className="py-1.5">
                                                {hop.resolvedHostname || hop.resolvedAddress ? (
                                                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                                                        <span className={`text-gray-800 ${isTarget ? 'font-bold text-primary-700' : ''}`}>{hop.resolvedHostname || hop.resolvedAddress}</span>
                                                        {hop.resolvedHostname && hop.resolvedAddress && hop.resolvedHostname !== hop.resolvedAddress && (
                                                            <span className="text-[10px] text-gray-400">({hop.resolvedAddress})</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">*</span>
                                                )}
                                            </td>
                                            <td className="py-1.5 text-right">
                                                {hop.timings.length > 0 ? (
                                                    <span className="text-gray-600">
                                                        {hop.timings.map((t: any) => Math.round(t.rtt) + 'ms').join('  ')}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-300">*</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

// --- Component ---

const CheckHost: React.FC = () => {
  // Persistence: Store history for each type
  const [savedHistory, setSavedHistory] = useLocalStorage<Record<string, HistoryData>>('tool-checkhost-history', {});
  
  // Helper to safely get data or defaults
  const getInitialData = (t: string): Partial<HistoryData> => savedHistory[t] || ({} as Partial<HistoryData>);

  const [type, setType] = useState<CheckType>('ping');
  
  // Initialize state from 'ping' history (default)
  const [host, setHost] = useState(() => getInitialData('ping').host || '');
  const [port, setPort] = useState(() => getInitialData('ping').port || '');
  const [selectedRegions, setSelectedRegions] = useState<string[]>(() => getInitialData('ping').selectedRegions || ['world', 'CN']);
  const [results, setResults] = useState<NodeResult[]>(() => getInitialData('ping').results || []);
  const [probeCount, setProbeCount] = useState(() => getInitialData('ping').probeCount || 6);
  
  // HTTP Protocol Selector State - Initialize from history or default to HTTPS
  const [protocol, setProtocol] = useState<'HTTP' | 'HTTPS'>(() => getInitialData('http').protocol || 'HTTPS');

  // Runtime State
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [rateLimit, setRateLimit] = useState<RateLimitData | null>(null);

  // Refs
  const pollTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rateLimitTimerRef = useRef<number | null>(null);

  // Cleanup & Initial Fetch
  useEffect(() => {
    updateRateLimit();
    return () => stopCheck();
  }, []);

  // Save to history whenever state changes
  useEffect(() => {
      setSavedHistory(prev => ({
          ...prev,
          [type]: { host, port, selectedRegions, results, probeCount, protocol }
      }));
  }, [host, port, selectedRegions, results, probeCount, type, protocol, setSavedHistory]);

  // Handle Type Switching: Load history
  const handleTypeChange = (newType: CheckType) => {
      const data = getInitialData(newType);
      
      setHost(data.host || '');
      
      // Clear port for ICMP-based types
      if (newType === 'traceroute' || newType === 'mtr') {
          setPort('');
      } else {
          setPort(data.port || '');
      }

      setSelectedRegions(data.selectedRegions || ['world', 'CN']);
      setResults(data.results || []);
      setProbeCount(data.probeCount || 6);
      
      setType(newType);
      
      // Update protocol when switching to HTTP
      if (newType === 'http') {
          // If we have history (data.host exists implies we used it before), use saved protocol. 
          // If no history (or just default empty obj), default to HTTPS.
          // Note: getInitialData returns {} if not found.
          setProtocol(data.protocol || 'HTTPS');
      }

      // Clear runtime errors/status when switching
      setError(null);
      setStatusMsg('');
      setProgress(0);
      setIsChecking(false);
  };

  const handleHostChange = (val: string) => {
      let newHost = val;
      // Auto-detect protocol if type is HTTP
      if (type === 'http') {
          if (newHost.toLowerCase().startsWith('https://')) {
              setProtocol('HTTPS');
              newHost = newHost.substring(8);
          } else if (newHost.toLowerCase().startsWith('http://')) {
              setProtocol('HTTP');
              newHost = newHost.substring(7);
          }
      }
      setHost(newHost);
  };

  // Countdown Logic for Rate Limit
  useEffect(() => {
      if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);

      if (rateLimit && rateLimit.reset > 0) {
          rateLimitTimerRef.current = window.setInterval(() => {
              setRateLimit(prev => {
                  if (!prev) return null;
                  if (prev.reset <= 1) {
                      updateRateLimit();
                      return { ...prev, reset: 0 };
                  }
                  return { ...prev, reset: prev.reset - 1 };
              });
          }, 1000);
      }

      return () => {
          if (rateLimitTimerRef.current) clearInterval(rateLimitTimerRef.current);
      };
  }, [rateLimit?.reset]); 

  const updateRateLimit = async () => {
      try {
          const res = await fetch(`${API_BASE}/limits`);
          if (res.ok) {
              const data = await res.json();
              const info = data.rateLimit?.measurements?.create;
              if (info) {
                  setRateLimit({
                      limit: info.limit,
                      remaining: info.remaining,
                      reset: info.reset
                  });
              }
          }
      } catch (e) {
          console.warn("Failed to fetch limits", e);
      }
  };

  const stopCheck = () => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsChecking(false);
    setStatusMsg('');
    setProgress(0);
  };

  const toggleRegion = (id: string) => {
      setSelectedRegions(prev => {
          if (prev.includes(id)) {
              if (prev.length === 1) return prev;
              return prev.filter(r => r !== id);
          } else {
              return [...prev, id];
          }
      });
  };

  const startCheck = async () => {
    if (!host.trim()) return;
    
    let target = host.trim();
    
    // Safety check: remove protocol if user pasted it and somehow bypassed onChange logic
    // or if they are in non-http mode but still pasted a URL.
    target = target.replace(/^[a-zA-Z]+:\/\//, '');
    target = target.split('/')[0];
    target = target.replace(/:\d+$/, '');

    stopCheck();
    setResults([]);
    setError(null);
    setIsChecking(true);
    setStatusMsg('正在连接 Globalping 网络...');
    setProgress(5);

    abortControllerRef.current = new AbortController();

    try {
      const locationPayload = selectedRegions.map(id => {
          const def = AVAILABLE_REGIONS.find(r => r.id === id);
          if (!def) return { magic: "world" };
          if (def.type === 'magic') return { magic: "world" };
          if (def.type === 'continent') return { continent: id };
          return { country: id };
      });

      const measurementOptions: any = {};
      
      // Handle Port and Protocol options based on type
      if (type === 'http') {
          if (port.trim()) measurementOptions.port = parseInt(port.trim());
          measurementOptions.protocol = protocol;
      } else if (type === 'dns' && port.trim()) {
          measurementOptions.port = parseInt(port.trim());
      }

      const requestBody: any = {
          target: target,
          type: type,
          limit: probeCount, 
          locations: locationPayload,
          measurementOptions: measurementOptions
      };
      
      const res = await fetch(`${API_BASE}/measurements`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: abortControllerRef.current.signal
      });

      updateRateLimit();

      if (!res.ok) {
          if (res.status === 429) throw new Error("请求过于频繁或配额不足 (429)。");
          if (res.status === 422) {
              const errData = await res.json().catch(() => ({}));
              if (errData.error?.type === 'too_many_probes') throw new Error(`请求的节点数(${probeCount})过多，当前可用不足。`);
              if (errData.error?.params?.target) throw new Error("目标地址格式无效。");
              throw new Error("参数校验失败。");
          }
          throw new Error(`API Error: ${res.status}`);
      }

      const data = await res.json();
      const measurementId = data.id;

      if (!measurementId) throw new Error("未获取到测速 ID");

      setStatusMsg(`任务下发成功 (${probeCount} 节点)，正在等待响应...`);
      setProgress(10);

      pollResults(measurementId);

    } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error(err);
        setError(err.message || '检测启动失败');
        setIsChecking(false);
    }
  };

  const pollResults = async (id: string, attempt = 0) => {
      if (attempt > 30) { 
          stopCheck();
          return;
      }

      try {
          const res = await fetch(`${API_BASE}/measurements/${id}`, {
              signal: abortControllerRef.current?.signal
          });

          if (!res.ok) throw new Error("Poll failed");

          const data: MeasurementResult = await res.json();
          
          const processedResults: NodeResult[] = data.results.map(r => {
              const probe = r.probe;
              const raw = r.result;
              let status: 'success' | 'error' | 'pending' = 'pending';
              let summary = '';
              let latency = 0;
              let errorMsg = '';

              if (raw.status === 'in-progress') {
                  status = 'pending';
                  summary = 'Waiting...';
              } else if (raw.status === 'failed') {
                  status = 'error';
                  summary = 'Failed';
                  errorMsg = raw.rawOutput || 'Unknown error';
              } else {
                  if (type === 'ping') {
                      const stats = raw.stats;
                      if (!stats) {
                          status = 'error';
                          summary = 'Timeout';
                      } else {
                          const total = stats.total || 0;
                          const drop = stats.drop || 0;
                          const lossPercent = total > 0 ? (drop / total) * 100 : 100;
                          
                          if (lossPercent === 100) {
                              status = 'error';
                              summary = '100% Loss';
                          } else {
                              status = 'success';
                              latency = stats.avg;
                              summary = `${stats.avg.toFixed(0)}ms`;
                          }
                      }
                  } else if (type === 'http') {
                      if (raw.status !== 'finished') {
                          status = 'error';
                          summary = 'Error';
                      } else {
                          const code = raw.statusCode;
                          status = (code >= 200 && code < 400) ? 'success' : 'error';
                          latency = raw.timings?.total ?? 0;
                          summary = `${latency.toFixed(0)}ms`;
                      }
                  } else if (type === 'dns') {
                      if (raw.status !== 'finished') {
                          status = 'error';
                          summary = 'Error';
                      } else {
                          status = 'success';
                          latency = raw.timings?.total ?? 0;
                          // If latency is 0, it means cached/very fast. Display as <1ms for clarity.
                          summary = latency === 0 ? '<1ms' : `${latency.toFixed(0)}ms`;
                      }
                  } else if (type === 'traceroute' || type === 'mtr') {
                      if (raw.status === 'finished') {
                          status = 'success';
                          const hops = raw.hops || [];
                          const isMtr = type === 'mtr';
                          
                          if (isMtr) {
                              // For MTR, we look at the last hop for summary stats
                              const lastHop = hops[hops.length - 1];
                              if (lastHop && lastHop.stats) {
                                  latency = lastHop.stats.avg;
                                  if (lastHop.stats.loss === 100) {
                                      summary = '100% Loss';
                                      status = 'error';
                                  } else {
                                      summary = `${latency.toFixed(0)}ms`;
                                  }
                              } else {
                                  summary = 'No Data';
                              }
                          } else {
                              // Traceroute Logic
                              for (let i = hops.length - 1; i >= 0; i--) {
                                  const h = hops[i];
                                  if (h.timings && h.timings.length > 0) {
                                      const avg = h.timings.reduce((sum: number, t: any) => sum + t.rtt, 0) / h.timings.length;
                                      latency = avg;
                                      break;
                                  }
                              }
                              // Summary uses latency if available
                              if (latency > 0) {
                                  summary = `${latency.toFixed(0)}ms`;
                              } else {
                                  summary = `${hops.length} Hops`;
                              }
                          }
                      } else {
                          status = 'error';
                          summary = 'Error';
                      }
                  }
              }

              return { location: probe, status, data: raw, summary, latency, errorMsg };
          });

          setResults(processedResults);
          
          const finishedCount = processedResults.filter(r => r.status !== 'pending').length;
          const p = Math.min(100, 10 + (finishedCount / probeCount) * 90);
          setProgress(p);

          if (data.status === 'finished') {
              setStatusMsg(`检测完成，共获取 ${processedResults.length} 个节点数据`);
              setIsChecking(false);
          } else {
              pollTimerRef.current = window.setTimeout(() => {
                  pollResults(id, attempt + 1);
              }, 1500);
          }

      } catch (err: any) {
          if (err.name === 'AbortError') return;
          console.error("Poll Error:", err);
          pollTimerRef.current = window.setTimeout(() => {
              pollResults(id, attempt + 1);
          }, 2000);
      }
  };

  const getLatencyColorClass = (latency?: number) => {
      if (!latency && latency !== 0) return 'text-gray-500'; // Handle 0 valid case
      if (latency < 100) return 'text-green-600';
      if (latency < 300) return 'text-amber-600';
      return 'text-red-600';
  };

  const getDefaultPort = () => {
      if (type === 'http') {
          return protocol === 'HTTPS' ? '443' : '80';
      }
      if (type === 'dns') return '53';
      if (type === 'ping') return '22'; // Visual default only
      if (type === 'traceroute' || type === 'mtr') return 'ICMP';
      return '';
  };

  const getQuotaColor = () => {
      if (!rateLimit) return 'text-gray-700';
      const percent = rateLimit.remaining / rateLimit.limit;
      if (percent > 0.5) return 'text-green-600';
      if (percent > 0.2) return 'text-amber-600';
      return 'text-red-600';
  };

  // --- Sorting Results ---
  const sortedResults = [...results].sort((a, b) => {
      // 1. Status Priority: Success (0) < Pending (1) < Error (2)
      const getStatusScore = (s: string) => {
          if (s === 'success') return 0;
          if (s === 'pending') return 1;
          return 2; // error
      };
      
      const scoreA = getStatusScore(a.status);
      const scoreB = getStatusScore(b.status);
      
      if (scoreA !== scoreB) return scoreA - scoreB;

      // 2. If both Success, sort by Latency (Ascending)
      if (a.status === 'success' && b.status === 'success') {
          return (a.latency || 0) - (b.latency || 0); // Handle 0
      }
      
      return 0;
  });

  return (
    <div className="flex flex-col gap-6">
       {/* Input Area */}
       <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
           
           <div className="flex flex-col md:flex-row gap-4">
               {/* Host */}
               <div className="flex-[3]">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">目标地址 (Host)</label>
                   <div className="relative flex">
                       {/* Protocol Selector for HTTP */}
                       {type === 'http' && (
                           <select 
                               value={protocol}
                               onChange={(e) => setProtocol(e.target.value as 'HTTP' | 'HTTPS')}
                               className="pl-3 pr-8 py-2.5 bg-gray-50 border border-r-0 border-gray-300 rounded-l-lg text-sm focus:ring-0 focus:border-gray-300 outline-none appearance-none cursor-pointer font-bold text-gray-600 w-24 shrink-0"
                           >
                               <option value="HTTP">http://</option>
                               <option value="HTTPS">https://</option>
                           </select>
                       )}
                       
                       <div className="relative w-full">
                           <input 
                                type="text" 
                                value={host}
                                onChange={(e) => handleHostChange(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && startCheck()}
                                placeholder={type === 'http' ? "google.com" : "1.1.1.1"}
                                className={`
                                    w-full py-2.5 bg-gray-50 border border-gray-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all
                                    ${type === 'http' ? 'rounded-r-lg pl-3 pr-4 border-l-0' : 'rounded-lg pl-10 pr-4'}
                                `}
                           />
                           {type !== 'http' && <Globe className="absolute left-3 top-2.5 text-gray-400" size={18} />}
                       </div>
                   </div>
               </div>

               {/* Port */}
               <div className="flex-1 min-w-[100px] max-w-[140px]">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">端口</label>
                   <div className="relative">
                       <input 
                            type="text" 
                            value={port}
                            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={(e) => e.key === 'Enter' && startCheck()}
                            placeholder={getDefaultPort()}
                            disabled={isChecking || type === 'traceroute' || type === 'mtr'}
                            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                       />
                       <Hash className="absolute left-3 top-2.5 text-gray-400" size={18} />
                   </div>
               </div>

               {/* Type */}
               <div className="flex-1 min-w-[140px]">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 ml-1">类型</label>
                   <div className="relative">
                       <select 
                            value={type}
                            onChange={(e) => handleTypeChange(e.target.value as CheckType)}
                            className="w-full pl-9 pr-8 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none appearance-none cursor-pointer"
                       >
                           <option value="ping">Ping</option>
                           <option value="http">HTTP(s)</option>
                           <option value="dns">DNS</option>
                           <option value="traceroute">Traceroute</option>
                           <option value="mtr">MTR</option>
                       </select>
                       <div className="absolute left-3 top-2.5 text-gray-400 pointer-events-none">
                           {type === 'ping' && <Wifi size={18} />}
                           {type === 'http' && <Globe size={18} />}
                           {type === 'dns' && <Info size={18} />}
                           {type === 'traceroute' && <Route size={18} />}
                           {type === 'mtr' && <Activity size={18} />}
                       </div>
                   </div>
               </div>

               {/* Button */}
               <div className="flex items-end">
                   <button 
                        onClick={startCheck}
                        disabled={isChecking || !host}
                        className="w-full md:w-auto px-6 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                   >
                       {isChecking ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                       {isChecking ? '检测中...' : '开始'}
                   </button>
               </div>
           </div>

           {/* Region Selection */}
           <div className="flex flex-col md:flex-row gap-6 pt-2">
               <div className="flex-1">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1 flex items-center gap-2">
                       <MapPin size={12} />
                       测试区域 (多选)
                   </label>
                   <div className="flex flex-wrap gap-2">
                       {AVAILABLE_REGIONS.map(region => {
                           const isSelected = selectedRegions.includes(region.id);
                           return (
                               <button
                                    key={region.id}
                                    onClick={() => toggleRegion(region.id)}
                                    className={`
                                        flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all select-none
                                        ${isSelected 
                                            ? 'bg-primary-50 border-primary-200 text-primary-700 font-bold shadow-sm' 
                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}
                                    `}
                               >
                                   <FlagIcon code={region.id} type={region.type} />
                                   {region.label.split(' ')[0]}
                               </button>
                           );
                       })}
                   </div>
               </div>

               <div className="md:w-64 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center justify-between">
                       <div className="flex items-center gap-2"><Sliders size={12}/> 节点数量</div>
                       <span className="text-primary-600 font-mono text-sm">{probeCount}</span>
                   </label>
                   <input 
                        type="range" 
                        min="1" 
                        max="16" 
                        step="1"
                        value={probeCount}
                        onChange={(e) => setProbeCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                   />
                   <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                       <span>1</span>
                       <span>8</span>
                       <span>16</span>
                   </div>
               </div>
           </div>
           
           {/* Footer Info */}
           <div className="pt-2 mt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500">
               <div className="flex items-center gap-1.5">
                   <Info size={14} className="text-blue-500" />
                   <span>Globalping 分布式网络</span>
               </div>
               
               {rateLimit && (
                   <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <Server size={14} className="text-gray-400" />
                            <span>配额: <span className={`font-mono font-bold ${getQuotaColor()}`}>{rateLimit.remaining}</span>/{rateLimit.limit}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="每秒自动刷新">
                            <Clock size={14} className={rateLimit.reset <= 5 ? "text-red-500 animate-pulse" : "text-gray-400"} />
                            <span>重置: <span className="font-mono font-medium text-gray-700">{formatTime(rateLimit.reset)}</span></span>
                        </div>
                   </div>
               )}
           </div>
           
           {/* Error Display */}
           {error && (
               <div className="mt-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2 border border-red-100 animate-fade-in">
                   <AlertTriangle size={16} />
                   {error}
               </div>
           )}
       </div>

       {/* Progress Bar */}
       {isChecking && (
           <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
               <div 
                  className="h-full bg-primary-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
               ></div>
           </div>
       )}

       {/* Results List */}
       {sortedResults.length > 0 && (
           <div className="flex flex-col gap-2 animate-fade-in">
               {sortedResults.map((res, index) => (
                   <ResultRow 
                        key={index} 
                        res={res} 
                        type={type}
                        getLatencyColorClass={getLatencyColorClass} 
                   />
               ))}
           </div>
       )}
       
       {!isChecking && results.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                <Globe size={64} strokeWidth={1} className="mb-4 text-gray-200" />
                <p>输入域名或 IP，调用全球探针进行检测</p>
            </div>
       )}
    </div>
  );
};

export default CheckHost;
