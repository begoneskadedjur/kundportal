// src/components/admin/webLeads/leadKlassning.ts
// Klassning för tabellen i Leads (Webb): vilken tjänstikon en förfrågan får (pest_type är en slug
// som "rattor" eller sajtens fritext som "Pälsänger") och vilken kanal kunden kom från, utifrån
// gclid/gbraid/wbraid, utm-fälten, landningsadressen och referrern.

import type { WebInquiry } from '../../../types/webInquiry'
import type { KallaIkon, TjanstIkon } from './WebLeadIcons'

export const TJANST_LABEL: Record<TjanstIkon, string> = {
  rattor: 'Råttor',
  moss: 'Möss',
  faglar: 'Fåglar',
  getingar: 'Getingar',
  vaggloss: 'Vägglöss',
  silverfisk: 'Silverfisk',
  myror: 'Myror',
  kackerlackor: 'Kackerlackor',
  palsanger: 'Pälsänger',
  mjolbaggar: 'Mjölbaggar',
  mal: 'Mal',
  flugor: 'Flugor',
  mogel: 'Mögel',
  annat: 'Annat',
}

export const TJANST_ORDNING = Object.keys(TJANST_LABEL) as TjanstIkon[]

function normalisera(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
}

/** Tjänstens ikon och filtergrupp. Okänt, vet inte och företag utan djur blir Annat. */
export function tjanstNyckel(pest: string | null | undefined): TjanstIkon {
  const n = normalisera(pest ?? '')
  if (!n) return 'annat'
  if (/ratt/.test(n)) return 'rattor'
  if (/^moss|\bmoss\b|\bmus\b|husmus|skogsmus|^mus/.test(n)) return 'moss'
  if (/fagel|faglar|duv|kraka|kajor?\b|masar|skata|stare/.test(n)) return 'faglar'
  if (/geting|humla|\bbin\b/.test(n)) return 'getingar'
  if (/vaggl/.test(n)) return 'vaggloss'
  if (/silverfisk|pappersfisk|borstsvans/.test(n)) return 'silverfisk'
  if (/myr/.test(n)) return 'myror'
  if (/kacker/.test(n)) return 'kackerlackor'
  if (/palsang/.test(n)) return 'palsanger'
  if (/mjol|brodbagge|bagge/.test(n)) return 'mjolbaggar'
  if (/^mal$|\bmal(ar)?\b|kladmal|matmal|ljusmal|palsmal/.test(n)) return 'mal'
  if (/flug/.test(n)) return 'flugor'
  if (/mogel/.test(n)) return 'mogel'
  return 'annat'
}

export type Kanal = Exclude<KallaIkon, 'artanalys'>

export const KANAL_LABEL: Record<Kanal, string> = {
  google_ads: 'Google Ads',
  betald: 'Annons, övrig',
  organiskt: 'Organisk sökning',
  ai: 'AI-assistent',
  social: 'Sociala medier',
  epost: 'E-post',
  hanvisning: 'Hänvisning',
  direkt: 'Direkt',
}

export const KANAL_ORDNING = Object.keys(KANAL_LABEL) as Kanal[]

/** Ikonens färg per kanal (Tailwind-färgerna remappas i ljust tema). */
export const KANAL_FARG: Record<Kanal, string> = {
  google_ads: 'text-amber-400',
  betald: 'text-orange-400',
  organiskt: 'text-[#20c58f]',
  ai: 'text-violet-400',
  social: 'text-sky-400',
  epost: 'text-cyan-400',
  hanvisning: 'text-slate-300',
  direkt: 'text-slate-400',
}

const ADS_I_URL = /[?&](gclid|gbraid|wbraid|gad_source)=/
const AI = /chatgpt|openai|copilot|perplexity|gemini|claude|bard|you\.com/
const SOCIAL = /facebook|instagram|linkedin|tiktok|youtube|twitter|(^|\.)x\.com|(^|\.)t\.co$|pinterest|snapchat|reddit|threads/
const SOK = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|startpage|qwant|eniro|hitta)\./

function vard(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function arEgen(host: string): boolean {
  return !host || host === 'begone.se' || host.endsWith('.begone.se') || host.endsWith('.vercel.app')
}

export interface KanalInfo {
  kanal: Kanal
  /** Detalj för tooltip: sökord, utm-källa eller referrerns domän. */
  detalj: string
}

type KanalFalt = Pick<WebInquiry, 'gclid' | 'gbraid' | 'wbraid' | 'utm_source' | 'utm_medium' | 'utm_term' | 'utm_campaign' | 'landing_url' | 'referrer'>

/** Vilken kanal förfrågan kom från. Google Ads vinner alltid när ett klick-id finns. */
export function kanalFor(i: KanalFalt): KanalInfo {
  const kalla = normalisera(i.utm_source ?? '')
  const medium = normalisera(i.utm_medium ?? '')
  const urls = `${i.landing_url ?? ''} ${i.referrer ?? ''}`.toLowerCase()
  const ref = vard(i.referrer)
  const extern = arEgen(ref) ? '' : ref

  if (i.gclid || i.gbraid || i.wbraid || ADS_I_URL.test(urls) || (kalla === 'google' && /cpc|ppc|paid/.test(medium))) {
    return { kanal: 'google_ads', detalj: i.utm_term || i.utm_campaign || '' }
  }
  if (/cpc|ppc|paid|display|^ads?$/.test(medium)) {
    return { kanal: 'betald', detalj: [i.utm_source, i.utm_campaign].filter(Boolean).join(' / ') }
  }
  if (AI.test(kalla) || AI.test(extern)) return { kanal: 'ai', detalj: i.utm_source || extern }
  if (medium === 'email' || medium === 'e-post' || medium === 'epost' || /nyhetsbrev|newsletter/.test(kalla)) {
    return { kanal: 'epost', detalj: i.utm_source || '' }
  }
  if (medium === 'social' || SOCIAL.test(kalla) || SOCIAL.test(extern)) return { kanal: 'social', detalj: i.utm_source || extern }
  if (medium === 'organic' || SOK.test(extern) || SOK.test(`${kalla}.`)) return { kanal: 'organiskt', detalj: extern || i.utm_source || '' }
  if (extern) return { kanal: 'hanvisning', detalj: extern }
  if (kalla) return { kanal: 'hanvisning', detalj: i.utm_source ?? '' }
  return { kanal: 'direkt', detalj: '' }
}
