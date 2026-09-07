
/// <reference lib="dom" />
import React, { useState, useEffect, useRef } from 'react';
import { Search, Music, Disc, Upload, Save, ArrowRight, Link as LinkIcon, AlertCircle, Loader2, Check, Download, Zap, X, Maximize2, RefreshCw } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useLanguage } from '../../contexts/LanguageContext';
// Fix: ID3Writer is a default export in the ESM bundle
import ID3Writer from 'browser-id3-writer';
// @ts-ignore
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

// --- Types ---

interface SongResult {
  source: 'netease' | 'qq' | 'itunes';
  id: string | number;
  name: string;
  artist: string;
  album: string;
  picId: string;
  year: string;
  track?: number;
  disc?: number;
  duration?: number; // duration in seconds (optional)
}

interface SourceDetail {
  title: string;
  artist: string;
  album: string;
  year: string;
  track: string;
  disc: string;
  lyricist: string;
  composer: string;
  lyrics: string;
  coverUrl: string;
}

interface TargetTags {
  title: string;
  artist: string;
  album: string;
  year: string;
  track: string;
  disc: string;
  lyricist: string;
  composer: string;
  lyrics: string;
}

const INITIAL_TAGS: TargetTags = {
  title: '', artist: '', album: '', year: '', track: '', disc: '', lyricist: '', composer: '', lyrics: ''
};

// JSONP Helper for iTunes to bypass CORS
const fetchItunesJsonp = (term: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const cbName = `itunes_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');
    
    const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('iTunes request timed out'));
    }, 10000);

    const cleanup = () => {
        // @ts-ignore
        delete window[cbName];
        if (document.body.contains(script)) document.body.removeChild(script);
        clearTimeout(timeout);
    };

    // @ts-ignore
    window[cbName] = (data: any) => {
        cleanup();
        resolve(data);
    };

    script.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=20&callback=${cbName}`;
    script.onerror = () => {
        cleanup();
        reject(new Error('iTunes request failed (Network)'));
    };
    
    document.body.appendChild(script);
  });
};

// Helper to read ID3 tags from local MP3 file using jsmediatags
const readMp3Tags = (file: File): Promise<{ tags: TargetTags; coverBlob: Blob | null; coverUrl: string; coverSize: string }> => {
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: (result) => {
        const rawTags = result.tags || {};
        
        const title = rawTags.title ? String(rawTags.title).trim() : '';
        const artist = rawTags.artist ? String(rawTags.artist).trim() : '';
        const album = rawTags.album ? String(rawTags.album).trim() : '';
        const year = rawTags.year ? String(rawTags.year).trim() : '';
        const track = rawTags.track ? String(rawTags.track).trim() : '';

        const disc = rawTags.TPOS ? String(rawTags.TPOS.data || rawTags.TPOS || '').trim() : '';
        const lyricist = rawTags.TEXT ? String(rawTags.TEXT.data || rawTags.TEXT || '').trim() : '';
        const composer = rawTags.TCOM ? String(rawTags.TCOM.data || rawTags.TCOM || '').trim() : '';

        let lyrics = '';
        if (rawTags.USLT) {
          if (typeof rawTags.USLT === 'string') {
            lyrics = rawTags.USLT;
          } else if (rawTags.USLT.data) {
            lyrics = typeof rawTags.USLT.data === 'string'
              ? rawTags.USLT.data
              : (rawTags.USLT.data.lyrics || '');
          }
        } else if (rawTags.lyrics) {
          lyrics = typeof rawTags.lyrics === 'string' ? rawTags.lyrics : String(rawTags.lyrics);
        }

        let coverBlob: Blob | null = null;
        let coverUrl = '';
        let coverSize = '';

        if (rawTags.picture) {
          try {
            const { data, format } = rawTags.picture;
            const byteArray = new Uint8Array(data);
            coverBlob = new Blob([byteArray], { type: format || 'image/jpeg' });
            coverUrl = URL.createObjectURL(coverBlob);
            coverSize = `${(coverBlob.size / 1024).toFixed(1)} KB`;
          } catch (e) {
            console.warn('Failed to parse embedded album art:', e);
          }
        }

        resolve({
          tags: {
            title,
            artist,
            album,
            year,
            track,
            disc,
            lyricist,
            composer,
            lyrics,
          },
          coverBlob,
          coverUrl,
          coverSize
        });
      },
      onError: (error) => {
        console.warn('jsmediatags read error:', error);
        resolve({
          tags: INITIAL_TAGS,
          coverBlob: null,
          coverUrl: '',
          coverSize: ''
        });
      }
    });
  });
};

const MusicTagEditor: React.FC = () => {
  const { t } = useLanguage();
  
  // Settings (Default empty)
  const [backendUrl, setBackendUrl] = useLocalStorage<string>('tool-mt-api', '');
  
  // State
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SongResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sourceDetail, setSourceDetail] = useState<SourceDetail | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // Track selection uniquely
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  
  const [targetTags, setTargetTags] = useState<TargetTags>(INITIAL_TAGS);
  const [targetCoverBlob, setTargetCoverBlob] = useState<Blob | null>(null);
  const [targetCoverUrl, setTargetCoverUrl] = useState<string>('');
  const [targetCoverSize, setTargetCoverSize] = useState('');

  const [useNetease, setUseNetease] = useLocalStorage<boolean>('tool-mt-ne', true);
  const [useQQ, setUseQQ] = useLocalStorage<boolean>('tool-mt-qq', true);
  const [useItunes, setUseItunes] = useLocalStorage<boolean>('tool-mt-itunes', true);

  const [isDragging, setIsDragging] = useState(false);
  
  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Unified Modal State for Image Preview
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (targetCoverUrl) URL.revokeObjectURL(targetCoverUrl);
    };
  }, [targetCoverUrl]);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const getApiBase = () => {
      let url = backendUrl.trim();
      if (!url) return '';
      
      // Check for absolute URL (http:// or https://)
      if (/^https?:\/\//i.test(url)) {
          return url.replace(/\/$/, '');
      }
      
      // Treat as relative path, prepend current origin
      const origin = window.location.origin;
      const path = url.startsWith('/') ? url : `/${url}`;
      return `${origin}${path}`.replace(/\/$/, '');
  };

  const coverFileInputRef = useRef<HTMLInputElement>(null);

  const getSourceCoverUrl = (url: string) => {
      if (!url) return '';
      // iTunes URLs are direct (CORS usually ok or handling via img tag)
      // Netease/QQ need proxy
      if (url.includes('mzstatic.com') || url.includes('apple.com')) {
          return url;
      }
      return `${getApiBase()}/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const handleLocalCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const imgFile = e.target.files?.[0];
      if (!imgFile) return;

      if (!imgFile.type.startsWith('image/')) {
          showToast('请选择有效的图片文件', 'error');
          return;
      }

      setTargetCoverBlob(imgFile);
      const url = URL.createObjectURL(imgFile);
      if (targetCoverUrl) URL.revokeObjectURL(targetCoverUrl);
      setTargetCoverUrl(url);

      const img = new Image();
      img.onload = () => {
          setTargetCoverSize(`${img.naturalWidth}x${img.naturalHeight} (${(imgFile.size / 1024).toFixed(1)}KB)`);
      };
      img.src = url;

      showToast(t('mt.upload_cover_btn') + ' 成功', 'success');
  };

  const handleRemoveCover = () => {
      if (targetCoverUrl) URL.revokeObjectURL(targetCoverUrl);
      setTargetCoverBlob(null);
      setTargetCoverUrl('');
      setTargetCoverSize('');
      if (coverFileInputRef.current) {
          coverFileInputRef.current.value = '';
      }
  };

  const handleFile = async (f: File) => {
      if (!f.name.toLowerCase().endsWith('.mp3')) {
          showToast('Only MP3 files are supported.', 'error');
          return;
      }
      setFile(f);
      setFileBuffer(await f.arrayBuffer());
      
      // Reset target
      setTargetTags(INITIAL_TAGS);
      setTargetCoverBlob(null);
      if (targetCoverUrl) URL.revokeObjectURL(targetCoverUrl);
      setTargetCoverUrl('');
      setTargetCoverSize('');
      setSelectedKey(null);
      setDetailError(null);

      // Read embedded ID3 tags from the MP3 file
      const { tags, coverBlob, coverUrl, coverSize } = await readMp3Tags(f);

      setTargetTags(tags);
      if (coverBlob && coverUrl) {
          setTargetCoverBlob(coverBlob);
          setTargetCoverUrl(coverUrl);

          const img = new Image();
          img.onload = () => {
              setTargetCoverSize(`${img.naturalWidth}x${img.naturalHeight} (${(coverBlob.size / 1024).toFixed(1)}KB)`);
          };
          img.src = coverUrl;
      }

      const hasMeta = Object.values(tags).some(val => Boolean(val.trim())) || Boolean(coverBlob);
      if (hasMeta) {
          showToast(t('mt.original_tags_loaded'), 'success');
      }

      // Auto fill keyword using extracted title/artist or filename
      let query = f.name.replace(/\.mp3$/i, '').replace(/\s-\s/g, ' ');
      if (tags.title && tags.artist) {
          query = `${tags.artist} ${tags.title}`;
      } else if (tags.title) {
          query = tags.title;
      }
      setKeyword(query);
      
      // Auto search if we have any valid source
      if (backendUrl.trim() || useItunes) {
          doSearch(query);
      } else {
          setSearchResults([]);
          setSourceDetail(null);
      }
  };

  const doSearch = async (queryOverride?: string) => {
      const q = queryOverride || keyword;
      if (!q.trim()) return;
      
      const hasApi = !!backendUrl.trim();
      if (!hasApi && !useItunes) {
          showToast(t('mt.api_tip'), 'info');
          return;
      }

      // Clear previous results immediately
      setSearchResults([]);
      setSourceDetail(null);
      setSelectedKey(null);
      setDetailError(null);
      setIsSearching(true);

      const promises = [];
      const apiBase = getApiBase();

      if (hasApi && useNetease) {
          promises.push(
              fetch(`${apiBase}/api/netease/search?keywords=${encodeURIComponent(q)}`)
                .then(r => r.json())
                .then(data => (data.result?.songs || []).map((s: any) => ({
                    source: 'netease', 
                    id: s.id, 
                    name: s.name, 
                    artist: s.ar.map((a: any) => a.name).join('/'), 
                    album: s.al.name, 
                    picId: s.al.picUrl, 
                    year: s.publishTime ? new Date(s.publishTime).getFullYear().toString() : ''
                })))
                .catch(() => [])
          );
      }

      if (hasApi && useQQ) {
          promises.push(
              fetch(`${apiBase}/api/qq/search?keywords=${encodeURIComponent(q)}`)
                .then(r => r.json())
                .then(list => list.map((s: any) => ({
                    source: 'qq', 
                    id: s.songmid, 
                    name: s.songname, 
                    artist: s.singer.map((a: any) => a.name).join('/'), 
                    album: s.albumname, 
                    picId: s.albummid, 
                    year: s.publishTime ? s.publishTime.split('-')[0] : '', 
                    track: s.trackNum, 
                    disc: s.discNum
                })))
                .catch(() => [])
          );
      }

      if (useItunes) {
          promises.push(
              fetchItunesJsonp(q)
                .then(data => (data.results || []).map((s: any) => ({
                    source: 'itunes',
                    id: s.trackId,
                    name: s.trackName,
                    artist: s.artistName,
                    album: s.collectionName,
                    picId: s.artworkUrl100 ? s.artworkUrl100.replace('100x100bb', '600x600bb') : '',
                    year: s.releaseDate ? s.releaseDate.substring(0, 4) : '',
                    track: s.trackNumber,
                    disc: s.discNumber,
                    duration: s.trackTimeMillis ? Math.round(s.trackTimeMillis / 1000) : 0
                })))
                .catch(err => {
                    console.error('iTunes Search Error', err);
                    return [];
                })
          );
      }

      try {
          let results: SongResult[] = (await Promise.all(promises)).flat();
          // Sort order: QQ Music -> Netease -> iTunes
          results.sort((a, b) => {
              const score = (s: string) => {
                  if (s === 'qq') return 3;
                  if (s === 'netease') return 2;
                  if (s === 'itunes') return 1;
                  return 0;
              };
              return score(b.source) - score(a.source);
          });
          setSearchResults(results);
      } catch (e) {
          console.error(e);
      } finally {
          setIsSearching(false);
      }
  };

  const loadDetail = async (song: SongResult) => {
      setSelectedKey(`${song.source}:${song.id}`); // Set unique key for highlight
      setIsLoadingDetail(true);
      setDetailError(null);
      setSourceDetail(null);
      const apiBase = getApiBase();

      try {
          let detail: Partial<SourceDetail> = {
              title: song.name,
              artist: song.artist,
              album: song.album,
              year: song.year,
              track: song.track ? song.track.toString() : '',
              disc: song.disc ? song.disc.toString() : '',
              coverUrl: '',
              lyrics: ''
          };

          if (song.source === 'netease') {
              const [dRes, lRes] = await Promise.all([
                  fetch(`${apiBase}/api/netease/detail?ids=${song.id}`).then(r => r.json()),
                  fetch(`${apiBase}/api/netease/lyric?id=${song.id}`).then(r => r.json())
              ]);
              const d = dRes.songs[0];
              if (d.publishTime) detail.year = new Date(d.publishTime).getFullYear().toString();
              if (d.no) detail.track = String(d.no);
              if (d.cd) detail.disc = String(d.cd);
              detail.coverUrl = d.al.picUrl ? d.al.picUrl + '?param=500y500' : '';
              detail.lyrics = lRes.lrc ? lRes.lrc.lyric : '';
          } else if (song.source === 'qq') {
              const lRes = await fetch(`${apiBase}/api/qq/lyric?songmid=${song.id}`).then(r => r.json());
              detail.coverUrl = song.picId ? `http://y.gtimg.cn/music/photo_new/T002R500x500M000${song.picId}.jpg` : '';
              detail.lyrics = lRes.lyric || '';
          } else if (song.source === 'itunes') {
              detail.coverUrl = song.picId || ''; 
              try {
                  const params = new URLSearchParams({
                      artist_name: song.artist,
                      track_name: song.name,
                      album_name: song.album,
                      duration: song.duration ? song.duration.toString() : ''
                  });
                  const lrcRes = await fetch(`https://lrclib.net/api/get?${params.toString()}`);
                  if (lrcRes.ok) {
                      const lrcData = await lrcRes.json();
                      detail.lyrics = lrcData.syncedLyrics || lrcData.plainLyrics || '';
                  }
              } catch(e) {
                  console.warn('LRCLIB fetch failed', e);
              }
          }

          if (detail.lyrics && !detail.lyricist) {
              const lMatch = detail.lyrics.match(/(?:作词|词|Lyricist)\s*[:：]\s*(.+?)(\r|\n|\[)/i);
              const cMatch = detail.lyrics.match(/(?:作曲|曲|Composer)\s*[:：]\s*(.+?)(\r|\n|\[)/i);
              detail.lyricist = lMatch ? lMatch[1].trim() : '';
              detail.composer = cMatch ? cMatch[1].trim() : '';
          }

          setSourceDetail(detail as SourceDetail);
      } catch (e) {
          console.error(e);
          setDetailError(t('mt.error_api'));
      } finally {
          setIsLoadingDetail(false);
      }
  };

  const applyField = (key: keyof TargetTags, val: string) => {
      setTargetTags(prev => ({ ...prev, [key]: val }));
  };

  const applyCover = async () => {
      if (!sourceDetail?.coverUrl) return;
      try {
          const proxyUrl = getSourceCoverUrl(sourceDetail.coverUrl);
          const res = await fetch(proxyUrl);
          if (!res.ok) throw new Error("Fetch failed");
          const blob = await res.blob();
          
          setTargetCoverBlob(blob);
          const url = URL.createObjectURL(blob);
          if (targetCoverUrl) URL.revokeObjectURL(targetCoverUrl);
          setTargetCoverUrl(url);

          const img = new Image();
          img.onload = () => {
              setTargetCoverSize(`${img.naturalWidth}x${img.naturalHeight} (${(blob.size/1024).toFixed(1)}KB)`);
          };
          img.src = url;
      } catch (e) {
          console.error(e);
          showToast('Failed to download cover image.', 'error');
      }
  };

  const applyAll = () => {
      if (!sourceDetail) return;
      setTargetTags({
          title: sourceDetail.title || '',
          artist: sourceDetail.artist || '',
          album: sourceDetail.album || '',
          year: sourceDetail.year || '',
          track: String(sourceDetail.track || ''),
          disc: String(sourceDetail.disc || ''),
          lyricist: sourceDetail.lyricist || '',
          composer: sourceDetail.composer || '',
          lyrics: sourceDetail.lyrics || ''
      });
      applyCover();
  };

  const handleDownload = async () => {
      if (!fileBuffer) return;
      try {
          const writer = new (ID3Writer as any)(fileBuffer);
          const setFrame = (frame: string, val: any, isArr = false) => {
              if (val === null || val === undefined) return;
              const v = String(val).trim(); 
              if (v) writer.setFrame(frame as any, (isArr ? [v] : v) as any);
          };

          setFrame('TIT2', targetTags.title);
          setFrame('TPE1', targetTags.artist, true);
          setFrame('TALB', targetTags.album);
          setFrame('TYER', targetTags.year);
          setFrame('TRCK', targetTags.track);
          setFrame('TPOS', targetTags.disc);
          setFrame('TEXT', targetTags.lyricist, true);
          setFrame('TCOM', targetTags.composer, true);

          if (targetTags.lyrics) {
              writer.setFrame('USLT', { description: '', lyrics: targetTags.lyrics });
          }

          if (targetCoverBlob) {
              writer.setFrame('APIC', {
                  type: 3,
                  data: await targetCoverBlob.arrayBuffer(),
                  description: 'Cover'
              });
          }

          writer.addTag();
          const taggedBlob = writer.getBlob();
          const url = URL.createObjectURL(taggedBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `[Tagged] ${file?.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // showToast(t('mt.success_write'), 'success'); // Successful write toast optional
      } catch (e) {
          console.error(e);
          showToast('Failed to write tags to file.', 'error');
      }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleRetryDetail = () => {
      if (!selectedKey) return;
      const song = searchResults.find(s => `${s.source}:${s.id}` === selectedKey);
      if (song) loadDetail(song);
  };

  return (
    <div className="flex flex-col gap-6 h-full relative">
        {/* Toast Notification Overlay */}
        {toast && (
            <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg shadow-lg border animate-fade-in flex items-center gap-2 max-w-sm w-full mx-4 sm:mx-0
                ${toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 
                  toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 
                  'bg-white border-gray-200 text-gray-700'}`}>
                {toast.type === 'error' ? <AlertCircle size={18}/> : <Check size={18}/>}
                <span className="text-sm font-medium flex-1">{toast.message}</span>
                <button onClick={() => setToast(null)}><X size={14}/></button>
            </div>
        )}

        {/* Modal for Cover Preview */}
        {previewModalUrl && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewModalUrl(null)}>
                <div className="relative max-w-2xl max-h-full">
                    <button className="absolute -top-10 right-0 text-white p-2 hover:bg-white/10 rounded-full" onClick={() => setPreviewModalUrl(null)}>
                        <X size={24} />
                    </button>
                    <img 
                        src={previewModalUrl} 
                        alt="Full Cover" 
                        className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()} 
                    />
                </div>
            </div>
        )}

        {/* Top Bar: Settings & File */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="flex-1 w-full flex items-center gap-2">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={backendUrl}
                        onChange={(e) => setBackendUrl(e.target.value)}
                        placeholder={t('mt.api_url')}
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    />
                    <LinkIcon className="absolute left-3 top-2.5 text-gray-400" size={16} />
                </div>
            </div>

            <div 
                className={`
                    flex-1 w-full border-2 border-dashed rounded-xl h-12 flex items-center justify-center cursor-pointer transition-all gap-2
                    ${isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}
                    ${file ? 'bg-green-50 border-green-300' : ''}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('mt-upload')?.click()}
            >
                <input id="mt-upload" type="file" accept=".mp3" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Upload size={18} className={file ? "text-green-600" : "text-gray-400"} />
                <span className={`text-sm font-medium ${file ? "text-green-700" : "text-gray-500"}`}>
                    {file ? file.name : t('mt.upload_desc')}
                </span>
            </div>
        </div>

        {/* Main Grid - Removed Fixed height to allow page-level scroll */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
            
            {/* Left: Search (Internal scroll for list ONLY) */}
            <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm h-full max-h-[800px]">
                <div className="p-4 border-b border-gray-100 bg-gray-50 space-y-3 shrink-0">
                    <div className="relative">
                        <input 
                            type="text" 
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                            placeholder={t('mt.search_ph')}
                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-gray-600 px-1">
                        <div className="flex gap-4">
                            <label className={`flex items-center gap-1.5 cursor-pointer ${!backendUrl.trim() ? 'opacity-50' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={useQQ} 
                                    disabled={!backendUrl.trim()}
                                    onChange={e => setUseQQ(e.target.checked)} 
                                    className="rounded text-primary-600 focus:ring-primary-500" 
                                />
                                {t('mt.qq')}
                            </label>
                            <label className={`flex items-center gap-1.5 cursor-pointer ${!backendUrl.trim() ? 'opacity-50' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    checked={useNetease} 
                                    disabled={!backendUrl.trim()}
                                    onChange={e => setUseNetease(e.target.checked)} 
                                    className="rounded text-primary-600 focus:ring-primary-500" 
                                />
                                {t('mt.netease')}
                            </label>
                        </div>
                        <label className="flex items-center gap-1.5 cursor-pointer mt-1">
                            <input 
                                type="checkbox" 
                                checked={useItunes} 
                                onChange={e => setUseItunes(e.target.checked)} 
                                className="rounded text-primary-600 focus:ring-primary-500" 
                            />
                            {t('mt.itunes')}
                        </label>
                    </div>
                    <button 
                        onClick={() => doSearch()} 
                        disabled={isSearching || !keyword || (!backendUrl.trim() && !useItunes)}
                        className="w-full py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                        {isSearching ? t('mt.searching') : t('mt.search')}
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {searchResults.map((song, i) => {
                        const isCurrentSelected = selectedKey === `${song.source}:${song.id}`;
                        return (
                            <div 
                                key={`${song.source}-${song.id}-${i}`}
                                onClick={() => loadDetail(song)}
                                className={`
                                    p-2.5 rounded-lg cursor-pointer border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-all
                                    ${isCurrentSelected ? 'bg-primary-50 border-primary-200' : ''}
                                `}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${song.source === 'netease' ? 'bg-red-500' : song.source === 'qq' ? 'bg-green-500' : 'bg-purple-500'}`}>
                                        {song.source === 'netease' ? '网' : song.source === 'qq' ? 'Q' : 'i'}
                                    </span>
                                    <div className="font-bold text-gray-800 text-sm truncate">{song.name}</div>
                                </div>
                                <div className="text-xs text-gray-500 truncate pl-1">
                                    {song.artist} - {song.album}
                                </div>
                            </div>
                        );
                    })}
                    {!isSearching && searchResults.length === 0 && (
                        <div className="text-center text-gray-400 py-10 text-sm">{t('mt.no_results')}</div>
                    )}
                </div>
            </div>

            {/* Middle: Source Details - No Internal Scroll */}
            <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm">
                <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 text-sm flex justify-between items-center shrink-0 rounded-t-xl">
                    <span>{t('mt.source_info')}</span>
                    {sourceDetail && (
                        <button onClick={applyAll} className="text-xs flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium">
                            {t('mt.apply_all')}
                        </button>
                    )}
                </div>
                
                <div className="flex flex-col">
                    {isLoadingDetail ? (
                        <div className="py-20 flex items-center justify-center text-gray-400 gap-2">
                            <Loader2 className="animate-spin" size={24} />
                            <span>{t('mt.loading')}</span>
                        </div>
                    ) : detailError ? (
                        <div className="py-20 flex flex-col items-center justify-center text-red-400 text-sm gap-2 p-6 text-center">
                            <AlertCircle size={32} strokeWidth={1.5} />
                            <p className="font-medium">{detailError}</p>
                            <button 
                                onClick={handleRetryDetail}
                                className="mt-3 flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-full border border-red-100 transition-colors"
                            >
                                <RefreshCw size={12}/>
                                {t('common.reset')}
                            </button>
                        </div>
                    ) : sourceDetail ? (
                        <div className="flex flex-col">
                            <div className="p-4 space-y-4">
                                <div className="flex flex-col items-center">
                                    <div 
                                        className="w-32 h-32 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden mb-2 relative group cursor-zoom-in"
                                        onClick={() => sourceDetail.coverUrl && setPreviewModalUrl(getSourceCoverUrl(sourceDetail.coverUrl))}
                                    >
                                        {sourceDetail.coverUrl ? (
                                            <>
                                                <img src={getSourceCoverUrl(sourceDetail.coverUrl)} alt="Cover" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                    <Maximize2 size={24} />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 cursor-default"><Disc size={32}/></div>
                                        )}
                                    </div>
                                    <button onClick={applyCover} className="text-xs px-3 py-1 text-primary-600 hover:bg-primary-50 hover:border-primary-200 border border-transparent rounded transition-colors flex items-center gap-1">
                                        {t('mt.apply_cover')}
                                    </button>
                                </div>
                                <div className="space-y-1.5">
                                    {([
                                        ['title', t('mt.field_title')],
                                        ['artist', t('mt.field_artist')],
                                        ['album', t('mt.field_album')],
                                        ['year', t('mt.field_year')],
                                        ['track', t('mt.field_track')],
                                        ['disc', t('mt.field_disc')],
                                        ['lyricist', t('mt.field_lyricist')],
                                        ['composer', t('mt.field_composer')],
                                    ] as const).map(([key, label]) => (
                                        <div key={key} className="flex items-center gap-2 group">
                                            <div className="w-16 text-xs text-gray-500 text-right shrink-0">{label}</div>
                                            <div 
                                                className="flex-1 bg-gray-50 border border-gray-100 rounded px-2 py-1 text-xs text-gray-800 truncate cursor-pointer hover:bg-primary-50 hover:border-primary-200 transition-colors h-[30px] flex items-center"
                                                title={(sourceDetail as any)[key]}
                                                onClick={() => applyField(key as keyof TargetTags, (sourceDetail as any)[key])}
                                            >
                                                {(sourceDetail as any)[key]}
                                            </div>
                                            <button 
                                                onClick={() => applyField(key as keyof TargetTags, (sourceDetail as any)[key])}
                                                className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 pt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-xs font-bold text-gray-500">Lyrics</span>
                                    <button onClick={() => applyField('lyrics', sourceDetail.lyrics)} className="text-xs text-primary-600 hover:underline">{t('mt.apply_lyrics')}</button>
                                </div>
                                <textarea 
                                    readOnly 
                                    value={sourceDetail.lyrics} 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-xs font-mono text-gray-600 resize-none h-64 focus:outline-none"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="py-40 flex flex-col items-center justify-center text-gray-300 text-sm gap-2">
                            <AlertCircle size={32} strokeWidth={1.5} />
                            <p>{t('mt.select_tip')}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Target Tags - No Internal Scroll */}
            <div className="lg:col-span-5 bg-white border border-gray-200 rounded-xl flex flex-col shadow-sm">
                <div className="p-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 text-sm flex justify-between items-center shrink-0 rounded-t-xl">
                    <span className="flex items-center gap-2"><Save size={16} className="text-green-600"/> {t('mt.write_data')}</span>
                    {file && <span className="text-xs text-gray-400 font-normal truncate max-w-[150px]">{file.name}</span>}
                </div>
                <div className="flex flex-col">
                    <div className="p-4 space-y-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-gray-600 flex items-center gap-1">
                                    <Disc size={14} className="text-primary-600" />
                                    {t('mt.album_cover')}
                                </label>
                                <div className="flex items-center gap-1.5">
                                    <input 
                                        type="file" 
                                        ref={coverFileInputRef} 
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={handleLocalCoverChange} 
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => coverFileInputRef.current?.click()}
                                        className="text-xs px-2.5 py-1 bg-white border border-gray-200 hover:border-primary-300 text-gray-700 hover:text-primary-600 rounded shadow-sm transition-all flex items-center gap-1 font-medium cursor-pointer"
                                    >
                                        <Upload size={12} />
                                        {t('mt.upload_cover_btn')}
                                    </button>
                                    {targetCoverUrl && (
                                        <button 
                                            type="button"
                                            onClick={handleRemoveCover}
                                            className="text-xs px-2 py-1 bg-white border border-gray-200 hover:border-red-300 text-gray-500 hover:text-red-600 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                                            title={t('mt.remove_cover')}
                                        >
                                            <X size={12} />
                                            {t('mt.remove')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div 
                                    className={`w-14 h-14 bg-white border border-gray-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0 relative group ${targetCoverUrl ? 'cursor-zoom-in hover:shadow' : 'border-dashed cursor-pointer'}`}
                                    onClick={() => {
                                        if (targetCoverUrl) {
                                            setPreviewModalUrl(targetCoverUrl);
                                        } else {
                                            coverFileInputRef.current?.click();
                                        }
                                    }}
                                >
                                    {targetCoverUrl ? (
                                        <>
                                            <img src={targetCoverUrl} alt="New Cover" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                                <Maximize2 size={16} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-0.5 text-gray-400 p-1 text-center">
                                            <Upload size={14} />
                                            <span className="text-[9px]">{t('mt.click_to_upload')}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                        {targetCoverUrl ? (
                                            <span className="text-green-600 flex items-center gap-1">
                                                <Check size={13} /> {t('mt.cover_ready')}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">{t('mt.no_cover')}</span>
                                        )}
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                        {targetCoverSize || (targetCoverUrl ? '' : 'JPG, PNG, WEBP')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-12">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_title')}</label>
                                <input type="text" value={targetTags.title} onChange={e => applyField('title', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-6">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_artist')}</label>
                                <input type="text" value={targetTags.artist} onChange={e => applyField('artist', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-6">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_album')}</label>
                                <input type="text" value={targetTags.album} onChange={e => applyField('album', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_year')}</label>
                                <input type="text" value={targetTags.year} onChange={e => applyField('year', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_track')}</label>
                                <input type="text" value={targetTags.track} onChange={e => applyField('track', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-4">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_disc')}</label>
                                <input type="text" value={targetTags.disc} onChange={e => applyField('disc', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-6">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_lyricist')}</label>
                                <input type="text" value={targetTags.lyricist} onChange={e => applyField('lyricist', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                            <div className="col-span-6">
                                <label className="block text-xs font-medium text-gray-500 mb-1">{t('mt.field_composer')}</label>
                                <input type="text" value={targetTags.composer} onChange={e => applyField('composer', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-primary-500" />
                            </div>
                        </div>
                    </div>
                    <div className="p-4 pt-2">
                        <label className="block text-xs font-bold text-gray-500 mb-1 shrink-0">{t('mt.field_lyrics')}</label>
                        <textarea 
                            value={targetTags.lyrics} 
                            onChange={e => applyField('lyrics', e.target.value)} 
                            className="w-full p-2 border border-gray-300 rounded text-xs font-mono focus:ring-1 focus:ring-primary-500 h-64" 
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                    <button 
                        onClick={handleDownload}
                        disabled={!file}
                        className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-md shadow-green-100 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download size={20} />
                        {t('mt.write_btn')}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default MusicTagEditor;
