// src/components/coordinator/layout/coordinatorNavConfig.ts
// Navigeringskonfiguration för koordinator-layout
// Utvalda admin-grupper + koordinator-specifika grupper (Planering, Ärenden)

import {
  Home,
  CalendarDays,
  Wand2,
  Target,
  FileSignature,
  Users,
  Activity,
  BarChart3,
  KeyRound,
  TrendingUp,
  Receipt,
  MessageSquareText,
  Sparkles,
  Image as ImageIcon,
  FileSearch,
  FilePen,
} from 'lucide-react'
import type { NavItem, NavGroup } from '../../admin/layout/adminNavConfig'

export const topLevelItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
  { label: 'Skapa Avtal & Offerter', icon: FilePen, path: '/koordinator/oneflow-contract-creator' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Planering',
    icon: CalendarDays,
    pinned: true,
    items: [
      { label: 'Schemaoptimerare', icon: Wand2, path: '/koordinator/booking-assistant' },
      { label: 'Tickets', icon: MessageSquareText, path: '/koordinator/tickets' },
    ],
  },
  {
    label: 'Kunder & Avtal',
    icon: Users,
    pinned: true,
    items: [
      { label: 'Befintliga kunder', icon: Users, path: '/koordinator/befintliga-kunder' },
      { label: 'Trafikljusöversikt', icon: Activity, path: '/koordinator/trafikljusoversikt' },
      { label: 'Kundprognos', icon: BarChart3, path: '/koordinator/kundprognos' },
      { label: 'Användarkonton (Kund)', icon: KeyRound, path: '/koordinator/customer-access' },
    ],
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    items: [
      { label: 'Försäljningspipeline', icon: Receipt, path: '/koordinator/forsaljningspipeline' },
      { label: 'Försäljningsmöjligheter', icon: TrendingUp, path: '/koordinator/forsaljningsmojligheter' },
      { label: 'Leads', icon: Target, path: '/koordinator/leads' },
      { label: 'Leadsstatistik', icon: BarChart3, path: '/koordinator/leadsstatistik' },
      { label: 'Dokumentsignering', icon: FileSignature, path: '/koordinator/dokumentsignering' },
    ],
  },
  {
    label: 'Fakturering',
    icon: Receipt,
    items: [
      { label: 'Fakturering', icon: Receipt, path: '/koordinator/fakturering' },
    ],
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'AI Assistent', icon: Sparkles, path: '/koordinator/team-chat' },
      { label: 'Gemensam bildbank', icon: ImageIcon, path: '/koordinator/bildbank' },
    ],
  },
  {
    label: 'Ärenden',
    icon: FileSearch,
    items: [
      { label: 'Sök Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
    ],
  },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
  { label: 'Kunder', icon: Users, path: '/koordinator/befintliga-kunder' },
  { label: 'Leads', icon: Target, path: '/koordinator/leads' },
  { label: 'Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  // Översikt
  '/koordinator/dashboard': 'Översikt',

  // Kunder & Avtal
  '/koordinator/befintliga-kunder': 'Befintliga kunder',
  '/koordinator/trafikljusoversikt': 'Trafikljusöversikt',
  '/koordinator/kundprognos': 'Kundprognos',
  '/koordinator/customer-access': 'Användarkonton (Kund)',

  // Försäljning
  '/koordinator/forsaljningspipeline': 'Försäljningspipeline',
  '/koordinator/forsaljningsmojligheter': 'Försäljningsmöjligheter',
  '/koordinator/leads': 'Leads',
  '/koordinator/leadsstatistik': 'Leadsstatistik',
  // Fakturering
  '/koordinator/fakturering': 'Fakturering',

  // Organisation
  '/koordinator/tickets': 'Tickets',

  // Verktyg
  '/koordinator/team-chat': 'AI Assistent',
  '/koordinator/bildbank': 'Gemensam bildbank',

  // Planering (koordinator-specifik)
  '/koordinator/schema': 'Schema & Planering',
  '/koordinator/booking-assistant': 'Schemaoptimerare',

  // Ärenden (koordinator-specifik)
  '/koordinator/dokumentsignering': 'Dokumentsignering',
  '/koordinator/sok-arenden': 'Sök Ärenden',
  '/koordinator/oneflow-contract-creator': 'Avtal & Offerter',
  '/koordinator/analytics': 'Analytics & Insights',

  // Guides
  '/koordinator/guides/case-deletion': 'Ärendehantering',
  '/koordinator/guides/ticket-system': 'Ticket-systemet',

  // Legacy
  '/koordinator/organisation/traffic-light': 'Trafikljusöversikt',

  // Lärosäte
  '/koordinator/larosate': 'Lärosäte',
}
