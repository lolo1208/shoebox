
import { zh } from './zh';
import { en } from './en';

export const translations = { zh, en };

export type Language = 'en' | 'zh';
export type TranslationKey = keyof typeof zh;
