import React from 'react';

interface ToolContainerProps {
  children: React.ReactNode;
}

const ToolContainer: React.FC<ToolContainerProps> = ({ children }) => {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
};

export default ToolContainer;