import React, { useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, User, Settings, X, Rocket, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface NavItem {
  name: string;
  to: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Profile', to: '/profile', icon: User },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (isOpen) {
      onClose();
    }
    await logout();
    navigate('/login', { replace: true });
  };
  // Dismiss sidebar on Escape key when open on mobile
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Mobile backdrop overlay — only rendered when mobile sidebar is open */}
      {isOpen && (
        <div
          role="presentation"
          aria-hidden="true"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar container */}
      <aside
        id="sidebar-navigation"
        aria-label="Sidebar navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${className}`}
      >
        {/* Mobile sidebar header with close button */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-6 lg:hidden">
          <div className="flex items-center gap-2.5 font-bold text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </div>
            <span>DevLaunch</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sidebar"
            className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => {
                  // Close mobile sidebar upon navigation
                  if (isOpen) {
                    onClose();
                  }
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sign Out Button */}
        <div className="border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <LogOut className="h-5 w-5 flex-shrink-0 text-slate-400" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Bottom footer badge */}
        <div className="border-t border-slate-200 p-4">
          <div className="rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs font-semibold text-slate-800">DevLaunch Starter</p>
            <p className="text-[11px] text-slate-500">v0.1.0 • React + Vite</p>
          </div>
        </div>
      </aside>
    </>
  );
};
