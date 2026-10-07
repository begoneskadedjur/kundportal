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

// ---------- AI-assistenter ----------

/** Kända AI-assistenter. 'annan' är en AI-källa som inte finns i listan. */
export type AiKalla =
  | 'chatgpt'
  | 'copilot'
  | 'perplexity'
  | 'gemini'
  | 'claude'
  | 'meta_ai'
  | 'grok'
  | 'le_chat'
  | 'deepseek'
  | 'you'
  | 'phind'
  | 'kagi'
  | 'annan'

export const AI_KALLA_LABEL: Record<AiKalla, string> = {
  chatgpt: 'ChatGPT',
  copilot: 'Copilot',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  meta_ai: 'Meta AI',
  grok: 'Grok',
  le_chat: 'Le Chat',
  deepseek: 'DeepSeek',
  you: 'You.com',
  phind: 'Phind',
  kagi: 'Kagi',
  annan: 'Annan AI',
}

/** Visningsordning: listans ordning, Annan AI sist. */
export const AI_KALLA_ORDNING = Object.keys(AI_KALLA_LABEL) as AiKalla[]

/**
 * Igenkänning per assistent: [assistent, mönster för utm_source, mönster för referrerns domän].
 * Ordningen spelar roll: Copilot före Bing, Gemini före Google.
 */
const AI_KANDA: Array<[Exclude<AiKalla, 'annan'>, RegExp, RegExp]> = [
  ['chatgpt', /chatgpt|openai/, /(^|\.)(chatgpt\.com|openai\.com)$/],
  ['copilot', /copilot|bing ?chat|edgeservices/, /(^|\.)(copilot\.microsoft\.com|copilot\.com|edgeservices\.bing\.com)$/],
  ['perplexity', /perplexity/, /(^|\.)perplexity\.ai$/],
  ['gemini', /gemini|bard/, /(^|\.)(gemini|bard)\.google\.com$/],
  ['claude', /claude|anthropic/, /(^|\.)claude\.ai$/],
  ['meta_ai', /meta[ ._-]?ai/, /(^|\.)meta\.ai$/],
  ['grok', /grok|^x\.?ai$/, /(^|\.)(grok\.com|x\.ai)$/],
  ['le_chat', /mistral|le ?chat/, /(^|\.)chat\.mistral\.ai$/],
  ['deepseek', /deepseek/, /(^|\.)deepseek\.com$/],
  ['you', /^you(\.com)?$|youcom/, /(^|\.)you\.com$/],
  ['phind', /phind/, /(^|\.)phind\.com$/],
  ['kagi', /kagi/, /(^|\.)kagi\.com$/],
]

/** Okänd AI: utm-fält som säger AI utan att namnge en känd assistent. */
const AI_OKAND = /^(ai|llm|chatbot|ai[ _-]?(assistent|assistant|chat|chatbot|search|sok))$/

/** Vilken AI-assistent förfrågan kom från (utm_source, utm_medium, referrerns domän), annars null. */
export function aiKallaFor(kalla: string, medium: string, extern: string): AiKalla | null {
  for (const [nyckel, utm, doman] of AI_KANDA) {
    if ((kalla && utm.test(kalla)) || (extern && doman.test(extern))) return nyckel
  }
  // Den tidigare breda igenkänningen (delsträng) behålls så att inget som var AI slutar vara det
  if (AI.test(kalla) || AI.test(extern) || AI_OKAND.test(kalla) || AI_OKAND.test(medium)) return 'annan'
  return null
}

export function arAiKalla(s: string): s is AiKalla {
  return Object.prototype.hasOwnProperty.call(AI_KALLA_LABEL, s)
}

// ---------- Hänvisningar ----------

/**
 * Kända hänvisande webbplatser: [nyckel, visningsnamn, mönster för utm_source, mönster för domänen].
 * Allt annat visas som domänen utan www (eller utm_source när domän saknas).
 */
const HANVISNING_KANDA: Array<[string, string, RegExp, RegExp]> = [
  ['trustpilot', 'Trustpilot', /trustpilot/, /(^|\.)trustpilot\.com$/],
  ['reco', 'Reco', /^reco(\.se)?$/, /(^|\.)reco\.se$/],
  ['offerta', 'Offerta', /offerta/, /(^|\.)offerta\.se$/],
  ['servicefinder', 'Servicefinder', /servicefinder/, /(^|\.)servicefinder\.se$/],
  ['byggahus', 'Byggahus.se', /byggahus/, /(^|\.)byggahus\.se$/],
  ['allabolag', 'Allabolag', /allabolag/, /(^|\.)allabolag\.se$/],
  ['merinfo', 'Merinfo', /merinfo/, /(^|\.)merinfo\.se$/],
  ['ratsit', 'Ratsit', /ratsit/, /(^|\.)ratsit\.se$/],
  ['hemnet', 'Hemnet', /hemnet/, /(^|\.)hemnet\.se$/],
  ['blocket', 'Blocket', /blocket/, /(^|\.)blocket\.se$/],
  ['wikipedia', 'Wikipedia', /wikipedia/, /(^|\.)wikipedia\.org$/],
]

/** Hänvisningens källa: nyckel för filter och gruppering samt visningsnamn. */
export function hanvisningKallaFor(kalla: string, utmRa: string, extern: string): { nyckel: string; namn: string } {
  for (const [nyckel, namn, utm, doman] of HANVISNING_KANDA) {
    if ((extern && doman.test(extern)) || (kalla && utm.test(kalla))) return { nyckel, namn }
  }
  if (extern) return { nyckel: extern, namn: extern }
  return { nyckel: kalla, namn: utmRa.trim() || kalla }
}

/** Kanaler som delas upp i källor (AI-assistent per assistent, Hänvisning per webbplats). */
export const UNDERDELADE = ['ai', 'hanvisning'] as const
export type UnderdeladKanal = (typeof UNDERDELADE)[number]

export function arUnderdelad(k: string): k is UnderdeladKanal {
  return (UNDERDELADE as readonly string[]).includes(k)
}

/** Visningsnamn för en källnyckel inom en kanal (för filtertexten, där bara nyckeln finns). */
export function underkallaNamn(kanal: UnderdeladKanal, nyckel: string): string {
  if (kanal === 'ai') return arAiKalla(nyckel) ? AI_KALLA_LABEL[nyckel] : nyckel
  return HANVISNING_KANDA.find(([k]) => k === nyckel)?.[1] ?? nyckel
}

/** Rubrik för källorna inom en kanal. */
export const UNDERKALLA_RUBRIK: Record<UnderdeladKanal, string> = { ai: 'AI-assistent', hanvisning: 'Hänvisande källa' }

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
  /** Vilken AI-assistent, bara när kanalen är ai. */
  aiKalla?: AiKalla
  /** Källan inom kanalen (assistenten eller den hänvisande webbplatsen), bara för ai och hanvisning. */
  under?: { nyckel: string; namn: string }
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
  const ai = aiKallaFor(kalla, medium, extern)
  if (ai) return { kanal: 'ai', detalj: i.utm_source || extern, aiKalla: ai, under: { nyckel: ai, namn: AI_KALLA_LABEL[ai] } }
  if (medium === 'email' || medium === 'e-post' || medium === 'epost' || /nyhetsbrev|newsletter/.test(kalla)) {
    return { kanal: 'epost', detalj: i.utm_source || '' }
  }
  if (medium === 'social' || SOCIAL.test(kalla) || SOCIAL.test(extern)) return { kanal: 'social', detalj: i.utm_source || extern }
  if (medium === 'organic' || SOK.test(extern) || SOK.test(`${kalla}.`)) return { kanal: 'organiskt', detalj: extern || i.utm_source || '' }
  if (extern) return { kanal: 'hanvisning', detalj: extern, under: hanvisningKallaFor(kalla, i.utm_source ?? '', extern) }
  if (kalla) return { kanal: 'hanvisning', detalj: i.utm_source ?? '', under: hanvisningKallaFor(kalla, i.utm_source ?? '', '') }
  return { kanal: 'direkt', detalj: '' }
}
