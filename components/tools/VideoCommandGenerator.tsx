
/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Film, Upload, FileVideo, Terminal, Copy, Check, Info, Cpu, Zap, Volume2, RefreshCw, Captions, Settings2, FolderInput, ExternalLink, Calculator, AlertTriangle, Plus, Trash2, FileText, Server, Smartphone, Monitor } from 'lucide-react';
// @ts-ignore
import MediaInfoFactory from 'mediainfo.js';

interface TrackInfo {
  id: number; // Index in the list
  format: string;
  language: string;
  title: string;
  details: string;
  isDefault: boolean;
}

interface ExternalSubtitle {
    id: string;
    file: File;
    language: string; // ISO 639-2 (e.g. chi, eng)
    title: string;
}

interface VideoMetadata {
  format: string;
  duration: string;
  rawDuration: number; // in seconds
  fileSize: string;
  rawBitRate: number; // in bps
  video: {
    codec: string;
    codecId: string; // AVC, HEVC, etc.
    width: number;
    height: number;
    frameRate: string;
    bitRate: string;
  }[];
  audio: TrackInfo[];
  subtitles: TrackInfo[];
}

// --- Presets Definition ---
type PresetKey = 'compat' | 'compress' | 'high' | 'nas';

interface PresetConfig {
    id: PresetKey;
    title: string;
    desc: string;
    icon: React.ReactNode;
    config: {
        container: string;
        videoEncoder: string;
        crf: number;
        preset: string;
        audioEncoder: string;
        scale: string;
    }
}

const PRESETS: PresetConfig[] = [
    {
        id: 'nas',
        title: 'NAS 存档',
        desc: 'H.265 (CRF 23) + MP4 (1080p)。针对群晖优化，画质清晰，支持缩略图预览与苹果设备播放。',
        icon: <Server size={20} />,
        config: { container: 'mp4', videoEncoder: 'libx265', crf: 23, preset: 'medium', audioEncoder: 'aac', scale: '1080p' }
    },
    {
        id: 'compat',
        title: '兼容优先',
        desc: 'H.264 (CRF 23) + MP4。兼容性最好，适合老旧设备、浏览器直接播放与分享。',
        icon: <Smartphone size={20} />,
        config: { container: 'mp4', videoEncoder: 'libx264', crf: 23, preset: 'medium', audioEncoder: 'aac', scale: 'original' }
    },
    {
        id: 'compress',
        title: '极限压缩',
        desc: 'H.265 (CRF 28)。牺牲部分画质以换取最小体积，适合存档冷数据。',
        icon: <Zap size={20} />,
        config: { container: 'mp4', videoEncoder: 'libx265', crf: 28, preset: 'slow', audioEncoder: 'aac', scale: 'original' }
    },
    {
        id: 'high',
        title: '画质优先',
        desc: 'H.264 (CRF 18) + MKV。接近无损的视觉体验，保留原始音轨，体积较大。',
        icon: <Monitor size={20} />,
        config: { container: 'mkv', videoEncoder: 'libx264', crf: 18, preset: 'slow', audioEncoder: 'copy', scale: 'original' }
    }
];

const formatDuration = (secondsStr: string): string => {
  const seconds = parseFloat(secondsStr);
  if (isNaN(seconds)) return 'Unknown';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
};

const formatSize = (bytesStr: string): string => {
  const bytes = parseInt(bytesStr);
  if (isNaN(bytes)) return 'Unknown';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFriendlyCodecName = (format: string) => {
  const upper = format.toUpperCase();
  if (upper === 'AVC') return 'H.264 (AVC)';
  if (upper === 'HEVC') return 'H.265 (HEVC)';
  if (upper === 'VP9') return 'VP9';
  if (upper === 'VP8') return 'VP8';
  return format;
};

// Check if subtitle format is bitmap/image based (incompatible with mp4 mov_text)
const isBitmapSubtitle = (format: string) => {
    const f = format.toUpperCase();
    return f.includes('PGS') || f.includes('VOBSUB') || f.includes('HDMV') || f.includes('DVD');
};

const VideoCommandGenerator: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Working Directory
  const [workDir, setWorkDir] = useState('');

  // Stream Selection (Multi-select)
  const [selectedAudioTracks, setSelectedAudioTracks] = useState<Set<number>>(new Set());
  const [selectedSubTracks, setSelectedSubTracks] = useState<Set<number>>(new Set());

  // External Subtitles
  const [externalSubs, setExternalSubs] = useState<ExternalSubtitle[]>([]);

  // FFmpeg Settings
  // Initialize with NAS preset defaults
  const [container, setContainer] = useState('mp4');
  const [videoEncoder, setVideoEncoder] = useState('libx265'); 
  const [crf, setCrf] = useState(23);
  const [preset, setPreset] = useState('medium');
  const [audioEncoder, setAudioEncoder] = useState('aac');
  const [scale, setScale] = useState('1080p');
  const [customScaleW, setCustomScaleW] = useState(1920);
  
  const [command, setCommand] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Warnings
  const [warnings, setWarnings] = useState<string[]>([]);
  
  // Estimation
  const [estimatedSize, setEstimatedSize] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      analyzeFile(f);
    }
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
      const f = e.dataTransfer.files[0];
      setFile(f);
      analyzeFile(f);
    }
  };

  const handleExternalSubUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newSubs: ExternalSubtitle[] = Array.from<File>(e.target.files).map(f => ({
              id: Math.random().toString(36).substr(2, 9),
              file: f,
              language: 'chi', // Default to Chinese
              title: f.name
          }));
          setExternalSubs(prev => [...prev, ...newSubs]);
      }
      e.target.value = ''; // Reset
  };

  const removeExternalSub = (id: string) => {
      setExternalSubs(prev => prev.filter(s => s.id !== id));
  };

  const updateExternalSub = (id: string, field: 'language' | 'title', value: string) => {
      setExternalSubs(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const analyzeFile = async (f: File) => {
    setIsAnalyzing(true);
    setMetadata(null);
    setError(null);
    setEstimatedSize(null);
    setWarnings([]);
    setSelectedAudioTracks(new Set());
    setSelectedSubTracks(new Set());

    try {
      const mediainfo = await MediaInfoFactory({ 
        format: 'object',
        locateFile: () => 'https://unpkg.com/mediainfo.js@0.2.1/dist/MediaInfoModule.wasm'
      });
      
      const getSize = () => f.size;
      const readChunk = (chunkSize: number, offset: number) =>
        new Promise<Uint8Array>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(new Uint8Array(event.target.result as ArrayBuffer));
            }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(f.slice(offset, offset + chunkSize));
        });

      const result = await mediainfo.analyzeData(getSize, readChunk);
      
      if (result && result.media && result.media.track) {
        const general = result.media.track.find((t: any) => t['@type'] === 'General') as any;
        const videoTracks = result.media.track.filter((t: any) => t['@type'] === 'Video');
        const audioTracks = result.media.track.filter((t: any) => t['@type'] === 'Audio');
        const subTracks = result.media.track.filter((t: any) => t['@type'] === 'Text');

        let duration = 'Unknown';
        let rawDuration = 0;
        if (general?.Duration) {
             rawDuration = parseFloat(general.Duration);
             duration = formatDuration(general.Duration);
        }

        let fileSize = 'Unknown';
        let rawBitRate = 0;
        if (general?.FileSize_String4) fileSize = general.FileSize_String4;
        else if (general?.FileSize) fileSize = formatSize(general.FileSize);

        if (general?.OverallBitRate) {
            rawBitRate = parseInt(general.OverallBitRate);
        } else if (general?.FileSize && rawDuration > 0) {
            rawBitRate = (parseInt(general.FileSize) * 8) / rawDuration;
        }

        const audioList = audioTracks.map((a: any, index: number) => ({
            id: index,
            format: a.Format,
            language: a.Language || 'und',
            title: a.Title || '',
            details: `${a.Channels}ch ${a.SamplingRate ? (parseInt(a.SamplingRate)/1000).toFixed(1)+'kHz' : ''}`,
            isDefault: a.Default === 'Yes'
        }));

        const subList = subTracks.map((s: any, index: number) => ({
            id: index,
            format: s.Format,
            language: s.Language || 'und',
            title: s.Title || '',
            details: s.Title || '',
            isDefault: s.Default === 'Yes'
        }));

        setMetadata({
          format: general?.Format || 'Unknown',
          duration: duration,
          rawDuration: rawDuration,
          fileSize: fileSize,
          rawBitRate: rawBitRate,
          video: videoTracks.map((v: any) => ({
            codec: v.Format, 
            codecId: v.CodecID, 
            width: parseInt(v.Width),
            height: parseInt(v.Height),
            frameRate: v.FrameRate,
            bitRate: v.BitRate_String || (v.BitRate ? (parseInt(v.BitRate)/1000).toFixed(0)+' kb/s' : 'N/A')
          })),
          audio: audioList,
          subtitles: subList
        });
        
        const allAudioIds = new Set(audioList.map((a: any) => a.id));
        setSelectedAudioTracks(allAudioIds as Set<number>);

        const allSubIds = new Set(subList.map((s: any) => s.id));
        setSelectedSubTracks(allSubIds as Set<number>);
      }
    } catch (err) {
      console.error(err);
      setError('无法解析视频信息，请确保文件未损坏。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleTrack = (set: Set<number>, id: number, updateFn: (s: Set<number>) => void) => {
      const newSet = new Set(set);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      updateFn(newSet);
  };

  useEffect(() => {
    if (!metadata || metadata.rawDuration <= 0) {
        setEstimatedSize(null);
        return;
    }

    let estimatedVideoKbps = 3000;
    
    const isSourceHEVC = metadata.video.some(v => v.codec.includes('HEVC') || v.codec.includes('265'));
    const isTargetHEVC = videoEncoder.includes('265') || videoEncoder.includes('hevc');
    const isTargetNVENC = videoEncoder.includes('nvenc');

    if (metadata.rawBitRate > 0) {
        const approxAudio = Math.max(128 * metadata.audio.length, 256);
        let sourceVideoKbps = Math.max(500, (metadata.rawBitRate / 1000) - approxAudio);
        
        if (isSourceHEVC && !isTargetHEVC) {
            sourceVideoKbps = sourceVideoKbps * 1.6; 
        } else if (!isSourceHEVC && isTargetHEVC) {
            sourceVideoKbps = sourceVideoKbps * 0.6; 
        }
        
        estimatedVideoKbps = sourceVideoKbps;
    }

    let sourceW = 1920, sourceH = 1080;
    if (metadata.video.length > 0) {
        sourceW = metadata.video[0].width;
        sourceH = metadata.video[0].height;
    }
    
    let targetW = sourceW;
    let targetH = sourceH;

    if (scale === '720p' && targetH > 720) {
        const ratio = 720 / targetH;
        targetH = 720; targetW = targetW * ratio;
    } else if (scale === '1080p' && targetH > 1080) {
        const ratio = 1080 / targetH;
        targetH = 1080; targetW = targetW * ratio;
    } else if (scale === 'custom' && targetW > customScaleW) {
        const ratio = customScaleW / targetW;
        targetW = customScaleW; targetH = targetH * ratio;
    }

    const scaleFactor = (targetW * targetH) / (sourceW * sourceH);
    estimatedVideoKbps = estimatedVideoKbps * scaleFactor;

    const crfDelta = 23 - crf; 
    const crfFactor = Math.pow(2, crfDelta / 6); 
    estimatedVideoKbps = estimatedVideoKbps * crfFactor;

    if (isTargetNVENC) {
        estimatedVideoKbps = estimatedVideoKbps * 1.2;
    }

    let audioKbps = 0;
    if (audioEncoder === 'copy') {
        audioKbps = 192 * selectedAudioTracks.size; 
    } else if (audioEncoder === 'none') {
        audioKbps = 0;
    } else {
        audioKbps = 128 * selectedAudioTracks.size;
    }

    const totalKbps = estimatedVideoKbps + audioKbps;
    const totalSizeMB = (totalKbps * metadata.rawDuration) / 8 / 1024;

    if (totalSizeMB > 1024) {
        setEstimatedSize(`${(totalSizeMB / 1024).toFixed(2)} GB`);
    } else {
        setEstimatedSize(`${totalSizeMB.toFixed(1)} MB`);
    }

  }, [metadata, scale, customScaleW, crf, videoEncoder, audioEncoder, selectedAudioTracks]);

  useEffect(() => {
    const newWarnings: string[] = [];
    let cleanPath = workDir.trim();
    cleanPath = cleanPath.replace(/[\\/]+$/, '');
    
    const getPath = (filename: string) => {
        if (!cleanPath) return `"${filename}"`;
        const sep = cleanPath.includes('\\') ? '\\' : '/';
        return `"${cleanPath}${sep}${filename}"`;
    };

    const inputName = file ? file.name : 'input.mp4';
    let cmd = `ffmpeg -i ${getPath(inputName)}`;
    
    externalSubs.forEach(sub => {
        cmd += ` -i ${getPath(sub.file.name)}`;
    });

    cmd += ` -map 0:v:0`;
    
    if (audioEncoder !== 'none') {
        const sortedAudio = Array.from<number>(selectedAudioTracks).sort((a, b) => a - b);
        sortedAudio.forEach(id => {
            cmd += ` -map 0:a:${id}`;
        });
    }

    const sortedSubs = Array.from<number>(selectedSubTracks).sort((a, b) => a - b);
    let outputSubIndex = 0;
    const isMp4 = container === 'mp4' || container === 'mov';

    sortedSubs.forEach(id => {
        const subTrack = metadata?.subtitles.find(s => s.id === id);
        if (isMp4 && subTrack && isBitmapSubtitle(subTrack.format)) {
             newWarnings.push(`已忽略内部字幕 #${id+1} (${subTrack.format}): 图形字幕不支持封装到 MP4。`);
        } else {
             cmd += ` -map 0:s:${id}`;
             outputSubIndex++;
        }
    });

    externalSubs.forEach((sub, idx) => {
        const inputIdx = idx + 1;
        cmd += ` -map ${inputIdx}:0`;
        cmd += ` -metadata:s:s:${outputSubIndex} language=${sub.language}`;
        cmd += ` -metadata:s:s:${outputSubIndex} title="${sub.title}"`;
        outputSubIndex++;
    });

    cmd += ` -c:v ${videoEncoder}`;

    // Fix: Force yuv420p for H.264 AND H.265 to ensure Web/Synology compatibility
    // This solves "blurry" playback (which is caused by Synology transcoding incompatible profiles)
    // and thumbnail generation issues.
    if (videoEncoder.includes('264') || videoEncoder.includes('265') || videoEncoder.includes('hevc')) {
        cmd += ` -pix_fmt yuv420p`;
    }
    
    if (container === 'mp4' && (videoEncoder === 'libx265' || videoEncoder.includes('hevc'))) {
        cmd += ` -tag:v hvc1`;
    }

    if (videoEncoder === 'libx264' || videoEncoder === 'libx265') {
       cmd += ` -crf ${crf} -preset ${preset}`;
    } else if (videoEncoder.includes('nvenc')) {
       cmd += ` -cq ${crf} -preset p4`; 
    }

    if (scale !== 'original') {
       if (scale === '720p') {
           cmd += ` -vf "scale=-2:min(720\\,ih)"`;
       } else if (scale === '1080p') {
           cmd += ` -vf "scale=-2:min(1080\\,ih)"`;
       } else if (scale === 'custom') {
           cmd += ` -vf "scale=min(${customScaleW}\\,iw):-2"`;
       }
    }

    if (audioEncoder === 'copy') {
      cmd += ` -c:a copy`;
    } else if (audioEncoder === 'none') {
       // No audio
    } else {
      cmd += ` -c:a ${audioEncoder}`;
      if (audioEncoder === 'aac') cmd += ` -b:a 128k`;
    }

    if (outputSubIndex > 0) { 
        if (isMp4) {
            cmd += ` -c:s mov_text`;
        } else {
            cmd += ` -c:s copy`;
        }
    }

    // Fix: Add faststart for MP4/MOV to solve "freezing when seeking"
    if (container === 'mp4' || container === 'mov') {
        cmd += ` -movflags +faststart`;
    }

    const ext = container;
    const baseName = file ? file.name.substring(0, file.name.lastIndexOf('.')) : 'output';
    cmd += ` ${getPath(`${baseName}_compressed.${ext}`)}`;

    setCommand(cmd);
    setWarnings(newWarnings);
  }, [file, workDir, videoEncoder, crf, preset, audioEncoder, scale, customScaleW, container, selectedAudioTracks, selectedSubTracks, metadata, externalSubs]);

  const copyToClipboard = () => {
    (navigator as any).clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (p: PresetConfig) => {
      setContainer(p.config.container);
      setVideoEncoder(p.config.videoEncoder);
      setCrf(p.config.crf);
      setPreset(p.config.preset);
      setAudioEncoder(p.config.audioEncoder);
      setScale(p.config.scale);
  };

  const isPresetActive = (p: PresetConfig) => {
      return container === p.config.container &&
             videoEncoder === p.config.videoEncoder &&
             crf === p.config.crf &&
             // preset === p.config.preset && // Don't enforce speed preset strictness
             audioEncoder === p.config.audioEncoder &&
             scale === p.config.scale;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Left: Input & Analysis */}
      <div className="w-full lg:w-96 shrink-0 space-y-6 flex flex-col h-full overflow-hidden">
        {/* File Upload */}
        <div 
            className={`
                shrink-0 h-56 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group text-center px-4
                ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}
            `}
            onClick={() => document.getElementById('vid-upload')?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <input id="vid-upload" type="file" accept="video/*,.mkv,.flv,.avi,.mov,.wmv" className="hidden" onChange={handleFileChange} />
            <div className="w-16 h-16 bg-gray-100 group-hover:bg-primary-100 rounded-full flex items-center justify-center mb-4 text-gray-400 group-hover:text-primary-600 transition-colors shadow-sm">
                <Film size={32} />
            </div>
            <p className="text-lg font-bold text-gray-800 mb-1">导入视频</p>
            <p className="text-sm text-gray-500">支持 MP4, MKV, MOV 等格式<br/>本地分析元数据</p>
        </div>

        {isAnalyzing && (
            <div className="p-4 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-2 animate-fade-in shrink-0">
                <RefreshCw className="animate-spin" size={16} />
                <span>正在分析视频元数据...</span>
            </div>
        )}

        {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm animate-fade-in shrink-0">
                {error}
            </div>
        )}

        {/* Metadata Scroll Area */}
        {metadata && (
            <div className="flex-1 min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 flex items-center gap-2 shrink-0">
                    <Info size={16} /> 视频源信息
                </div>
                
                <div className="p-4 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm mb-4">
                        <span className="text-gray-500">格式:</span>
                        <span className="font-mono text-gray-900">{metadata.format}</span>
                        <span className="text-gray-500">时长:</span>
                        <span className="font-mono text-gray-900">{metadata.duration}</span>
                        <span className="text-gray-500">大小:</span>
                        <span className="font-mono text-gray-900">{metadata.fileSize}</span>
                    </div>
                    
                    {/* Video Tracks */}
                    <div className="mb-4">
                        <div className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-1"><Film size={14}/> 视频流</div>
                        {metadata.video.map((v, i) => (
                            <div key={i} className="pl-2 border-l-2 border-primary-200 ml-1 text-xs text-gray-600 space-y-0.5">
                                <div><span className="font-mono text-primary-700 font-bold">{getFriendlyCodecName(v.codec)}</span></div>
                                <div>{v.width}x{v.height} @ {v.frameRate} fps</div>
                                <div>码率: {v.bitRate}</div>
                            </div>
                        ))}
                    </div>

                    {/* Audio Tracks Selection */}
                    <div className="mb-4">
                        <div className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-1"><Volume2 size={14}/> 音频流 (多选)</div>
                        {metadata.audio.length > 0 ? (
                            <div className="space-y-1">
                                {metadata.audio.map((a) => (
                                    <label key={a.id} className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedAudioTracks.has(a.id)}
                                            onChange={() => toggleTrack(selectedAudioTracks, a.id, setSelectedAudioTracks)}
                                            className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="text-xs">
                                            <div className="font-semibold text-gray-700">{a.title || 'Untitled'} ({a.language})</div>
                                            <div className="text-gray-500">{a.details}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-xs italic">无音频流</div>
                        )}
                    </div>

                    {/* Subtitle Tracks Selection */}
                    <div>
                        <div className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-1"><Captions size={14}/> 字幕流 (多选)</div>
                        {metadata.subtitles.length > 0 ? (
                            <div className="space-y-1">
                                {metadata.subtitles.map((s) => (
                                    <label key={s.id} className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedSubTracks.has(s.id)}
                                            onChange={() => toggleTrack(selectedSubTracks, s.id, setSelectedSubTracks)}
                                            className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                                        />
                                        <div className="text-xs">
                                            <div className="font-semibold text-gray-700">{s.title || 'Untitled'} ({s.language})</div>
                                            <div className="text-gray-500">{s.details} {s.isDefault ? '[Default]' : ''}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-400 text-xs italic">无内置字幕</div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* External Subtitles */}
        <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[150px]">
            <div className="p-3 bg-gray-50 border-b border-gray-200 font-semibold text-gray-700 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2"><Captions size={16} /> 外挂字幕</div>
                <button 
                    onClick={() => document.getElementById('sub-upload')?.click()}
                    className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                    title="添加字幕文件"
                >
                    <Plus size={16} />
                </button>
                <input id="sub-upload" type="file" multiple accept=".srt,.ass,.ssa,.vtt" className="hidden" onChange={handleExternalSubUpload} />
            </div>
            
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                {externalSubs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
                        <FileText size={24} className="opacity-20" />
                        <span>暂无外挂字幕</span>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {externalSubs.map((sub) => (
                            <div key={sub.id} className="bg-gray-50 p-2 rounded border border-gray-100 group">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="font-medium text-xs text-gray-700 truncate max-w-[180px]" title={sub.file.name}>{sub.file.name}</div>
                                    <button onClick={() => removeExternalSub(sub.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={12}/></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input 
                                        type="text" 
                                        value={sub.language}
                                        onChange={(e) => updateExternalSub(sub.id, 'language', e.target.value)}
                                        placeholder="lang (e.g. chi)"
                                        className="text-xs p-1 border rounded"
                                        title="Language Code (ISO 639-2)"
                                    />
                                    <input 
                                        type="text" 
                                        value={sub.title}
                                        onChange={(e) => updateExternalSub(sub.id, 'title', e.target.value)}
                                        placeholder="Title"
                                        className="text-xs p-1 border rounded"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Right: Configuration & Command */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden gap-6">
          {/* Settings Panel */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Settings2 size={20}/> 转码配置</h2>
              </div>

              {/* Presets Cards */}
              <div className="grid grid-cols-2 gap-3 mb-8">
                  {PRESETS.map(preset => {
                      const isActive = isPresetActive(preset);
                      return (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset)}
                            className={`
                                flex flex-col items-start p-3 rounded-xl border-2 transition-all text-left group
                                ${isActive 
                                    ? 'border-primary-500 bg-primary-50 shadow-sm' 
                                    : 'border-gray-100 bg-gray-50 hover:border-primary-200 hover:bg-white'}
                            `}
                          >
                              <div className={`flex items-center gap-2 mb-1 ${isActive ? 'text-primary-700' : 'text-gray-700'}`}>
                                  {preset.icon}
                                  <span className="font-bold text-sm">{preset.title}</span>
                                  {isActive && <Check size={14} className="ml-auto text-primary-600" />}
                              </div>
                              <p className="text-xs text-gray-500 leading-tight">
                                  {preset.desc}
                              </p>
                          </button>
                      );
                  })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Container */}
                  <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700 block">封装格式 (Container)</label>
                      <div className="flex bg-gray-100 p-1 rounded-lg">
                          {['mp4', 'mkv', 'mov'].map(c => (
                              <button 
                                key={c}
                                onClick={() => setContainer(c)}
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md uppercase ${container === c ? 'bg-white shadow text-primary-600' : 'text-gray-500'}`}
                              >
                                  {c}
                              </button>
                          ))}
                      </div>
                  </div>

                  {/* Video Encoder */}
                  <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700 block">视频编码 (Video Codec)</label>
                      <select 
                        value={videoEncoder} 
                        onChange={(e) => setVideoEncoder(e.target.value)}
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      >
                          <option value="libx264">H.264 (libx264) - 最通用</option>
                          <option value="libx265">H.265 (libx265) - 高压缩</option>
                          <option value="h264_nvenc">NVIDIA H.264 (nvenc)</option>
                          <option value="hevc_nvenc">NVIDIA H.265 (nvenc)</option>
                          <option value="libvpx-vp9">VP9 (Web friendly)</option>
                          <option value="copy">Copy (不转码)</option>
                      </select>
                  </div>

                  {/* Audio Encoder */}
                  <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700 block">音频编码 (Audio Codec)</label>
                      <select 
                        value={audioEncoder} 
                        onChange={(e) => setAudioEncoder(e.target.value)}
                        className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                      >
                          <option value="aac">AAC (128k)</option>
                          <option value="libmp3lame">MP3</option>
                          <option value="ac3">AC3</option>
                          <option value="copy">Copy (不转码)</option>
                          <option value="none">无音频 (Mute)</option>
                      </select>
                  </div>

                  {/* CRF / Quality */}
                  {videoEncoder !== 'copy' && (
                      <div className="space-y-3">
                          <div className="flex justify-between">
                              <label className="text-sm font-medium text-gray-700 block">画质系数 (CRF: {crf})</label>
                              <span className="text-xs text-gray-500">{crf < 18 ? '无损级' : crf < 24 ? '高质量' : '低画质'}</span>
                          </div>
                          <input 
                            type="range" min="0" max="51" step="1"
                            value={crf} onChange={(e) => setCrf(parseInt(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg accent-primary-600 cursor-pointer"
                          />
                          <div className="flex justify-between text-xs text-gray-400">
                              <span>0 (高)</span>
                              <span>23 (标准)</span>
                              <span>51 (低)</span>
                          </div>
                      </div>
                  )}

                  {/* Preset Speed */}
                  {videoEncoder !== 'copy' && !videoEncoder.includes('nvenc') && (
                      <div className="space-y-3">
                           <label className="text-sm font-medium text-gray-700 block">编码速度 (Preset)</label>
                           <select 
                             value={preset} onChange={(e) => setPreset(e.target.value)}
                             className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                           >
                               <option value="ultrafast">Ultrafast (最快/大)</option>
                               <option value="superfast">Superfast</option>
                               <option value="veryfast">Veryfast</option>
                               <option value="faster">Faster</option>
                               <option value="fast">Fast</option>
                               <option value="medium">Medium (平衡)</option>
                               <option value="slow">Slow</option>
                               <option value="slower">Slower</option>
                               <option value="veryslow">Veryslow (最小)</option>
                           </select>
                      </div>
                  )}

                  {/* Resolution Scale */}
                  <div className="space-y-3">
                       <label className="text-sm font-medium text-gray-700 block">分辨率缩放</label>
                       <select 
                         value={scale} onChange={(e) => setScale(e.target.value)}
                         className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm"
                       >
                           <option value="original">原始分辨率</option>
                           <option value="1080p">限制最大 1080p</option>
                           <option value="720p">限制最大 720p</option>
                           <option value="custom">自定义宽度...</option>
                       </select>
                       {scale === 'custom' && (
                           <div className="flex items-center gap-2 mt-2">
                               <input 
                                 type="number" 
                                 value={customScaleW} 
                                 onChange={(e) => setCustomScaleW(parseInt(e.target.value))}
                                 className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                                 placeholder="Width px"
                               />
                               <span className="text-xs text-gray-500 whitespace-nowrap">px (Auto Height)</span>
                           </div>
                       )}
                  </div>
              </div>
              
              {/* Working Directory */}
              <div className="mt-6 pt-6 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <FolderInput size={16} />
                      工作目录 (可选)
                  </div>
                  <input 
                    type="text" 
                    value={workDir}
                    onChange={(e) => setWorkDir(e.target.value)}
                    placeholder="例如: C:\Videos 或 /Users/name/Movies (留空则使用相对路径)"
                    className="w-full p-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-600"
                  />
                  <p className="text-xs text-gray-400">设置后，输入/输出文件将使用完整路径，方便在任意位置运行命令。</p>
              </div>

              {/* Estimation */}
              {metadata && estimatedSize && (
                  <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100 flex items-start gap-3 text-green-800">
                      <Calculator size={20} className="mt-0.5" />
                      <div>
                          <div className="font-bold">预估输出大小: ~{estimatedSize}</div>
                          <div className="text-xs opacity-80 mt-1">仅供参考，实际大小受画面复杂度影响较大。NVENC 编码通常比 x264/x265 生成的文件稍大。</div>
                      </div>
                  </div>
              )}
          </div>

          {/* Command Output */}
          <div className="flex-1 bg-gray-900 rounded-xl p-0 flex flex-col overflow-hidden shadow-lg min-h-[200px]">
              <div className="bg-gray-800 px-4 py-2 flex justify-between items-center shrink-0">
                  <div className="text-gray-300 text-sm font-mono flex items-center gap-2">
                      <Terminal size={16} />
                      FFmpeg Command
                  </div>
                  <button 
                    onClick={copyToClipboard}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors"
                  >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? 'Copied' : 'Copy'}
                  </button>
              </div>
              <div className="flex-1 p-4 overflow-auto custom-scrollbar-dark relative">
                  <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap break-all leading-relaxed">
                      {command || '# 等待文件与配置...'}
                  </pre>
                  
                  {warnings.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                          {warnings.map((w, i) => (
                              <div key={i} className="flex items-start gap-2 text-amber-400 text-xs mt-1">
                                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                  <span>{w}</span>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default VideoCommandGenerator;
