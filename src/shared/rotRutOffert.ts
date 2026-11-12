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
//     rubrik "Avser: <tjänst>". Fyra tjänster läggs till som förval:
//       135 Skadedjurstekniker timpris -> "Arbetskostnad", 1 st, bär avdraget
//       120 Material & Utrustning      -> "Material och utrustning"
//       143 Servicebil                 -> "Servicebil"
//       145 Övriga kostnader           -> "Övriga kostnader"
//   - Ändrat 2026-11-12 (3.131.0): ROT/RUT-läget fungerar som vanligt läge.
//     Varje rad har pris, antal och papperskorg (Arbetskostnad går inte att ta
//     bort). Interna kostnader mappas av användaren i prisguiden, inget sker
//     automatiskt, och alla måste ligga på en rad. Mallen ger avdraget på all
//     Arbetstid som ligger på Arbetskostnad, användaren väljer det aldrig.
//     Tjänster som läggs till efter raderna (t.ex. Tippavgift) blir egna
//     prissatta rader utan avdrag (egen = true). Avser-rubriken gäller bara
//     tjänsterna som fanns innan raderna skapades (avserIds).
//   - Timmarna (summan av Arbetstid på arbetsraden) går till
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

/**
 * Raden en intern kostnad naturligt hör till efter artikelns kategori. Sedan
 * 3.131.0 mappas ingenting automatiskt, användaren mappar i prisguiden.
 */
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
  return `${Math.round(n).toLocaleString('sv-SE').replace(/\s/g, ' ').replace(/−/g, '-')} kr`
}

// ─── Sammanställningen kunden ser ───────────────────────────────────────────

export interface OffertTjanstRad {
  id: string
  roll: RadRoll | null
  /**
   * Bara när roll är null: true = egen prissatt rad utan avdrag (en tillagd
   * tjänst, t.ex. Tippavgift). false eller utelämnad = rubriken Avser på 0 kr.
   */
  egen?: boolean
  service_name?: string | null
  /** Radens summa exkl. moms (efter ev. rabatt) */
  total_price: number
  vat_rate?: number | null
  rot_rut_type?: Avdrag | null
  house_work_hours?: number | null
}

export interface KundRad {
  /** null = egen rad (tillagd tjänst) med katalogens namn */
  roll: RadRoll | null
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

/** Rubriken Avser: ingen roll och inte en egen rad */
export const arAvserRad = (r: Pick<OffertTjanstRad, 'roll' | 'egen'>): boolean => r.roll === null && !r.egen

export function sammanstallRotRut(rader: OffertTjanstRad[], typ: Avdrag): RotRutSammanstallning {
  const avserNamn = rader
    .filter(arAvserRad)
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
  // Egna rader (tillagda tjänster) efter de fyra, i den ordning de lades till
  for (const r of rader) {
    if (r.roll !== null || !r.egen) continue
    const belopp = inklMoms(r.total_price, r.vat_rate ?? 25)
    if (belopp === 0) continue
    kundRader.push({ roll: null, namn: (r.service_name ?? '').trim() || 'Tjänst', belopp, avdrag: false })
  }
  const totaltInkl = kundRader.reduce((s, r) => s + r.belopp, 0)
  const arbetskostnadInkl = kundRader.filter(r => r.roll === 'arbete').reduce((s, r) => s + r.belopp, 0)
  const totaltExkl = Math.round(
    rader.filter(r => !arAvserRad(r)).reduce((s, r) => s + (Number(r.total_price) || 0), 0) * 100
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
  return `${avdragsradNamn(s.typ)} på arbetskostnaden ${kr(s.arbetskostnadInkl)}: -${kr(s.avdrag)}. ` +
    `Att betala: ${kr(s.attBetala)}.`
}

// ─── Raderna i Oneflow (variant D, 3.127.5) ─────────────────────────────────
// Två priskolumner, ingen avdragsrad och ingen rabatt: "Pris inkl. moms"
// (price_1, radens fulla pris) och "Att betala efter ROT/RUT" (price_2, radens
// pris efter avdraget). Bara arbetsraden skiljer sig mellan kolumnerna, och
// avdraget står i dess beskrivning. Oneflow summerar båda kolumnerna (utkast
// 16810395/16810396). Avtalets värde (contracts.total_value) är summan av
// price_1, totalen före avdrag. Variant B (3.127.3) hade en avdragsrad med
// listpris 0 och rabatt. Sådana utkast känns fortfarande igen så att raden
// aldrig räknas in i värdet (arAvdragsradNamn, oneflowProductValue.ts).

/** Beskrivningskolumnen i Oneflow och granskningen */
export const KUNDBESKRIVNING: Record<RadRoll, string> = {
  arbete: 'Kostnad för arbetstid, inklusive planering, utförande och avslutande moment.',
  material: 'Kostnad för nödvändiga material och utrustning för uppdragets genomförande.',
  servicebil: 'Kostnad för drivmedel, slitage, tullavgifter och eventuell parkering.',
  ovrigt: 'Kostnad för underentreprenörer och hyrd utrustning.',
}

/** Kolumnrubrikerna i Oneflow. Varje prisrubrik blir även sin summas etikett. */
export const KOLUMN_PRIS = 'Pris inkl. moms'
export const KOLUMN_BESKRIVNING = 'Beskrivning'
/** "Att betala efter ROT" eller "Att betala efter RUT" */
export const kolumnEfterAvdrag = (typ: Avdrag): string => `Att betala efter ${typ}`

/** Rubriken på kolumnen efter avdrag, oavsett typ (känner igen ROT/RUT-offertens produktgrupp). */
export function arKolumnEfterAvdrag(label: string | null | undefined): boolean {
  return /^Att betala efter (ROT|RUT)$/.test(String(label ?? '').trim())
}

/** "ROT-avdrag 30 %" */
export const avdragsradNamn = (typ: Avdrag): string => `${typ}-avdrag ${ROT_RUT_PROCENT[typ]} %`

/** Variant B:s avdragsrad (3.127.3), "ROT-avdrag 30 %" eller "RUT-avdrag 50 %". Finns bara i äldre utkast. */
export function arAvdragsradNamn(name: string | null | undefined): boolean {
  return /^(ROT|RUT)-avdrag \d+ %$/.test(String(name ?? '').trim())
}

export interface OneflowRad {
  /** null = egen rad (tillagd tjänst): tom beskrivning, samma pris i båda kolumnerna */
  roll: RadRoll | null
  namn: string
  beskrivning: string
  /** Pris inkl. moms, hela kronor (price_1) */
  belopp: number
  /** Att betala efter avdraget, hela kronor (price_2). Samma som belopp utom på arbetsraden. */
  efterAvdrag: number
}

/** Arbetsradens beskrivning med avdraget, t.ex. "... ROT-avdrag 30 %: 3 600 kr." */
export function arbetsBeskrivning(s: RotRutSammanstallning): string {
  return s.avdrag > 0
    ? `${KUNDBESKRIVNING.arbete} ${avdragsradNamn(s.typ)}: ${kr(s.avdrag)}.`
    : KUNDBESKRIVNING.arbete
}

/** Raderna som de står i Oneflow: kundraderna med båda priskolumnerna. */
export function oneflowRader(s: RotRutSammanstallning): OneflowRad[] {
  let kvar = s.avdrag
  return s.rader.map(r => {
    // Avdraget dras på arbetsraden
    const dra = r.roll === 'arbete' ? Math.min(kvar, r.belopp) : 0
    kvar -= dra
    return {
      roll: r.roll,
      namn: r.namn,
      beskrivning: r.roll === 'arbete' ? arbetsBeskrivning(s) : r.roll ? KUNDBESKRIVNING[r.roll] : '',
      belopp: r.belopp,
      efterAvdrag: r.belopp - dra,
    }
  })
}

export const avserText = (avser: string | null): string | null => (avser ? `Avser: ${avser}` : null)

/** Produktgruppen som create-contract skickar till Oneflow (variant D). */
export interface OneflowProduktgrupp {
  products: Array<{
    name: string
    description: string
    price_1: { base_amount: { amount: string }; discount_amount: { amount: string } }
    price_2: { base_amount: { amount: string }; discount_amount: { amount: string } }
    quantity: { type: 'quantity'; amount: number }
    counterparty_lock: boolean
  }>
  configuration: {
    hide_price_summation: boolean
    counterpart_edit: boolean
    name?: { enabled: boolean; label: string }
    columns: Array<{ key: string; enabled: boolean; label: string }>
  }
}

/**
 * Kundraderna inkl. moms, hela kronor, 1 st, låsta för kunden. Två synliga
 * priskolumner: price_1 "Pris inkl. moms" och price_2 "Att betala efter
 * ROT/RUT". Rubriken "Avser: <tjänst>" är produktgruppens namn.
 */
export function oneflowProduktgrupp(s: RotRutSammanstallning): OneflowProduktgrupp {
  const pris = (belopp: number) => ({ base_amount: { amount: String(belopp) }, discount_amount: { amount: '0' } })
  const rubrik = avserText(s.avser)
  return {
    products: oneflowRader(s).map(r => ({
      name: r.namn,
      description: r.beskrivning,
      price_1: pris(r.belopp),
      price_2: pris(r.efterAvdrag),
      quantity: { type: 'quantity' as const, amount: 1 },
      counterparty_lock: true,
    })),
    configuration: {
      hide_price_summation: false,
      counterpart_edit: false,
      ...(rubrik ? { name: { enabled: true, label: rubrik } } : {}),
      columns: [
        // Mallarnas beskrivningskolumn heter "Avser", som krockar med rubriken
        // "Avser: <tjänst>" (utkast 16806487 visade "Avser: Inget avdrag").
        // Varje prisrubrik blir även sin summas etikett i Oneflow.
        { key: 'description', enabled: true, label: KOLUMN_BESKRIVNING },
        { key: 'price_1', enabled: true, label: KOLUMN_PRIS },
        { key: 'price_2', enabled: true, label: kolumnEfterAvdrag(s.typ) },
      ],
    },
  }
}

/** Det wizarden visar i Granska och sidokortet: samma rader, kolumner och summor som Oneflow. */
export interface RotRutForhandsvisning {
  rubrik: string | null
  kolumnPris: string
  kolumnEfterAvdrag: string
  rader: OneflowRad[]
  summaPris: number
  summaEfterAvdrag: number
  /** Datafältet "pris" i mallen */
  prisText: string
}

export function rotRutForhandsvisning(s: RotRutSammanstallning): RotRutForhandsvisning {
  const rader = oneflowRader(s)
  return {
    rubrik: avserText(s.avser),
    kolumnPris: KOLUMN_PRIS,
    kolumnEfterAvdrag: kolumnEfterAvdrag(s.typ),
    rader,
    // Oneflow summerar kolumnerna, så summan räknas på raderna
    summaPris: rader.reduce((sum, r) => sum + r.belopp, 0),
    summaEfterAvdrag: rader.reduce((sum, r) => sum + r.efterAvdrag, 0),
    prisText: prisText(s),
  }
}

/** Raden behöver id, roll och när den skapades */
export interface AvserKalla {
  id: string
  roll: RadRoll | null
  created_at?: string | null
}

const tidFor = (t: string | null | undefined): number | null => {
  if (!t) return null
  const n = Date.parse(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Raderna som är rubriken Avser: tjänster utan roll som fanns innan de fyra
 * raderna skapades (skapade före den tidigaste raden med roll). Finns ingen
 * rad med roll är alla tjänster utan roll Avser. En tjänst som läggs till
 * efter raderna är alltid en egen prissatt rad. Bygger bara på created_at,
 * så samma svar i ärendet (databasen) och i utkastet (lokala rader).
 */
export function avserIds(rader: AvserKalla[]): Set<string> {
  const rollTider = rader
    .filter(r => r.roll !== null)
    .map(r => tidFor(r.created_at))
    .filter((t): t is number => t !== null)
  const forsta = rollTider.length > 0 ? Math.min(...rollTider) : Infinity
  return new Set(
    rader
      .filter(r => r.roll === null && (tidFor(r.created_at) ?? -Infinity) < forsta)
      .map(r => r.id)
  )
}

/** En tjänsterad som wizarden har den (case_billing_items eller utkastets rader). */
export interface WizardTjanstKalla {
  id: string
  created_at?: string | null
  service_code?: string | null
  /** Katalogtjänsten. rot_eligible finns bara för att prefill-raderna (utan code) ska passa typen */
  service?: { code?: string | null; rot_eligible?: boolean | null } | null
  service_name?: string | null
  total_price: number | string | null
  vat_rate?: number | null
  rot_rut_type?: Avdrag | null
  house_work_hours?: number | null
}

/** Wizardens tjänsterader i ROT/RUT-läget. Rollen ur tjänstekoden. */
export function wizardTjanstRader(rader: WizardTjanstKalla[]): OffertTjanstRad[] {
  const roller = rader.map(i => ({
    id: i.id,
    roll: rollForKod(i.service_code ?? i.service?.code ?? null),
    created_at: i.created_at ?? null,
  }))
  const avser = avserIds(roller)
  return rader.map((i, idx) => ({
    id: i.id,
    roll: roller[idx].roll,
    egen: roller[idx].roll === null && !avser.has(i.id),
    service_name: i.service_name ?? null,
    total_price: Number(i.total_price || 0),
    vat_rate: i.vat_rate,
    rot_rut_type: i.rot_rut_type ?? null,
    house_work_hours: i.house_work_hours ?? null,
  }))
}

/** En tjänsterad som servern får i draftItems. */
export interface ServerTjanstKalla {
  draft_id?: string | null
  service_id?: string | null
  service_name?: string | null
  total_price: number | string | null
  vat_rate?: number | null
  rot_rut_type?: Avdrag | null
  /**
   * Klientens flagga (3.131.0, avserIds): true = rubriken Avser, false = egen
   * prissatt rad. Utelämnad (äldre klient) = Avser som före 3.131.0. En rad med
   * roll är aldrig Avser. Servern kontrollerar att Avser har 0 kr (rotRutBrister).
   */
  rot_avser?: boolean | null
}

/** Serverns tjänsterader. Rollen ur katalogens kod för service_id, klientens kod används inte. */
export function serverTjanstRader(rader: ServerTjanstKalla[], kodFor: (serviceId: string) => string | null | undefined): OffertTjanstRad[] {
  return rader.map((r, idx) => {
    const roll = r.service_id ? rollForKod(kodFor(r.service_id)) : null
    return {
      id: r.draft_id || `rad-${idx}`,
      roll,
      egen: roll === null && r.rot_avser === false,
      service_name: r.service_name ?? null,
      total_price: Number(r.total_price) || 0,
      vat_rate: r.vat_rate ?? 25,
      rot_rut_type: r.rot_rut_type ?? null,
    }
  })
}

/**
 * Offertinnehållet som Skriv förslag från tjänsterna ger i ROT/RUT-mallen:
 * kundraderna med pris, aldrig timmar, antal eller interna kostnader.
 * Rubriken Avser står ovanför prisraderna i Oneflow, inte här.
 */
export function rotRutForslagText(rader: OffertTjanstRad[], typ: Avdrag): string | null {
  const namn = sammanstallRotRut(rader, typ).rader.map(r => `- ${r.namn}`)
  return namn.length > 0 ? `Offerten omfattar:\n\n${namn.join('\n')}` : null
}

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

/** Fastighetsbeteckning, t.ex. "Exempelby 1:23" eller "Stockholm Fältskären 8". */
export function giltigFastighetsbeteckning(f: string | null | undefined): boolean {
  // Ett namn (kommun och/eller område) följt av nummer, med eller utan kolon:
  // "Exempelby 1:23", "1:23A" eller Stockholms form "STOCKHOLM FÄLTSKÄREN 8" (3.131.1)
  return /[A-Za-zÅÄÖåäöÉéÜü][^\d]*\s+\d+(:\d+)?\s?[A-Za-zÅÄÖåäö]?$/.test(String(f ?? '').trim())
}

export interface Fastighet {
  brf: boolean
  fastighetsbeteckning?: string | null
  brfOrgNr?: string | null
  lagenhetsnummer?: string | null
}

/**
 * Skatteverket kräver fastighetsbeteckning (eller bostadsrättens förening och
 * lägenhet) bara för ROT. RUT har ingen fastighet (3.127.4).
 */
export const fastighetKravs = (typ: string | null | undefined): boolean => typ === 'ROT'

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
  | 'mappning' | 'arbete_ej_avdrag' | 'arbete_fel_rad' | 'avser' | 'fritext'

export interface RotRutBrist {
  kod: BristKod
  text: string
}

/**
 * Timmarna till Skatteverket: all Arbetstid mappad mot arbetsraden(erna).
 * Sedan 3.131.0 styr mallen avdraget, användaren väljer det aldrig, så
 * artikelns rot_rut_type spelar ingen roll här.
 */
export function timmarForArbete(artiklar: KontrollArtikel[], arbetsradIds: Set<string>): number {
  const t = artiklar
    .filter(a => a.mappadMot && arbetsradIds.has(a.mappadMot) && a.category === 'Arbetstid')
    .reduce((s, a) => s + (Number(a.quantity) || 0), 0)
  return Math.round(t * 100) / 100
}

/** Nämner texten den andra avdragstypen? Enkel kontroll på ordet (ROT/RUT, rotavdrag, rut-avdrag). */
export function namnerAndraTypen(text: string, typ: Avdrag): boolean {
  const andra = andraTypen(typ)
  const re = new RegExp(`(^|[^A-Za-zÅÄÖåäö])(${andra}|${andra.toLowerCase()}-?avdrag|${andra[0]}${andra.slice(1).toLowerCase()}-?avdrag)([^A-Za-zÅÄÖåäö]|$)`)
  return re.test(text ?? '')
}

const namnLista = (a: KontrollArtikel[]) => Array.from(new Set(a.map(x => x.namn))).join(', ')

/**
 * Det som stoppar offerten, i den ordning listan visas. Tom lista = klart.
 * Samma funktion i wizarden och på servern.
 *
 * 3.131.0 (Christian 2026-11-12): mallen ger avdraget på all Arbetstid som
 * ligger på Arbetskostnad. Spärrar kring arbetet: Arbetstid bara på
 * Arbetskostnad, inget annat än Arbetstid på Arbetskostnad, minst en timme på
 * Arbetskostnad. Alla interna kostnader ska ligga på en rad (mappas i prisguiden).
 */
export function rotRutBrister(d: RotRutKontrollIndata): RotRutBrist[] {
  const ut: RotRutBrist[] = []
  const typ = d.mall
  const andra = andraTypen(typ)

  const arbetsrader = d.tjanster.filter(t => t.roll === 'arbete')
  const arbetsIds = new Set(arbetsrader.map(t => t.id))
  // Rader en intern kostnad kan ligga på: alla utom rubriken Avser
  const radIds = new Set(d.tjanster.filter(t => !arAvserRad(t)).map(t => t.id))
  const timmar = timmarForArbete(d.artiklar, arbetsIds)
  const arbetsBelopp = arbetsrader.reduce((s, r) => s + inklMoms(r.total_price, r.vat_rate ?? 25), 0)
  if (arbetsrader.length === 0 || timmar <= 0 || arbetsBelopp <= 0) {
    ut.push({
      kod: 'arbete',
      text: arbetsrader.length === 0
        ? 'Raden Arbetskostnad saknas'
        : timmar <= 0
          ? 'Arbetstid saknas på Arbetskostnad. Mappa arbetstiden mot Arbetskostnad i prisguiden'
          : 'Arbetskostnaden är 0 kr',
    })
  }

  // Annat än arbetstid på Arbetskostnad skulle ge avdrag på material
  const ejArbete = d.artiklar.filter(a => a.mappadMot && arbetsIds.has(a.mappadMot) && a.category !== 'Arbetstid')
  if (ejArbete.length > 0) {
    ut.push({
      kod: 'arbete_ej_avdrag',
      text: `Bara arbetstid hör till Arbetskostnad: ${namnLista(ejArbete)}. Mappa om i prisguiden`,
    })
  }

  // Arbetstid på en annan rad: timmarna och avdraget skulle tappas
  const felRad = d.artiklar.filter(a =>
    a.category === 'Arbetstid' && a.mappadMot && radIds.has(a.mappadMot) && !arbetsIds.has(a.mappadMot)
  )
  if (felRad.length > 0) {
    ut.push({
      kod: 'arbete_fel_rad',
      text: `Arbetstid ska ligga på Arbetskostnad: ${namnLista(felRad)}. Mappa om i prisguiden`,
    })
  }

  // Alla interna kostnader ska ligga på en rad (inte på rubriken Avser)
  const omappade = d.artiklar.filter(a => !a.mappadMot || !radIds.has(a.mappadMot))
  if (omappade.length > 0) {
    ut.push({
      kod: 'mappning',
      text: `Interna kostnader utan rad: ${namnLista(omappade)}. Mappa dem i prisguiden`,
    })
  }

  // Avdraget hör bara till Arbetskostnad och har mallens typ
  const blandade = d.tjanster.some(t => t.rot_rut_type && t.rot_rut_type !== typ)
    || d.tjanster.some(t => t.rot_rut_type && t.roll !== 'arbete')
  if (blandade) {
    ut.push({ kod: 'blandning', text: `Mallen gäller bara ${typ}. Ta bort ${andra} och avdrag på andra rader än Arbetskostnad` })
  }

  const avserMedPris = d.tjanster.filter(t => arAvserRad(t) && Math.abs(Number(t.total_price) || 0) >= 0.005)
  if (avserMedPris.length > 0) {
    ut.push({
      kod: 'avser',
      text: `Ärendets tjänst ska ha 0 kr: ${Array.from(new Set(avserMedPris.map(t => t.service_name || 'Tjänst'))).join(', ')}`,
    })
  }

  if (fastighetKravs(typ) && !fastighetKlar(d.fastighet)) {
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

/** Det som inte stoppar men bör ses över: tillagda tjänster på 0 kr (syns inte för kunden). */
export function rotRutVarningar(d: Pick<RotRutKontrollIndata, 'tjanster'>): string[] {
  const ut: string[] = []
  for (const t of d.tjanster) {
    if (t.roll === null && t.egen && inklMoms(t.total_price, t.vat_rate ?? 25) === 0) {
      ut.push(`${t.service_name || 'Tjänsten'} har 0 kr och syns inte i offerten.`)
    }
  }
  return ut
}

// ─── Fakturan───────────────────────────────────────────────────────────────

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
  if (fastighetKravs(d.typ) && !fastighetKlar(d.fastighet)) {
    ut.push(d.fastighet.brf ? 'Föreningens org.nr eller lägenhetsnummer saknas' : 'Fastighetsbeteckning saknas eller ser fel ut')
  }
  if (!d.harArbetsrad) ut.push(`Ingen rad bär ${d.typ}-avdraget`)
  if (!String(d.utforandeAdress ?? '').trim()) ut.push('Utförandeadress saknas på ärendet')
  if (!String(d.utforandeDatum ?? '').trim()) ut.push('Datum för arbetet saknas på ärendet')
  return ut
}

// ─── Kontroll mot Oneflow (webhooken) ───────────────────────────────────────

export interface RotRutForvantat {
  /** efter_avdrag finns sedan 3.127.5 (variant D, kolumnen "Att betala efter ROT/RUT") */
  rader: Array<{ namn: string; belopp: number; efter_avdrag?: number | null }>
  totalt_inkl?: number
}

export interface OneflowJamforRad {
  name: string
  /** Synlig kolumn efter rabatt gånger antal */
  total: number
  /** price_1 efter rabatt gånger antal */
  pris1?: number | null
  /** price_2 efter rabatt gånger antal */
  pris2?: number | null
}

/**
 * Jämför Oneflows produkter med raderna portalen skickade. null = stämmer,
 * annars en text för portalen. Sedan 3.127.5 jämförs båda priskolumnerna per
 * rad: price_1 med det fulla priset och price_2 med att betala efter avdraget.
 * Äldre offerter (utan efter_avdrag) jämförs på den synliga kolumnen, och
 * variant B:s avdragsrad (3.127.3) larmar om den ändras eller tas bort.
 */
export function jamforMedOneflow(
  forvantat: RotRutForvantat | null | undefined,
  oneflowRader: OneflowJamforRad[]
): string | null {
  if (!forvantat || !Array.isArray(forvantat.rader)) return null
  const fel: string[] = []
  const kvar = [...oneflowRader]
  for (const r of forvantat.rader) {
    const idx = kvar.findIndex(o => o.name.trim() === r.namn)
    const avdragsrad = arAvdragsradNamn(r.namn)
    if (idx < 0) {
      fel.push(avdragsrad ? `${r.namn} är borttaget i Oneflow` : `${r.namn} saknas i Oneflow`)
      continue
    }
    const o = kvar.splice(idx, 1)[0]
    if (r.efter_avdrag != null) {
      const p1 = o.pris1 ?? o.total
      const p2 = o.pris2 ?? o.total
      if (Math.abs(Math.round(p1) - r.belopp) >= 1) {
        fel.push(`${r.namn} är ${kr(p1)} inkl. moms i Oneflow, portalen ${kr(r.belopp)}`)
      }
      if (Math.abs(Math.round(p2) - r.efter_avdrag) >= 1) {
        fel.push(`${r.namn} är ${kr(p2)} efter avdrag i Oneflow, portalen ${kr(r.efter_avdrag)}`)
      }
      continue
    }
    if (Math.abs(Math.round(o.total) - r.belopp) >= 1) {
      fel.push(avdragsrad
        ? `${r.namn} är ändrat i Oneflow: ${kr(o.total)}, portalen ${kr(r.belopp)}`
        : `${r.namn} är ${kr(o.total)} i Oneflow, portalen ${kr(r.belopp)}`)
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
