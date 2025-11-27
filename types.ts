
import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum CategoryId {
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO_VIDEO = 'audio_video',
  DEVELOPER = 'developer',
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  component: React.ReactNode;
  // Optional CSS class for the tool container (e.g., 'max-w-3xl mx-auto')
  // If undefined, defaults to 'w-full'
  layoutClass?: string;
}

export interface Category {
  id: CategoryId;
  name: string;
  icon: LucideIcon;
  description: string;
  tools: Tool[];
}
