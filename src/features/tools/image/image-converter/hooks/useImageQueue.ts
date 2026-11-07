import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_IMAGES, inspectImage, type SourceImage } from '@/lib/image/convert';

/** 同一批导入里去重时使用的指纹 */
const fingerprint = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

let idSeed = 0;
const nextId = () => {
  idSeed += 1;
  return `image-${Date.now().toString(36)}-${idSeed}`;
};

export interface ImageQueue {
  items: SourceImage[];
  /** 当前用于预览 / 排序参照的图片 */
  selectedId: string | null;
  selected: SourceImage | null;
  /** 导入相关的提示文案 key（img_conv.*） */
  errorKey: string | null;
  addFiles: (files: File[]) => Promise<void>;
  remove: (id: string) => void;
  move: (id: string, offset: number) => void;
  clear: () => void;
  select: (id: string) => void;
  dismissError: () => void;
}

/**
 * 图片导入队列。
 *
 * 负责：类型校验、去重、解码取尺寸 + 生成缩略图、ObjectURL 生命周期与顺序调整。
 * 顺序即 PDF 页面顺序，因此提供上移 / 下移。
 */
export function useImageQueue(): ImageQueue {
  const [items, setItems] = useState<SourceImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const aliveRef = useRef(true);
  // 卸载时统一回收，避免离开工具后仍占用内存
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      itemsRef.current.forEach(item => URL.revokeObjectURL(item.thumbnailUrl));
    };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const images = files.filter(file => file.type.startsWith('image/'));
    if (images.length === 0) {
      setErrorKey('img_conv.error.invalid');
      return;
    }

    const existing = new Set(itemsRef.current.map(item => fingerprint(item.file)));
    const room = Math.max(0, MAX_IMAGES - itemsRef.current.length);
    const accepted = images.filter(file => !existing.has(fingerprint(file))).slice(0, room);

    let error: string | null = images.length > room ? 'img_conv.error.limit' : null;

    // 逐张解码并立即释放位图：一次导入几十张大图时不会出现内存峰值
    const loaded: Array<SourceImage | null> = [];
    for (const file of accepted) {
      try {
        const inspection = await inspectImage(file);
        // 缩略图生成失败时退回原图 URL，保证列表仍可显示
        const thumbnailUrl = URL.createObjectURL(inspection.thumbnail ?? file);
        loaded.push({
          id: nextId(),
          file,
          thumbnailUrl,
          name: file.name,
          size: file.size,
          width: inspection.width,
          height: inspection.height,
        });
      } catch {
        error = 'img_conv.error.decode';
        loaded.push(null);
      }
    }

    if (!aliveRef.current) {
      loaded.forEach(item => item && URL.revokeObjectURL(item.thumbnailUrl));
      return;
    }

    const added = loaded.filter((item): item is SourceImage => item !== null);
    if (added.length > 0) {
      // 并发导入时按上限截断，保证不会超出 MAX_IMAGES
      setItems(prev => [...prev, ...added].slice(0, MAX_IMAGES));
      setSelectedId(current => current ?? added[0].id);
    }
    setErrorKey(added.length < accepted.length ? 'img_conv.error.decode' : error);
  }, []);

  const remove = useCallback((id: string) => {
    const list = itemsRef.current;
    const index = list.findIndex(item => item.id === id);
    if (index === -1) return;

    URL.revokeObjectURL(list[index].thumbnailUrl);
    const remaining = list.filter(item => item.id !== id);
    setItems(remaining);
    setSelectedId(current => {
      if (current !== id) return current;
      if (remaining.length === 0) return null;
      return remaining[Math.min(index, remaining.length - 1)].id;
    });
  }, []);

  const move = useCallback((id: string, offset: number) => {
    setItems(prev => {
      const index = prev.findIndex(item => item.id === id);
      const target = index + offset;
      if (index === -1 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    itemsRef.current.forEach(item => URL.revokeObjectURL(item.thumbnailUrl));
    setItems([]);
    setSelectedId(null);
    setErrorKey(null);
  }, []);

  const select = useCallback((id: string) => setSelectedId(id), []);
  const dismissError = useCallback(() => setErrorKey(null), []);

  return {
    items,
    selectedId,
    selected: items.find(item => item.id === selectedId) ?? items[0] ?? null,
    errorKey,
    addFiles,
    remove,
    move,
    clear,
    select,
    dismissError,
  };
}
