import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Shuffle, 
  Copy, 
  Check, 
  Search, 
  ShieldCheck, 
  Info, 
  Radio, 
  Server, 
  Layers,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { KNOWN_PORTS, KNOWN_PORTS_SET, KnownPort } from './knownPortsData';
import { useLanguage } from '../../contexts/LanguageContext';

const RandomPortGenerator: React.FC = () => {
  const { t } = useLanguage();

  // 是否仅使用动态/私有端口 (49152 - 65535)
  const [useDynamicRange, setUseDynamicRange] = useState<boolean>(false);
  
  // 生成数量：1，5，10
  const [generateCount, setGenerateCount] = useState<number>(1);

  // 生成的端口列表
  const [generatedPorts, setGeneratedPorts] = useState<number[]>([]);
  
  // 复制成功的端口状态
  const [copiedPort, setCopiedPort] = useState<number | string | null>(null);

  // 搜索和过滤已知端口
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProtocol, setSelectedProtocol] = useState<string>('ALL');

  // 生成单个符合条件的端口
  const getRandomPort = useCallback((min: number, max: number): number => {
    let port: number;
    let attempts = 0;
    const range = max - min + 1;

    do {
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      port = min + (randomBuffer[0] % range);
      attempts++;
    } while (KNOWN_PORTS_SET.has(port) && attempts < 1000);

    return port;
  }, []);

  // 生成指定数量的随机可用端口
  const handleGenerate = useCallback(() => {
    const min = useDynamicRange ? 49152 : 1024;
    const max = 65535;

    const newPorts: number[] = [];
    const usedInBatch = new Set<number>();

    while (newPorts.length < generateCount) {
      const port = getRandomPort(min, max);
      if (!usedInBatch.has(port)) {
        usedInBatch.add(port);
        newPorts.push(port);
      }
    }

    setGeneratedPorts(newPorts);
  }, [useDynamicRange, generateCount, getRandomPort]);

  // 初始加载时自动生成端口
  useEffect(() => {
    handleGenerate();
  }, [handleGenerate]);

  // 一键复制
  const copyToClipboard = (text: string | number, idKey: number | string) => {
    navigator.clipboard.writeText(String(text));
    setCopiedPort(idKey);
    setTimeout(() => {
      setCopiedPort(null);
    }, 1800);
  };

  // 一键复制全部生成的端口号
  const copyAllPorts = () => {
    if (generatedPorts.length === 0) return;
    const text = generatedPorts.join(', ');
    copyToClipboard(text, 'ALL');
  };

  // 过滤已知端口列表
  const filteredKnownPorts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    return KNOWN_PORTS.filter((item) => {
      // 协议过滤
      if (selectedProtocol !== 'ALL') {
        if (selectedProtocol === 'TCP' && !item.protocol.includes('TCP')) return false;
        if (selectedProtocol === 'UDP' && !item.protocol.includes('UDP')) return false;
      }

      // 关键词过滤（匹配端口号、服务名、中文描述）
      if (!query) return true;

      const matchPort = item.port.toString().includes(query);
      const matchService = item.service.toLowerCase().includes(query);
      const matchDesc = item.description.toLowerCase().includes(query);
      const matchProto = item.protocol.toLowerCase().includes(query);

      return matchPort || matchService || matchDesc || matchProto;
    });
  }, [searchQuery, selectedProtocol]);

  return (
    <div className="w-full space-y-8">
      {/* 端口生成主区域 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          {/* 控制面板：区间选择与生成数量 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
            {/* 动态/私有端口范围 Switch 开关 */}
            <label className="inline-flex items-center gap-3 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={useDynamicRange}
                onChange={(e) => setUseDynamicRange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              <div>
                <span className="text-sm font-semibold text-gray-800 group-hover:text-primary-600 transition-colors">
                  使用动态/私有端口范围 (49152 - 65535)
                </span>
                <p className="text-xs text-gray-500">
                  {useDynamicRange ? '已限定 IANA 动态端口区间：49152 - 65535' : '当前端口区间：1024 - 65535'}
                </p>
              </div>
            </label>

            {/* 生成数量与刷新操作 */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-medium">
                {[1, 5, 10].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setGenerateCount(cnt)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      generateCount === cnt
                        ? 'bg-white text-primary-600 shadow-sm font-semibold'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {cnt} 个
                  </button>
                ))}
              </div>

              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm rounded-xl shadow-sm hover:shadow transition-all active:scale-95"
              >
                <Shuffle className="w-4 h-4" />
                <span>生成随机端口</span>
              </button>
            </div>
          </div>

          {/* 生成结果展示卡片 */}
          {generatedPorts.length === 1 ? (
            /* 单个端口大屏卡片 */
            <div className="relative bg-gradient-to-br from-gray-50 to-blue-50/30 border border-gray-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center space-y-4 group">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>可用非已知端口</span>
              </div>

              <div className="text-5xl md:text-6xl font-mono font-bold text-gray-900 tracking-tight select-all">
                {generatedPorts[0]}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => copyToClipboard(generatedPorts[0], generatedPorts[0])}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:border-primary-300 text-gray-800 hover:text-primary-600 font-medium rounded-xl shadow-sm hover:shadow transition-all"
                >
                  {copiedPort === generatedPorts[0] ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">已复制端口</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>复制端口号</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-400">
                范围：{useDynamicRange ? '49152 - 65535 (动态/私有端口)' : '1024 - 65535 (用户与动态端口)'}
              </p>
            </div>
          ) : (
            /* 多个端口网格展示 */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>生成列表（共 {generatedPorts.length} 个随机端口）：</span>
                <button
                  onClick={copyAllPorts}
                  className="flex items-center gap-1 text-primary-600 hover:underline font-medium"
                >
                  {copiedPort === 'ALL' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPort === 'ALL' ? '已复制全部' : '一键复制全部'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {generatedPorts.map((port) => (
                  <div
                    key={port}
                    onClick={() => copyToClipboard(port, port)}
                    className="p-4 bg-gray-50 hover:bg-blue-50/50 border border-gray-200 hover:border-primary-300 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group relative"
                  >
                    <span className="text-2xl font-mono font-bold text-gray-800 group-hover:text-primary-600 transition-colors">
                      {port}
                    </span>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1">
                      {copiedPort === port ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> 已复制
                        </span>
                      ) : (
                        <span className="group-hover:text-gray-600 flex items-center gap-0.5">
                          <Copy className="w-3 h-3" /> 点击复制
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 已知端口号知识库与查询面板 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary-600" />
              <span>已知网络端口库与查询</span>
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              可随时检索常见系统端口、知名应用与数据库监听端口及对应协议（共收录 {KNOWN_PORTS.length} 个常用端口）。
            </p>
          </div>

          {/* 协议筛选 Tag */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl text-xs font-medium self-start md:self-auto">
            {['ALL', 'TCP', 'UDP'].map((proto) => (
              <button
                key={proto}
                onClick={() => setSelectedProtocol(proto)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedProtocol === proto
                    ? 'bg-white text-primary-600 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {proto === 'ALL' ? '全部协议' : proto}
              </button>
            ))}
          </div>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索端口号（如 3306、80）、协议类型或描述服务（如 MySQL、HTTP、SSH、数据库）..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              清空
            </button>
          )}
        </div>

        {/* 端口数据展示列表/表格 */}
        {filteredKnownPorts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
            {filteredKnownPorts.map((item) => (
              <div
                key={`${item.port}-${item.protocol}`}
                className="p-4 bg-gray-50 hover:bg-blue-50/30 border border-gray-200/80 hover:border-primary-200 rounded-xl transition-all flex flex-col justify-between gap-2.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                      {item.port}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${
                        item.protocol.includes('TCP') && item.protocol.includes('UDP')
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : item.protocol === 'TCP'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {item.protocol}
                    </span>
                  </div>

                  <button
                    onClick={() => copyToClipboard(item.port, `known-${item.port}`)}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 transition-all"
                    title="复制端口号"
                  >
                    {copiedPort === `known-${item.port}` ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-800 mb-0.5">
                    {item.service}
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                    {item.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400 text-sm bg-gray-50/50 border border-dashed border-gray-200 rounded-xl">
            未搜到匹配的端口信息，尝试换个关键词（如 "80" 或 "MySQL"）
          </div>
        )}
      </div>
    </div>
  );
};

export default RandomPortGenerator;
