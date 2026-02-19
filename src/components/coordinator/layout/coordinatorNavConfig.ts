// src/components/coordinator/layout/coordinatorNavConfig.ts
// Navigeringskonfiguration för koordinator-layout

import {
  Home,
  CalendarDays,
  Wand2,
  Target,
  FileSignature,
  Building2,
  TrendingUp,
  FileSearch,
  BarChart3,
  Sparkles,
  MessageSquareText,
  GraduationCap,
} from 'lucide-react'
import type { NavItem, NavGroup } from '../../admin/layout/adminNavConfig'

export const topLevelItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Planering',
    icon: CalendarDays,
    items: [
      { label: 'Schema & Planering', icon: CalendarDays, path: '/koordinator/schema' },
      { label: 'Schemaoptimerare', icon: Wand2, path: '/koordinator/booking-assistant' },
    ],
  },
  {
    label: 'Försäljning',
    icon: Target,
    items: [
      { label: 'Lead Pipeline', icon: Target, path: '/koordinator/leads' },
      { label: 'Avtal & Offerter', icon: FileSignature, path: '/koordinator/oneflow-contract-creator' },
    ],
  },
  {
    label: 'Ärenden',
    icon: FileSearch,
    items: [
      { label: 'Sök Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
    ],
  },
  {
    label: 'Analys',
    icon: BarChart3,
    items: [
      { label: 'Analytics & Insights', icon: BarChart3, path: '/koordinator/analytics' },
      { label: 'Trafikljusöversikt', icon: TrendingUp, path: '/koordinator/organisation/traffic-light' },
    ],
  },
  {
    label: 'Verktyg',
    icon: Sparkles,
    items: [
      { label: 'Team AI Chat', icon: Sparkles, path: '/koordinator/team-chat' },
      { label: 'Kundåtkomst', icon: Building2, path: '/koordinator/customer-access' },
    ],
  },
  {
    label: 'Organisation',
    icon: MessageSquareText,
    items: [
      { label: 'Tickets', icon: MessageSquareText, path: '/koordinator/tickets' },
      { label: 'Lärosäte', icon: GraduationCap, path: '/koordinator/larosate' },
    ],
  },
]

export const favoriteItems: NavItem[] = [
  { label: 'Schema & Planering', icon: CalendarDays, path: '/koordinator/schema' },
  { label: 'Team AI Chat', icon: Sparkles, path: '/koordinator/team-chat' },
  { label: 'Sök Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/koordinator/dashboard' },
  { label: 'Schema', icon: CalendarDays, path: '/koordinator/schema' },
  { label: 'Leads', icon: Target, path: '/koordinator/leads' },
  { label: 'Ärenden', icon: FileSearch, path: '/koordinator/sok-arenden' },
]

// Breadcrumb-mappning: path -> svenskt namn
export const breadcrumbMap: Record<string, string> = {
  '/koordinator/dashboard': 'Översikt',
  '/koordinator/schema': 'Schema & Planering',
  '/koordinator/booking-assistant': 'Schemaoptimerare',
  '/koordinator/leads': 'Lead Pipeline',
  '/koordinator/oneflow-contract-creator': 'Avtal & Offerter',
  '/koordinator/sok-arenden': 'Sök Ärenden',
  '/koordinator/analytics': 'Analytics & Insights',
  '/koordinator/organisation/traffic-light': 'Trafikljusöversikt',
  '/koordinator/team-chat': 'Team AI Chat',
  '/koordinator/customer-access': 'Kundåtkomst',
  '/koordinator/tickets': 'Tickets',
  '/koordinator/larosate': 'Lärosäte',
  '/koordinator/guides/case-deletion': 'Ärendehantering',
  '/koordinator/guides/ticket-system': 'Ticket-systemet',
}
