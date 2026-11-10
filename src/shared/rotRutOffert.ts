// src/shared/rotRutOffert.ts
// ROT och RUT hela vägen från offert till Fortnox (3.127.0). Ren modul utan
// databas: samma regler och samma avrundning i wizarden (förhandsvisning,
// listan "Kvar innan du kan gå vidare"), servern (api/oneflow/create-contract.ts
// räknar om själv och litar inte på klienten) och fakturan (avdraget).
//
// Beslut (Christian 2026-11-10):
//   - ROT 30 %, RUT 50 % av arbetskostnaden INKL. moms. Mallen bestämmer typen.
//   - Bara privatpersoner med giltigt personnummer (10 eller 12 siffror, rätt kontrollsiffra).
//   - Kunden ser priserna inkl. moms.
//   - Raderna i en ROT/RUT-mall: ärendets tjänst står kvar på 0 kr och visas som
//     rubrik "Avser: <tjänst>". Kundraderna är fyra fasta tjänster:
//       135 Skadedjurstekniker timpris -> "Arbetskostnad", 1 st, bär avdraget
//       120 Material & Utrustning      -> "Material och utrustning"
//       143 Servicebil                 -> "Servicebil" (pris för hand)
//       145 Övriga kostnader           -> "Övriga kostnader"
//   - Interna kostnader mappas mot raderna, automatiskt efter kategori.
//   - Timmarna (summan av ROT/RUT-markerad Arbetstid på arbetsraden) går till
//     Skatteverket via Fortnox och visas aldrig för kunden.
//   - Rader på 0 kr visas inte för kunden.
//
// Avrundning, samma överallt: varje rad avrundas till hela kronor inkl. moms
// (Math.round), avdraget avrundas NEDÅT till hela kronor (Math.floor) så att
// begärt avdrag aldrig blir högre än Skatteverkets regel tillåter.

export type Avdrag = 'ROT' | 'RUT'

export const ROT_RUT_PROCENT: Record<Avdrag, number> = { ROT: 30, RUT: 50 }

/** Typ av arbete till Skatteverket via Fortnox. ROT alltid byggarbete, RUT alltid samma typ. */
export const HUSARBETE_TYP: Record<Avdrag, string> = { ROT: 'CONSTRUCTION', RUT: 'CLEANING' }

export type RadRoll = 'arbete' | 'material' | 'servicebil' | 'ovrigt'

/** Tjänstekoderna i katalogen för de fyra kundraderna. */
export const ROT_RUT_TJANSTKOD: Record<RadRoll, string> = {
  arbete: '135',
  material: '120',
  servicebil: '143',
  ovrigt: '145',
}

export const ROT_RUT_ROLLER: RadRoll[] = ['arbete', 'material', 'servicebil', 'ovrigt']

/** Radens namn för kunden (Oneflow, granskningen, fakturan). */
export const KUNDNAMN: Record<RadRoll, string> = {
  arbete: 'Arbetskostnad',
  material: 'Material och utrustning',
  servicebil: 'Servicebil',
  ovrigt: 'Övriga kostnader',
}

export function rollForKod(code: string | null | undefined): RadRoll | null {
  const c = String(code ?? '').trim()
  for (const r of ROT_RUT_ROLLER) if (ROT_RUT_TJANSTKOD[r] === c) return r
  return null
}

/** Automatisk mappning av en intern kostnad efter artikelns kategori. */
export function rollForKategori(category: string | null | undefined): RadRoll {
  switch (category) {
    case 'Arbetstid':
      return 'arbete'
    case 'Underentreprenör':
    case 'Övrigt':
      return 'ovrigt'
    default:
      // Bekämpning, Tillbehör, Inspektion och okända
      return 'material'
  }
}

export function mallensTyp(deduction: string | null | undefined): Avdrag | null {
  return deduction === 'ROT' || deduction === 'RUT' ? deduction : null
}

export const andraTypen = (t: Avdrag): Avdrag => (t === 'ROT' ? 'RUT' : 'ROT')

// ─── Belopp ─────────────────────────────────────────────────────────────────

/** Belopp inkl. moms i hela kronor ur ett belopp exkl. moms. */
export function inklMoms(exkl: number, vatRate = 25): number {
  const n = Number(exkl)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * (1 + (Number(vatRate) || 0) / 100))
}

/** Belopp exkl. moms (två decimaler) som blir exakt `inkl` hela kronor med moms. */
export function exklFranInkl(inkl: number, vatRate = 25): number {
  const n = Math.round(Number(inkl) || 0)
  return Math.round((n / (1 + (Number(vatRate) || 0) / 100)) * 100) / 100
}

/** Avdraget i hela kronor (nedåt). */
export function avdragKr(arbetskostnadInkl: number, typ: Avdrag): number {
  return Math.max(0, Math.floor((Number(arbetskostnadInkl) || 0) * ROT_RUT_PROCENT[typ] / 100))
}

/** "12 000 kr" med vanliga mellanslag (inte Intl:s hårda), för Oneflow och Fortnox. */
export function kr(n: number): string {
  return `${Math.round(n).toLocaleString('sv-SE').replace(/\s/g, ' ')} kr`
}

// ─── Sammanställningen kunden ser ───────────────────────────────────────────

export interface OffertTjanstRad {
  id: string
  roll: RadRoll | null
  service_name?: string | null
  /** Radens summa exkl. moms (efter ev. rabatt) */
  total_price: number
  vat_rate?: number | null
  rot_rut_type?: Avdrag | null
  house_work_hours?: number | null
}

export interface KundRad {
  roll: RadRoll
  namn: string
  /** Belopp inkl. moms, hela kronor */
  belopp: number
  avdrag: boolean
}

export interface RotRutSammanstallning {
  typ: Avdrag
  procent: number
  /** Rubriken: ärendets tjänst(er), t.ex. "Tätning gnagare" */
  avser: string | null
  /** Raderna kunden ser, i ordning, utan rader på 0 kr */
  rader: KundRad[]
  totaltInkl: number
  arbetskostnadInkl: number
  materialOvrigtInkl: number
  momsKr: number
  totaltExkl: number
  avdrag: number
  attBetala: number
  /** Internt: timmar till Skatteverket */
  timmar: number
}

export function sammanstallRotRut(rader: OffertTjanstRad[], typ: Avdrag): RotRutSammanstallning {
  const avserNamn = rader
    .filter(r => r.roll === null)
    .map(r => (r.service_name ?? '').trim())
    .filter(Boolean)
  const kundRader: KundRad[] = []
  for (const roll of ROT_RUT_ROLLER) {
    const egna = rader.filter(r => r.roll === roll)
    if (egna.length === 0) continue
    const belopp = egna.reduce((s, r) => s + inklMoms(r.total_price, r.vat_rate ?? 25), 0)
    if (belopp === 0) continue
    kundRader.push({ roll, namn: KUNDNAMN[roll], belopp, avdrag: roll === 'arbete' })
  }
  const totaltInkl = kundRader.reduce((s, r) => s + r.belopp, 0)
  const arbetskostnadInkl = kundRader.filter(r => r.roll === 'arbete').reduce((s, r) => s + r.belopp, 0)
  const totaltExkl = Math.round(
    rader.filter(r => r.roll !== null).reduce((s, r) => s + (Number(r.total_price) || 0), 0) * 100
  ) / 100
  const avdrag = avdragKr(arbetskostnadInkl, typ)
  const timmar = rader
    .filter(r => r.roll === 'arbete')
    .reduce((s, r) => s + (Number(r.house_work_hours) || 0), 0)
  return {
    typ,
    procent: ROT_RUT_PROCENT[typ],
    avser: avserNamn.length > 0 ? Array.from(new Set(avserNamn)).join(', ') : null,
    rader: kundRader,
    totaltInkl,
    arbetskostnadInkl,
    materialOvrigtInkl: totaltInkl - arbetskostnadInkl,
    momsKr: Math.round((totaltInkl - totaltExkl) * 100) / 100,
    totaltExkl,
    avdrag,
    attBetala: totaltInkl - avdrag,
    timmar: Math.round(timmar * 100) / 100,
  }
}

/** Datafältet "pris" i Oneflow-mallen. */
export function prisText(s: RotRutSammanstallning): string {
  return `Totalt inkl. moms ${kr(s.totaltInkl)}, varav arbetskostnad ${kr(s.arbetskostnadInkl)}. ` +
    `${s.typ}-avdrag ${s.procent} %: -${kr(s.avdrag)}. Att betala: ${kr(s.attBetala)}.`
}

export const avserText = (avser: string | null): string | null => (avser ? `Avser: ${avser}` : null)

// ─── Identitet och fastighet ────────────────────────────────────────────────

const siffror = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '')

/** Kontrollsiffran (Luhn) på de tio sista siffrorna. */
function luhnOk(tio: string): boolean {
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let n = Number(tio[i]) * (i % 2 === 0 ? 2 : 1)
    if (n > 9) n -= 9
    sum += n
  }
  return sum % 10 === 0
}

/**
 * Personnumret med tolv siffror, ÅÅÅÅMMDD-XXXX, eller null om det inte är ett
 * giltigt personnummer (fel datum, fel kontrollsiffra eller org.nr). Tio
 * siffror (ÅÅMMDD-XXXX) får sekel efter ålder, "+" betyder 100 år eller äldre.
 */
export function personnummer12(pnr: string | null | undefined, idag: Date = new Date()): string | null {
  const d = siffror(pnr)
  let full: string
  if (d.length === 12) {
    full = d
  } else if (d.length === 10) {
    const aa = Number(d.slice(0, 2))
    const iAr = idag.getFullYear()
    let ar = Math.floor(iAr / 100) * 100 + aa
    if (ar > iAr) ar -= 100
    if (String(pnr ?? '').includes('+')) ar -= 100
    full = `${ar}${d.slice(2)}`
  } else {
    return null
  }
  const ar = Number(full.slice(0, 4))
  const man = Number(full.slice(4, 6))
  const dag = Number(full.slice(6, 8))
  if (ar < 1900 || ar > 2099) return null
  if (man < 1 || man > 12) return null
  // Samordningsnummer: dag + 60
  const verkligDag = dag > 60 ? dag - 60 : dag
  if (verkligDag < 1 || verkligDag > 31) return null
  if (!luhnOk(full.slice(2))) return null
  return `${full.slice(0, 8)}-${full.slice(8)}`
}

/** Giltigt personnummer (10 eller 12 siffror, rätt datum och kontrollsiffra). Inte org.nr. */
export function giltigtPersonnummer(pnr: string | null | undefined): boolean {
  return personnummer12(pnr) !== null
}

/** Org.nr (10 siffror, tredje siffran 2 eller högre). */
export function giltigtOrgNr(nr: string | null | undefined): boolean {
  const d = siffror(nr)
  const tio = d.length === 12 ? d.slice(2) : d
  return tio.length === 10 && Number(tio[2]) >= 2
}

/** "ÅÅMMDD-XXXX" för visning internt (aldrig hela numret). */
export function maskeratPersonnummer(pnr: string | null | undefined): string {
  const d = siffror(pnr)
  if (d.length === 12) return `${d.slice(2, 8)}-XXXX`
  if (d.length === 10) return `${d.slice(0, 6)}-XXXX`
  return pnr ? 'XXXXXX-XXXX' : ''
}

/** Fastighetsbeteckning med kolon, t.ex. "Exempelby 1:23". */
export function giltigFastighetsbeteckning(f: string | null | undefined): boolean {
  // Ett namn (kommun och/eller område) följt av block:enhet, t.ex. "1:23" eller "1:23A"
  return /[^\s\d:]\S*\s+\d+:\d+/.test(String(f ?? '').trim())
}

export interface Fastighet {
  brf: boolean
  fastighetsbeteckning?: string | null
  brfOrgNr?: string | null
  lagenhetsnummer?: string | null
}

export function fastighetKlar(f: Fastighet): boolean {
  if (f.brf) return giltigtOrgNr(f.brfOrgNr) && !!String(f.lagenhetsnummer ?? '').trim()
  return giltigFastighetsbeteckning(f.fastighetsbeteckning)
}

/** Texten i Oneflows fält "fastighetsbeteckning" (BRF: föreningens org.nr och lgh-nr). */
export function fastighetText(f: Fastighet): string {
  if (f.brf) {
    return `Bostadsrätt, föreningens org.nr ${String(f.brfOrgNr ?? '').trim()}, lägenhet ${String(f.lagenhetsnummer ?? '').trim()}`
  }
  return String(f.fastighetsbeteckning ?? '').trim()
}

// ─── Spärrarna ──────────────────────────────────────────────────────────────

export interface KontrollArtikel {
  id: string
  namn: string
  category?: string | null
  /** Tjänsteradens id artikeln är mappad mot (null = ingen) */
  mappadMot: string | null
  rot_rut_type?: Avdrag | null
  quantity: number
}

export interface RotRutKontrollIndata {
  mall: Avdrag
  partTyp: 'company' | 'individual'
  personnummer: string
  fastighet: Fastighet
  tjanster: OffertTjanstRad[]
  artiklar: KontrollArtikel[]
  /** Offertinnehållet (fritexten) */
  fritext: string
}

export type BristKod =
  | 'privat' | 'personnummer' | 'arbete' | 'fastighet' | 'blandning'
  | 'mappning' | 'arbete_ej_avdrag' | 'avser' | 'fritext'

export interface RotRutBrist {
  kod: BristKod
  text: string
}

/** Arbetstidens timmar med mallens typ, mappade mot arbetsraden(erna). */
export function timmarForArbete(artiklar: KontrollArtikel[], arbetsradIds: Set<string>, typ: Avdrag): number {
  const t = artiklar
    .filter(a => a.mappadMot && arbetsradIds.has(a.mappadMot) && a.category === 'Arbetstid' && a.rot_rut_type === typ)
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0)
  return Math.round(t * 100) / 100
}

/** Nämner texten den andra avdragstypen? Enkel kontroll på ordet (ROT/RUT, rotavdrag, rut-avdrag). */
export function namnerAndraTypen(text: string, typ: Avdrag): boolean {
  const andra = andraTypen(typ)
  const re = new RegExp(`(^|[^A-Za-zÅÄÖåäö])(${andra}|${andra.toLowerCase()}-?avdrag|${andra[0]}${andra.slice(1).toLowerCase()}-?avdrag)([^A-Za-zÅÄÖåäö]|$)`)
  return re.test(text ?? '')
}

/**
 * Det som stoppar offerten, i den ordning listan visas. Tom lista = klart.
 * Samma funktion i wizarden och på servern.
 */
export function rotRutBrister(d: RotRutKontrollIndata): RotRutBrist[] {
  const ut: RotRutBrist[] = []
  const typ = d.mall
  const andra = andraTypen(typ)

  const arbetsrader = d.tjanster.filter(t => t.roll === 'arbete')
  const arbetsIds = new Set(arbetsrader.map(t => t.id))
  const timmar = timmarForArbete(d.artiklar, arbetsIds, typ)
  const arbetsBelopp = arbetsrader.reduce((s, r) => s + inklMoms(r.total_price, r.vat_rate ?? 25), 0)
  if (arbetsrader.length === 0 || timmar <= 0 || arbetsBelopp <= 0) {
    ut.push({
      kod: 'arbete',
      text: arbetsrader.length === 0
        ? 'Raden Arbetskostnad saknas'
        : timmar <= 0
          ? `Arbetstid med ${typ} saknas`
          : 'Arbetskostnaden är 0 kr',
    })
  }

  const ejAvdrag = d.artiklar.filter(a =>
    a.mappadMot && arbetsIds.has(a.mappadMot) && !(a.category === 'Arbetstid' && a.rot_rut_type === typ)
  )
  if (ejAvdrag.length > 0) {
    ut.push({
      kod: 'arbete_ej_avdrag',
      text: `Bara arbetstid med ${typ} hör till Arbetskostnad: ${Array.from(new Set(ejAvdrag.map(a => a.namn))).join(', ')}`,
    })
  }

  const tjanstIds = new Set(d.tjanster.filter(t => t.roll !== null).map(t => t.id))
  const omappade = d.artiklar.filter(a => !a.mappadMot || !tjanstIds.has(a.mappadMot))
  if (omappade.length > 0) {
    ut.push({ kod: 'mappning', text: 'Alla interna kostnader ligger på en rad' })
  }

  const blandade = d.tjanster.some(t => t.rot_rut_type && t.rot_rut_type !== typ)
    || d.artiklar.some(a => a.rot_rut_type && a.rot_rut_type !== typ)
    || d.tjanster.some(t => t.rot_rut_type && t.roll !== 'arbete')
  if (blandade) {
    ut.push({ kod: 'blandning', text: `Mallen gäller bara ${typ}. Ta bort ${andra} och avdrag på andra rader än Arbetskostnad` })
  }

  const avserMedPris = d.tjanster.filter(t => t.roll === null && Math.abs(Number(t.total_price) || 0) >= 0.005)
  if (avserMedPris.length > 0) {
    ut.push({
      kod: 'avser',
      text: `Ärendets tjänst ska ha 0 kr: ${Array.from(new Set(avserMedPris.map(t => t.service_name || 'Tjänst'))).join(', ')}`,
    })
  }

  if (!fastighetKlar(d.fastighet)) {
    const f = d.fastighet
    const tomt = f.brf ? !String(f.brfOrgNr ?? '').trim() && !String(f.lagenhetsnummer ?? '').trim() : !String(f.fastighetsbeteckning ?? '').trim()
    ut.push({
      kod: 'fastighet',
      text: f.brf
        ? (tomt ? 'Föreningens org.nr och lägenhetsnummer saknas' : 'Föreningens org.nr eller lägenhetsnumret ser fel ut')
        : (tomt ? 'Fastighetsbeteckning saknas' : 'Fastighetsbeteckningen ser fel ut'),
    })
  }

  if (d.partTyp !== 'individual') {
    ut.push({ kod: 'privat', text: 'Bara privatpersoner kan få ROT eller RUT' })
  } else if (!giltigtPersonnummer(d.personnummer)) {
    ut.push({
      kod: 'personnummer',
      text: !siffror(d.personnummer) ? 'Personnummer saknas' : 'Personnumret ser fel ut eller är ett org.nr',
    })
  }

  if (namnerAndraTypen(d.fritext, typ)) {
    ut.push({ kod: 'fritext', text: `Offertinnehållet nämner ${andra}, men mallen gäller ${typ}` })
  }

  return ut
}

// ─── Fakturan ───────────────────────────────────────────────────────────────

export interface FakturaRadKalla {
  item_type?: string | null
  service_code?: string | null
  rot_rut_type?: string | null
  house_work_hours?: number | null
  labor_for_item_id?: string | null
}

/**
 * Ärendet är byggt med ROT/RUT-offertens radmodell (3.127.0): arbetsraden
 * (tjänst 135) bär avdraget och timmarna, utan koppling till en tjänsterad.
 * Gamla uppdelningar (labor_for_item_id) och gamla ärenden räknas inte.
 */
export function arRotRutRadmodell(rader: FakturaRadKalla[]): boolean {
  return rader.some(r =>
    (r.item_type ?? 'service') === 'service'
    && !!r.rot_rut_type
    && !r.labor_for_item_id
    && rollForKod(r.service_code) === 'arbete'
    && r.house_work_hours != null
  )
}

/** Fakturaradens namn och typ i radmodellen. Avser-rubriken blir textrad utan pris. */
export function fakturaRadIRadmodell(rad: {
  service_code?: string | null
  service_name?: string | null
  article_name?: string | null
  total_price: number
}): { namn: string; textrad: boolean } {
  const roll = rollForKod(rad.service_code)
  if (roll) return { namn: KUNDNAMN[roll], textrad: false }
  if (Math.abs(Number(rad.total_price) || 0) < 0.005) {
    return { namn: `Avser: ${rad.service_name || rad.article_name || 'Tjänst'}`, textrad: true }
  }
  return { namn: rad.service_name || rad.article_name || 'Tjänst', textrad: false }
}

/** Avdraget på en faktura: arbetsraderna (rot_rut_type) inkl. moms, hela kronor, nedåt. */
export function fakturaAvdrag(items: Array<{ rot_rut_type?: string | null; total_price: number; vat_rate?: number | null }>, typ: Avdrag): {
  arbetskostnadInkl: number
  avdrag: number
} {
  const arbetskostnadInkl = items
    .filter(i => i.rot_rut_type === typ)
    .reduce((s, i) => s + inklMoms(i.total_price, i.vat_rate ?? 25), 0)
  return { arbetskostnadInkl, avdrag: avdragKr(arbetskostnadInkl, typ) }
}

/** Timmar till Fortnox: house_work_hours, annars antal (äldre rader). Heltal, minst 1. */
export function timmarTillFortnox(rad: { house_work_hours?: number | null; quantity: number }): number {
  const h = rad.house_work_hours != null ? Number(rad.house_work_hours) : Number(rad.quantity)
  if (!Number.isFinite(h) || h <= 0) return 1
  return Math.max(1, Math.round(h))
}

/**
 * Det som saknas för att en ROT/RUT-faktura ska kunna skickas till Fortnox.
 * Saknas något stoppas fakturan, avdraget tas aldrig bort i tysthet.
 */
export function fakturaBrister(d: {
  typ: Avdrag
  privat: boolean
  personnummer: string | null | undefined
  fastighet: Fastighet
  utforandeAdress: string | null | undefined
  utforandeDatum: string | null | undefined
  harArbetsrad: boolean
}): string[] {
  const ut: string[] = []
  if (!d.privat) ut.push('Bara privatpersoner kan få ROT eller RUT')
  else if (!giltigtPersonnummer(d.personnummer)) ut.push('Giltigt personnummer saknas på fakturan')
  if (!fastighetKlar(d.fastighet)) {
    ut.push(d.fastighet.brf ? 'Föreningens org.nr eller lägenhetsnummer saknas' : 'Fastighetsbeteckning saknas eller ser fel ut')
  }
  if (!d.harArbetsrad) ut.push(`Ingen rad bär ${d.typ}-avdraget`)
  if (!String(d.utforandeAdress ?? '').trim()) ut.push('Utförandeadress saknas på ärendet')
  if (!String(d.utforandeDatum ?? '').trim()) ut.push('Datum för arbetet saknas på ärendet')
  return ut
}

// ─── Kontroll mot Oneflow (webhooken) ───────────────────────────────────────

export interface RotRutForvantat {
  rader: Array<{ namn: string; belopp: number }>
  totalt_inkl?: number
}

/**
 * Jämför Oneflows produkter (namn och synligt belopp efter rabatt gånger antal)
 * med raderna portalen skickade. null = stämmer, annars en text för portalen.
 */
export function jamforMedOneflow(
  forvantat: RotRutForvantat | null | undefined,
  oneflowRader: Array<{ name: string; total: number }>
): string | null {
  if (!forvantat || !Array.isArray(forvantat.rader)) return null
  const fel: string[] = []
  const kvar = [...oneflowRader]
  for (const r of forvantat.rader) {
    const idx = kvar.findIndex(o => o.name.trim() === r.namn)
    if (idx < 0) {
      fel.push(`${r.namn} saknas i Oneflow`)
      continue
    }
    const o = kvar.splice(idx, 1)[0]
    if (Math.abs(Math.round(o.total) - r.belopp) >= 1) {
      fel.push(`${r.namn} är ${kr(o.total)} i Oneflow, portalen ${kr(r.belopp)}`)
    }
  }
  for (const o of kvar) fel.push(`${o.name || 'En rad'} finns bara i Oneflow (${kr(o.total)})`)
  return fel.length > 0 ? `Oneflow stämmer inte med portalen: ${fel.join('. ')}.` : null
}

/**
 * Privatpersonens nummer på en faktura: 12 siffror (giltigt personnummer) eller
 * äldre 10 siffror där tredje siffran är månadens första (0 eller 1).
 * Ett org.nr (tredje siffran 2 eller högre) är aldrig en privatperson.
 */
export function arPrivatpersonsNummer(nr: string | null | undefined): boolean {
  const d = siffror(nr)
  if (d.length === 12) return giltigtPersonnummer(d)
  return d.length === 10 && Number(d[2]) < 2
}

/** Fakturan är byggd med ROT/RUT-offertens radmodell (arbetsraden heter Arbetskostnad och bär timmarna). */
export function fakturaArRadmodell(items: Array<{ rot_rut_type?: string | null; house_work_hours?: number | null; article_name?: string | null }>): boolean {
  return items.some(i => !!i.rot_rut_type && i.house_work_hours != null && i.article_name === KUNDNAMN.arbete)
}
