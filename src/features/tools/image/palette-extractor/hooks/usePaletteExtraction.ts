import { useEffect, useRef, useState } from 'react';
import { extractPalette, sampleImage } from '@/lib/image/palette';
import type { PaletteOptions, PaletteReport } from '@/lib/image/palette';
import type { ImageSource } from './useImageSource';

export type ExtractionStatus = 'idle' | 'working' | 'ready';

export interface PaletteExtraction {
  report: PaletteReport | null;
  status: ExtractionStatus;
  errorKey: string | null;
}

const reanalyzeDelay = 60;

/**
 * 监听图片与提取参数的变化，重算调色板。
 *
 * - 排序（sort）只影响展示顺序，不参与像素分析，因此从依赖中排除；
 * - 首次分析新图片立即执行，参数调整稍作防抖，避免拖动滑块时反复重算；
 * - 计算本身是同步的（毫秒级），但让出一帧再执行，保证「分析中」状态可见。
 */
export function usePaletteExtraction(
  source: ImageSource | null,
  options: PaletteOptions,
): PaletteExtraction {
  const [state, setState] = useState<PaletteExtraction>({ report: null, status: 'idle', errorKey: null });
  const sourceRef = useRef<ImageSource | null>(null);

  const analysisKey = [
    options.mode,
    options.count,
    options.maxEdge,
    options.ignoreTransparent,
    options.ignoreNearWhite,
    options.ignoreNearBlack,
    options.mergeSimilar,
    options.mergeThreshold,
  ].join('|');

  useEffect(() => {
    if (!source) {
      sourceRef.current = null;
      setState({ report: null, status: 'idle', errorKey: null });
      return;
    }

    const imageChanged = sourceRef.current !== source;
    sourceRef.current = source;

    setState(previous =>
      imageChanged
        ? { report: null, status: 'working', errorKey: null }
        : { ...previous, status: 'working' },
    );

    const timer = window.setTimeout(
      () => {
        const sampled = sampleImage(source.image, options.maxEdge);
        if (!sampled) {
          setState({ report: null, status: 'ready', errorKey: 'palette.err_sample' });
          return;
        }

        const report = extractPalette(sampled, options);
        setState({
          report,
          status: 'ready',
          errorKey: report.colors.length ? null : 'palette.err_empty',
        });
      },
      imageChanged ? 0 : reanalyzeDelay,
    );

    return () => window.clearTimeout(timer);
    // options 通过 analysisKey 参与依赖，读取时取最新值
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, analysisKey]);

  return state;
}
