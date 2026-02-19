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
]

export const navGroups: NavGroup[] = [
  {
    label: 'Kunder & Avtal',
    icon: Users,
    items: [
      { label: 'Befintliga kunder', icon: Users, path: '/admin/befintliga-kunder' },
      { label: 'Trafikljusöversikt', icon: Activity, path: '/admin/organisation/traffic-light' },
      { label: 'Kundprognos', icon: BarChart3, path: '/admin/kundprognos' },
      { label: 'Användarkonton (Kund)', icon: KeyRound, path: '/admin/anvandarkonton-kund' },
    ]
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    items: [
      { label: 'Försäljningspipeline', icon: Receipt, path: '/admin/forsaljningspipeline' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/admin/sales-opportunities' },
      { label: 'Leads', icon: Target, path: '/admin/leads' },
      { label: 'Leadsstatistik', icon: BarChart3, path: '/admin/leadsstatistik' },
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
    label: 'Organisation',
    icon: Building2,
    items: [
      { label: 'Teknikerstatistik', icon: BarChart3, path: '/admin/technicians' },
      { label: 'Användarkonton (Personal)', icon: UserCheck, path: '/admin/anvandarkonton-personal' },
      { label: 'Tickets', icon: MessageSquareText, path: '/admin/tickets' },
    ]
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'AI Assistent', icon: Sparkles, path: '/admin/ai-assistent' },
      { label: 'Gemensam bildbank', icon: ImageIcon, path: '/admin/bildbank' },
    ]
  },
  {
    label: 'Produkter & Priser',
    icon: Package,
    items: [
      { label: 'Stationer & Fällor', icon: Target, path: '/admin/stationer-fallor' },
      { label: 'Preparat', icon: Beaker, path: '/admin/settings/preparations' },
      { label: 'Prislistor', icon: Receipt, path: '/admin/settings/price-lists' },
      { label: 'Artiklar', icon: Package, path: '/admin/settings/articles' },
    ]
  },
  {
    label: 'Systeminställningar',
    icon: Settings,
    items: [
      { label: 'Webhook-config', icon: Wrench, path: '/admin/webhook-config' },
      { label: 'Avtalsdiagnostik', icon: AlertCircle, path: '/admin/oneflow-diagnostics' },
    ]
  },
]

export const favoriteItems: NavItem[] = [
  { label: 'Ekonomisk översikt', icon: DollarSign, path: '/admin/economics' },
  { label: 'Fakturering', icon: Receipt, path: '/admin/invoicing' },
  { label: 'AI Assistent', icon: Sparkles, path: '/admin/ai-assistent' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Befintliga kunder', icon: Users, path: '/admin/befintliga-kunder' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/economics' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/admin/dashboard': 'Översikt',
  '/admin/befintliga-kunder': 'Befintliga kunder',
  '/admin/leads': 'Leads',
  '/admin/economics': 'Ekonomisk översikt',
  '/admin/invoicing': 'Fakturering',
  '/admin/commissions': 'Provisioner',
  '/admin/technicians': 'Teknikerstatistik',
  '/admin/anvandarkonton-personal': 'Användarkonton (Personal)',
  '/admin/forsaljningspipeline': 'Försäljningspipeline',
  '/admin/sales-opportunities': 'Försäljningsmöjligheter',
  '/admin/kundprognos': 'Kundprognos',
  '/admin/leadsstatistik': 'Leadsstatistik',
  '/admin/anvandarkonton-kund': 'Användarkonton (Kund)',
  '/admin/organisation/traffic-light': 'Trafikljusöversikt',

  '/admin/ai-assistent': 'AI Assistent',
  '/admin/bildbank': 'Gemensam bildbank',
  '/admin/tickets': 'Tickets',
  '/admin/oneflow-contract-creator': 'Skapa avtal',
  '/admin/oneflow-diagnostics': 'Avtalsdiagnostik',
  '/admin/webhook-config': 'Webhook-config',
  '/admin/stationer-fallor': 'Stationer & Fällor',
  '/admin/settings/preparations': 'Preparat',
  '/admin/settings/articles': 'Artiklar',
  '/admin/settings/price-lists': 'Prislistor',
}
