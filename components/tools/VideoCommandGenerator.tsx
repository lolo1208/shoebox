import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileVideo, Terminal, Copy, Check, Info, Film, Cpu, Zap, Volume2, RefreshCw, Captions, Settings2, FolderInput, ExternalLink, Calculator, AlertTriangle, Plus, Trash2, FileText } from 'lucide-react';
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
  
  // Working Directory
  const [workDir, setWorkDir] = useState('');

  // Stream Selection (Multi-select)
  const [selectedAudioTracks, setSelectedAudioTracks] = useState<Set<number>>(new Set());
  const [selectedSubTracks, setSelectedSubTracks] = useState<Set<number>>(new Set());

  // External Subtitles
  const [externalSubs, setExternalSubs] = useState<ExternalSubtitle[]>([]);

  // FFmpeg Settings
  const [container, setContainer] = useState('mp4');
  const [videoEncoder, setVideoEncoder] = useState('libx264');
  const [crf, setCrf] = useState(23);
  const [preset, setPreset] = useState('medium');
  const [audioEncoder, setAudioEncoder] = useState('aac');
  const [scale, setScale] = useState('original');
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

  const handleExternalSubUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
          const newSubs: ExternalSubtitle[] = Array.from(e.target.files).map(f => ({
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
      const mediainfo = await MediaInfoFactory({ format: 'object' });
      
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
        // Cast to any to avoid TypeScript errors with dynamic MediaInfo properties
        const general = result.media.track.find((t: any) => t['@type'] === 'General') as any;
        const videoTracks = result.media.track.filter((t: any) => t['@type'] === 'Video');
        const audioTracks = result.media.track.filter((t: any) => t['@type'] === 'Audio');
        const subTracks = result.media.track.filter((t: any) => t['@type'] === 'Text');

        // Parse Duration
        let duration = 'Unknown';
        let rawDuration = 0;
        if (general?.Duration) {
             rawDuration = parseFloat(general.Duration);
             duration = formatDuration(general.Duration);
        }

        // Parse Size
        let fileSize = 'Unknown';
        let rawBitRate = 0;
        if (general?.FileSize_String4) fileSize = general.FileSize_String4;
        else if (general?.FileSize) fileSize = formatSize(general.FileSize);

        // Calculate overall bitrate if available or infer from size/duration
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
            codec: v.Format, // e.g., AVC, HEVC
            codecId: v.CodecID, 
            width: parseInt(v.Width),
            height: parseInt(v.Height),
            frameRate: v.FrameRate,
            bitRate: v.BitRate_String || (v.BitRate ? (parseInt(v.BitRate)/1000).toFixed(0)+' kb/s' : 'N/A')
          })),
          audio: audioList,
          subtitles: subList
        });
        
        // Auto-select ALL audio tracks
        const allAudioIds = new Set(audioList.map((a: any) => a.id));
        setSelectedAudioTracks(allAudioIds as Set<number>);

        // Auto-select ALL subtitle tracks
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

  // Improved Estimation Logic
  useEffect(() => {
    if (!metadata || metadata.rawDuration <= 0) {
        setEstimatedSize(null);
        return;
    }

    // 1. Determine Base Bitrate Source
    // If we have raw bitrate from source, use it as a reference point for complexity.
    // If not, default to standard model (3000kbps for 1080p).
    let estimatedVideoKbps = 3000;
    
    // Detect Source Efficiency
    const isSourceHEVC = metadata.video.some(v => v.codec.includes('HEVC') || v.codec.includes('265'));
    const isTargetHEVC = videoEncoder.includes('265') || videoEncoder.includes('hevc');
    const isTargetNVENC = videoEncoder.includes('nvenc');

    if (metadata.rawBitRate > 0) {
        // Use source bitrate as base complexity, assuming visual transparency goal
        // Remove audio part (approx) to get video part
        const approxAudio = Math.max(128 * metadata.audio.length, 256);
        let sourceVideoKbps = Math.max(500, (metadata.rawBitRate / 1000) - approxAudio);
        
        // Adjust for Source Efficiency:
        // If Source is HEVC (High Efficiency), it "contains" more quality per bit.
        // Converting HEVC to AVC requires MORE bits to keep that quality.
        if (isSourceHEVC && !isTargetHEVC) {
            sourceVideoKbps = sourceVideoKbps * 1.6; // Penalty for HEVC -> AVC
        } else if (!isSourceHEVC && isTargetHEVC) {
            sourceVideoKbps = sourceVideoKbps * 0.6; // Gain for AVC -> HEVC
        }
        
        estimatedVideoKbps = sourceVideoKbps;
    }

    // 2. Adjust for Resolution Changes
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

    // 3. Adjust for CRF changes (Assuming source is roughly equivalent to CRF 23 visual quality if we used bitrate basis)
    // Rule: +/- 6 CRF = double/half bitrate. 
    // If we started from source bitrate, we assume that represents "Good" quality (approx CRF 20-23).
    const crfDelta = 23 - crf; // positive if crf < 23 (higher quality/size)
    const crfFactor = Math.pow(2, crfDelta / 6); 
    estimatedVideoKbps = estimatedVideoKbps * crfFactor;

    // 4. Adjust for Hardware Encoder (NVENC tends to be larger for same QP/CRF)
    if (isTargetNVENC) {
        estimatedVideoKbps = estimatedVideoKbps * 1.2;
    }

    // 5. Audio Size
    let audioKbps = 0;
    if (audioEncoder === 'copy') {
        audioKbps = 192 * selectedAudioTracks.size; // Conservative guess for copy
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

  // Generate Command
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
    
    // Input 0: Video
    let cmd = `ffmpeg -i ${getPath(inputName)}`;
    
    // Input 1..N: External Subs
    externalSubs.forEach(sub => {
        cmd += ` -i ${getPath(sub.file.name)}`;
    });

    // --- MAPPING ---

    // Map Video: -map 0:v:0 (First video track from Input 0)
    cmd += ` -map 0:v:0`;
    
    // Map Selected Audio
    if (audioEncoder !== 'none') {
        const sortedAudio = Array.from(selectedAudioTracks).sort((a, b) => a - b);
        sortedAudio.forEach(id => {
            cmd += ` -map 0:a:${id}`;
        });
    }

    // Map Internal Subs
    const sortedSubs = Array.from(selectedSubTracks).sort((a, b) => a - b);
    let outputSubIndex = 0;
    
    const isMp4 = container === 'mp4' || container === 'mov';

    // Internal Subtitles Processing
    sortedSubs.forEach(id => {
        const subTrack = metadata?.subtitles.find(s => s.id === id);
        if (isMp4 && subTrack && isBitmapSubtitle(subTrack.format)) {
             newWarnings.push(`已忽略内部字幕 #${id+1} (${subTrack.format}): 图形字幕不支持封装到 MP4。`);
        } else {
             cmd += ` -map 0:s:${id}`;
             outputSubIndex++;
        }
    });

    // External Subtitles Processing
    externalSubs.forEach((sub, idx) => {
        // External inputs start at index 1
        const inputIdx = idx + 1;
        cmd += ` -map ${inputIdx}:0`;
        
        // Metadata for external subs
        // Need to know the output stream index. 
        // Video is stream 0. Audio tracks are 1..N. Subs follow.
        // This is complex in ffmpeg to predict exact index without -map_metadata logic, 
        // but explicit metadata tagging usually works with s:s:{idx relative to subtitles}
        
        // Set Language
        cmd += ` -metadata:s:s:${outputSubIndex} language=${sub.language}`;
        // Set Title
        cmd += ` -metadata:s:s:${outputSubIndex} title="${sub.title}"`;
        
        outputSubIndex++;
    });


    // --- ENCODING ---

    // Video Codec
    cmd += ` -c:v ${videoEncoder}`;
    
    // Fix 10-bit input crashing 8-bit encoders: Force yuv420p (8-bit)
    if (videoEncoder.includes('264')) {
        cmd += ` -pix_fmt yuv420p`;
    }

    if (videoEncoder === 'libx264' || videoEncoder === 'libx265') {
       cmd += ` -crf ${crf} -preset ${preset}`;
    } else if (videoEncoder.includes('nvenc')) {
       cmd += ` -cq ${crf} -preset p4`; 
    }

    // Scale
    if (scale !== 'original') {
       if (scale === '720p') {
           cmd += ` -vf "scale=-2:min(720\\,ih)"`;
       } else if (scale === '1080p') {
           cmd += ` -vf "scale=-2:min(1080\\,ih)"`;
       } else if (scale === 'custom') {
           cmd += ` -vf "scale=min(${customScaleW}\\,iw):-2"`;
       }
    }

    // Audio Settings
    if (audioEncoder === 'copy') {
      cmd += ` -c:a copy`;
    } else if (audioEncoder === 'none') {
       // No audio
    } else {
      cmd += ` -c:a ${audioEncoder}`;
      if (audioEncoder === 'aac') cmd += ` -b:a 128k`;
    }

    // Subtitle Settings (Global)
    if (outputSubIndex > 0) { // If we have any subs mapped
        if (isMp4) {
            cmd += ` -c:s mov_text`;
        } else {
            cmd += ` -c:s copy`;
        }
    }

    // Output filename
    const ext = container;
    const baseName = file ? file.name.substring(0, file.name.lastIndexOf('.')) : 'output';
    cmd += ` ${getPath(`${baseName}_compressed.${ext}`)}`;

    setCommand(cmd);
    setWarnings(newWarnings);
  }, [file, workDir, videoEncoder, crf, preset, audioEncoder, scale, customScaleW, container, selectedAudioTracks, selectedSubTracks, metadata, externalSubs]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (type: 'compat' | 'compress' | 'high') => {
      if (type === 'compat') {
          setContainer('mp4');
          setVideoEncoder('libx264');
          setCrf(23);
          setPreset('medium');
          setAudioEncoder('aac');
      } else if (type === 'compress') {
          setContainer('mp4');
          setVideoEncoder('libx265');
          setCrf(28);
          setPreset('slow');
          setAudioEncoder('aac');
      } else if (type === 'high') {
          setContainer('mkv');
          setVideoEncoder('libx264');
          setCrf(18);
          setPreset('slow');
          setAudioEncoder('copy');
      }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full">
      {/* Left: Input & Analysis */}
      <div className="w-full lg:w-96 shrink-0 space-y-6 flex flex-col h-full overflow-hidden">
        {/* File Upload */}
        <div 
            className="shrink-0 h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors bg-gray-50"
            onClick={() => document.getElementById('vid-upload')?.click()}
        >
            <input id="vid-upload" type="file" accept="video/*,.mkv,.flv,.avi,.mov,.wmv" className="hidden" onChange={handleFileChange} />
            <Upload size={32} className="text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">选择视频文件</p>
            <p className="text-xs text-gray-400 mt-1">支持 MP4, MKV, MOV 等</p>
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
                                            <div className="font-semibold text-gray-800">
                                                #{a.id + 1} - {a.language}
                                                {a.title && <span className="ml-1 text-gray-500 font-normal">[{a.title}]</span>}
                                                {a.isDefault && <span className="ml-2 text-[10px] bg-gray-200 px-1 rounded text-gray-600">Default</span>}
                                            </div>
                                            <div className="text-gray-500">{a.format}, {a.details}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : <div className="text-xs text-gray-400 italic">无音频流</div>}
                    </div>

                    {/* Subtitle Tracks Selection */}
                    <div>
                        <div className="font-medium text-sm text-gray-900 mb-2 flex items-center gap-1"><Captions size={14}/> 内部字幕 (多选)</div>
                        <div className="space-y-1">
                            {metadata.subtitles.length > 0 ? metadata.subtitles.map((s) => (
                                <label key={s.id} className="flex items-start gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedSubTracks.has(s.id)}
                                        onChange={() => toggleTrack(selectedSubTracks, s.id, setSelectedSubTracks)}
                                        className="mt-0.5 rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    <div className="text-xs">
                                        <div className="font-semibold text-gray-800">
                                            #{s.id + 1} - {s.language}
                                            {s.title && <span className="ml-1 text-gray-500 font-normal">[{s.title}]</span>}
                                            {s.isDefault && <span className="ml-2 text-[10px] bg-gray-200 px-1 rounded text-gray-600">Default</span>}
                                        </div>
                                        <div className="text-gray-500">{s.format} {s.details}</div>
                                    </div>
                                </label>
                            )) : <div className="text-xs text-gray-400 italic">无字幕流</div>}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Right: Configuration & Command */}
      <div className="flex-1 space-y-6 overflow-y-auto pr-1 custom-scrollbar">
          {/* Quick Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <button onClick={() => applyPreset('compat')} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm text-left transition-all group">
                  <div className="font-semibold text-gray-800 group-hover:text-primary-600 text-sm">兼容性优先</div>
                  <div className="text-xs text-gray-500 mt-1">MP4, H.264, 中画质</div>
              </button>
              <button onClick={() => applyPreset('compress')} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm text-left transition-all group">
                  <div className="font-semibold text-gray-800 group-hover:text-primary-600 text-sm">极致压缩</div>
                  <div className="text-xs text-gray-500 mt-1">MP4, H.265, 慢速</div>
              </button>
              <button onClick={() => applyPreset('high')} className="p-3 bg-white border border-gray-200 rounded-lg hover:border-primary-300 hover:shadow-sm text-left transition-all group">
                  <div className="font-semibold text-gray-800 group-hover:text-primary-600 text-sm">高质量存档</div>
                  <div className="text-xs text-gray-500 mt-1">MKV, CRF 18, 无损音频</div>
              </button>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6 shadow-sm">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Settings2 size={18} className="text-primary-600" />
                  转码参数配置
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">封装格式 (Container)</label>
                      <select value={container} onChange={(e) => setContainer(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500">
                          <option value="mp4">MP4 (通用)</option>
                          <option value="mkv">MKV (功能强)</option>
                          <option value="mov">MOV (Apple)</option>
                          <option value="webm">WebM (网页)</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                          分辨率限制 
                          <span className="text-xs text-gray-400 font-normal ml-2">(仅缩小, 不放大)</span>
                      </label>
                      <select value={scale} onChange={(e) => setScale(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500">
                          <option value="original">保持原始分辨率</option>
                          <option value="1080p">限制为 1080p (Max Height)</option>
                          <option value="720p">限制为 720p (Max Height)</option>
                          <option value="custom">限制宽度 (Max Width)</option>
                      </select>
                      {scale === 'custom' && (
                          <input 
                            type="number" 
                            value={customScaleW} 
                            onChange={(e) => setCustomScaleW(parseInt(e.target.value))}
                            className="mt-2 w-full p-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Max Width (e.g. 1920)"
                          />
                      )}
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">视频编码 (Encoder)</label>
                      <select value={videoEncoder} onChange={(e) => setVideoEncoder(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500">
                          <optgroup label="CPU (软件编码)">
                              <option value="libx264">H.264 (x264) - 兼容性最好</option>
                              <option value="libx265">H.265 (x265) - 压缩率最高</option>
                              <option value="libvpx-vp9">VP9 - Web通用</option>
                          </optgroup>
                          <optgroup label="GPU (硬件加速)">
                              <option value="h264_nvenc">NVIDIA H.264</option>
                              <option value="hevc_nvenc">NVIDIA H.265</option>
                              <option value="h264_amf">AMD H.264</option>
                              <option value="h264_videotoolbox">Apple Silicon H.264</option>
                          </optgroup>
                      </select>
                  </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">音频编码 (Audio)</label>
                      <select value={audioEncoder} onChange={(e) => setAudioEncoder(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-primary-100 focus:border-primary-500">
                          <option value="aac">AAC (推荐)</option>
                          <option value="libmp3lame">MP3</option>
                          <option value="copy">Copy (不转码，原样复制)</option>
                          <option value="none">移除音频</option>
                      </select>
                  </div>
              </div>

              {/* CRF Slider */}
              {!videoEncoder.includes('vp9') && (
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">压缩质量 (CRF/CQ)</label>
                          <span className="text-sm font-mono text-primary-600 font-bold">{crf}</span>
                      </div>
                      <input 
                        type="range" min="0" max="51" 
                        value={crf} onChange={(e) => setCrf(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                      />
                      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                          <span>0 (无损)</span>
                          <span>18 (高画质)</span>
                          <span>23 (平衡)</span>
                          <span>28 (压缩)</span>
                          <span>51 (低画质)</span>
                      </div>
                  </div>
              )}
              
              {/* Preset Slider for CPU */}
              {(videoEncoder === 'libx264' || videoEncoder === 'libx265') && (
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-sm font-medium text-gray-700">编码速度 (Preset)</label>
                          <span className="text-sm font-mono text-primary-600 font-bold">{preset}</span>
                      </div>
                      <div className="flex justify-between gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto">
                          {['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'].map((p) => (
                              <button 
                                key={p}
                                onClick={() => setPreset(p)}
                                className={`flex-1 h-8 px-2 rounded text-[10px] sm:text-xs transition-colors whitespace-nowrap ${preset === p ? 'bg-white shadow text-primary-600 font-bold ring-1 ring-primary-100' : 'text-gray-500 hover:text-gray-700'}`}
                                title={p}
                              >
                                  {p}
                              </button>
                          ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">越慢压缩率越高(文件越小)，越快文件越大。</p>
                  </div>
              )}

              {/* External Subtitles */}
              <div>
                   <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                            <FileText size={14} /> 添加外部字幕
                        </label>
                        <button 
                            onClick={() => document.getElementById('sub-upload')?.click()}
                            className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700 px-2 py-1 bg-primary-50 rounded hover:bg-primary-100 transition-colors"
                        >
                            <Plus size={12} /> 添加字幕文件
                        </button>
                        <input id="sub-upload" type="file" accept=".srt,.ass,.ssa,.vtt" multiple className="hidden" onChange={handleExternalSubUpload} />
                   </div>
                   
                   {externalSubs.length > 0 ? (
                       <div className="space-y-2">
                           {externalSubs.map((sub, idx) => (
                               <div key={sub.id} className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                                   <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-gray-500 font-mono">
                                       {idx + 1}
                                   </div>
                                   <div className="flex-1 min-w-0">
                                       <div className="truncate font-medium text-gray-700">{sub.file.name}</div>
                                       <div className="flex gap-2 mt-1">
                                           <input 
                                                type="text" 
                                                value={sub.language}
                                                onChange={(e) => updateExternalSub(sub.id, 'language', e.target.value)}
                                                className="w-12 p-0.5 border rounded text-center text-[10px]"
                                                placeholder="lang"
                                                title="语言代码 (如 chi, eng)"
                                           />
                                           <input 
                                                type="text" 
                                                value={sub.title}
                                                onChange={(e) => updateExternalSub(sub.id, 'title', e.target.value)}
                                                className="flex-1 p-0.5 border rounded text-[10px]"
                                                placeholder="标题 (如 中文, Director's Cut)"
                                           />
                                       </div>
                                   </div>
                                   <button 
                                        onClick={() => removeExternalSub(sub.id)}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded transition-colors"
                                   >
                                       <Trash2 size={14} />
                                   </button>
                               </div>
                           ))}
                       </div>
                   ) : (
                       <div className="text-xs text-gray-400 italic p-3 border border-dashed border-gray-200 rounded-lg text-center">
                           暂无外部字幕，点击上方按钮添加 .srt, .ass 等文件
                       </div>
                   )}
              </div>
          </div>

          {/* Working Directory Input */}
          <div className="shrink-0">
             <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                 <FolderInput size={12} />
                 本地工作目录 (可选)
             </label>
             <input 
                type="text" 
                value={workDir}
                onChange={(e) => setWorkDir(e.target.value)}
                placeholder="例如 D:\Videos 或 /Users/Name/Movies"
                className="w-full p-2 text-xs border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 font-mono"
             />
             <p className="text-[10px] text-gray-400 mt-1">设置后将生成绝对路径，方便在任意目录运行命令。</p>
          </div>

          {/* Warnings */}
          {warnings.length > 0 && (
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-1">
                 {warnings.map((w, i) => (
                     <div key={i} className="flex items-start gap-2 text-xs text-yellow-800">
                         <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                         <span>{w}</span>
                     </div>
                 ))}
             </div>
          )}

          {/* Command Output */}
          <div className="space-y-2">
              <div className="flex justify-between items-end">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <Terminal size={16} />
                      对应的 FFmpeg 命令
                  </label>
                  {estimatedSize && (
                      <span className="text-xs font-mono text-primary-600 flex items-center gap-1 bg-primary-50 px-2 py-0.5 rounded">
                          <Calculator size={10} />
                          预估大小: ~{estimatedSize} (仅供参考)
                      </span>
                  )}
              </div>
              <div className="relative group">
                  <textarea 
                    readOnly
                    value={command}
                    className="w-full h-48 p-4 bg-gray-900 text-gray-100 font-mono text-xs sm:text-sm rounded-xl border border-gray-700 focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none custom-scrollbar"
                  />
                  <button 
                    onClick={copyToClipboard}
                    className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors border border-gray-600 shadow-sm opacity-100 sm:opacity-0 group-hover:opacity-100"
                    title="复制命令"
                  >
                      {copied ? <Check size={16} className="text-green-400"/> : <Copy size={16} />}
                  </button>
              </div>
              <div className="text-xs text-gray-500 flex flex-col gap-1">
                  <div className="flex gap-1">
                      <Info size={12} className="mt-0.5 shrink-0" />
                      <p>
                          请确保您的电脑上已安装 FFmpeg。在终端或命令提示符中运行上述命令即可。
                      </p>
                  </div>
                  <div className="flex gap-1 ml-4 items-center">
                      <ExternalLink size={10} />
                      <a href="https://ffmpeg.org/download.html" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          前往 FFmpeg 官网下载
                      </a>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default VideoCommandGenerator;