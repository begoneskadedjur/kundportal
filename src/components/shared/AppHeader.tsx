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
  Shield,
  Wrench,
  Check,
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
    { label: 'Lär dig systemet', path: '/admin/larosate', icon: GraduationCap },
  ],
  koordinator: [
    { label: 'Dashboard', path: '/koordinator/dashboard', icon: LayoutDashboard },
    { label: 'Schema', path: '/koordinator/schema', icon: Calendar },
    { label: 'Sök ärenden', path: '/koordinator/sok-arenden', icon: Search },
    { label: 'Tickets', path: '/koordinator/tickets', icon: MessageSquareText },
    { label: 'Lär dig systemet', path: '/admin/larosate', icon: GraduationCap },
  ],
  technician: [
    { label: 'Dashboard', path: '/technician/dashboard', icon: LayoutDashboard },
    { label: 'Schema', path: '/technician/schedule', icon: Calendar },
    { label: 'Mina ärenden', path: '/technician/cases', icon: Search },
    { label: 'Tickets', path: '/technician/tickets', icon: MessageSquareText },
    { label: 'Lär dig systemet', path: '/admin/larosate', icon: GraduationCap },
  ],
};

export function AppHeader() {
  const { profile, signOut, hasDualRole, activeView, setActiveView } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const userRole = profile?.role as string | undefined;
  const effectiveRole = hasDualRole ? activeView : userRole;
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

  const navItems = NAV_ITEMS[effectiveRole || ''] || [];

  const getDashboardPath = () => {
    switch (effectiveRole) {
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
    switch (effectiveRole) {
      case 'admin': return 'Administratör';
      case 'koordinator': return 'Koordinator';
      case 'technician': return 'Tekniker';
      default: return '';
    }
  };

  const handleSwitchView = (view: 'admin' | 'technician') => {
    setActiveView(view);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
    navigate(view === 'admin' ? '/admin/dashboard' : '/technician/dashboard');
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
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <p className="text-sm font-medium text-white truncate">
                      {getUserDisplayName()}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {profile?.email}
                    </p>
                  </div>
                  {hasDualRole && (
                    <div className="px-2 py-2 border-b border-slate-700">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider px-2 mb-1">Byt vy</p>
                      <button
                        onClick={() => handleSwitchView('admin')}
                        className={`w-full px-3 py-1.5 rounded-md text-sm text-left flex items-center gap-2 ${
                          activeView === 'admin'
                            ? 'bg-[#20c58f]/10 text-[#20c58f]'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        Administratör
                        {activeView === 'admin' && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                      <button
                        onClick={() => handleSwitchView('technician')}
                        className={`w-full px-3 py-1.5 rounded-md text-sm text-left flex items-center gap-2 ${
                          activeView === 'technician'
                            ? 'bg-[#20c58f]/10 text-[#20c58f]'
                            : 'text-slate-300 hover:bg-slate-700/50'
                        }`}
                      >
                        <Wrench className="w-4 h-4" />
                        Tekniker
                        {activeView === 'technician' && <Check className="w-3 h-3 ml-auto" />}
                      </button>
                    </div>
                  )}
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

            {/* Vy-växlare (mobil) */}
            {hasDualRole && (
              <>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider px-3 mb-1">Byt vy</p>
                <button
                  onClick={() => handleSwitchView('admin')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'admin'
                      ? 'bg-[#20c58f]/10 text-[#20c58f]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  Administratör
                  {activeView === 'admin' && <Check className="w-4 h-4 ml-auto" />}
                </button>
                <button
                  onClick={() => handleSwitchView('technician')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'technician'
                      ? 'bg-[#20c58f]/10 text-[#20c58f]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <Wrench className="w-5 h-5" />
                  Tekniker
                  {activeView === 'technician' && <Check className="w-4 h-4 ml-auto" />}
                </button>
                <div className="border-t border-slate-700 my-2" />
              </>
            )}

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
