import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum CategoryId {
  TEXT = 'text',
  IMAGE_VIDEO = 'image_video',
  FILE_CONVERT = 'file_convert',
  DEVELOPER = 'developer',
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  component: React.ReactNode;
}

export interface Category {
  id: CategoryId;
  name: string;
  icon: LucideIcon;
  tools: Tool[];
}

// Declaration for CryptoJS loaded via CDN
declare global {
  interface Window {
    CryptoJS: any;
  }
}