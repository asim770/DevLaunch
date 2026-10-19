import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Rocket, LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export interface NavbarProps {
  isMobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  brandTitle?: string;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  isMobileMenuOpen,
  onToggleMobileMenu,
  brandTitle = 'DevLaunch',
  className = '',
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getInitials = (name?: string, email?: string): string => {
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'DL';
  };

  return (
    <header className={`sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm ${className}`}>
      <nav
        aria-label="Top navigation"
        className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        {/* Left: Mobile Toggle & Brand Logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="sidebar-navigation"
            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>

          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-lg py-1 px-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <Rocket className="h-5 w-5" aria-hidden="true" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              {brandTitle}
            </span>
          </Link>
        </div>

        {/* Right: User / Avatar identity and Logout */}
        <div className="flex items-center gap-3">
          <div
            tabIndex={0}
            role="region"
            aria-label="User profile summary"
            className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || 'User avatar'}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                {getInitials(user?.name, user?.email)}
              </div>
            )}
            <div className="hidden flex-col text-left sm:flex">
              <span className="text-xs font-medium text-slate-900 leading-none">
                {user?.name || 'DevLaunch User'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                {user?.email || 'Authenticated'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign out of your account"
            aria-label="Sign out"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <LogOut className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </nav>
    </header>
  );
};
