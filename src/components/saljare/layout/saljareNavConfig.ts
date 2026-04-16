// src/components/saljare/layout/saljareNavConfig.ts
// Navigeringskonfiguration för säljare-layout
// Kunder & Avtal + Försäljning + AI Assistent

import {
  Home,
  Target,
  Users,
  Activity,
  BarChart3,
  KeyRound,
  TrendingUp,
  Receipt,
  ClipboardList,
  GitBranch,
  Trash2,
  Sparkles,
} from 'lucide-react'
import type { NavItem, NavGroup } from '../../admin/layout/adminNavConfig'

export const topLevelItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/saljare/dashboard' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Kunder & Avtal',
    icon: Users,
    pinned: true,
    items: [
      { label: 'Befintliga kunder', icon: Users, path: '/saljare/befintliga-kunder' },
      { label: 'Trafikljusöversikt', icon: Activity, path: '/saljare/trafikljusoversikt' },
      { label: 'Kundprognos', icon: BarChart3, path: '/saljare/kundprognos' },
      { label: 'Användarkonton (Kund)', icon: KeyRound, path: '/saljare/anvandarkonton-kund' },
    ],
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    pinned: true,
    items: [
      { label: 'Försäljningspipeline', icon: Receipt, path: '/saljare/forsaljningspipeline' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/saljare/forsaljningsmojligheter' },
      { label: 'Leads', icon: Target, path: '/saljare/leads' },
      { label: 'Leadsstatistik', icon: BarChart3, path: '/saljare/leadsstatistik' },
      { label: 'Offerthantering', icon: ClipboardList, path: '/saljare/offerthantering' },
      { label: 'Kundresa', icon: GitBranch, path: '/saljare/kundresa' },
      { label: 'Avslutade ärenden', icon: Trash2, path: '/saljare/avslutade-arenden' },
    ],
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'AI Assistent', icon: Sparkles, path: '/saljare/ai-assistent' },
    ],
  },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/saljare/dashboard' },
  { label: 'Leads', icon: Target, path: '/saljare/leads' },
  { label: 'Kunder', icon: Users, path: '/saljare/befintliga-kunder' },
  { label: 'Försäljning', icon: TrendingUp, path: '/saljare/forsaljningspipeline' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/saljare/dashboard': 'Översikt',

  // Kunder & Avtal
  '/saljare/befintliga-kunder': 'Befintliga kunder',
  '/saljare/trafikljusoversikt': 'Trafikljusöversikt',
  '/saljare/kundprognos': 'Kundprognos',
  '/saljare/anvandarkonton-kund': 'Användarkonton (Kund)',

  // Försäljning
  '/saljare/forsaljningspipeline': 'Försäljningspipeline',
  '/saljare/forsaljningsmojligheter': 'Försäljningsmöjligheter',
  '/saljare/leads': 'Leads',
  '/saljare/leadsstatistik': 'Leadsstatistik',
  '/saljare/offerthantering': 'Offerthantering',
  '/saljare/kundresa': 'Kundresa',
  '/saljare/avslutade-arenden': 'Avslutade ärenden',

  // Verktyg
  '/saljare/ai-assistent': 'AI Assistent',
}
