// src/components/admin/layout/adminNavConfig.ts
// Navigeringskonfiguration for admin CRM-layout

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
} from 'lucide-react'

export interface NavItem {
  label: string
  icon: React.ElementType
  path: string
}

export interface NavGroup {
  label: string
  icon: React.ElementType
  items: NavItem[]
}

export const topLevelItems: NavItem[] = [
  { label: 'Oversikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
]

export const navGroups: NavGroup[] = [
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

export const favoriteItems: NavItem[] = [
  { label: 'Ekonomisk oversikt', icon: DollarSign, path: '/admin/economics' },
  { label: 'Fakturering', icon: Receipt, path: '/admin/invoicing' },
  { label: 'Team AI Chat', icon: Sparkles, path: '/admin/team-chat' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Oversikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/economics' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/admin/dashboard': 'Oversikt',
  '/admin/customers': 'Kunder',
  '/admin/leads': 'Leads',
  '/admin/economics': 'Ekonomisk oversikt',
  '/admin/invoicing': 'Fakturering',
  '/admin/commissions': 'Provisioner',
  '/admin/technicians': 'Teknikerstatistik',
  '/admin/technician-management': 'Personalkonton',
  '/admin/contracts-overview': 'Avtalsoversikt',
  '/admin/sales-opportunities': 'Forsaljningsmojligheter',
  '/admin/customers/analytics': 'Kundanalys',
  '/admin/leads/analytics': 'Leadanalys',
  '/admin/organisation/organizations': 'Kundkonton',
  '/admin/organisation/organizations-manage': 'Hantera organisationer',
  '/admin/organisation/traffic-light': 'Trafikljusoversikt',
  '/admin/organisation/billing': 'Multisite-fakturering',
  '/admin/organisation/register': 'Registrera multisite',
  '/admin/team-chat': 'Team AI Chat',
  '/admin/image-bank': 'Bildbank',
  '/admin/tickets': 'Tickets',
  '/admin/oneflow-contract-creator': 'Skapa avtal',
  '/admin/oneflow-diagnostics': 'Avtalsdiagnostik',
  '/admin/webhook-config': 'Webhook-config',
  '/admin/settings/station-types': 'Stationstyper',
  '/admin/settings/preparations': 'Preparat',
  '/admin/settings/articles': 'Artiklar',
  '/admin/settings/price-lists': 'Prislistor',
}
