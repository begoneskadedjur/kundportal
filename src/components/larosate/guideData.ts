// src/components/larosate/guideData.ts
// Centraliserad metadata för alla guider i BeGone Lärosäte

import {
  MessageSquareText,
  Ticket,
  Plus,
  Trash2,
  MapPin,
  type LucideIcon
} from 'lucide-react';

// Kategorier för guider
export type GuideCategory = 'communication' | 'cases' | 'equipment';

export interface CategoryInfo {
  id: GuideCategory;
  label: string;
  color: string;
  bgColor: string;
}

export const categories: CategoryInfo[] = [
  { id: 'communication', label: 'Kommunikation', color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
  { id: 'cases', label: 'Ärendehantering', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  { id: 'equipment', label: 'Utrustning', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
];

// Guide-interface
export interface Guide {
  id: string;
  title: string;
  description: string;
  category: GuideCategory;
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
  path: string;
  tags: string[];
  isNew?: boolean;
}

// Alla tillgängliga guider
export const guides: Guide[] = [
  {
    id: 'case-communication',
    title: 'Ärendekommunikation',
    description: 'Lär dig chatta effektivt med kollegor i ärenden',
    category: 'communication',
    icon: MessageSquareText,
    iconColor: 'text-cyan-400',
    iconBgColor: 'bg-cyan-500/20',
    path: '/larosate/guides/case-communication',
    tags: ['chatt', 'meddelanden', 'mentions', 'kommunikation', 'bilagor'],
    isNew: true
  },
  {
    id: 'ticket-system',
    title: 'Ticket-systemet',
    description: 'Förstå de 6 flikarna och hur du hanterar tickets effektivt',
    category: 'communication',
    icon: Ticket,
    iconColor: 'text-cyan-400',
    iconBgColor: 'bg-cyan-500/20',
    path: '/larosate/guides/ticket-system',
    tags: ['tickets', 'flikar', 'notifikationer', 'inkorg', 'svar'],
    isNew: true
  },
  {
    id: 'follow-up-case',
    title: 'Skapa Följeärenden',
    description: 'Hur du skapar nya ärenden direkt i fält när du hittar extra problem',
    category: 'cases',
    icon: Plus,
    iconColor: 'text-amber-400',
    iconBgColor: 'bg-amber-500/20',
    path: '/larosate/guides/follow-up-case',
    tags: ['följeärende', 'nytt ärende', 'fält', 'skapa', 'problem']
  },
  {
    id: 'case-deletion',
    title: 'Radera vs Slaska ärenden',
    description: 'När och hur du avbryter ärenden - och varför du aldrig ska radera',
    category: 'cases',
    icon: Trash2,
    iconColor: 'text-red-400',
    iconBgColor: 'bg-red-500/20',
    path: '/larosate/guides/case-deletion',
    tags: ['radera', 'slaska', 'avbryt', 'ta bort', 'stänga'],
    isNew: true
  },
  {
    id: 'equipment-placement',
    title: 'Utrustningsplacering',
    description: 'Lär dig registrera fällor och stationer med GPS-position och foto',
    category: 'equipment',
    icon: MapPin,
    iconColor: 'text-emerald-400',
    iconBgColor: 'bg-emerald-500/20',
    path: '/larosate/guides/equipment-placement',
    tags: ['fällor', 'stationer', 'gps', 'foto', 'placering', 'utrustning']
  }
];

// Hjälpfunktion för att filtrera guider
export function filterGuides(
  searchTerm: string,
  category: GuideCategory | 'all'
): Guide[] {
  let filtered = guides;

  // Filtrera på kategori
  if (category !== 'all') {
    filtered = filtered.filter(g => g.category === category);
  }

  // Filtrera på sökterm
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(guide =>
      guide.title.toLowerCase().includes(term) ||
      guide.description.toLowerCase().includes(term) ||
      guide.tags.some(tag => tag.toLowerCase().includes(term))
    );
  }

  return filtered;
}

// Hämta kategori-info
export function getCategoryInfo(categoryId: GuideCategory): CategoryInfo | undefined {
  return categories.find(c => c.id === categoryId);
}
