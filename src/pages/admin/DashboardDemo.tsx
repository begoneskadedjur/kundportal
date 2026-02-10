// src/pages/admin/DashboardDemo.tsx
// Premium CRM-layout demo med sidebar-navigering — v2 med alla UX-forbattringar

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import {
  Home,
  Users,
  Target,
  Receipt,
  TrendingUp,
  BarChart3,
  DollarSign,
  Wallet,
  UserCheck,
  Building2,
  Settings,
  Activity,
  UserPlus,
  Sparkles,
  Image as ImageIcon,
  MessageSquareText,
  FileText,
  GraduationCap,
  Beaker,
  Package,
  Wrench,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  ArrowRight,
  Calendar,
  Clock,
  Plus,
  Star,
  HelpCircle,
  FileCheck,
  ClipboardCheck
} from 'lucide-react'

// ============================================================
// NAV CONFIG
// ============================================================

interface NavItem {
  label: string
  icon: React.ElementType
  path: string
}

interface NavGroup {
  label: string
  icon: React.ElementType
  items: NavItem[]
}

const topLevelItems: NavItem[] = [
  { label: 'Oversikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
]

const navGroups: NavGroup[] = [
  {
    label: 'Forsaljning',
    icon: TrendingUp,
    items: [
      { label: 'Avtalsoversikt', icon: Receipt, path: '/admin/contracts-overview' },
      { label: 'Forsaljningsmojligheter', icon: TrendingUp, path: '/admin/sales-opportunities' },
      { label: 'Kundanalys', icon: BarChart3, path: '/admin/customers/analytics' },
      { label: 'Leadanalys', icon: BarChart3, path: '/admin/leads/analytics' },
    ]
  },
  {
    label: 'Ekonomi & Fakturering',
    icon: DollarSign,
    items: [
      { label: 'Ekonomisk oversikt', icon: DollarSign, path: '/admin/economics' },
      { label: 'Fakturering', icon: Receipt, path: '/admin/invoicing' },
      { label: 'Provisioner', icon: Wallet, path: '/admin/commissions' },
    ]
  },
  {
    label: 'Personal',
    icon: UserCheck,
    items: [
      { label: 'Teknikerstatistik', icon: BarChart3, path: '/admin/technicians' },
      { label: 'Personalkonton', icon: UserCheck, path: '/admin/technician-management' },
    ]
  },
  {
    label: 'Organisation',
    icon: Building2,
    items: [
      { label: 'Kundkonton', icon: Building2, path: '/admin/organisation/organizations' },
      { label: 'Hantera organisationer', icon: Settings, path: '/admin/organisation/organizations-manage' },
      { label: 'Trafikljusoversikt', icon: Activity, path: '/admin/organisation/traffic-light' },
      { label: 'Multisite-fakturering', icon: Receipt, path: '/admin/organisation/billing' },
      { label: 'Registrera multisite', icon: UserPlus, path: '/admin/organisation/register' },
    ]
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'Team AI Chat', icon: Sparkles, path: '/admin/team-chat' },
      { label: 'Bildbank', icon: ImageIcon, path: '/admin/image-bank' },
      { label: 'Tickets', icon: MessageSquareText, path: '/admin/tickets' },
      { label: 'Skapa avtal', icon: FileText, path: '/admin/oneflow-contract-creator' },
      { label: 'Larocenter', icon: GraduationCap, path: '/larosate' },
    ]
  },
  {
    label: 'Installningar',
    icon: Settings,
    items: [
      { label: 'Stationstyper', icon: Target, path: '/admin/settings/station-types' },
      { label: 'Preparat', icon: Beaker, path: '/admin/settings/preparations' },
      { label: 'Artiklar', icon: Package, path: '/admin/settings/articles' },
      { label: 'Prislistor', icon: FileText, path: '/admin/settings/price-lists' },
      { label: 'Webhook-config', icon: Wrench, path: '/admin/webhook-config' },
      { label: 'Avtalsdiagnostik', icon: AlertCircle, path: '/admin/oneflow-diagnostics' },
    ]
  },
]

const favoriteItems: NavItem[] = [
  { label: 'Ekonomisk oversikt', icon: DollarSign, path: '/admin/economics' },
  { label: 'Fakturering', icon: Receipt, path: '/admin/invoicing' },
  { label: 'Team AI Chat', icon: Sparkles, path: '/admin/team-chat' },
]

const mobileBottomItems: NavItem[] = [
  { label: 'Oversikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/economics' },
]

// ============================================================
// MINI SPARKLINE
// ============================================================

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 80
  const h = 28
  const padding = 2
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2)
    const y = h - padding - ((v - min) / range) * (h - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const colorMap: Record<string, string> = {
    teal: '#2dd4bf',
    emerald: '#34d399',
    cyan: '#22d3ee',
    blue: '#60a5fa',
  }

  return (
    <svg width={w} height={h} className="mt-2 opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={colorMap[color] || '#2dd4bf'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ============================================================
// SIDEBAR NAV GROUP (expandable)
// ============================================================

function SidebarNavGroup({
  group,
  collapsed,
  currentPath,
}: {
  group: NavGroup
  collapsed: boolean
  currentPath: string
}) {
  const isAnyActive = group.items.some(item => currentPath.startsWith(item.path))
  const [expanded, setExpanded] = useState(isAnyActive)
  const GroupIcon = group.icon

  if (collapsed) {
    return (
      <div className="relative group/nav">
        <button
          className={`
            w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200
            ${isAnyActive
              ? 'bg-teal-500/10 text-teal-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
            }
          `}
          title={group.label}
          aria-label={group.label}
        >
          <GroupIcon className="w-5 h-5 flex-shrink-0" />
        </button>
        <div className="absolute left-full top-0 ml-2 hidden group-hover/nav:block z-50">
          <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl p-2 min-w-[200px]">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3 py-1.5 mb-1">
              {group.label}
            </p>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = currentPath.startsWith(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-sm
                    focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 outline-none
                    ${isActive
                      ? 'bg-teal-500/15 text-teal-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200
          ${isAnyActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-1 mt-1">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                  focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none
                  ${isActive
                    ? 'border-l-[3px] border-teal-400 text-white font-medium bg-teal-500/5 -ml-[3px]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                  }
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN DEMO COMPONENT
// ============================================================

const DashboardDemo: React.FC = () => {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [timePeriod, setTimePeriod] = useState<'day' | 'week' | 'month'>('week')

  const currentPath = location.pathname
  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Admin'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'God morgon' : hour < 18 ? 'God eftermiddag' : 'God kvall'
  const today = new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">

      {/* Ambient glow */}
      <div className="fixed top-0 left-64 w-[600px] h-[600px] bg-teal-500/[0.03] rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* ===== DESKTOP SIDEBAR ===== */}
      <aside
        className={`
          fixed left-0 top-0 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50
          hidden lg:flex flex-col z-40 transition-all duration-300
          ${sidebarCollapsed ? 'w-20' : 'w-64'}
        `}
      >
        {/* Logo */}
        <div className="p-4 border-b border-slate-700/50">
          <Link to="/admin/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20 group-hover:scale-105 group-hover:shadow-teal-500/30 transition-all duration-300">
              <span className="text-white font-bold text-sm">BG</span>
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-white font-semibold text-sm">BeGone</p>
                <p className="text-slate-400 text-xs">Admin CRM</p>
              </div>
            )}
          </Link>
        </div>

        {/* User Profile — at TOP (1.1) */}
        <div className={`px-3 py-3 border-b border-slate-700/50 ${sidebarCollapsed ? 'flex justify-center' : ''}`}>
          {sidebarCollapsed ? (
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center" title={userName}>
              <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="overflow-hidden">
                <p className="text-white text-sm font-semibold truncate">{userName}</p>
                <p className="text-slate-500 text-xs">Administrator</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA Button (1.2) */}
        <div className="px-3 pt-3">
          {sidebarCollapsed ? (
            <Link
              to="/admin/oneflow-contract-creator"
              className="w-full flex items-center justify-center p-2.5 bg-teal-500 hover:bg-teal-400 rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
              title="Skapa avtal"
            >
              <Plus className="w-5 h-5 text-white" />
            </Link>
          ) : (
            <Link
              to="/admin/oneflow-contract-creator"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-colors duration-200 shadow-lg shadow-teal-500/25"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Skapa avtal</span>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {/* Top-level items with border-left active style (1.3) */}
          {topLevelItems.map(item => {
            const Icon = item.icon
            const isActive = currentPath === item.path || (item.path === '/admin/dashboard' && currentPath === '/admin/dashboard-demo')
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 outline-none
                  ${isActive
                    ? 'border-l-[3px] border-teal-400 text-white font-medium bg-teal-500/5'
                    : 'border-l-[3px] border-transparent text-slate-400 hover:text-white hover:bg-slate-800/30'
                  }
                  ${sidebarCollapsed ? 'justify-center border-l-0' : ''}
                `}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{item.label}</span>
                )}
              </Link>
            )
          })}

          <div className="h-px bg-slate-700/50 my-3" />

          {/* Nav groups */}
          {navGroups.map(group => (
            <SidebarNavGroup
              key={group.label}
              group={group}
              collapsed={sidebarCollapsed}
              currentPath={currentPath}
            />
          ))}

          {/* Separator before favorites */}
          <div className="h-px bg-slate-700/50 my-3" />

          {/* Favorites section (1.4) */}
          {!sidebarCollapsed && (
            <div>
              <p className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Star className="w-3.5 h-3.5" />
                Favoriter
              </p>
              <div className="space-y-0.5 mt-1">
                {favoriteItems.map(item => {
                  const Icon = item.icon
                  const isActive = currentPath.startsWith(item.path)
                  return (
                    <Link
                      key={`fav-${item.path}`}
                      to={item.path}
                      className={`
                        flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm
                        focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
                        ${isActive
                          ? 'text-teal-400 bg-teal-500/5'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <button
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-slate-500 hover:text-amber-400 transition-colors"
              title="Favoriter"
            >
              <Star className="w-5 h-5" />
            </button>
          )}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-700/50 space-y-1">
          {/* Search trigger */}
          {!sidebarCollapsed ? (
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors" aria-label="Sok">
              <Search className="w-4 h-4" />
              <span className="text-sm">Sok...</span>
              <kbd className="ml-auto text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              title="Sok (Cmd+K)"
              aria-label="Sok"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Help center (1.6) */}
          <Link
            to="/larosate"
            className={`
              w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors
              focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? 'Hjalpcenter' : undefined}
          >
            <HelpCircle className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">Hjalpcenter</span>}
          </Link>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 outline-none"
            aria-label="Minimera sidopanelen"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5" />
                <span className="text-sm">Minimera</span>
              </>
            )}
          </button>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              text-slate-400 hover:text-red-400 hover:bg-red-500/10
              focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
              ${sidebarCollapsed ? 'justify-center' : ''}
            `}
            title={sidebarCollapsed ? 'Logga ut' : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-medium">Logga ut</span>
            )}
          </button>
        </div>
      </aside>

      {/* ===== MOBILE HEADER ===== */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-teal-500/20">
            <span className="text-white font-bold text-xs">BG</span>
          </div>
          <p className="text-white font-semibold text-sm">BeGone</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 relative" aria-label="Notifieringar">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">3</span>
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Meny"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile slide-out menu */}
      <div
        className={`
          lg:hidden fixed top-14 right-0 w-72 h-[calc(100%-3.5rem-4rem)] bg-slate-900/95 backdrop-blur-xl
          border-l border-slate-700/50 z-30 transition-transform duration-300 overflow-y-auto
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <nav className="p-3 space-y-1">
          {topLevelItems.map(item => {
            const Icon = item.icon
            const isActive = currentPath === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                  ${isActive ? 'bg-teal-500/15 text-teal-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            )
          })}
          <div className="h-px bg-slate-700/50 my-3" />
          {navGroups.map(group => (
            <MobileNavGroup key={group.label} group={group} currentPath={currentPath} onNavigate={() => setMobileMenuOpen(false)} />
          ))}
          <div className="h-px bg-slate-700/50 my-3" />
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">Logga ut</span>
          </button>
        </nav>
      </div>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 z-40 px-2 flex items-center justify-around safe-area-bottom">
        {mobileBottomItems.map(item => {
          const Icon = item.icon
          const isActive = currentPath === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all ${isActive ? 'text-teal-400' : 'text-slate-500'}`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-500">
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mer</span>
        </button>
      </nav>

      {/* ===== DESKTOP TOP HEADER with breadcrumbs (2.1-2.3) ===== */}
      <header
        className={`
          hidden lg:flex fixed top-0 right-0 h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/30
          z-30 items-center justify-between px-6 transition-all duration-300
          ${sidebarCollapsed ? 'left-20' : 'left-64'}
        `}
      >
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-slate-400">BeGone</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-white font-medium">Oversikt</span>
        </div>

        {/* Centered search (2.2) */}
        <button
          className="flex-1 max-w-md mx-auto flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/60 ring-1 ring-slate-700/50 hover:ring-slate-600 text-slate-400 transition-all duration-200"
          aria-label="Sok"
        >
          <Search className="w-4 h-4" />
          <span className="text-sm">Sok i systemet...</span>
          <kbd className="ml-auto text-[10px] bg-slate-700/50 text-slate-500 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Right side icons (2.3) */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors" aria-label="Synka data" title="Synka data">
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors relative" aria-label="Notifieringar">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">3</span>
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
            <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main
        className={`
          min-h-screen pt-14 pb-20 lg:pb-0
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
          lg:pt-12
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Welcome (3.1, 3.2) */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              {greeting}, <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">{userName}</span>
            </h1>
            <p className="text-base text-slate-400 mt-1 capitalize">{today}</p>
            <p className="text-sm text-slate-500 mt-1">3 notifieringar och 12 planerade besok idag</p>
          </motion.div>

          {/* Time period selector + KPI Cards (3.4, 4.1-4.3) */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Nyckeltal</h2>
              <div className="inline-flex bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
                {(['day', 'week', 'month'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`text-xs px-3 py-1 rounded-md transition-all duration-200 ${
                      timePeriod === period
                        ? 'bg-slate-700 text-white font-medium'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {period === 'day' ? 'Idag' : period === 'week' ? 'Vecka' : 'Manad'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Avtalskunder', value: '47', icon: Users, trend: '+5%', color: 'teal' as const, href: '/admin/customers', sparkData: [30, 35, 32, 38, 42, 40, 47] },
                { title: 'Total intakt', value: '1 245 000 kr', icon: DollarSign, trend: '+12%', color: 'emerald' as const, href: '/admin/economics', sparkData: [800, 920, 880, 1050, 1100, 1180, 1245] },
                { title: 'Aktiva arenden', value: '128', icon: FileText, trend: '+3', color: 'cyan' as const, href: '/admin/customers', sparkData: [100, 108, 115, 110, 120, 125, 128] },
                { title: 'Aktiva tekniker', value: '8', icon: UserCheck, trend: '+2', color: 'blue' as const, href: '/admin/technicians', sparkData: [5, 6, 6, 7, 7, 7, 8] },
              ].map((kpi, index) => (
                <motion.div
                  key={kpi.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + index * 0.06 }}
                >
                  <KpiCard {...kpi} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quick Actions as mini-cards (5.1, 5.2) */}
          <div className="mb-12">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Snabbatgarder</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Plus, label: 'Skapa avtal', desc: 'Generera via Oneflow', href: '/admin/oneflow-contract-creator', color: 'teal' },
                { icon: Receipt, label: 'Ny faktura', desc: 'Skapa och skicka', href: '/admin/invoicing', color: 'emerald' },
                { icon: Users, label: 'Sok kund', desc: 'Sok i kundregistret', href: '/admin/customers', color: 'cyan' },
                { icon: Target, label: 'Ny lead', desc: 'Lagg till prospekt', href: '/admin/leads', color: 'purple' },
              ].map((action, index) => (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.3 + index * 0.06 }}
                >
                  <QuickActionCard {...action} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Activity & Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity (6.1-6.3) */}
            <motion.div
              className="lg:col-span-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.5 }}
            >
              <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-400" />
                Senaste aktivitet
              </h3>
              <div className="space-y-1">
                {[
                  { title: 'Nytt avtal signerat', desc: 'Skanskas avtal for skadedjurskontroll signerat via Oneflow', time: '12 min sedan', color: 'emerald', icon: FileCheck },
                  { title: 'Faktura skickad', desc: 'Faktura #2024-0147 skickad till Vasakronan AB', time: '45 min sedan', color: 'teal', icon: Receipt },
                  { title: 'Nytt arende', desc: 'Privat arende tilldelat tekniker Erik Lundberg', time: '1 timme sedan', color: 'cyan', icon: FileText },
                  { title: 'Lead tillagd', desc: 'Ny lead fran webbformuladet: Fastighets AB Centrum', time: '2 timmar sedan', color: 'purple', icon: Target },
                  { title: 'Inspektion slutford', desc: 'Kvartalsinspektion hos ICA Maxi Barkarby av Johan Karlsson', time: '3 timmar sedan', color: 'blue', icon: ClipboardCheck },
                ].map((item, index) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.6 + index * 0.06 }}
                  >
                    <ActivityItem {...item} />
                  </motion.div>
                ))}
              </div>
              <Link to="/admin/customers" className="flex items-center gap-1 mt-4 text-sm text-teal-400 hover:text-teal-300 transition-colors">
                Visa all aktivitet
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            {/* Today panel (7.1-7.3) */}
            <motion.div
              className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/40 rounded-2xl p-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.55 }}
            >
              <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                Idag
              </h3>
              <div className="space-y-4">
                <StatItem label="Planerade besok" value="12" total={12} progress={0} color="slate" />
                <StatItem label="Slutforda" value="7" total={12} progress={58} color="emerald" valueColor="text-emerald-400" />
                <StatItem label="Oppna arenden" value="23" color="blue" valueColor="text-blue-400" />
                <StatItem label="Forfallna fakturor" value="3" color="amber" valueColor="text-amber-400" />
                <StatItem label="Nya leads denna vecka" value="8" color="teal" valueColor="text-teal-400" />
              </div>

              {/* Team avatars (8.3) */}
              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Teamet idag</h4>
                <div className="flex items-center">
                  {[
                    { initials: 'EL', gradient: 'from-blue-500 to-cyan-500' },
                    { initials: 'JK', gradient: 'from-purple-500 to-pink-500' },
                    { initials: 'AS', gradient: 'from-teal-500 to-emerald-500' },
                    { initials: 'ML', gradient: 'from-amber-500 to-orange-500' },
                    { initials: 'NK', gradient: 'from-rose-500 to-red-500' },
                  ].map((member, i) => (
                    <div
                      key={member.initials}
                      className={`w-8 h-8 rounded-full border-2 border-slate-800 bg-gradient-to-br ${member.gradient} flex items-center justify-center ${i > 0 ? '-ml-2' : ''}`}
                      title={member.initials}
                    >
                      <span className="text-[10px] text-white font-bold">{member.initials}</span>
                    </div>
                  ))}
                  <span className="ml-2 text-xs text-slate-500">+3 mer</span>
                </div>
              </div>

              {/* Upcoming events (7.3) */}
              <div className="mt-5 pt-4 border-t border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Kommande</h4>
                <div className="space-y-2.5">
                  <UpcomingItem icon={FileText} title="Kvartalsrapport" time="Imorgon 09:00" />
                  <UpcomingItem icon={Building2} title="Kundmote - Akademiska Hus" time="Onsdag 14:00" />
                  <UpcomingItem icon={Users} title="Teammotet" time="Fredag 10:00" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Demo notice */}
          <motion.div
            className="mt-10 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <p className="text-amber-400 text-sm">
              <strong>Demo:</strong> Detta ar en forhandsvisning av den nya CRM-layouten.
              Navigeringen till vanster ar det som ska ersatta kort-gridden pa nuvarande dashboard.
              Data ar hardkodad for demonstration.
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}

// ============================================================
// HELPER COMPONENTS
// ============================================================

function MobileNavGroup({ group, currentPath, onNavigate }: { group: NavGroup; currentPath: string; onNavigate: () => void }) {
  const isAnyActive = group.items.some(item => currentPath.startsWith(item.path))
  const [expanded, setExpanded] = useState(isAnyActive)
  const GroupIcon = group.icon

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className={`
          w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200
          ${isAnyActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}
        `}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-1 mt-1 mb-2">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                  ${isActive ? 'bg-teal-500/15 text-teal-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}
                `}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function KpiCard({ title, value, icon: Icon, trend, color, href, sparkData }: {
  title: string; value: string; icon: React.ElementType; trend: string; color: string; href: string; sparkData: number[]
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/30',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/30',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/30',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/30',
  }
  const iconColorMap: Record<string, string> = {
    teal: 'text-teal-400',
    emerald: 'text-emerald-400',
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
  }
  const trendColor = trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'

  return (
    <Link
      to={href}
      className={`block bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5 shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 cursor-pointer group`}
    >
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <MiniSparkline data={sparkData} color={color} />
      <p className="text-sm text-slate-400 mt-2">{title}</p>
    </Link>
  )
}

function QuickActionCard({ icon: Icon, label, desc, href, color }: {
  icon: React.ElementType; label: string; desc: string; href: string; color: string
}) {
  const iconBgMap: Record<string, string> = {
    teal: 'bg-teal-500/15 text-teal-400',
    emerald: 'bg-emerald-500/15 text-emerald-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    purple: 'bg-purple-500/15 text-purple-400',
  }
  return (
    <Link
      to={href}
      className="group flex flex-col bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 hover:border-teal-500/30 hover:bg-slate-800/60 transition-all duration-200"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg ${iconBgMap[color]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-sm font-medium text-white">{label}</p>
      <p className="text-xs text-slate-500 mt-1">{desc}</p>
    </Link>
  )
}

function ActivityItem({ title, desc, time, color, icon: Icon }: {
  title: string; desc: string; time: string; color: string; icon: React.ElementType
}) {
  const bgColorMap: Record<string, string> = {
    emerald: 'bg-emerald-500/15 text-emerald-400',
    teal: 'bg-teal-500/15 text-teal-400',
    cyan: 'bg-cyan-500/15 text-cyan-400',
    purple: 'bg-purple-500/15 text-purple-400',
    blue: 'bg-blue-500/15 text-blue-400',
  }
  return (
    <div className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-700/20 cursor-pointer transition-colors">
      <div className={`w-8 h-8 rounded-full ${bgColorMap[color]} flex items-center justify-center flex-shrink-0 mt-0.5`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5 truncate">{desc}</p>
        <p className="text-xs text-slate-500 mt-1">{time}</p>
      </div>
    </div>
  )
}

function StatItem({ label, value, total, progress, color, valueColor }: {
  label: string; value: string; total?: number; progress?: number; color: string; valueColor?: string
}) {
  const barColorMap: Record<string, string> = {
    emerald: 'bg-emerald-400',
    blue: 'bg-blue-400',
    amber: 'bg-amber-400',
    teal: 'bg-teal-400',
    slate: 'bg-slate-500',
  }
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={`text-sm font-semibold ${valueColor || 'text-white'}`}>
          {value}{total ? `/${total}` : ''}
        </span>
      </div>
      {progress !== undefined && (
        <div className="h-1.5 bg-slate-700/50 rounded-full mt-1.5">
          <div
            className={`h-1.5 rounded-full ${barColorMap[color]} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}

function UpcomingItem({ icon: Icon, title, time }: { icon: React.ElementType; title: string; time: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-slate-300">{title}</p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
    </div>
  )
}

export default DashboardDemo
