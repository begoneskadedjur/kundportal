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
  ClipboardList,
  AlertTriangle,
  GitBranch,
  Trash2,
  Bug,
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
  pinned?: boolean
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
      { label: 'Trafikljusöversikt', icon: Activity, path: '/admin/trafikljusoversikt' },
      { label: 'Kundprognos', icon: BarChart3, path: '/admin/kundprognos' },
      { label: 'Användarkonton (Kund)', icon: KeyRound, path: '/admin/anvandarkonton-kund' },
    ]
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    items: [
      { label: 'Försäljningspipeline', icon: Receipt, path: '/admin/forsaljningspipeline' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/admin/forsaljningsmojligheter' },
      { label: 'Leads', icon: Target, path: '/admin/leads' },
      { label: 'Leadsstatistik', icon: BarChart3, path: '/admin/leadsstatistik' },
      { label: 'Offerthantering', icon: ClipboardList, path: '/admin/offerthantering' },
      { label: 'Kundresa', icon: GitBranch, path: '/admin/kundresa' },
      { label: 'Avslutade ärenden', icon: Trash2, path: '/admin/avslutade-arenden' },
    ]
  },
  {
    label: 'Ekonomi & Fakturering',
    icon: DollarSign,
    items: [
      { label: 'Ekonomisk översikt', icon: DollarSign, path: '/admin/ekonomi' },
      { label: 'Fakturering', icon: Receipt, path: '/admin/fakturering' },
      { label: 'Provisioner', icon: Wallet, path: '/admin/provisioner' },
    ]
  },
  {
    label: 'Organisation',
    icon: Building2,
    items: [
      { label: 'Teknikerstatistik', icon: BarChart3, path: '/admin/teknikerstatistik' },
      { label: 'Användarkonton (Personal)', icon: UserCheck, path: '/admin/anvandarkonton-personal' },
      { label: 'Tickets', icon: MessageSquareText, path: '/admin/tickets' },
      { label: 'Tillbud & Avvikelser', icon: AlertTriangle, path: '/admin/tillbud-avvikelser' },
      { label: 'Buggrapporter', icon: Bug, path: '/admin/bug-reports' },
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
      { label: 'Preparat', icon: Beaker, path: '/admin/preparat' },
      { label: 'Prislistor', icon: Receipt, path: '/admin/prislistor' },
      { label: 'Artiklar', icon: Package, path: '/admin/artiklar' },
    ]
  },
  {
    label: 'Systeminställningar',
    icon: Settings,
    items: [
      { label: 'Kundgrupper', icon: Users, path: '/admin/kundgrupper' },
      { label: 'Fortnox', icon: Building2, path: '/admin/installningar/fortnox' },
      { label: 'SMS Mallar', icon: MessageSquareText, path: '/admin/sms-mallar' },
      { label: 'Webhook-config', icon: Wrench, path: '/admin/webhook-config' },
      { label: 'Avtalsdiagnostik', icon: AlertCircle, path: '/admin/avtalsdiagnostik' },
    ]
  },
]

export const favoriteItems: NavItem[] = [
  { label: 'Ekonomisk översikt', icon: DollarSign, path: '/admin/ekonomi' },
  { label: 'Fakturering', icon: Receipt, path: '/admin/fakturering' },
  { label: 'AI Assistent', icon: Sparkles, path: '/admin/ai-assistent' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/admin/dashboard' },
  { label: 'Befintliga kunder', icon: Users, path: '/admin/befintliga-kunder' },
  { label: 'Leads', icon: Target, path: '/admin/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/admin/ekonomi' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/admin/dashboard': 'Översikt',
  '/admin/befintliga-kunder': 'Befintliga kunder',
  '/admin/leads': 'Leads',
  '/admin/ekonomi': 'Ekonomisk översikt',
  '/admin/fakturering': 'Fakturering',
  '/admin/provisioner': 'Provisioner',
  '/admin/teknikerstatistik': 'Teknikerstatistik',
  '/admin/anvandarkonton-personal': 'Användarkonton (Personal)',
  '/admin/forsaljningspipeline': 'Försäljningspipeline',
  '/admin/forsaljningsmojligheter': 'Försäljningsmöjligheter',
  '/admin/kundprognos': 'Kundprognos',
  '/admin/leadsstatistik': 'Leadsstatistik',
  '/admin/anvandarkonton-kund': 'Användarkonton (Kund)',
  '/admin/trafikljusoversikt': 'Trafikljusöversikt',
  '/admin/offerthantering': 'Offerthantering',
  '/admin/kundresa': 'Kundresa',
  '/admin/avslutade-arenden': 'Avslutade ärenden',

  '/admin/ai-assistent': 'AI Assistent',
  '/admin/bildbank': 'Gemensam bildbank',
  '/admin/tickets': 'Tickets',
  '/admin/skapa-avtal': 'Skapa avtal',
  '/admin/avtalsdiagnostik': 'Avtalsdiagnostik',
  '/admin/webhook-config': 'Webhook-config',
  '/admin/stationer-fallor': 'Stationer & Fällor',
  '/admin/preparat': 'Preparat',
  '/admin/artiklar': 'Artiklar',
  '/admin/prislistor': 'Prislistor',
  '/admin/kundgrupper': 'Kundgrupper',
  '/admin/installningar/fortnox': 'Fortnox',
  '/admin/tillbud-avvikelser': 'Tillbud & Avvikelser',
  '/admin/bug-reports': 'Buggrapporter',
}
