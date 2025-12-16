
import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum CategoryId {
  IMAGE = 'image',
  TEXT_DATA = 'text_data',
  DEVELOPER = 'developer',
  NETWORK = 'network',
  MEDIA = 'media',
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
