import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  CHARACTER_CLASS_IDS,
  clampInteger,
  generateKeyBatch,
  generatePasswordBatch,
  KEY_BYTES,
  KEY_FORMATS,
  PASSWORD_LENGTH,
  SECRET_COUNT,
  SYMBOL_SET_IDS,
  type CharacterClassSelection,
  type CharacterClassId,
  type GenerationResult,
  type KeyFormat,
  type KeyOptions,
  type PasswordOptions,
  type SecretMode,
  type SymbolSet,
} from '@/lib/secret';
import {
  DEFAULT_KEY_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  type KeyPreset,
  type PasswordPreset,
} from '../constants';

/** 存储里的枚举值可能是旧版本或被手工改过，非法值一律回退到默认 */
function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * localStorage 中的结构可能来自旧版本，读取时按缺省值补齐并夹取范围，
 * 保证 UI 控件与生成算法看到的是同一份合法参数。
 */
function withPasswordDefaults(stored: Partial<PasswordOptions>): PasswordOptions {
  const classes = {} as CharacterClassSelection;
  for (const id of CHARACTER_CLASS_IDS) {
    classes[id] = stored.classes?.[id] ?? DEFAULT_PASSWORD_OPTIONS.classes[id];
  }

  return {
    ...DEFAULT_PASSWORD_OPTIONS,
    ...stored,
    length: clampInteger(stored.length ?? DEFAULT_PASSWORD_OPTIONS.length, PASSWORD_LENGTH.min, PASSWORD_LENGTH.max),
    count: clampInteger(stored.count ?? DEFAULT_PASSWORD_OPTIONS.count, SECRET_COUNT.min, SECRET_COUNT.max),
    symbolSet: pickEnum<SymbolSet>(stored.symbolSet, SYMBOL_SET_IDS, DEFAULT_PASSWORD_OPTIONS.symbolSet),
    customCharacters: typeof stored.customCharacters === 'string' ? stored.customCharacters : '',
    classes,
  };
}

function withKeyDefaults(stored: Partial<KeyOptions>): KeyOptions {
  return {
    ...DEFAULT_KEY_OPTIONS,
    ...stored,
    bytes: clampInteger(stored.bytes ?? DEFAULT_KEY_OPTIONS.bytes, KEY_BYTES.min, KEY_BYTES.max),
    count: clampInteger(stored.count ?? DEFAULT_KEY_OPTIONS.count, SECRET_COUNT.min, SECRET_COUNT.max),
    format: pickEnum<KeyFormat>(stored.format, KEY_FORMATS, DEFAULT_KEY_OPTIONS.format),
  };
}

function runGeneration(
  mode: SecretMode,
  passwordOptions: PasswordOptions,
  keyOptions: KeyOptions,
): GenerationResult {
  return mode === 'password' ? generatePasswordBatch(passwordOptions) : generateKeyBatch(keyOptions);
}

export interface SecretGeneratorController {
  mode: SecretMode;
  passwordOptions: PasswordOptions;
  keyOptions: KeyOptions;
  /** 当前模式的生成结果 */
  result: GenerationResult;
  setMode: (mode: SecretMode) => void;
  updatePasswordOptions: (patch: Partial<PasswordOptions>) => void;
  updateKeyOptions: (patch: Partial<KeyOptions>) => void;
  toggleCharacterClass: (id: CharacterClassId) => void;
  applyPasswordPreset: (preset: PasswordPreset) => void;
  applyKeyPreset: (preset: KeyPreset) => void;
  /** 重新生成：参数变化时自动触发，也可由按钮手动调用 */
  regenerate: () => void;
}

/**
 * 生成器的状态与派生结果。
 * 参数发生变化即自动重新生成，因此「生成」按钮只承担「换一批」的语义。
 */
export function useSecretGenerator(): SecretGeneratorController {
  const [mode, setMode] = useLocalStorage<SecretMode>('tool-secret-mode', 'password');
  const [storedPassword, setStoredPassword] = useLocalStorage<Partial<PasswordOptions>>(
    'tool-secret-password-options',
    DEFAULT_PASSWORD_OPTIONS,
  );
  const [storedKey, setStoredKey] = useLocalStorage<Partial<KeyOptions>>(
    'tool-secret-key-options',
    DEFAULT_KEY_OPTIONS,
  );

  const passwordOptions = useMemo(() => withPasswordDefaults(storedPassword), [storedPassword]);
  const keyOptions = useMemo(() => withKeyDefaults(storedKey), [storedKey]);

  const [result, setResult] = useState<GenerationResult>(() => runGeneration(mode, passwordOptions, keyOptions));

  const regenerate = useCallback(() => {
    setResult(runGeneration(mode, passwordOptions, keyOptions));
  }, [mode, passwordOptions, keyOptions]);

  // 初始结果已由 useState 的惰性初始化生成，首次挂载不再重复生成（避免首屏闪一下）
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    regenerate();
  }, [regenerate]);

  const updatePasswordOptions = useCallback(
    (patch: Partial<PasswordOptions>) => setStoredPassword({ ...passwordOptions, ...patch }),
    [passwordOptions, setStoredPassword],
  );

  const updateKeyOptions = useCallback(
    (patch: Partial<KeyOptions>) => setStoredKey({ ...keyOptions, ...patch }),
    [keyOptions, setStoredKey],
  );

  const toggleCharacterClass = useCallback(
    (id: CharacterClassId) =>
      updatePasswordOptions({ classes: { ...passwordOptions.classes, [id]: !passwordOptions.classes[id] } }),
    [passwordOptions, updatePasswordOptions],
  );

  const applyPasswordPreset = useCallback(
    (preset: PasswordPreset) => updatePasswordOptions(preset.config),
    [updatePasswordOptions],
  );

  const applyKeyPreset = useCallback(
    (preset: KeyPreset) => updateKeyOptions({ bytes: preset.bytes }),
    [updateKeyOptions],
  );

  return {
    mode,
    passwordOptions,
    keyOptions,
    result,
    setMode,
    updatePasswordOptions,
    updateKeyOptions,
    toggleCharacterClass,
    applyPasswordPreset,
    applyKeyPreset,
    regenerate,
  };
}
