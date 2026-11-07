import React from 'react';
import type { CharacterClassId } from '@/lib/secret';

/** 字符类别对应的着色，用于让密码的组成一眼可辨 */
const CLASS_TONE: Record<CharacterClassId, string> = {
  uppercase: 'text-primary-600',
  lowercase: 'text-gray-800',
  digits: 'text-emerald-600',
  symbols: 'text-orange-500',
};

function classifyCharacter(char: string): CharacterClassId {
  if (char >= 'A' && char <= 'Z') return 'uppercase';
  if (char >= 'a' && char <= 'z') return 'lowercase';
  if (char >= '0' && char <= '9') return 'digits';
  return 'symbols';
}

interface SecretValueProps {
  value: string;
  /** 密码模式下逐字符着色；密钥模式下编码结果统一配色 */
  colorize?: boolean;
}

/** 生成结果的展示：等宽字体 + 按字符类别着色 */
const SecretValue: React.FC<SecretValueProps> = ({ value, colorize = false }) => {
  if (!colorize) return <>{value}</>;

  return (
    <>
      {Array.from(value).map((char, index) => (
        <span key={`${index}-${char}`} className={CLASS_TONE[classifyCharacter(char)]}>
          {char}
        </span>
      ))}
    </>
  );
};

export default SecretValue;
