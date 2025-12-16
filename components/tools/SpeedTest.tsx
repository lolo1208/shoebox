/// <reference lib="dom" />
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Square, Wifi, Globe, Server, ArrowDown, ArrowUp, Activity, Gauge, MapPin, Award, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// --- Worker Code (Inlined for portability) ---
const WORKER_CODE = `
/* eslint-disable no-restricted-globals */

// --- Constants ---
const CHINA_FILES = [
  'https://cdn.npmmirror.com/binaries/electron/28.2.0/electron-v28.2.0-win32-x64.zip',
  'https://cdn.npmmirror.com/binaries/node/v20.11.0/node-v20.11.0-win-x64.zip',
  'https://cdn.npmmirror.com/binaries/nwjs/v0.82.0/nwjs-sdk-v0.82.0-win-x64.zip',
  'https://registry.npmmirror.com/-/binary/python/3.11.8/python-3.11.8-amd64.exe'
];

const CHINA_PING_URL = 'https://registry.npmmirror.com/'; 
const TEST_DURATION = 10000; // 10 seconds per phase

// --- State ---
let isRunning = false;
let totalBytes = 0;
let lastSpeedUpdate = 0;
let activeConnections = [];

// --- Main Handler ---
self.onmessage = async (e) => {
  const { type, mode } = e.data;

  if (type === 'stop') {
    stopTest();
    return;
  }

  if (type === 'start' && mode) {
    isRunning = true;
    activeConnections = [];
    try {
      if (mode === 'china') {
        await runChinaTest();
      } else {
        await runGlobalTest();
      }
    } catch (err) {
      if (isRunning) { 
        self.postMessage({ type: 'error', data: err.message });
      }
    } finally {
      stopTest();
      self.postMessage({ type: 'done' });
    }
  }
};

function stopTest() {
  isRunning = false;
  activeConnections.forEach(conn => {
    if (conn instanceof AbortController) {
      conn.abort();
    } else if (conn instanceof WebSocket) {
      conn.close();
    }
  });
  activeConnections = [];
}

async function runChinaTest() {
  // China mode ping
  await measurePing(CHINA_PING_URL);

  if (!isRunning) return;

  self.postMessage({ type: 'status', phase: 'download', data: 'initializing' });
  
  const validFiles = [];
  for (const url of CHINA_FILES) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2000); 
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);
      if (res.ok) validFiles.push(url);
    } catch (e) {}
    if (validFiles.length >= 2) break; 
  }

  if (validFiles.length === 0) throw new Error("无法连接到测速节点 (npmmirror)");

  const CONCURRENCY = 6;
  totalBytes = 0;
  const startTime = performance.now();
  lastSpeedUpdate = startTime;

  const workers = Array.from({ length: CONCURRENCY }).map(async (_, i) => {
    const url = validFiles[i % validFiles.length] + '?t=' + Date.now() + '-' + i;
    const controller = new AbortController();
    activeConnections.push(controller);

    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.body) return;
      const reader = res.body.getReader();
      
      while (isRunning) {
        // Check duration strictly
        if (performance.now() - startTime > TEST_DURATION) break;

        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          reportSpeed('download', startTime);
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  });

  // Wait for duration or stop
  await Promise.race([
    Promise.all(workers),
    new Promise(r => setTimeout(r, TEST_DURATION + 1000))
  ]);
  
  // Ensure final 100% report
  reportSpeed('download', startTime, true);
}

async function runGlobalTest() {
  self.postMessage({ type: 'status', phase: 'ping', data: 'locating' });

  // Use M-Lab Locate API v2 for NDT7 (Standard)
  const locateRes = await fetch('https://locate.measurementlab.net/v2/nearest/ndt/ndt7');
  if (!locateRes.ok) throw new Error('无法定位 M-Lab 服务器');
  
  const data = await locateRes.json();
  if (!data.results || data.results.length === 0) throw new Error('未找到可用节点');
  
  const server = data.results[0];
  
  if (!server.urls || !server.urls['wss:///ndt/v7/download'] || !server.urls['wss:///ndt/v7/upload']) {
      throw new Error('节点返回格式不兼容 NDT7');
  }

  const dlUrl = server.urls['wss:///ndt/v7/download'];
  const ulUrl = server.urls['wss:///ndt/v7/upload'];

  // Measure Ping using Google's generate_204 endpoint with no-cors to avoid CORS issues
  await measurePing('https://www.gstatic.com/generate_204');

  if (!isRunning) return;

  self.postMessage({ type: 'status', phase: 'download', data: 'starting' });
  await runNdt7Download(dlUrl);

  if (!isRunning) return;

  self.postMessage({ type: 'status', phase: 'upload', data: 'starting' });
  await runNdt7Upload(ulUrl);
}

function runNdt7Download(url) {
  return new Promise((resolve) => {
    const sock = new WebSocket(url, 'net.measurementlab.ndt.v7');
    activeConnections.push(sock);
    
    sock.binaryType = 'arraybuffer';
    
    totalBytes = 0;
    const startTime = performance.now();
    lastSpeedUpdate = startTime;

    sock.onopen = () => {
      // Close after duration
      setTimeout(() => { 
          if(isRunning) sock.close(); 
      }, TEST_DURATION);
    };

    sock.onmessage = (e) => {
      if (!isRunning) { sock.close(); return; }
      if (e.data instanceof ArrayBuffer) {
        totalBytes += e.data.byteLength;
        reportSpeed('download', startTime);
      }
    };

    sock.onclose = () => {
        reportSpeed('download', startTime, true); // Final report
        resolve();
    };
    sock.onerror = (e) => { console.error(e); resolve(); }; 
  });
}

function runNdt7Upload(url) {
  return new Promise((resolve) => {
    const sock = new WebSocket(url, 'net.measurementlab.ndt.v7');
    activeConnections.push(sock);

    totalBytes = 0;
    const startTime = performance.now();
    lastSpeedUpdate = startTime;

    // Use larger buffer for high speed connections
    const bufferSize = 65536; 
    const buffer = new Uint8Array(bufferSize);
    for (let i = 0; i < bufferSize; i++) buffer[i] = Math.random() * 255;

    sock.onopen = () => {
      const send = () => {
        if (!isRunning) { sock.close(); return; }
        
        const now = performance.now();
        if (now - startTime > TEST_DURATION) { 
            sock.close(); 
            return; 
        }

        // Keep buffer relatively full (approx 8MB) to saturate link
        // Standard NDT7 client aims to keep buffer full enough but not exploding memory
        while (sock.bufferedAmount < 8388608) { 
           try {
             sock.send(buffer);
             totalBytes += bufferSize;
           } catch (e) {
             sock.close();
             return;
           }
        }
        
        reportSpeed('upload', startTime);
        
        // Minimal delay to keep event loop breathing but max throughput
        setTimeout(send, 0); 
      };
      
      send();
    };

    sock.onclose = () => {
        reportSpeed('upload', startTime, true); // Final report
        resolve();
    };
    sock.onerror = (e) => { console.error(e); resolve(); };
  });
}

async function measurePing(url) {
  self.postMessage({ type: 'status', phase: 'ping', data: 'warmup' });

  const pings = [];
  const COUNT = 10; 
  
  // Warmup with no-cors to handle opaque responses (like gstatic)
  try { 
      await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' }); 
  } catch(e) {}

  for (let i = 0; i < COUNT; i++) {
    if (!isRunning) return;
    try {
      const start = performance.now();
      // Use GET + no-cors for maximum compatibility
      await fetch(url + '?t=' + start, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
      const end = performance.now();
      pings.push(end - start);
      
      const validPings = pings.filter(p => p > 0);
      if (validPings.length > 0) {
        const avg = validPings.reduce((a, b) => a + b, 0) / validPings.length;
        let jitter = 0;
        if (validPings.length > 1) {
           let diffSum = 0;
           for(let j=1; j<validPings.length; j++) {
             diffSum += Math.abs(validPings[j] - validPings[j-1]);
           }
           jitter = diffSum / (validPings.length - 1);
        }
        
        self.postMessage({ 
          type: 'metric', 
          phase: 'ping', 
          data: { latency: avg, jitter: jitter, count: i+1 } 
        });
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
        // Ignore failed pings
    }
  }
}

function reportSpeed(phase, startTime, forceFinal = false) {
  const now = performance.now();
  const duration = (now - startTime) / 1000; 
  
  if (duration <= 0) return;

  if (forceFinal || now - lastSpeedUpdate > 100) {
    const bps = (totalBytes * 8) / duration; 
    
    // Calculate progress (0-100), clamp at 100
    let progress = Math.min(100, (duration * 1000 / TEST_DURATION) * 100);
    if (forceFinal) progress = 100;

    self.postMessage({
      type: 'metric',
      phase: phase,
      data: {
        bps: bps,
        progress: progress
      }
    });
    lastSpeedUpdate = now;
  }
}
`;

// --- Types ---

type TestMode = 'china' | 'global';
type TestState = 'idle' | 'ping' | 'download' | 'upload' | 'done';

interface TestMetrics {
  latency: number;
  jitter: number;
  downloadBps: number;
  uploadBps: number;
  progress: number; // 0-100 for current phase
  lastRun: number; // Timestamp
  chartData: number[]; // Store recent chart points
}

const DEFAULT_METRICS: TestMetrics = {
    latency: 0,
    jitter: 0,
    downloadBps: 0,
    uploadBps: 0,
    progress: 0,
    lastRun: 0,
    chartData: []
};

// --- Components ---

// SVG Gauge Component
const SpeedGauge: React.FC<{ 
  value: number; // bps
  label: string;
  isActive: boolean; // Controls color vs gray
  max?: number;
  colorClass: string;
}> = ({ value, label, isActive, max = 1000, colorClass }) => {
  // Convert bps to Mbps for display
  const mbps = value / 1_000_000;
  
  // Dynamic scale: If mbps > 1000, scale max to 2000 or higher
  const displayMax = mbps > 1000 ? Math.ceil(mbps / 1000) * 1200 : 1000;
  
  const radius = 80;
  const stroke = 12;
  const normalizedValue = Math.min(mbps, displayMax);
  const circumference = radius * Math.PI;
  const strokeDashoffset = circumference - (normalizedValue / displayMax) * circumference;

  return (
    <div className={`relative flex flex-col items-center transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-60 grayscale'}`}>
      <div className="relative w-48 h-24 overflow-hidden mb-2">
        <svg className="w-48 h-48 transform rotate-[0deg]" viewBox="0 0 200 200">
          {/* Background Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset="0"
            strokeLinecap="round"
            style={{ transform: 'rotate(180deg)', transformOrigin: 'center' }}
          />
          {/* Progress Arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="currentColor"
            className={colorClass}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ 
                transform: 'rotate(180deg)', 
                transformOrigin: 'center',
                transition: 'stroke-dashoffset 0.3s ease-out'
            }}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
             <div className={`text-3xl font-black tracking-tighter ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                 {mbps.toFixed(1)}
             </div>
             <div className="text-xs font-bold text-gray-400 uppercase">Mbps</div>
        </div>
      </div>
      <div className="font-bold text-gray-600 flex items-center gap-2">
          {label === '下载' ? <ArrowDown size={16}/> : <ArrowUp size={16}/>}
          {label}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ icon: React.ReactNode, label: string, value: string, unit: string, highlight?: boolean }> = ({ icon, label, value, unit, highlight }) => (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${highlight ? 'bg-white border-primary-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-80'}`}>
        <div className={`p-2.5 rounded-lg ${highlight ? 'bg-primary-50 text-primary-600' : 'bg-gray-200 text-gray-500'}`}>
            {icon}
        </div>
        <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">{label}</div>
            <div className="flex items-baseline gap-1">
                <span className={`text-xl font-bold font-mono ${highlight ? 'text-gray-900' : 'text-gray-500'}`}>{value}</span>
                <span className="text-xs text-gray-400">{unit}</span>
            </div>
        </div>
    </div>
);

// --- Helper for Broadband Label ---
const getBandwidthLabel = (bps: number) => {
    const mbps = bps / 1_000_000;
    if (mbps > 850) return "千兆级宽带 (1000M+)";
    if (mbps > 450) return "500M 宽带";
    if (mbps > 280) return "300M 宽带";
    if (mbps > 180) return "200M 宽带";
    if (mbps > 90) return "100M 宽带";
    if (mbps > 45) return "50M 宽带";
    if (mbps > 15) return "20M 宽带";
    return "基础宽带";
};

// --- Main Component ---

const SpeedTest: React.FC = () => {
  // --- Auto-detect Mode ---
  const detectDefaultMode = (): TestMode => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz.includes('Shanghai') || tz.includes('Beijing') || tz.includes('Chongqing') || tz.includes('Urumqi')) {
          return 'china';
      }
      return 'global';
  };

  const [mode, setMode] = useLocalStorage<TestMode>('tool-speedtest-mode', detectDefaultMode());
  
  // NOTE: We use standard useState for high-frequency updates to avoid race conditions 
  // in the custom useLocalStorage hook (which can use stale closures during rapid worker messages).
  // We sync to localStorage manually via useEffect.
  const [results, setResults] = useState<Record<TestMode, TestMetrics>>(() => {
      try {
          const item = window.localStorage.getItem('tool-speedtest-results');
          return item ? JSON.parse(item) : { china: { ...DEFAULT_METRICS }, global: { ...DEFAULT_METRICS } };
      } catch {
          return { china: { ...DEFAULT_METRICS }, global: { ...DEFAULT_METRICS } };
      }
  });

  // Sync results to localStorage when they change
  useEffect(() => {
      window.localStorage.setItem('tool-speedtest-results', JSON.stringify(results));
  }, [results]);

  const [state, setState] = useState<TestState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stoppedByUser, setStoppedByUser] = useState(false);
  
  // Real-time progress state (volatile, resets on mount/switch)
  const [currentProgress, setCurrentProgress] = useState(0);

  // Helper to update current mode result
  // Using functional update here guarantees we work with latest state, fixing the "clear data" bug
  const updateResult = (updater: (prev: TestMetrics) => TestMetrics) => {
      setResults(prev => ({
          ...prev,
          [mode]: updater(prev[mode])
      }));
  };

  const metrics = results[mode]; // Current visible metrics

  // Chart Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartDataRef = useRef<number[]>([]); // Store recent bps points for drawing

  const workerRef = useRef<Worker | null>(null);
  const workerUrlRef = useRef<string | null>(null);

  // --- Chart Drawing ---
  const drawChart = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      
      ctx.clearRect(0, 0, w, h);
      
      // Grid
      ctx.strokeStyle = '#f3f4f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h/2); ctx.lineTo(w, h/2);
      ctx.moveTo(0, h/4); ctx.lineTo(w, h/4);
      ctx.moveTo(0, h*0.75); ctx.lineTo(w, h*0.75);
      ctx.stroke();

      const data = chartDataRef.current;
      if (data.length < 2) return;

      ctx.strokeStyle = '#2a97ff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, 'rgba(42, 151, 255, 0.2)');
      gradient.addColorStop(1, 'rgba(42, 151, 255, 0)');

      ctx.beginPath();
      
      const maxVal = Math.max(...data, 1000000); 
      const stepX = w / (data.length - 1);

      data.forEach((val, i) => {
          const x = i * stepX;
          const y = h - (val / maxVal) * h * 0.9;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
      });
      ctx.stroke();

      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

  }, []);

  // Restore chart data when mode changes
  // We use a ref to check if we need to restore to avoid resetting during active test
  useEffect(() => {
      // Only restore if idle to avoid interrupting active visualization
      if (state === 'idle' || state === 'done') {
          const savedMetrics = results[mode];
          if (savedMetrics && savedMetrics.chartData && savedMetrics.chartData.length > 0) {
              chartDataRef.current = [...savedMetrics.chartData];
          } else {
              chartDataRef.current = [];
          }
          requestAnimationFrame(() => drawChart());
      }
  }, [mode, results, state, drawChart]); 

  useEffect(() => {
      return () => {
          if (workerRef.current) workerRef.current.terminate();
          if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
      };
  }, []);

  useEffect(() => {
      let animId: number;
      // Animate if running
      if (state === 'download' || state === 'upload') {
          const loop = () => {
              drawChart();
              animId = requestAnimationFrame(loop);
          };
          loop();
      }
      return () => cancelAnimationFrame(animId);
  }, [state, drawChart]);

  const startTest = () => {
      if (state !== 'idle' && state !== 'done') return;
      
      setState('ping');
      setError(null);
      setStoppedByUser(false);
      setCurrentProgress(0);
      
      // Reset only current mode metrics
      updateResult(() => ({ ...DEFAULT_METRICS, lastRun: Date.now() }));
      
      chartDataRef.current = new Array(50).fill(0); 

      if (workerRef.current) workerRef.current.terminate();
      if (workerUrlRef.current) URL.revokeObjectURL(workerUrlRef.current);
      
      try {
          const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
          const workerUrl = URL.createObjectURL(blob);
          workerUrlRef.current = workerUrl;

          workerRef.current = new Worker(workerUrl);
          
          let currentPhase: TestState = 'ping';

          workerRef.current.onmessage = (e) => {
              const { type, phase, data } = e.data;
              
              if (type === 'metric') {
                  if (phase === 'ping') {
                      updateResult(prev => ({ ...prev, latency: data.latency, jitter: data.jitter }));
                  } else if (phase === 'download') {
                      setCurrentProgress(data.progress);
                      updateResult(prev => ({ ...prev, downloadBps: data.bps, progress: data.progress }));
                      // Chart
                      chartDataRef.current.push(data.bps);
                      if (chartDataRef.current.length > 50) chartDataRef.current.shift();
                  } else if (phase === 'upload') {
                      setCurrentProgress(data.progress);
                      updateResult(prev => ({ ...prev, uploadBps: data.bps, progress: data.progress }));
                      // Chart
                      chartDataRef.current.push(data.bps);
                      if (chartDataRef.current.length > 50) chartDataRef.current.shift();
                  }
              } else if (type === 'status') {
                  if (phase === 'download' && currentPhase !== 'download') {
                      currentPhase = 'download';
                      setState('download');
                      setCurrentProgress(0);
                      chartDataRef.current = new Array(50).fill(0); 
                  } else if (phase === 'upload' && currentPhase !== 'upload') {
                      currentPhase = 'upload';
                      setState('upload');
                      setCurrentProgress(0);
                      chartDataRef.current = new Array(50).fill(0);
                  }
              } else if (type === 'done') {
                  currentPhase = 'done';
                  setState('done');
                  setCurrentProgress(100);
                  // Save chart data snapshot
                  updateResult(prev => ({ ...prev, chartData: [...chartDataRef.current] }));
              } else if (type === 'error') {
                  currentPhase = 'done';
                  setError(data);
                  setState('done');
              }
          };

          workerRef.current.onerror = (e) => {
              console.error("Worker error:", e);
              setError("Worker 初始化失败");
              setState('done');
          };

          workerRef.current.postMessage({ type: 'start', mode });

      } catch (e) {
          console.error("Failed to create worker:", e);
          setError("浏览器不支持 Worker");
          setState('done');
      }
  };

  const stopTest = () => {
      if (workerRef.current) {
          workerRef.current.postMessage({ type: 'stop' });
      }
      setStoppedByUser(true);
      setState('done');
  };

  const hasResult = metrics.lastRun > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
        
        {/* Mode Switcher & Info */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-2 rounded-2xl border border-gray-200 shadow-sm">
            {/* Mode Tabs */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
                <button
                    onClick={() => { if(state === 'idle' || state === 'done') setMode('china'); }}
                    disabled={state !== 'idle' && state !== 'done'}
                    className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                        mode === 'china' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Server size={16} />
                    国内模式
                </button>
                <button
                    onClick={() => { if(state === 'idle' || state === 'done') setMode('global'); }}
                    disabled={state !== 'idle' && state !== 'done'}
                    className={`flex-1 sm:flex-none px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
                        mode === 'global' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Globe size={16} />
                    国际模式
                </button>
            </div>

            {/* Node Info Badge */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 rounded-xl border border-gray-100 sm:mr-2 w-full sm:w-auto justify-center">
                <MapPin size={14} className="text-primary-500"/>
                <span>{mode === 'china' ? '节点: 中国大陆优化 (阿里云 CDN)' : '节点: 全球 M-Lab 分布式网络'}</span>
            </div>
        </div>

        {/* Error Banner */}
        {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl border border-red-100 flex items-center gap-3 text-sm">
                <div className="bg-red-100 p-1 rounded-full"><Activity size={14}/></div>
                {error}
            </div>
        )}

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Gauges */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-8 flex flex-col justify-between relative overflow-hidden">
                {/* Chart Background */}
                <div className="absolute inset-x-0 bottom-0 h-40 opacity-50 pointer-events-none">
                    <canvas ref={canvasRef} width={600} height={160} className="w-full h-full" />
                </div>

                <div className="relative z-10 flex flex-col sm:flex-row justify-around items-center gap-8 py-4">
                    <SpeedGauge 
                        value={metrics.downloadBps} 
                        label="下载" 
                        // Active if: Currently downloading OR if we have data (even if test done)
                        isActive={state === 'download' || metrics.downloadBps > 0} 
                        colorClass="text-cyan-500"
                    />
                    
                    {mode === 'global' ? (
                        <SpeedGauge 
                            value={metrics.uploadBps} 
                            label="上传" 
                            isActive={state === 'upload' || metrics.uploadBps > 0} 
                            colorClass="text-purple-500"
                        />
                    ) : (
                        <div className="opacity-50 grayscale flex flex-col items-center select-none" title="国内模式仅支持下载测试">
                             <SpeedGauge 
                                value={0} 
                                label="上传 (不支持)" 
                                isActive={false} 
                                colorClass="text-gray-300"
                            />
                        </div>
                    )}
                </div>

                {/* Progress Bar / Result Area */}
                <div className="relative z-10 mt-8 min-h-[32px] flex items-center justify-center">
                    {(state === 'download' || state === 'upload') && (
                        <div className="w-full">
                            <div className="flex justify-between text-xs font-bold text-gray-400 uppercase mb-2">
                                <span>{state === 'download' ? 'Downloading...' : 'Uploading...'}</span>
                                <span>{currentProgress.toFixed(0)}%</span>
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${state === 'download' ? 'bg-cyan-500' : 'bg-purple-500'}`} 
                                    style={{ width: `${currentProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    {state === 'done' && !error && (
                        <div className="animate-fade-in w-full">
                            {stoppedByUser ? (
                                <div className="flex items-center justify-center gap-2 text-amber-600 bg-amber-50 px-4 py-2 rounded-lg border border-amber-100 text-sm font-bold">
                                    <AlertTriangle size={16} />
                                    <span>测试已手动终止</span>
                                </div>
                            ) : metrics.downloadBps > 0 && (
                                <div className="flex items-center justify-center gap-2 text-primary-700 bg-primary-50 px-4 py-2 rounded-lg border border-primary-100 text-sm font-bold">
                                    <Award size={16} />
                                    <span>预估宽带等级: {getBandwidthLabel(metrics.downloadBps)}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Metrics & Controls */}
            <div className="space-y-6 flex flex-col">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">网络延迟</h3>
                    
                    <MetricCard 
                        icon={<Activity size={18} />}
                        label="Ping (延迟)"
                        value={metrics.latency > 0 ? metrics.latency.toFixed(0) : '--'}
                        unit="ms"
                        highlight={metrics.latency > 0}
                    />
                    
                    <MetricCard 
                        icon={<Wifi size={18} />}
                        label="Jitter (抖动)"
                        value={metrics.jitter > 0 ? metrics.jitter.toFixed(0) : '--'}
                        unit="ms"
                        highlight={metrics.jitter > 0}
                    />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col items-center justify-center">
                    {(state === 'idle' || state === 'done') ? (
                        <button
                            onClick={startTest}
                            className="w-full py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-primary-200 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 group"
                        >
                            <span className="flex items-center gap-2">
                                <Play fill="currentColor" size={20} /> 
                                {hasResult ? '重新测速' : '开始测速'}
                            </span>
                            <span className="text-[10px] font-normal opacity-80 group-hover:opacity-100">
                                {mode === 'china' ? '并发多线程下载' : 'WebSocket 双向测试'}
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={stopTest}
                            className="w-full py-4 bg-white border-2 border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1"
                        >
                            <span className="flex items-center gap-2">
                                <Square fill="currentColor" size={18} />
                                停止测试
                            </span>
                            <span className="text-[10px] font-normal opacity-60">
                                正在进行中...
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* Info Footer */}
        <div className="text-center text-xs text-gray-400 mt-8 space-y-2">
            <p>测速结果受网络环境、设备性能及服务器繁忙程度影响。建议在不同时段多次测试以获取准确数据。</p>
            {mode === 'china' && (
                <p>
                    受浏览器并发限制，本工具可能无法完全跑满高带宽。更精准的国内测速推荐访问：
                    <a href="https://test.nju.edu.cn/" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline mx-1">南京大学测速站</a>
                    或
                    <a href="https://test.ustc.edu.cn/" target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline mx-1">中科大测速站</a>
                </p>
            )}
        </div>
    </div>
  );
};

export default SpeedTest;