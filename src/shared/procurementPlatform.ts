// src/shared/procurementPlatform.ts
// "Hämta underlaget" (beslut 3, docs/upphandlingsportal-ux-plan.md): vilken
// sida som ska öppnas för att ladda ner förfrågningsunderlaget. Ren logik
// utan nätverk, delas av klient och tester.
//
// Ordning:
//   1. notice.document_url, källans egen dokumentlänk. Plattformen läses ur
//      värdnamnet (e-Avrop, TendSign, Kommers med flera).
//   2. Kommers-synkens egen annonssida (procurement_notice_sources.url för
//      source 'kommers').
//   3. Annonsen på TED (platform_url eller källpostens url), där dokumenten
//      länkas från annonsen.
//   4. Mercells annonssida (källpostens url, https://app.mercell.com/tender/{id}).
//
// Länkar byggs ALDRIG ur Mercells sourceId/sourceNoticeId. Kontrollerat mot
// databasen 2026-10-15: e-Avrops dokumentlänk har formen
// e-avrop.com/{kund}/e-Upphandling/NoticeLink.aspx?id={X} där både kund och X
// skiljer sig från sourceNoticeId (74288 mot id=138486), och Kommers
// NoticeDispatch.aspx?NoticeId=95845 hör till sourceNoticeId 72970. TendSign
// (MeForm) har inget id i dokumentlänken som går att härleda. Ett påhittat
// format skulle ge fel sida, så då länkas annonsen i stället.

export type PlatformKey = 'e-avrop' | 'tendsign' | 'kommers' | 'ted' | 'mercell' | 'other'

export interface DocumentLink {
  url: string
  platform: PlatformKey
  /** Plattformens namn för knapptext och toast */
  platformLabel: string
  /** document = dokumentsidan, notice = annonsen (dokumenten nås därifrån) */
  kind: 'document' | 'notice'
}

export interface PlatformSourceInput {
  source: string
  source_sub?: string | null
  url: string | null
}

export interface PlatformNoticeInput {
  document_url: string | null
  platform_url: string | null
  sources?: PlatformSourceInput[] | null
}

export const PLATFORM_LABEL: Record<PlatformKey, string> = {
  'e-avrop': 'e-Avrop',
  tendsign: 'TendSign',
  kommers: 'Kommers',
  ted: 'TED',
  mercell: 'Mercell',
  other: 'köparens plattform',
}

function hostOf(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

/** Plattform ur en adress. Kommers vita etiketter (leverantorsportal.*) känns igen på NoticeDispatch.aspx. */
export function platformOfUrl(url: string | null | undefined): PlatformKey | null {
  if (!url) return null
  const host = hostOf(url)
  if (!host) return null
  if (host === 'e-avrop.com' || host.endsWith('.e-avrop.com')) return 'e-avrop'
  if (host === 'tendsign.com' || host.endsWith('.tendsign.com')) return 'tendsign'
  if (host === 'kommersannons.se' || host.endsWith('.kommersannons.se')) return 'kommers'
  if (/\/notice\/noticedispatch\.aspx/i.test(url)) return 'kommers'
  if (host === 'ted.europa.eu' || host.endsWith('.ted.europa.eu')) return 'ted'
  if (host === 'mercell.com' || host.endsWith('.mercell.com')) return 'mercell'
  return 'other'
}

function link(url: string, kind: DocumentLink['kind'], fallback: PlatformKey = 'other'): DocumentLink {
  const platform = platformOfUrl(url) ?? fallback
  return { url, platform, platformLabel: PLATFORM_LABEL[platform], kind }
}

/** Sidan att öppna för underlaget, eller null när upphandlingen saknar länkar */
export function documentLinkFor(n: PlatformNoticeInput): DocumentLink | null {
  if (n.document_url && hostOf(n.document_url)) return link(n.document_url, 'document')

  const sources = (n.sources ?? []).filter((s) => s.url && hostOf(s.url))
  const kommers = sources.find((s) => s.source === 'kommers')
  if (kommers?.url) return link(kommers.url, 'notice', 'kommers')

  // En köparplattform som inte är TED eller Mercell i platform_url räknas som dokumentsida
  const platform = n.platform_url && hostOf(n.platform_url) ? platformOfUrl(n.platform_url) : null
  if (n.platform_url && platform && platform !== 'ted' && platform !== 'mercell') return link(n.platform_url, 'document')
  if (n.platform_url && platform === 'ted') return link(n.platform_url, 'notice')

  const ted = sources.find((s) => platformOfUrl(s.url) === 'ted')
  if (ted?.url) return link(ted.url, 'notice')
  const mercell = sources.find((s) => s.source === 'mercell')
  if (mercell?.url) return link(mercell.url, 'notice', 'mercell')
  const any = sources[0]
  return any?.url ? link(any.url, 'notice') : null
}

/** Originalannonsen för ikonknappen i sidhuvudet: TED eller källans annonssida, annars dokumentsidan */
export function originalNoticeUrl(n: PlatformNoticeInput): string | null {
  const sources = (n.sources ?? []).filter((s) => s.url && hostOf(s.url))
  const ted = sources.find((s) => platformOfUrl(s.url) === 'ted')
  if (ted?.url) return ted.url
  if (n.platform_url && hostOf(n.platform_url)) return n.platform_url
  const first = sources.find((s) => s.source !== 'manual' && s.source !== 'email')
  if (first?.url) return first.url
  return n.document_url && hostOf(n.document_url) ? n.document_url : null
}
