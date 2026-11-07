import React from 'react';

/**
 * 工具 chunk 加载中的占位骨架。
 * 尺寸与常规工具面板接近，避免加载完成时页面高度跳动。
 */
const ToolLoading: React.FC = () => (
  <div className="animate-pulse space-y-4" aria-busy="true" aria-live="polite">
    <div className="h-9 w-1/3 bg-gray-100 rounded-lg" />
    <div className="h-4 w-2/3 bg-gray-100 rounded" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="h-24 bg-gray-100 rounded-xl" />
    </div>
    <div className="h-40 bg-gray-100 rounded-xl" />
    <span className="sr-only">Loading…</span>
  </div>
);

export default ToolLoading;
