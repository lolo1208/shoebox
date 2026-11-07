import { useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type ConverterSettings,
  type ImageOutputOptions,
  type PdfOutputOptions,
} from '@/lib/image/convert';
import { SETTINGS_STORAGE_KEY } from '../constants';

export interface ConverterSettingsApi {
  settings: ConverterSettings;
  /** 整体替换（如切换目标） */
  update: (patch: Partial<ConverterSettings>) => void;
  updateImage: (patch: Partial<ImageOutputOptions>) => void;
  updatePdf: (patch: Partial<PdfOutputOptions>) => void;
  reset: () => void;
}

/**
 * 输出设置的持久化。
 *
 * 读取时统一归一化：本地缓存可能来自旧版本，字段缺失或越界都不会进入 UI。
 */
export function useConverterSettings(): ConverterSettingsApi {
  const [stored, setStored] = useLocalStorage<ConverterSettings>(SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS);

  const settings = useMemo(() => normalizeSettings(stored), [stored]);

  const update = useCallback(
    (patch: Partial<ConverterSettings>) => setStored(current => normalizeSettings({ ...current, ...patch })),
    [setStored],
  );

  const updateImage = useCallback(
    (patch: Partial<ImageOutputOptions>) =>
      setStored(current => {
        const base = normalizeSettings(current);
        return normalizeSettings({ ...base, image: { ...base.image, ...patch } });
      }),
    [setStored],
  );

  const updatePdf = useCallback(
    (patch: Partial<PdfOutputOptions>) =>
      setStored(current => {
        const base = normalizeSettings(current);
        return normalizeSettings({ ...base, pdf: { ...base.pdf, ...patch } });
      }),
    [setStored],
  );

  const reset = useCallback(() => setStored(DEFAULT_SETTINGS), [setStored]);

  return { settings, update, updateImage, updatePdf, reset };
}
