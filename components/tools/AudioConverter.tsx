
import React, { useState, useEffect, useRef } from 'react';
import { FileAudio, Download, Play, Pause, Volume2, Music, RefreshCw, FileVideo, ChevronRight, ChevronLeft, Settings2, Info, Check, Timer, Clock } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const AudioConverter: React.FC = () => {
  // --- Core State ---
  const [file, setFile] = useState<File | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // FFmpeg State
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // --- Playback/Edit State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(100); // 0-200%
  
  // Trim State
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  
  // Refs for Rendering Sync (Crucial for RAF loop)
  const renderRefs = useRef({
      currentTime: 0,
      trimStart: 0,
      trimEnd: 0,
      volume: 100,
      fadeIn: false,
      fadeOut: false,
      fadeDuration: 2
  });

  // Export Settings
  const [targetFormat, setTargetFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('192'); // kbps for lossy
  
  // Effects
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [fadeDuration, setFadeDuration] = useState(2); // seconds

  // --- Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const pauseTimeRef = useRef<number>(0); 
  const playRafRef = useRef<number | null>(null); // For playback time update
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawRafRef = useRef<number | null>(null); // For drawing loop
  
  // Dragging State
  const dragInfo = useRef<{
      isDragging: boolean;
      target: 'start' | 'end' | 'playhead' | null;
  }>({ isDragging: false, target: null });

  // Sync refs with state whenever state changes
  useEffect(() => {
      renderRefs.current = { 
          currentTime, 
          trimStart, 
          trimEnd,
          volume,
          fadeIn,
          fadeOut,
          fadeDuration
      };
  }, [currentTime, trimStart, trimEnd, volume, fadeIn, fadeOut, fadeDuration]);

  // Initialize FFmpeg
  useEffect(() => {
    const load = async () => {
        const ffmpegInstance = new FFmpeg();
        ffmpegInstance.on('log', ({ message }: { message: string }) => {
            console.log('[FFmpeg]', message);
        });
        ffmpegInstance.on('progress', ({ progress }: { progress: number }) => {
            setProgress(Math.round(progress * 100));
        });
        setFfmpeg(ffmpegInstance);
    };
    load();
  }, []);

  const loadFfmpegCore = async () => {
      if (!ffmpeg || ffmpegLoaded) return true;
      setStatusMessage('正在加载引擎 (30MB)...');
      setIsProcessing(true);
      try {
          const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
          await ffmpeg.load({
              coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
              wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          setFfmpegLoaded(true);
          return true;
      } catch (e) {
          console.error(e);
          alert('组件加载失败。请检查网络或使用 Chrome 浏览器。');
          return false;
      } finally {
          setIsProcessing(false);
          setStatusMessage('');
      }
  };

  // --- Audio Context Helpers ---
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadFile(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };

  const loadFile = async (f: File) => {
    setFile(f);
    stopPlayback();
    setStatusMessage('正在解析音频...');
    setIsProcessing(true);

    try {
        // Attempt 1: Native Decode
        const arrayBuffer = await f.arrayBuffer();
        const ctx = getAudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        setupAudio(decoded);
    } catch (e) {
        console.warn("Native decode failed, trying FFmpeg fallback...", e);
        await convertAndLoadViaFfmpeg(f);
    } finally {
        setIsProcessing(false);
        setStatusMessage('');
    }
  };

  const convertAndLoadViaFfmpeg = async (f: File) => {
      const loaded = await loadFfmpegCore();
      if (!loaded) return;

      setStatusMessage('正在转码音频流...');
      const inputName = 'input_raw';
      const outputName = 'decoded.wav';
      
      try {
          await ffmpeg!.writeFile(inputName, await fetchFile(f));
          await ffmpeg!.exec(['-i', inputName, '-vn', '-ac', '2', '-ar', '44100', outputName]);
          
          const data = await ffmpeg!.readFile(outputName);
          const blob = new Blob([data], { type: 'audio/wav' });
          const arrayBuffer = await blob.arrayBuffer();
          const ctx = getAudioContext();
          const decoded = await ctx.decodeAudioData(arrayBuffer);
          
          setupAudio(decoded);
          
          await ffmpeg!.deleteFile(inputName);
          await ffmpeg!.deleteFile(outputName);
      } catch (err) {
          console.error(err);
          alert("该文件格式无法解析");
          setFile(null);
      }
  };

  const setupAudio = (buffer: AudioBuffer) => {
      setAudioBuffer(buffer);
      setTrimStart(0);
      setTrimEnd(buffer.duration);
      renderRefs.current.trimEnd = buffer.duration;
      setCurrentTime(0);
      pauseTimeRef.current = 0;
      setFadeIn(false);
      setFadeOut(false);
  };

  const handleClose = () => {
      stopPlayback();
      setFile(null);
      setAudioBuffer(null);
      setVolume(100);
  };

  // --- Waveform Rendering Loop ---
  const renderWaveform = () => {
      if (!audioBuffer || !canvasRef.current || !containerRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = containerRef.current.clientWidth;
      const height = 200;
      const dpr = window.devicePixelRatio || 1;
      
      // Ensure canvas size matches
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
      }
      
      ctx.resetTransform();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // --- Read from Refs for zero-latency ---
      const { trimStart, trimEnd, currentTime, volume, fadeIn, fadeOut, fadeDuration } = renderRefs.current;

      // Background
      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, width, height);

      // Data
      const data = audioBuffer.getChannelData(0);
      const step = Math.ceil(data.length / width);
      const amp = height / 2;

      const pxPerSec = width / audioBuffer.duration;
      const startX = trimStart * pxPerSec;
      const endX = trimEnd * pxPerSec;

      // 1. Draw Full Dimmed Waveform
      ctx.fillStyle = '#334155'; // slate-700
      for (let i = 0; i < width; i+=2) { // optimization: skip every 2nd pixel if dense
          let min = 1.0, max = -1.0;
          const idx = i * step;
          // Optimization: only sample a few points in the step
          for (let j = 0; j < step; j += Math.max(1, Math.floor(step/10))) {
              const datum = data[idx + j];
              if (datum < min) min = datum;
              if (datum > max) max = datum;
          }
          const h = Math.max(1, (max - min) * amp * 0.9);
          // Draw if outside active zone
          if (i < startX || i > endX) {
               ctx.fillRect(i, (1 + min) * amp, 1, h);
          }
      }

      // 2. Draw Active Region Bright
      ctx.fillStyle = '#06b6d4'; // cyan-500
      const startIdx = Math.max(0, Math.floor(startX));
      const endIdx = Math.min(width, Math.ceil(endX));
      
      for (let i = startIdx; i <= endIdx; i+=1) {
          let min = 1.0, max = -1.0;
          const idx = i * step;
          for (let j = 0; j < step; j += Math.max(1, Math.floor(step/10))) {
              if (idx + j < data.length) {
                  const datum = data[idx + j];
                  if (datum < min) min = datum;
                  if (datum > max) max = datum;
              }
          }
          const h = Math.max(1, (max - min) * amp * 0.9);
          ctx.fillRect(i, (1 + min) * amp, 1, h);
      }

      // 3. Overlays
      ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      ctx.fillRect(0, 0, startX, height);
      ctx.fillRect(endX, 0, width - endX, height);

      // 4. Volume Envelope
      if (startX < endX) {
          ctx.strokeStyle = '#facc15'; // Yellow
          ctx.lineWidth = 2;
          ctx.beginPath();
          
          const clipDuration = trimEnd - trimStart;
          const baseY = (height / 2) - ((volume / 200) * (height / 2));
          const zeroY = height / 2;
          const effectiveFade = Math.min(fadeDuration, clipDuration / 2);
          const fadePx = effectiveFade * pxPerSec;

          ctx.moveTo(startX, zeroY);
          if (fadeIn) {
              ctx.lineTo(startX + fadePx, baseY);
          } else {
              ctx.lineTo(startX, baseY);
          }
          
          if (fadeOut) {
              ctx.lineTo(endX - fadePx, baseY);
              ctx.lineTo(endX, zeroY);
          } else {
              ctx.lineTo(endX, baseY);
              ctx.lineTo(endX, zeroY);
          }
          ctx.stroke();
      }

      // 5. Playhead
      const playX = (currentTime / audioBuffer.duration) * width;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playX, 0);
      ctx.lineTo(playX, height);
      ctx.stroke();
  };

  // Setup loop
  useEffect(() => {
      const loop = () => {
          renderWaveform();
          drawRafRef.current = requestAnimationFrame(loop);
      };
      loop();
      return () => {
          if (drawRafRef.current) cancelAnimationFrame(drawRafRef.current);
      };
  }, [audioBuffer]); // Re-init if buffer changes

  // --- Interaction Handlers ---
  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'playhead') => {
      e.stopPropagation();
      e.preventDefault();
      dragInfo.current = { isDragging: true, target: type };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
      if (!audioBuffer || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const time = (relativeX / rect.width) * audioBuffer.duration;
      
      // Update State immediately for UI
      // Also update Refs immediately for Renderer
      const { trimStart, trimEnd } = renderRefs.current;

      if (time < trimStart) {
          setTrimStart(time);
          renderRefs.current.trimStart = time;
          seekTo(time);
          handleMouseDown(e, 'start'); 
      } else if (time > trimEnd) {
          setTrimEnd(time);
          renderRefs.current.trimEnd = time;
          handleMouseDown(e, 'end');
      } else {
          seekTo(time);
          handleMouseDown(e, 'playhead');
      }
  };

  const seekTo = (time: number) => {
      let target = Math.max(0, Math.min(audioBuffer?.duration || 0, time));
      setCurrentTime(target);
      renderRefs.current.currentTime = target; // Sync Ref
      pauseTimeRef.current = target;
      if (isPlaying) {
          stopPlayback(false);
          startPlayback(target);
      }
  };

  const handleMouseMove = (e: MouseEvent) => {
      if (!dragInfo.current.isDragging || !audioBuffer || !containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
      const time = percentage * audioBuffer.duration;

      const MIN_GAP = 0.5;
      
      // Use Refs for current drag state
      const currentStart = renderRefs.current.trimStart;
      const currentEnd = renderRefs.current.trimEnd;

      if (dragInfo.current.target === 'start') {
          let newStart = Math.min(time, currentEnd - MIN_GAP);
          newStart = Math.max(0, newStart);
          
          // 1. Update State (Triggers React re-render for bubbles)
          setTrimStart(newStart);
          // 2. Update Ref (Triggers immediate canvas redraw in next RAF frame)
          renderRefs.current.trimStart = newStart;
          
          if (renderRefs.current.currentTime < newStart) {
              setCurrentTime(newStart);
              renderRefs.current.currentTime = newStart;
              pauseTimeRef.current = newStart;
          }
      } else if (dragInfo.current.target === 'end') {
          let newEnd = Math.max(time, currentStart + MIN_GAP);
          newEnd = Math.min(audioBuffer.duration, newEnd);
          
          setTrimEnd(newEnd);
          renderRefs.current.trimEnd = newEnd;
          
          if (renderRefs.current.currentTime > newEnd) {
              setCurrentTime(newEnd);
              renderRefs.current.currentTime = newEnd;
              pauseTimeRef.current = newEnd;
          }
      } else if (dragInfo.current.target === 'playhead') {
          seekTo(time);
      }
  };

  const handleMouseUp = () => {
      dragInfo.current = { isDragging: false, target: null };
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  };

  // --- Playback Logic ---
  useEffect(() => {
      if (gainNodeRef.current) {
          gainNodeRef.current.gain.setTargetAtTime(volume / 100, getAudioContext().currentTime, 0.1);
      }
  }, [volume]);

  const stopPlayback = (resetUI = true) => {
      if (sourceNodeRef.current) {
          try { sourceNodeRef.current.stop(); } catch(e) {}
          sourceNodeRef.current = null;
      }
      if (playRafRef.current) cancelAnimationFrame(playRafRef.current);
      if (resetUI) setIsPlaying(false);
  };

  const startPlayback = (offset: number) => {
      if (!audioBuffer) return;
      const ctx = getAudioContext();

      // Check range using Refs to be safe
      const start = renderRefs.current.trimStart;
      const end = renderRefs.current.trimEnd;

      if (offset < start || offset >= end) {
          offset = start;
      }

      sourceNodeRef.current = ctx.createBufferSource();
      sourceNodeRef.current.buffer = audioBuffer;
      gainNodeRef.current = ctx.createGain();
      
      const baseVolume = volume / 100;
      const clipDuration = end - start;
      const effectiveFade = Math.min(fadeDuration, clipDuration / 2);
      const now = ctx.currentTime;
      const relativeOffset = offset - start;
      
      gainNodeRef.current.gain.setValueAtTime(0, now); 

      // Fade Logic
      if (fadeIn) {
          if (relativeOffset < effectiveFade) {
              const startVol = (relativeOffset / effectiveFade) * baseVolume;
              gainNodeRef.current.gain.setValueAtTime(startVol, now);
              gainNodeRef.current.gain.linearRampToValueAtTime(baseVolume, now + (effectiveFade - relativeOffset));
          } else {
              gainNodeRef.current.gain.setValueAtTime(baseVolume, now);
          }
      } else {
          gainNodeRef.current.gain.setValueAtTime(baseVolume, now);
      }

      if (fadeOut) {
          const fadeOutStartTime = clipDuration - effectiveFade;
          const timeUntilFadeOut = fadeOutStartTime - relativeOffset;
          if (timeUntilFadeOut > 0) {
              gainNodeRef.current.gain.setValueAtTime(baseVolume, now + timeUntilFadeOut);
              gainNodeRef.current.gain.linearRampToValueAtTime(0, now + timeUntilFadeOut + effectiveFade);
          } else {
              // ... fade logic simplification for playback ...
          }
      }

      sourceNodeRef.current.connect(gainNodeRef.current);
      gainNodeRef.current.connect(ctx.destination);

      const duration = end - offset;
      sourceNodeRef.current.start(0, offset, duration);
      startTimeRef.current = ctx.currentTime;
      setIsPlaying(true);

      const loop = () => {
          const elapsed = ctx.currentTime - startTimeRef.current;
          const cur = offset + elapsed;
          // Sync UI
          setCurrentTime(cur);
          renderRefs.current.currentTime = cur; // Sync Renderer

          if (cur >= end) {
              stopPlayback();
              pauseTimeRef.current = start;
              setCurrentTime(start);
              renderRefs.current.currentTime = start;
          } else {
              playRafRef.current = requestAnimationFrame(loop);
          }
      };
      playRafRef.current = requestAnimationFrame(loop);
  };

  const togglePlay = () => {
      if (!audioBuffer) return;
      const ctx = getAudioContext();
      if (isPlaying) {
          stopPlayback();
          const elapsed = ctx.currentTime - startTimeRef.current;
          pauseTimeRef.current = pauseTimeRef.current + elapsed;
      } else {
          startPlayback(pauseTimeRef.current);
      }
  };

  // --- Export Logic (Same as before) ---
  const handleSave = async () => {
      if (!file) return;
      const loaded = await loadFfmpegCore();
      if (!loaded) return;

      setIsProcessing(true);
      setStatusMessage('正在处理音频...');
      setProgress(0);

      try {
          const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
          const outputName = `output.${targetFormat}`;
          
          await ffmpeg!.writeFile(inputName, await fetchFile(file));

          const clipDuration = trimEnd - trimStart;
          const effectiveFade = Math.min(fadeDuration, clipDuration / 2);

          const filters = [];
          filters.push(`atrim=${trimStart.toFixed(3)}:${trimEnd.toFixed(3)}`);
          filters.push(`asetpts=PTS-STARTPTS`);
          
          if (volume !== 100) filters.push(`volume=${volume/100}`);
          if (fadeIn) filters.push(`afade=t=in:ss=0:d=${effectiveFade}`);
          if (fadeOut) {
              const fadeOutStart = clipDuration - effectiveFade;
              filters.push(`afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${effectiveFade}`);
          }

          const args = ['-i', inputName, '-filter:a', filters.join(',')];

          if (targetFormat === 'mp3') {
              args.push('-c:a', 'libmp3lame', '-b:a', `${bitrate}k`);
          } else if (targetFormat === 'm4a') {
              args.push('-c:a', 'aac', '-b:a', `${bitrate}k`);
          } else if (targetFormat === 'ogg') {
              args.push('-c:a', 'libvorbis', '-q:a', '4');
          } else if (targetFormat === 'wav') {
              args.push('-c:a', 'pcm_s16le');
          }

          args.push(outputName);
          setStatusMessage('正在编码...');
          await ffmpeg!.exec(args);

          const data = await ffmpeg!.readFile(outputName);
          const blob = new Blob([data], { type: `audio/${targetFormat}` });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          const origName = file.name.split('.')[0];
          link.download = `${origName}_edit.${targetFormat}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          await ffmpeg!.deleteFile(inputName);
          await ffmpeg!.deleteFile(outputName);

      } catch (e) {
          console.error(e);
          alert('导出失败: ' + (e as Error).message);
      } finally {
          setIsProcessing(false);
          setStatusMessage('');
          setProgress(0);
      }
  };

  const fetchFile = async (f: File) => {
      return new Uint8Array(await f.arrayBuffer());
  };

  const formatTime = (t: number) => {
      if (isNaN(t)) return '0:00.0';
      const m = Math.floor(t / 60);
      const s = Math.floor(t % 60);
      const ms = Math.floor((t % 1) * 10);
      return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const calculateEstimatedSize = () => {
      const duration = trimEnd - trimStart;
      if (duration <= 0) return '0 KB';
      
      let kbps = parseInt(bitrate);
      if (targetFormat === 'wav') {
          kbps = 1411; 
      }
      const sizeKB = (duration * kbps) / 8;
      if (sizeKB < 1024) {
          return `≈ ${sizeKB.toFixed(2)} KB`;
      } else {
          return `≈ ${(sizeKB / 1024).toFixed(2)} MB`;
      }
  };

  const formats = [
      { id: 'mp3', label: 'MP3', desc: '最通用，兼容性好', icon: 'MP3' },
      { id: 'm4a', label: 'M4A', desc: '同体积下音质更好', icon: 'AAC' },
      { id: 'wav', label: 'WAV', desc: '无损，适合编辑', icon: 'WAV' },
      { id: 'ogg', label: 'OGG', desc: '开源，适合游戏', icon: 'OGG' },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Upload */}
      {!file && (
          <div 
            className={`
                flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group min-h-[400px]
                ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}
            `}
            onClick={() => document.getElementById('ac-upload')?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
              <input id="ac-upload" type="file" accept="audio/*,video/*,.mkv,.flv" className="hidden" onChange={handleFileChange} />
              <div className="w-20 h-20 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-6 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                  <FileAudio size={40} />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">选择媒体文件</h3>
              <p className="text-gray-500">拖拽音频或视频至此，开始剪辑与转换</p>
          </div>
      )}

      {file && (
          <div className="flex flex-col gap-6">
              {/* Main Editor Card */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                      <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-white border border-gray-200 text-primary-600 rounded-lg shadow-sm">
                              {file.type.startsWith('video') || file.name.endsWith('.mkv') ? <FileVideo size={20}/> : <FileAudio size={20}/>}
                          </div>
                          <div>
                              <div className="font-bold text-gray-900 text-base">{file.name}</div>
                              <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                                  <span>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                                  {audioBuffer && <span>{formatTime(audioBuffer.duration)}</span>}
                              </div>
                          </div>
                      </div>
                      <button onClick={handleClose} className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200 rounded-lg text-gray-500 transition-all text-sm font-medium shadow-sm">
                          取消 / 关闭
                      </button>
                  </div>

                  {/* Waveform Area */}
                  <div className="bg-slate-900 px-8 py-14 relative select-none">
                      {isProcessing && (
                          <div className="absolute inset-0 bg-slate-900/90 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                              <RefreshCw className="animate-spin mb-4 text-primary-400" size={40} />
                              <div className="font-medium text-xl">{statusMessage}</div>
                              {progress > 0 && <div className="text-sm mt-2 text-slate-400 font-mono">{progress}%</div>}
                          </div>
                      )}

                      {/* Playhead Time Tag (Above) */}
                      {audioBuffer && (
                          <div 
                              className="absolute top-[20px] z-30 transform -translate-x-1/2 pointer-events-none"
                              style={{ left: `calc(32px + ${(currentTime / audioBuffer.duration) * (containerRef.current?.clientWidth || 0)}px)` }}
                          >
                              <div className="bg-white text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded-sm shadow-md border border-slate-200 font-mono whitespace-nowrap">
                                  {formatTime(currentTime)}
                              </div>
                              <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-white mx-auto"></div>
                          </div>
                      )}

                      <div className="relative h-[200px] bg-slate-950 rounded-lg border border-slate-700 shadow-inner" ref={containerRef} onMouseDown={handleCanvasMouseDown}>
                          <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />
                          
                          {/* Handles */}
                          {audioBuffer && (
                              <>
                                  {/* Start Handle */}
                                  <div 
                                      className="absolute top-0 bottom-0 w-6 cursor-ew-resize group z-20 flex flex-col items-center select-none"
                                      style={{ left: `calc(${ (trimStart / audioBuffer.duration) * 100 }% - 12px)` }} 
                                      onMouseDown={(e) => handleMouseDown(e, 'start')}
                                  >
                                      {/* Solid Bar - Thicker */}
                                      <div className="h-full w-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/20 ring-1 ring-black/20"></div>
                                      
                                      {/* Top Tag */}
                                      <div className="absolute top-[-4px] transform -translate-y-full flex flex-col items-center pb-1">
                                          <div className="bg-cyan-500 text-white rounded-t-md px-1 py-1 h-6 flex items-center justify-center shadow-md">
                                               <ChevronRight size={14} strokeWidth={4} />
                                          </div>
                                      </div>

                                      {/* Bottom Time Bubble - Outside Container */}
                                      <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-slate-800/90 text-cyan-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-600 font-mono shadow whitespace-nowrap">
                                          {formatTime(trimStart)}
                                      </div>
                                  </div>

                                  {/* End Handle */}
                                  <div 
                                      className="absolute top-0 bottom-0 w-6 cursor-ew-resize group z-20 flex flex-col items-center select-none"
                                      style={{ left: `calc(${ (trimEnd / audioBuffer.duration) * 100 }% - 12px)` }}
                                      onMouseDown={(e) => handleMouseDown(e, 'end')}
                                  >
                                      {/* Solid Bar - Thicker */}
                                      <div className="h-full w-2 bg-purple-500 rounded-full shadow-lg shadow-purple-500/20 ring-1 ring-black/20"></div>
                                      
                                      {/* Top Tag */}
                                      <div className="absolute top-[-4px] transform -translate-y-full flex flex-col items-center pb-1">
                                          <div className="bg-purple-500 text-white rounded-t-md px-1 py-1 h-6 flex items-center justify-center shadow-md">
                                               <ChevronLeft size={14} strokeWidth={4} />
                                          </div>
                                      </div>

                                      {/* Bottom Time Bubble - Outside Container */}
                                      <div className="absolute bottom-[-36px] left-1/2 -translate-x-1/2 bg-slate-800/90 text-purple-400 text-[10px] px-1.5 py-0.5 rounded border border-slate-600 font-mono shadow whitespace-nowrap">
                                          {formatTime(trimEnd)}
                                      </div>
                                  </div>
                              </>
                          )}
                      </div>
                  </div>

                  {/* Playback Controls & Info */}
                  <div className="px-8 py-5 bg-white border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
                      
                      {/* 1. Left: Playback Controls */}
                      <div className="flex items-center gap-4 flex-1">
                          <button 
                            onClick={togglePlay}
                            className="w-12 h-12 flex items-center justify-center bg-gray-900 text-white rounded-full hover:bg-gray-700 shadow-sm transition-all active:scale-95 shrink-0"
                          >
                              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5"/>}
                          </button>
                          
                          <div className="flex flex-col">
                              <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">播放位置</div>
                              <div className="font-mono text-xl font-medium text-gray-700 w-[100px]">
                                  {formatTime(currentTime)}
                              </div>
                          </div>
                      </div>

                      {/* 2. Middle: Clip Duration (Centered) */}
                      <div className="flex flex-col items-center flex-1">
                          <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mb-0.5">剪辑时长</div>
                          <div className="font-mono text-4xl font-bold text-primary-600 tracking-tight leading-none flex items-baseline gap-1">
                              {formatTime(trimEnd - trimStart)}
                              <span className="text-base font-medium text-gray-400">s</span>
                          </div>
                      </div>

                      {/* 3. Right: Volume & Effects (Right Aligned) */}
                      <div className="flex flex-1 flex-wrap items-center justify-end gap-6">
                          {/* Volume */}
                          <div className="flex flex-col gap-1 w-[100px]">
                              <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                  <div className="flex items-center gap-1"><Volume2 size={10}/> 音量</div>
                                  <span>{volume}%</span>
                              </div>
                              <input 
                                type="range" min="0" max="200" step="5"
                                value={volume} onChange={(e) => setVolume(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                              />
                          </div>

                          {/* Fade Controls */}
                          <div className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer select-none">
                                  <input type="checkbox" checked={fadeIn} onChange={e => setFadeIn(e.target.checked)} className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500 border-gray-300" />
                                  淡入
                              </label>
                              <div className="w-px h-3 bg-gray-300"></div>
                              <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 cursor-pointer select-none">
                                  <input type="checkbox" checked={fadeOut} onChange={e => setFadeOut(e.target.checked)} className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500 border-gray-300" />
                                  淡出
                              </label>
                              
                              <div className={`transition-all duration-200 overflow-hidden flex items-center gap-1 border-l border-gray-300 pl-3 ${fadeIn || fadeOut ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                                  <input 
                                    type="number" min="0.5" max="10" step="0.5"
                                    value={fadeDuration} 
                                    onChange={e => setFadeDuration(parseFloat(e.target.value))} 
                                    className="w-12 text-center text-xs font-bold bg-white border border-gray-300 rounded py-1 focus:ring-1 focus:ring-primary-500" 
                                  />
                                  <span className="text-[10px] text-gray-400 pointer-events-none">s</span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              {/* Export Panel */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Settings2 size={20} className="text-primary-600" />
                      导出格式与配置
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {formats.map(fmt => (
                          <div 
                            key={fmt.id}
                            onClick={() => setTargetFormat(fmt.id)}
                            className={`
                                cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden group
                                ${targetFormat === fmt.id 
                                    ? 'border-primary-500 bg-primary-50 shadow-md' 
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}
                            `}
                          >
                              {targetFormat === fmt.id && (
                                  <div className="absolute top-2 right-2 text-primary-600">
                                      <Check size={18} />
                                  </div>
                              )}
                              <div className={`text-xl font-black mb-1 ${targetFormat === fmt.id ? 'text-primary-700' : 'text-gray-700'}`}>
                                  {fmt.label}
                              </div>
                              <div className="text-xs text-gray-500 leading-tight">
                                  {fmt.desc}
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-gray-100">
                      {/* Detailed Settings */}
                      <div className="flex items-center gap-6">
                          {(targetFormat === 'mp3' || targetFormat === 'm4a') && (
                              <div className="flex items-center gap-3">
                                  <label className="text-sm font-medium text-gray-700">音频质量 (码率)</label>
                                  <select 
                                    value={bitrate} 
                                    onChange={(e) => setBitrate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 min-w-[120px]"
                                  >
                                      <option value="128">128 kbps (标准)</option>
                                      <option value="192">192 kbps (高质)</option>
                                      <option value="320">320 kbps (超高)</option>
                                  </select>
                              </div>
                          )}
                          
                          {targetFormat === 'wav' && (
                              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                                  <Info size={16} />
                                  WAV 为无损格式，无需设置码率
                              </div>
                          )}
                          
                          <div className="text-sm text-gray-500 font-mono bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                              预估大小: <strong>{calculateEstimatedSize()}</strong>
                          </div>
                      </div>

                      {/* Main Action */}
                      <button 
                        onClick={handleSave}
                        disabled={isProcessing}
                        className="w-full md:w-auto px-8 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-lg shadow-primary-200 font-bold text-lg flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          {isProcessing ? <RefreshCw className="animate-spin" /> : <Download />}
                          导出音频
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AudioConverter;
