import React from 'react';
import { NetworkStatus } from '@/components/NetworkStatus';

interface SimpleLayoutProps {
  children: React.ReactNode;
}

export const SimpleLayout: React.FC<SimpleLayoutProps> = ({ children }) => {
  return (
    <div className="bg-gray-50">
      {/* Page Content with padding */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Network Status */}
        <NetworkStatus />

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
};
