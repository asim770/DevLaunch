import React, { useState } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface MainLayoutProps {
  children?: React.ReactNode;
  brandTitle?: string;
  className?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  brandTitle = 'DevLaunch',
  className = '',
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleToggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleCloseMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className={`min-h-screen bg-slate-50 flex flex-col text-slate-900 ${className}`}>
      {/* Top Navbar */}
      <Navbar
        brandTitle={brandTitle}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={handleToggleMobileMenu}
      />

      {/* Main body area: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={handleCloseMobileMenu}
        />

        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
