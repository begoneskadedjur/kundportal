// src/components/technician/layout/technicianNavConfig.ts
// Navigeringskonfiguration för tekniker-layout

import {
  Home,
  ClipboardList,
  Calendar,
  Target as TargetIcon,
  TrendingUp,
  Wrench,
  Sparkles,
  DollarSign,
  AlertTriangle,
  MessageSquareText,
  FileSignature,
  Package,
  GitBranch,
} from 'lucide-react'

import type { NavItem, NavGroup } from '../../admin/layout/adminNavConfig'

export type { NavItem, NavGroup }

export const topLevelItems: NavItem[] = [
  { label: 'Översikt', icon: Home, path: '/technician/dashboard' },
]

export const navGroups: NavGroup[] = [
  {
    label: 'Ärenden & Fält',
    icon: ClipboardList,
    pinned: true,
    items: [
      { label: 'Mina ärenden', icon: ClipboardList, path: '/technician/cases' },
      { label: 'Schema', icon: Calendar, path: '/technician/schedule' },
      { label: 'Utrustning', icon: Package, path: '/technician/equipment' },
      { label: 'Tickets', icon: MessageSquareText, path: '/technician/tickets' },
    ],
  },
  {
    label: 'Försäljning',
    icon: TrendingUp,
    items: [
      { label: 'Leads', icon: TargetIcon, path: '/technician/leads' },
      { label: 'Skapa Avtal & Offerter', icon: FileSignature, path: '/technician/oneflow' },
      { label: 'Dokumentsignering', icon: FileSignature, path: '/technician/dokumentsignering' },
      { label: 'Min Kundresa', icon: GitBranch, path: '/technician/min-kundresa' },
    ],
  },
  {
    label: 'Verktyg',
    icon: Wrench,
    items: [
      { label: 'AI Assistent', icon: Sparkles, path: '/technician/team-chat' },
      { label: 'Provisioner', icon: DollarSign, path: '/technician/commissions' },
      { label: 'Tillbud & Avvikelser', icon: AlertTriangle, path: '/technician/tillbud-avvikelser' },
    ],
  },
]

export const mobileBottomItems: NavItem[] = [
  { label: 'Hem', icon: Home, path: '/technician/dashboard' },
  { label: 'Ärenden', icon: ClipboardList, path: '/technician/cases' },
  { label: 'Schema', icon: Calendar, path: '/technician/schedule' },
  { label: 'Provision', icon: DollarSign, path: '/technician/commissions' },
]

export const breadcrumbMap: Record<string, string> = {
  '/technician/dashboard': 'Översikt',
  '/technician/cases': 'Mina ärenden',
  '/technician/schedule': 'Schema',
  '/technician/equipment': 'Utrustning',
  '/technician/commissions': 'Provisioner',
  '/technician/leads': 'Leads',
  '/technician/oneflow': 'Skapa Avtal & Offerter',
  '/technician/oneflow-contract-creator': 'Skapa Avtal & Offerter',
  '/technician/dokumentsignering': 'Dokumentsignering',
  '/technician/min-kundresa': 'Min Kundresa',
  '/technician/team-chat': 'AI Assistent',
  '/technician/tillbud-avvikelser': 'Tillbud & Avvikelser',
  '/technician/tickets': 'Tickets',
}
