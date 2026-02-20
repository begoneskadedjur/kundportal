// src/components/coordinator/layout/coordinatorNavConfig.ts
// Navigeringskonfiguration för koordinator-layout
// Speglar admin-menystrukturen + koordinator-specifika grupper (Planering, Ärenden)

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
  DollarSign,
  Wallet,
  Building2,
  UserCheck,
  MessageSquareText,
  Sparkles,
  Image as ImageIcon,
  Package,
  Beaker,
  FileSearch,
} from 'lucide-react'
import type { NavItem, NavGroup } from '../../admin/layout/adminNavConfig'

export const topLevelItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Kunder & Avtal',
    icon: Users,
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
    ],
  },
  {
    label: 'Ekonomi & Fakturering',
    icon: DollarSign,
    items: [
      { label: 'Ekonomisk översikt', icon: DollarSign, path: '/koordinator/ekonomi' },
      { label: 'Fakturering', icon: Receipt, path: '/koordinator/fakturering' },
      { label: 'Provisioner', icon: Wallet, path: '/koordinator/provisioner' },
    ],
  },
  {
    label: 'Organisation',
    icon: Building2,
    items: [
      { label: 'Teknikerstatistik', icon: BarChart3, path: '/koordinator/teknikerstatistik' },
      { label: 'Användarkonton (Personal)', icon: UserCheck, path: '/koordinator/anvandarkonton-personal' },
      { label: 'Tickets', icon: MessageSquareText, path: '/koordinator/tickets' },
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
    label: 'Produkter & Priser',
    icon: Package,
    items: [
      { label: 'Stationer & Fällor', icon: Target, path: '/koordinator/stationer-fallor' },
      { label: 'Preparat', icon: Beaker, path: '/koordinator/preparat' },
      { label: 'Prislistor', icon: Receipt, path: '/koordinator/prislistor' },
      { label: 'Artiklar', icon: Package, path: '/koordinator/artiklar' },
    ],
  },
  {
    label: 'Planering',
    icon: CalendarDays,
    items: [
      { label: 'Schema & Planering', icon: CalendarDays, path: '/koordinator/schema' },
      { label: 'Schemaoptimerare', icon: Wand2, path: '/koordinator/booking-assistant' },
    ],
  },
  {
    label: 'Ärenden',
    icon: FileSearch,
    items: [
      { label: 'Sök Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
      { label: 'Avtal & Offerter', icon: FileSignature, path: '/koordinator/oneflow-contract-creator' },
    ],
  },
]

export const favoriteItems: NavItem[] = [
  { label: 'Schema & Planering', icon: CalendarDays, path: '/koordinator/schema' },
  { label: 'Ekonomisk översikt', icon: DollarSign, path: '/koordinator/ekonomi' },
  { label: 'Sök Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
  { label: 'Kunder', icon: Users, path: '/koordinator/befintliga-kunder' },
  { label: 'Leads', icon: Target, path: '/koordinator/leads' },
  { label: 'Ekonomi', icon: DollarSign, path: '/koordinator/ekonomi' },
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

  // Ekonomi & Fakturering
  '/koordinator/ekonomi': 'Ekonomisk översikt',
  '/koordinator/fakturering': 'Fakturering',
  '/koordinator/provisioner': 'Provisioner',

  // Organisation
  '/koordinator/teknikerstatistik': 'Teknikerstatistik',
  '/koordinator/anvandarkonton-personal': 'Användarkonton (Personal)',
  '/koordinator/tickets': 'Tickets',

  // Verktyg
  '/koordinator/team-chat': 'AI Assistent',
  '/koordinator/bildbank': 'Gemensam bildbank',

  // Produkter & Priser
  '/koordinator/stationer-fallor': 'Stationer & Fällor',
  '/koordinator/preparat': 'Preparat',
  '/koordinator/prislistor': 'Prislistor',
  '/koordinator/artiklar': 'Artiklar',

  // Planering (koordinator-specifik)
  '/koordinator/schema': 'Schema & Planering',
  '/koordinator/booking-assistant': 'Schemaoptimerare',

  // Ärenden (koordinator-specifik)
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
