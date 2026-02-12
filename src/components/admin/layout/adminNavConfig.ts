// src/components/admin/layout/adminNavConfig.ts
// Navigeringskonfiguration för admin CRM-layout

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
  KeyRound,
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
  { label: 'Översikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Kundåtkomst', icon: KeyRound, path: '/admin/customer-access' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Försäljning',
    icon: TrendingUp,
    items: [
      { label: 'Avtalsöversikt', icon: Receipt, path: '/admin/contracts-overview' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/admin/sales-opportunities' },
      { label: 'Kundanalys', icon: BarChart3, path: '/admin/customers/analytics' },
      { label: 'Leadanalys', icon: BarChart3, path: '/admin/leads/analytics' },
    ]
  },
  {
    label: 'Ekonomi & Fakturering',
    icon: DollarSign,
    items: [
      { label: 'Ekonomisk översikt', icon: DollarSign, path: '/admin/economics' },
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
      { label: 'Trafikljusöversikt', icon: Activity, path: '/admin/organisation/traffic-light' },
      { label: 'Multisite-fakturering', icon: Receipt, path: '/admin/organisation/billing' },
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
      { label: 'Lärocenter', icon: GraduationCap, path: '/larosate' },
    ]
  },
  {
    label: 'Inställningar',
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
  { label: 'Ekonomisk översikt', icon: DollarSign, path: '/admin/economics' },
  { label: 'Fakturering', icon: Receipt, path: '/admin/invoicing' },
  { label: 'Team AI Chat', icon: Sparkles, path: '/admin/team-chat' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Kunder', icon: Users, path: '/admin/customers' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/economics' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/admin/dashboard': 'Översikt',
  '/admin/customers': 'Kunder',
  '/admin/leads': 'Leads',
  '/admin/economics': 'Ekonomisk översikt',
  '/admin/invoicing': 'Fakturering',
  '/admin/commissions': 'Provisioner',
  '/admin/technicians': 'Teknikerstatistik',
  '/admin/technician-management': 'Personalkonton',
  '/admin/contracts-overview': 'Avtalsöversikt',
  '/admin/sales-opportunities': 'Försäljningsmöjligheter',
  '/admin/customers/analytics': 'Kundanalys',
  '/admin/leads/analytics': 'Leadanalys',
  '/admin/customer-access': 'Kundåtkomst',
  '/admin/organisation/traffic-light': 'Trafikljusöversikt',
  '/admin/organisation/billing': 'Multisite-fakturering',
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
