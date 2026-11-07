/** 音乐标签编辑的数据层：iTunes 搜索与本地 ID3 读取 */

// @ts-ignore
import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

export interface SongResult {
  source: 'netease' | 'qq' | 'itunes';
  id: string | number;
  name: string;
  artist: string;
  album: string;
  picId: string;
  year: string;
  track?: number;
  disc?: number;
  duration?: number;
}

export interface SourceDetail {
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

export interface TargetTags {
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

export const INITIAL_TAGS: TargetTags = {
  title: '',
  artist: '',
  album: '',
  year: '',
  track: '',
  disc: '',
  lyricist: '',
  composer: '',
  lyrics: '',
};

/** 通过 JSONP 调用 iTunes 搜索接口，绕过 CORS */
export const fetchItunesJsonp = (term: string): Promise<any> =>
  new Promise((resolve, reject) => {
    const cbName = `itunes_cb_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('iTunes request timed out'));
    }, 10000);

    const cleanup = () => {
      delete (window as any)[cbName];
      if (document.body.contains(script)) document.body.removeChild(script);
      window.clearTimeout(timeout);
    };

    (window as any)[cbName] = (data: any) => {
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

/** 读取本地 MP3 的 ID3 标签与内嵌封面 */
export const readAudioTags = (
  file: File,
): Promise<{ tags: TargetTags; coverBlob: Blob | null; coverUrl: string; coverSize: string }> =>
  new Promise(resolve => {
    jsmediatags.read(file, {
      onSuccess: (result: any) => {
        const raw = result.tags || {};
        const text = (value: any) => (value ? String(value).trim() : '');

        let lyrics = '';
        if (raw.USLT) {
          if (typeof raw.USLT === 'string') lyrics = raw.USLT;
          else if (raw.USLT.data) lyrics = typeof raw.USLT.data === 'string' ? raw.USLT.data : raw.USLT.data.lyrics || '';
        } else if (raw.lyrics) {
          lyrics = typeof raw.lyrics === 'string' ? raw.lyrics : String(raw.lyrics);
        }

        let coverBlob: Blob | null = null;
        let coverUrl = '';
        let coverSize = '';

        if (raw.picture) {
          try {
            const { data, format } = raw.picture;
            coverBlob = new Blob([new Uint8Array(data)], { type: format || 'image/jpeg' });
            coverUrl = URL.createObjectURL(coverBlob);
            coverSize = `${(coverBlob.size / 1024).toFixed(1)} KB`;
          } catch (e) {
            console.warn('解析内嵌封面失败:', e);
          }
        }

        resolve({
          tags: {
            title: text(raw.title),
            artist: text(raw.artist),
            album: text(raw.album),
            year: text(raw.year),
            track: text(raw.track),
            disc: text(raw.TPOS?.data || raw.TPOS),
            lyricist: text(raw.TEXT?.data || raw.TEXT),
            composer: text(raw.TCOM?.data || raw.TCOM),
            lyrics,
          },
          coverBlob,
          coverUrl,
          coverSize,
        });
      },
      onError: (error: unknown) => {
        console.warn('jsmediatags 读取失败:', error);
        resolve({ tags: INITIAL_TAGS, coverBlob: null, coverUrl: '', coverSize: '' });
      },
    });
  });
