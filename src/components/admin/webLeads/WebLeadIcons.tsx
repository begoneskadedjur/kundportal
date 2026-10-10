// src/components/admin/webLeads/WebLeadIcons.tsx
// Tunt alias mot ikonstandarden (src/components/icons). Ritningarna ligger i
// registret som tjanst.*, kalla.* och allman.* och renderas via <Icon>, så att
// befintliga importer fungerar oförändrat. Ny kod använder <Icon> direkt.

import { Icon, type IconName } from '../../icons/Icon'

export type TjanstIkon =
  | 'rattor'
  | 'moss'
  | 'faglar'
  | 'getingar'
  | 'vaggloss'
  | 'silverfisk'
  | 'myror'
  | 'kackerlackor'
  | 'palsanger'
  | 'mjolbaggar'
  | 'mal'
  | 'flugor'
  | 'mogel'
  | 'annat'

export type KallaIkon =
  | 'google_ads'
  | 'betald'
  | 'organiskt'
  | 'ai'
  | 'social'
  | 'epost'
  | 'hanvisning'
  | 'direkt'
  | 'artanalys'

export type OvrigIkon = 'las' | 'marknad' | 'arkiv' | 'aterstall' | 'meny'

const TJANST: Record<TjanstIkon, IconName> = {
  rattor: 'tjanst.rattor',
  moss: 'tjanst.moss',
  faglar: 'tjanst.faglar',
  getingar: 'tjanst.getingar',
  vaggloss: 'tjanst.vaggloss',
  silverfisk: 'tjanst.silverfisk',
  myror: 'tjanst.myror',
  kackerlackor: 'tjanst.kackerlackor',
  palsanger: 'tjanst.palsanger',
  mjolbaggar: 'tjanst.mjolbaggar',
  mal: 'tjanst.mal',
  flugor: 'tjanst.flugor',
  mogel: 'tjanst.mogel',
  annat: 'tjanst.annat',
}

const KALLA: Record<KallaIkon, IconName> = {
  google_ads: 'kalla.google-ads',
  betald: 'kalla.betald',
  organiskt: 'kalla.organiskt',
  ai: 'kalla.ai',
  social: 'kalla.social',
  epost: 'kalla.epost',
  hanvisning: 'kalla.hanvisning',
  direkt: 'kalla.direkt',
  artanalys: 'kalla.artanalys',
}

const OVRIG: Record<OvrigIkon, IconName> = {
  las: 'allman.las',
  marknad: 'allman.marknad',
  arkiv: 'allman.arkiv',
  aterstall: 'allman.aterstall',
  meny: 'allman.meny',
}

export function TjanstIcon({ name, className = 'w-5 h-5' }: { name: TjanstIkon; className?: string }) {
  return <Icon name={TJANST[name]} size={20} className={className} />
}

export function KallaIcon({ name, className = 'w-4 h-4' }: { name: KallaIkon; className?: string }) {
  return <Icon name={KALLA[name]} size={16} className={className} />
}

export function LeadIcon({ name, className = 'w-4 h-4' }: { name: OvrigIkon; className?: string }) {
  return <Icon name={OVRIG[name]} size={16} className={className} />
}
