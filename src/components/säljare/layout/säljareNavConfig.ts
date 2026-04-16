// src/components/säljare/layout/säljareNavConfig.ts
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
  { label: 'Översikt', icon: Home, path: '/säljare/dashboard' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Kunder & Avtal',
    icon: Users,
    pinned: true,
    items: [
      { label: 'Befintliga kunder', icon: Users, path: '/säljare/befintliga-kunder' },
      { label: 'Trafikljusöversikt', icon: Activity, path: '/säljare/trafikljusoversikt' },
      { label: 'Kundprognos', icon: BarChart3, path: '/säljare/kundprognos' },
      { label: 'Användarkonton (Kund)', icon: KeyRound, path: '/säljare/anvandarkonton-kund' },
    ],
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    pinned: true,
    items: [
      { label: 'Försäljningspipeline', icon: Receipt, path: '/säljare/forsaljningspipeline' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/säljare/forsaljningsmojligheter' },
      { label: 'Leads', icon: Target, path: '/säljare/leads' },
      { label: 'Leadsstatistik', icon: BarChart3, path: '/säljare/leadsstatistik' },
      { label: 'Offerthantering', icon: ClipboardList, path: '/säljare/offerthantering' },
      { label: 'Kundresa', icon: GitBranch, path: '/säljare/kundresa' },
      { label: 'Avslutade ärenden', icon: Trash2, path: '/säljare/avslutade-arenden' },
    ],
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'AI Assistent', icon: Sparkles, path: '/säljare/ai-assistent' },
    ],
  },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/säljare/dashboard' },
  { label: 'Leads', icon: Target, path: '/säljare/leads' },
  { label: 'Kunder', icon: Users, path: '/säljare/befintliga-kunder' },
  { label: 'Försäljning', icon: TrendingUp, path: '/säljare/forsaljningspipeline' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/säljare/dashboard': 'Översikt',

  // Kunder & Avtal
  '/säljare/befintliga-kunder': 'Befintliga kunder',
  '/säljare/trafikljusoversikt': 'Trafikljusöversikt',
  '/säljare/kundprognos': 'Kundprognos',
  '/säljare/anvandarkonton-kund': 'Användarkonton (Kund)',

  // Försäljning
  '/säljare/forsaljningspipeline': 'Försäljningspipeline',
  '/säljare/forsaljningsmojligheter': 'Försäljningsmöjligheter',
  '/säljare/leads': 'Leads',
  '/säljare/leadsstatistik': 'Leadsstatistik',
  '/säljare/offerthantering': 'Offerthantering',
  '/säljare/kundresa': 'Kundresa',
  '/säljare/avslutade-arenden': 'Avslutade ärenden',

  // Verktyg
  '/säljare/ai-assistent': 'AI Assistent',
}
