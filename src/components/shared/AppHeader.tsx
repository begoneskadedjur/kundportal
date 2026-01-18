// src/components/shared/AppHeader.tsx
// Global header med notifikationer för admin/koordinator/tekniker

import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import NotificationBell from '../communication/NotificationBell';
import {
  LayoutDashboard,
  Search,
  MessageSquareText,
  Calendar,
  LogOut,
  ChevronDown,
  User,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
}

// Navigation per roll
const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Schema', path: '/koordinator/schema', icon: Calendar },
    { label: 'Sök ärenden', path: '/koordinator/sok-arenden', icon: Search },
    { label: 'Tickets', path: '/admin/tickets', icon: MessageSquareText },
    { label: 'Lärosäte', path: '/larosate', icon: GraduationCap },
  ],
  koordinator: [
    { label: 'Dashboard', path: '/koordinator/dashboard', icon: LayoutDashboard },
    { label: 'Schema', path: '/koordinator/schema', icon: Calendar },
    { label: 'Sök ärenden', path: '/koordinator/sok-arenden', icon: Search },
    { label: 'Tickets', path: '/koordinator/tickets', icon: MessageSquareText },
    { label: 'Lärosäte', path: '/larosate', icon: GraduationCap },
  ],
  technician: [
    { label: 'Dashboard', path: '/technician/dashboard', icon: LayoutDashboard },
    { label: 'Schema', path: '/technician/schedule', icon: Calendar },
    { label: 'Mina ärenden', path: '/technician/cases', icon: Search },
    { label: 'Tickets', path: '/technician/tickets', icon: MessageSquareText },
    { label: 'Lärosäte', path: '/larosate', icon: GraduationCap },
  ],
};

export function AppHeader() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const userRole = profile?.role as string | undefined;
  const isInternalUser = userRole && ['admin', 'koordinator', 'technician'].includes(userRole);

  // Stäng user menu vid klick utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Visa inte header för icke-interna användare
  if (!isInternalUser) return null;

  const navItems = NAV_ITEMS[userRole] || [];

  const getDashboardPath = () => {
    switch (userRole) {
      case 'admin': return '/admin/dashboard';
      case 'koordinator': return '/koordinator/dashboard';
      case 'technician': return '/technician/dashboard';
      default: return '/';
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getUserDisplayName = () => {
    if (profile?.display_name) return profile.display_name;
    if (profile?.technicians?.name) return profile.technicians.name;
    return profile?.email?.split('@')[0] || 'Användare';
  };

  const getRoleName = () => {
    switch (userRole) {
      case 'admin': return 'Administratör';
      case 'koordinator': return 'Koordinator';
      case 'technician': return 'Tekniker';
      default: return '';
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Vänster: Logo + Navigation */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link
              to={getDashboardPath()}
              className="flex-shrink-0 flex items-center gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 12l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-white tracking-tight">BeGone</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path ||
                  (item.path !== getDashboardPath() && location.pathname.startsWith(item.path));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${isActive
                        ? 'bg-slate-700/70 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Höger: Notifikationer + Användarmeny */}
          <div className="flex items-center gap-2">
            {/* Notifikationsklocka */}
            <NotificationBell />

            {/* Användarmeny (Desktop) */}
            <div className="hidden md:block relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors
                  ${userMenuOpen
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {getUserDisplayName().charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-sm font-medium text-white leading-tight">
                    {getUserDisplayName()}
                  </div>
                  <div className="text-xs text-slate-400 leading-tight">
                    {getRoleName()}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-sm font-medium text-white truncate">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {profile?.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-sm text-red-400 hover:bg-slate-700/50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logga ut
                  </button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-700/50 bg-slate-900/95 backdrop-blur-sm">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-slate-700/70 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}

            {/* Divider */}
            <div className="border-t border-slate-700 my-2" />

            {/* User info och logout */}
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-white">
                {getUserDisplayName()}
              </p>
              <p className="text-xs text-slate-400">
                {getRoleName()}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-slate-800/50 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logga ut
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
