// src/pages/shared/intranet/interactive/tillagg/tillaggRoles.ts
// Rollerna i guiden Tilläggsstationer med färg per roll.

export type TillaggRole = 'koordinator' | 'tekniker' | 'fakturering' | 'systemet'

export const ROLE_CONFIG: Record<TillaggRole, { label: string; short: string; dot: string; text: string }> = {
  koordinator: { label: 'Koordinator', short: 'Koordinator', dot: 'bg-cyan-400', text: 'text-cyan-400' },
  tekniker: { label: 'Tekniker', short: 'Tekniker', dot: 'bg-amber-400', text: 'text-amber-400' },
  fakturering: { label: 'Faktureringsansvarig', short: 'Fakturering', dot: 'bg-[#20c58f]', text: 'text-[#20c58f]' },
  systemet: { label: 'Systemet', short: 'Systemet', dot: 'bg-purple-400', text: 'text-purple-400' },
}

export const ROLE_ORDER: TillaggRole[] = ['koordinator', 'tekniker', 'fakturering', 'systemet']
