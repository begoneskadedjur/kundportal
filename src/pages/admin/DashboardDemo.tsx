// src/pages/admin/DashboardDemo.tsx
// Hardkodad demo av ny CRM-layout med sidebar-navigering

import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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
  ArrowUpRight,
  Calendar,
  Clock,
  Plus
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

const mobileBottomItems: NavItem[] = [
  { label: 'Oversikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/economics' },
]

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
    // Collapsed: show only group icon, highlight if any child is active
    return (
      <div className="relative group/nav">
        <button
          className={`
            w-full flex items-center justify-center px-3 py-2.5 rounded-xl transition-all duration-200
            ${isAnyActive
              ? 'bg-teal-500/15 text-teal-400'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }
          `}
          title={group.label}
        >
          <GroupIcon className="w-5 h-5 flex-shrink-0" />
        </button>
        {/* Tooltip with items */}
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
          ${isAnyActive
            ? 'text-teal-400'
            : 'text-slate-500 hover:text-slate-300'
          }
        `}
      >
        <div className="flex items-center gap-2.5">
          <GroupIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-0.5 mt-1">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm
                  ${isActive
                    ? 'bg-teal-500/15 text-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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

  const currentPath = location.pathname
  const userName = profile?.display_name || profile?.email?.split('@')[0] || 'Admin'

  // Greeting based on time of day
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/20">
              <span className="text-white font-bold text-sm">BG</span>
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-white font-semibold text-sm">BeGone</p>
                <p className="text-slate-400 text-xs">Admin CRM</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {/* Top-level items */}
          {topLevelItems.map(item => {
            const Icon = item.icon
            const isActive = currentPath === item.path || (item.path === '/admin/dashboard' && currentPath === '/admin/dashboard-demo')
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                  ${isActive
                    ? 'bg-teal-500/15 text-teal-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                  ${sidebarCollapsed ? 'justify-center' : ''}
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

          {/* Separator */}
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
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-700/50 space-y-1">
          {/* Search trigger */}
          {!sidebarCollapsed ? (
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors">
              <Search className="w-4 h-4" />
              <span className="text-sm">Sok...</span>
              <kbd className="ml-auto text-[10px] bg-slate-700/50 text-slate-400 px-1.5 py-0.5 rounded">⌘K</kbd>
            </button>
          ) : (
            <button
              className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
              title="Sok (Cmd+K)"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"
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

          {/* User info */}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="overflow-hidden">
                <p className="text-white text-sm font-medium truncate">{userName}</p>
                <p className="text-slate-500 text-xs">Admin</p>
              </div>
            </div>
          )}

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className={`
              w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
              text-slate-400 hover:text-red-400 hover:bg-red-500/10
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
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
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
          {/* Top-level */}
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

          {/* Groups in mobile */}
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
              className={`
                flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg transition-all
                ${isActive ? 'text-teal-400' : 'text-slate-500'}
              `}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-lg text-slate-500"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium">Mer</span>
        </button>
      </nav>

      {/* ===== SLIM TOP HEADER (desktop only) ===== */}
      <header
        className={`
          hidden lg:flex fixed top-0 right-0 h-12 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700/30
          z-30 items-center justify-between px-6 transition-all duration-300
          ${sidebarCollapsed ? 'left-20' : 'left-64'}
        `}
      >
        {/* Search */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-colors">
          <Search className="w-4 h-4" />
          <span className="text-sm">Sok...</span>
          <kbd className="text-[10px] bg-slate-700/50 text-slate-500 px-1.5 py-0.5 rounded ml-8">⌘K</kbd>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-400 rounded-full" />
          </button>
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg flex items-center justify-center cursor-pointer">
            <span className="text-white text-xs font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main
        className={`
          min-h-screen
          pt-14 pb-20 lg:pb-0
          transition-all duration-300
          ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}
          lg:pt-12
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">
              {greeting}, <span className="bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent">{userName}</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 capitalize">{today}</p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <KpiCard title="Avtalskunder" value="47" icon={Users} trend="+5%" color="teal" />
            <KpiCard title="Total intakt" value="1 245 000 kr" icon={DollarSign} trend="+12%" color="emerald" />
            <KpiCard title="Aktiva arenden" value="128" icon={FileText} trend="+3" color="cyan" />
            <KpiCard title="Aktiva tekniker" value="8" icon={UserCheck} trend="+2" color="blue" />
          </div>

          {/* Quick Actions */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Snabbatgarder</h2>
            <div className="flex flex-wrap gap-3">
              <QuickActionButton icon={Plus} label="Skapa avtal" href="/admin/oneflow-contract-creator" color="teal" />
              <QuickActionButton icon={Receipt} label="Ny faktura" href="/admin/invoicing" color="emerald" />
              <QuickActionButton icon={Users} label="Sok kund" href="/admin/customers" color="cyan" />
              <QuickActionButton icon={Target} label="Ny lead" href="/admin/leads" color="purple" />
            </div>
          </div>

          {/* Activity & Events */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-400" />
                Senaste aktivitet
              </h3>
              <div className="space-y-4">
                <ActivityItem
                  title="Nytt avtal signerat"
                  description="Skanskas avtal for skadedjurskontroll signerat via Oneflow"
                  time="12 min sedan"
                  color="emerald"
                />
                <ActivityItem
                  title="Faktura skickad"
                  description="Faktura #2024-0147 skickad till Vasakronan AB"
                  time="45 min sedan"
                  color="teal"
                />
                <ActivityItem
                  title="Nytt arende"
                  description="Privat arende tilldelat tekniker Erik Lundberg"
                  time="1 timme sedan"
                  color="cyan"
                />
                <ActivityItem
                  title="Lead tillagd"
                  description="Ny lead fran webbformuladet: Fastighets AB Centrum"
                  time="2 timmar sedan"
                  color="purple"
                />
                <ActivityItem
                  title="Inspektion slutford"
                  description="Kvartalsinspektion hos ICA Maxi Barkarby av Johan Karlsson"
                  time="3 timmar sedan"
                  color="blue"
                />
              </div>
            </div>

            {/* Event Log / Stats */}
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                Idag
              </h3>
              <div className="space-y-4">
                <StatItem label="Planerade besok" value="12" />
                <StatItem label="Slutforda" value="7" />
                <StatItem label="Oppna arenden" value="23" />
                <StatItem label="Forfallna fakturor" value="3" highlight />
                <StatItem label="Nya leads denna vecka" value="8" />
              </div>

              <div className="mt-6 pt-4 border-t border-slate-700/50">
                <h4 className="text-sm font-semibold text-slate-400 mb-3">Kommande</h4>
                <div className="space-y-2">
                  <UpcomingItem title="Kvartalsrapport" time="Imorgon 09:00" />
                  <UpcomingItem title="Kundmote - Akademiska Hus" time="Onsdag 14:00" />
                  <UpcomingItem title="Teammotet" time="Fredag 10:00" />
                </div>
              </div>
            </div>
          </div>

          {/* Demo notice */}
          <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <p className="text-amber-400 text-sm">
              <strong>Demo:</strong> Detta ar en forhandsvisning av den nya CRM-layouten.
              Navigeringen till vanster ar det som ska ersatta kort-gridden pa nuvarande dashboard.
              Data ar hardkodad for demonstration.
            </p>
          </div>
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
        <div className="ml-2 pl-3 border-l border-slate-700/50 space-y-0.5 mt-1 mb-2">
          {group.items.map(item => {
            const Icon = item.icon
            const isActive = currentPath.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`
                  flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200 text-sm
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

function KpiCard({ title, value, icon: Icon, trend, color }: {
  title: string; value: string; icon: React.ElementType; trend: string; color: string
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-teal-500/20 to-teal-600/5 border-teal-500/20 text-teal-400',
    emerald: 'from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400',
    cyan: 'from-cyan-500/20 to-cyan-600/5 border-cyan-500/20 text-cyan-400',
    blue: 'from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400',
  }
  const trendColor = trend.startsWith('+') ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className={`bg-gradient-to-br ${colorMap[color]} border rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className={`w-5 h-5 ${colorMap[color].split(' ').pop()}`} />
        <span className={`text-xs font-medium ${trendColor}`}>{trend}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{title}</p>
    </div>
  )
}

function QuickActionButton({ icon: Icon, label, href, color }: {
  icon: React.ElementType; label: string; href: string; color: string
}) {
  const colorMap: Record<string, string> = {
    teal: 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20',
    cyan: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20',
    purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20',
  }
  return (
    <Link
      to={href}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${colorMap[color]}`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
      <ArrowUpRight className="w-3.5 h-3.5 opacity-50" />
    </Link>
  )
}

function ActivityItem({ title, description, time, color }: {
  title: string; description: string; time: string; color: string
}) {
  const dotColorMap: Record<string, string> = {
    emerald: 'bg-emerald-400',
    teal: 'bg-teal-400',
    cyan: 'bg-cyan-400',
    purple: 'bg-purple-400',
    blue: 'bg-blue-400',
  }
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center mt-1.5">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColorMap[color]}`} />
        <div className="w-px flex-1 bg-slate-700/50 mt-1" />
      </div>
      <div className="flex-1 pb-1">
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        <p className="text-xs text-slate-500 mt-1">{time}</p>
      </div>
    </div>
  )
}

function StatItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-amber-400' : 'text-white'}`}>{value}</span>
    </div>
  )
}

function UpcomingItem({ title, time }: { title: string; time: string }) {
  return (
    <div className="flex items-start gap-2">
      <Calendar className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-slate-300">{title}</p>
        <p className="text-xs text-slate-500">{time}</p>
      </div>
    </div>
  )
}

export default DashboardDemo
