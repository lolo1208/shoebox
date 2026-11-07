import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import {
  generateKeyBatch,
  generatePasswordBatch,
  type CharacterClassId,
  type GenerationResult,
  type KeyOptions,
  type PasswordOptions,
  type SecretMode,
} from '@/lib/secret';
import {
  DEFAULT_KEY_OPTIONS,
  DEFAULT_PASSWORD_OPTIONS,
  type KeyPreset,
  type PasswordPreset,
} from '../constants';

/**
 * localStorage 中的结构可能来自旧版本，读取时按缺省值补齐，
 * 嵌套的 classes 也要单独合并，避免新增类别后读到 undefined。
 */
function withPasswordDefaults(stored: Partial<PasswordOptions>): PasswordOptions {
  return {
    ...DEFAULT_PASSWORD_OPTIONS,
    ...stored,
    classes: { ...DEFAULT_PASSWORD_OPTIONS.classes, ...stored.classes },
  };
}

const withKeyDefaults = (stored: Partial<KeyOptions>): KeyOptions => ({ ...DEFAULT_KEY_OPTIONS, ...stored });

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

  // 依赖 regenerate 即可：选项或模式变化都会重建它，从而自动刷新结果
  useEffect(() => {
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
    (preset: PasswordPreset) => updatePasswordOptions(preset.patch),
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
