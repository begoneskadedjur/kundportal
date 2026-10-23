// src/components/fragor/fragorLogik.ts
// Logiken bakom sidan Frågor och uppdrag (/<roll>/tickets, 3.89.0).
//
// En tråd är en rotkommentar i case_comments med alla svar, kopplad till ett ärende.
// Här byggs trådarna ur InkorgData (communicationService.getInboxThreads) och varje
// tråd får en grupp, en status som punkt och text, och raden i listan.
//
// Mina grupper (alla roller):
//   fragor    Frågor till dig: jag är nämnd personligen (eller tog den) och har inte
//             skrivit något efter frågan.
//   svar      Svar till dig: senaste repliken är någon annans, efter min, och jag
//             startade tråden eller frågade någon.
//   vantar    Du väntar på svar: jag frågade en person, en roll eller alla och någon
//             fråga är obesvarad.
//   kannedom  Omnämnd för kännedom: gruppnämningar (@admin, @koordinator, @tekniker,
//             @alla) och trådar jag är med i där inget väntar på mig.
//   klara     Klara (status resolved).
//   anteckning  Anteckning utan mottagare: ingen nämnd och bara författaren har
//             skrivit. Räknas aldrig som öppen tråd, visas bara i kontorets Alla.
//
// Kontorets grupper (Alla, admin och koordinator):
//   roll      Till en roll eller alla, ingen har svarat
//   person    Väntar på en person
//   besvarad  Besvarade, inte klara
//   klara, anteckning som ovan
//
// "Jag tar den" sparas som ett svar där författaren nämner sig själv
// (mentioned_user_ids innehåller author_id). Då väntar tråden på den personen tills
// hen skriver igen.
//
// Gult efter två dagar utan svar. Rött används inte.

import { formatInTimeZone } from 'date-fns-tz'
import type { CaseComment, CaseType } from '../../types/communication'
import type { InkorgArende, InkorgData, InkorgKvitto } from '../../services/communicationService'

export const SVENSK_TZ = 'Europe/Stockholm'
export const GUL_EFTER_DAGAR = 2

export type Roll = 'admin' | 'koordinator' | 'technician'
export type Ton = 'gron' | 'gul' | 'bla' | 'gra'

export interface Mig {
  id: string
  namn: string
  /** Alla roller personen hör till (primär roll, is_admin, is_koordinator, extra_roles) */
  roller: Roll[]
  /** Admin eller koordinator i den vy som är aktiv */
  arKontor: boolean
}

interface ProfilRoller {
  role?: string | null
  is_admin?: boolean | null
  is_koordinator?: boolean | null
  extra_roles?: string[] | null
}

export function effektivaRoller(p: ProfilRoller | null | undefined): Roll[] {
  if (!p) return []
  const s = new Set<Roll>()
  const lagg = (r: string | null | undefined) => {
    if (r === 'admin' || r === 'koordinator' || r === 'technician') s.add(r)
  }
  lagg(p.role)
  if (p.is_admin) s.add('admin')
  if (p.is_koordinator) s.add('koordinator')
  for (const r of p.extra_roles || []) lagg(r)
  return [...s]
}

export const ROLL_ETIKETT: Record<Roll, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
}

/** "till admin", "till koordinatorerna", "till alla tekniker" */
export function rollMottagare(r: string): string {
  if (r === 'admin') return 'admin'
  if (r === 'koordinator') return 'koordinatorerna'
  if (r === 'technician') return 'alla tekniker'
  return r
}

/** "Ingen admin", "Ingen koordinator", "Ingen tekniker" */
function ingenIRoll(r: string): string {
  if (r === 'admin') return 'Ingen admin'
  if (r === 'koordinator') return 'Ingen koordinator'
  if (r === 'technician') return 'Ingen tekniker'
  return 'Ingen'
}

export function rollText(r: string | null | undefined): string {
  if (r === 'admin') return 'admin'
  if (r === 'koordinator') return 'koordinator'
  if (r === 'technician') return 'tekniker'
  return ''
}

export function fornamn(namn: string | null | undefined): string {
  return (namn || '').trim().split(/\s+/)[0] || 'Okänd'
}

// ─── Tid, alltid svensk tid ───

function svenskDag(d: Date): string {
  return formatInTimeZone(d, SVENSK_TZ, 'yyyy-MM-dd')
}

function dagForeIdag(n: number): string {
  return svenskDag(new Date(Date.now() - n * 86400000))
}

/** 08:14 i dag, Igår, annars ÅÅÅÅ-MM-DD */
export function tidKort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dag = svenskDag(d)
  if (dag === dagForeIdag(0)) return formatInTimeZone(d, SVENSK_TZ, 'HH:mm')
  if (dag === dagForeIdag(1)) return 'Igår'
  return dag
}

/** 08:14 i dag, igår 15:30, annars ÅÅÅÅ-MM-DD */
export function tidSedan(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const dag = svenskDag(d)
  if (dag === dagForeIdag(0)) return formatInTimeZone(d, SVENSK_TZ, 'HH:mm')
  if (dag === dagForeIdag(1)) return `igår ${formatInTimeZone(d, SVENSK_TZ, 'HH:mm')}`
  return dag
}

/** ÅÅÅÅ-MM-DD HH:mm */
export function datumTid(iso: string | null | undefined): string {
  if (!iso) return ''
  return formatInTimeZone(new Date(iso), SVENSK_TZ, 'yyyy-MM-dd HH:mm')
}

export function dagarSedan(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

/** "40 minuter", "3 timmar", "2 dagar" */
export function varaktighet(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 60) return min === 1 ? '1 minut' : `${min} minuter`
  const tim = Math.floor(min / 60)
  if (tim < 24) return tim === 1 ? '1 timme' : `${tim} timmar`
  const dagar = Math.floor(tim / 24)
  return dagar === 1 ? '1 dag' : `${dagar} dagar`
}

// ─── Trådar ───

export interface Trad {
  id: string
  root: CaseComment
  /** Svaren i tidsordning */
  svar: CaseComment[]
  /** Rot och svar i tidsordning */
  alla: CaseComment[]
  arende: InkorgArende
  caseId: string
  caseType: CaseType
  /** Senaste aktivitet (ISO) */
  senastAt: string
}

export function byggTradar(data: InkorgData): Trad[] {
  const rotIds = new Set(data.rotIds)
  const perId = new Map(data.kommentarer.map(k => [k.id, k]))
  const rotAv = (k: CaseComment): string | null => {
    let cur: CaseComment | undefined = k
    let varv = 0
    while (cur && cur.parent_comment_id && varv < 50) {
      cur = perId.get(cur.parent_comment_id)
      varv++
    }
    return cur && !cur.parent_comment_id ? cur.id : null
  }
  const svarPerRot = new Map<string, CaseComment[]>()
  for (const k of data.kommentarer) {
    if (!k.parent_comment_id) continue
    const r = rotAv(k)
    if (!r || !rotIds.has(r)) continue
    const lista = svarPerRot.get(r) || []
    lista.push(k)
    svarPerRot.set(r, lista)
  }
  const ut: Trad[] = []
  for (const id of rotIds) {
    const root = perId.get(id)
    if (!root) continue
    const arende = data.arenden.get(`${root.case_type}:${root.case_id}`)
    if (!arende) continue
    const svar = (svarPerRot.get(id) || []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const alla = [root, ...svar]
    ut.push({
      id,
      root,
      svar,
      alla,
      arende,
      caseId: root.case_id,
      caseType: root.case_type,
      senastAt: alla[alla.length - 1].created_at,
    })
  }
  return ut.sort((a, b) => b.senastAt.localeCompare(a.senastAt))
}

// ─── Frågor i en tråd ───

export interface Fraga {
  typ: 'person' | 'roll' | 'alla'
  kommentar: CaseComment
  /** Person som frågas (typ person) */
  till?: string
  tillNamn?: string
  /** Roll som frågas (typ roll) */
  roll?: string
  /** Personen tog den själv (Jag tar den) */
  tog: boolean
  besvarad: boolean
}

export function fragorITrad(trad: Trad): Fraga[] {
  const ut: Fraga[] = []
  const alla = trad.alla
  alla.forEach((c, idx) => {
    const efter = alla.slice(idx + 1)
    c.mentioned_user_ids.forEach((uid, i) => {
      const tog = uid === c.author_id
      ut.push({
        typ: 'person',
        kommentar: c,
        till: uid,
        tillNamn: tog ? c.author_name : (c.mentioned_user_names[i] || 'Okänd'),
        tog,
        besvarad: efter.some(e => e.author_id === uid),
      })
    })
    for (const r of c.mentioned_roles) {
      ut.push({ typ: 'roll', kommentar: c, roll: r, tog: false, besvarad: efter.some(e => e.author_id !== c.author_id) })
    }
    if (c.mentions_all) {
      ut.push({ typ: 'alla', kommentar: c, tog: false, besvarad: efter.some(e => e.author_id !== c.author_id) })
    }
  })
  return ut
}

export function arAnteckning(trad: Trad, fragor: Fraga[] = fragorITrad(trad)): boolean {
  return fragor.length === 0 && trad.alla.every(c => c.author_id === trad.root.author_id)
}

/** Mottagarna i rotkommentaren som text: "Kim", "Kim och admin", "alla" */
export function mottagareText(trad: Trad, mig?: Mig): string {
  const delar: string[] = []
  const r = trad.root
  r.mentioned_user_ids.forEach((uid, i) => {
    if (uid === r.author_id) return
    delar.push(mig && uid === mig.id ? 'dig' : fornamn(r.mentioned_user_names[i]))
  })
  for (const roll of r.mentioned_roles) delar.push(rollMottagare(roll))
  if (r.mentions_all) delar.push('alla')
  if (delar.length === 0) return ''
  if (delar.length === 1) return delar[0]
  return `${delar.slice(0, -1).join(', ')} och ${delar[delar.length - 1]}`
}

/** "Sara till Kim", "Du till kontoret", "Sara, koordinator" */
export function franTillText(trad: Trad, mig?: Mig): string {
  const fran = mig && trad.root.author_id === mig.id ? 'Du' : fornamn(trad.root.author_name)
  const till = mottagareText(trad, mig)
  if (till) return `${fran} till ${till}`
  const roll = rollText(trad.root.author_role)
  return roll ? `${fran}, ${roll}` : fran
}

// ─── Text ───

/** Tar bort @-nämningar i början av texten, så att ämnet blir själva frågan */
export function utanInledandeNamningar(c: CaseComment): string {
  let t = c.content || ''
  const namn = [...c.mentioned_user_names].sort((a, b) => b.length - a.length)
  let byttes = true
  while (byttes) {
    byttes = false
    t = t.replace(/^\s+/, '')
    for (const n of namn) {
      if (n && t.toLowerCase().startsWith(`@${n.toLowerCase()}`)) {
        t = t.slice(n.length + 1).replace(/^[\s,:]+/, '')
        byttes = true
      }
    }
    const m = t.match(/^@(tekniker|koordinator|admin|alla)\b[\s,:]*/i)
    if (m) {
      t = t.slice(m[0].length)
      byttes = true
    }
  }
  return t.trim()
}

export function amne(trad: Trad): string {
  const t = utanInledandeNamningar(trad.root)
  const forsta = t.split('\n').find(r => r.trim()) || ''
  if (!forsta) return trad.root.attachments.length > 0 ? 'Bild eller fil' : 'Utan text'
  return forsta.length > 90 ? `${forsta.slice(0, 88).trim()}...` : forsta
}

export function citat(c: CaseComment): string {
  const t = utanInledandeNamningar(c).replace(/\s+/g, ' ')
  if (!t) return c.attachments.length > 0 ? 'Bild eller fil' : ''
  return t.length > 140 ? `${t.slice(0, 138).trim()}...` : t
}

export function bilagorText(trad: Trad): string {
  let bilder = 0
  let filer = 0
  for (const c of trad.alla) {
    for (const a of c.attachments) {
      if (a.mimetype?.startsWith('image/')) bilder++
      else filer++
    }
  }
  const delar: string[] = []
  if (bilder) delar.push(bilder === 1 ? '1 bild' : `${bilder} bilder`)
  if (filer) delar.push(filer === 1 ? '1 fil' : `${filer} filer`)
  return delar.join(', ')
}

// ─── Analys per tråd ───

export type MinGrupp = 'fragor' | 'svar' | 'vantar' | 'kannedom' | 'klara' | 'anteckning'
export type KontorGrupp = 'roll' | 'person' | 'besvarad' | 'klara' | 'anteckning'

export interface Status {
  ton: Ton
  text: string
}

export interface MinAnalys {
  grupp: MinGrupp
  status: Status
  olasta: number
  /** Första olästa kommentaren, för Nytt sedan du läste */
  forstaOlasta: string | null
}

export interface KontorAnalys {
  grupp: KontorGrupp
  status: Status
  olasta: number
}

function lastaAv(kvitton: InkorgKvitto[], userId: string): Set<string> {
  return new Set(kvitton.filter(k => k.userId === userId).map(k => k.commentId))
}

export function kvittonPerKommentar(kvitton: InkorgKvitto[]): Map<string, InkorgKvitto[]> {
  const m = new Map<string, InkorgKvitto[]>()
  for (const k of kvitton) {
    const l = m.get(k.commentId) || []
    l.push(k)
    m.set(k.commentId, l)
  }
  return m
}

function harLast(kvitton: Map<string, InkorgKvitto[]>, commentId: string, userId: string): boolean {
  return (kvitton.get(commentId) || []).some(k => k.userId === userId)
}

function vantarText(obesvarade: Fraga[], kvitton: Map<string, InkorgKvitto[]>, mig?: Mig): Status {
  const aldst = obesvarade.reduce((a, f) => (f.kommentar.created_at < a ? f.kommentar.created_at : a), obesvarade[0].kommentar.created_at)
  const dagar = dagarSedan(aldst)
  const gul = dagar >= GUL_EFTER_DAGAR
  const personer = obesvarade.filter(f => f.typ === 'person')
  if (personer.length > 0) {
    const namn = [...new Set(personer.map(f => (mig && f.till === mig.id ? 'dig' : fornamn(f.tillNamn))))]
    const vem = namn.length === 1 ? namn[0] : `${namn.slice(0, -1).join(', ')} och ${namn[namn.length - 1]}`
    if (gul) return { ton: 'gul', text: `${vem === 'dig' ? 'Du' : vem} har inte svarat på ${dagar} dagar` }
    if (personer.length === 1 && personer[0].till && harLast(kvitton, personer[0].kommentar.id, personer[0].till)) {
      return { ton: 'gra', text: `${vem} har läst, inte svarat än` }
    }
    return { ton: 'gra', text: `Väntar på ${vem} sedan ${tidSedan(aldst)}` }
  }
  if (gul) return { ton: 'gul', text: `Ingen har svarat på ${dagar} dagar` }
  const roller = [...new Set(obesvarade.filter(f => f.typ === 'roll').map(f => f.roll || ''))]
  if (roller.length === 1 && !obesvarade.some(f => f.typ === 'alla')) {
    return { ton: 'gra', text: `${ingenIRoll(roller[0])} har svarat än` }
  }
  return { ton: 'gra', text: 'Ingen har svarat än' }
}

export function analysMin(trad: Trad, mig: Mig, kvitton: InkorgKvitto[], kvittoKarta?: Map<string, InkorgKvitto[]>): MinAnalys {
  const karta = kvittoKarta || kvittonPerKommentar(kvitton)
  const lasta = new Set<string>()
  for (const c of trad.alla) if (harLast(karta, c.id, mig.id)) lasta.add(c.id)
  const olastaLista = trad.alla.filter(c => c.author_id !== mig.id && !lasta.has(c.id))
  const bas = { olasta: olastaLista.length, forstaOlasta: olastaLista[0]?.id || null }
  const fr = fragorITrad(trad)

  if (arAnteckning(trad, fr)) {
    return { ...bas, grupp: 'anteckning', status: { ton: 'gra', text: 'Anteckning utan mottagare' } }
  }
  if (trad.root.status === 'resolved') {
    return { ...bas, grupp: 'klara', status: { ton: 'gron', text: `Klar ${tidSedan(trad.root.resolved_at || trad.root.updated_at)}` } }
  }

  const tillMig = fr.filter(f => f.typ === 'person' && f.till === mig.id && !f.besvarad && (f.tog || f.kommentar.author_id !== mig.id))
  if (tillMig.length > 0) {
    const f = tillMig[0]
    const dagar = dagarSedan(f.kommentar.created_at)
    if (f.tog) {
      return { ...bas, grupp: 'fragor', status: { ton: dagar >= GUL_EFTER_DAGAR ? 'gul' : 'bla', text: `Du tog den ${tidSedan(f.kommentar.created_at)}, inte svarat än` } }
    }
    const vem = fornamn(f.kommentar.author_name)
    return {
      ...bas,
      grupp: 'fragor',
      status: dagar >= GUL_EFTER_DAGAR
        ? { ton: 'gul', text: `${vem} har väntat på ditt svar i ${dagar} dagar` }
        : { ton: 'bla', text: `${vem} väntar på ditt svar sedan ${tidSedan(f.kommentar.created_at)}` },
    }
  }

  const sista = trad.alla[trad.alla.length - 1]
  const jagSkrivit = trad.alla.some(c => c.author_id === mig.id)
  const minaFragor = fr.filter(f => f.kommentar.author_id === mig.id && !f.tog)
  if (sista.author_id !== mig.id && jagSkrivit && (trad.root.author_id === mig.id || minaFragor.length > 0)) {
    return { ...bas, grupp: 'svar', status: { ton: 'gron', text: `${fornamn(sista.author_name)} svarade ${tidSedan(sista.created_at)}, läs och markera som klar` } }
  }

  const obesvarade = minaFragor.filter(f => !f.besvarad)
  if (obesvarade.length > 0) {
    return { ...bas, grupp: 'vantar', status: vantarText(obesvarade, karta, mig) }
  }

  const gruppTillMig = fr.find(f => f.kommentar.author_id !== mig.id && (
    f.typ === 'alla' || (f.typ === 'roll' && mig.roller.includes(f.roll as Roll))
  ))
  if (gruppTillMig) {
    const till = gruppTillMig.typ === 'alla' ? 'alla' : rollMottagare(gruppTillMig.roll || '')
    return { ...bas, grupp: 'kannedom', status: { ton: 'gra', text: `För kännedom, till ${till}` } }
  }
  if (minaFragor.length > 0) {
    return { ...bas, grupp: 'kannedom', status: { ton: 'gron', text: 'Besvarad, markera som klar' } }
  }
  return { ...bas, grupp: 'kannedom', status: { ton: 'gra', text: 'Du är med i tråden' } }
}

export function analysKontor(trad: Trad, mig: Mig, kvitton: InkorgKvitto[], kvittoKarta?: Map<string, InkorgKvitto[]>): KontorAnalys {
  const karta = kvittoKarta || kvittonPerKommentar(kvitton)
  const olasta = trad.alla.filter(c => c.author_id !== mig.id && !harLast(karta, c.id, mig.id)).length
  const fr = fragorITrad(trad)
  if (arAnteckning(trad, fr)) return { grupp: 'anteckning', status: { ton: 'gra', text: 'Anteckning, ingen väntar på svar' }, olasta }
  if (trad.root.status === 'resolved') {
    return { grupp: 'klara', status: { ton: 'gron', text: `Klar ${tidSedan(trad.root.resolved_at || trad.root.updated_at)}` }, olasta }
  }
  const personer = fr.filter(f => f.typ === 'person' && !f.besvarad)
  if (personer.length > 0) {
    const namn = [...new Set(personer.map(f => (f.till === mig.id ? 'dig' : fornamn(f.tillNamn))))]
    const vem = namn.length === 1 ? namn[0] : `${namn.slice(0, -1).join(', ')} och ${namn[namn.length - 1]}`
    const aldst = personer.reduce((a, f) => (f.kommentar.created_at < a ? f.kommentar.created_at : a), personer[0].kommentar.created_at)
    const dagar = dagarSedan(aldst)
    if (dagar >= GUL_EFTER_DAGAR) return { grupp: 'person', status: { ton: 'gul', text: `Väntar på ${vem} i ${dagar} dagar` }, olasta }
    const last = personer.length === 1 && personer[0].till && harLast(karta, personer[0].kommentar.id, personer[0].till)
    return { grupp: 'person', status: { ton: 'bla', text: last ? `Väntar på ${vem}, läst` : `Väntar på ${vem} sedan ${tidSedan(aldst)}` }, olasta }
  }
  const grupper = fr.filter(f => f.typ !== 'person' && !f.besvarad)
  if (grupper.length > 0) {
    const aldst = grupper[0].kommentar.created_at
    const dagar = dagarSedan(aldst)
    return { grupp: 'roll', status: { ton: dagar >= GUL_EFTER_DAGAR ? 'gul' : 'bla', text: `Väntat ${varaktighet(aldst)}` }, olasta }
  }
  const sista = trad.alla[trad.alla.length - 1]
  return { grupp: 'besvarad', status: { ton: 'gron', text: `${fornamn(sista.author_name)} svarade ${tidSedan(sista.created_at)}` }, olasta }
}

/** Samma regel som set_case_comment_status i databasen */
export function kanAndraStatus(trad: Trad, mig: Mig): boolean {
  if (mig.roller.includes('admin') || mig.roller.includes('koordinator')) return true
  if (trad.root.author_id === mig.id) return true
  return trad.alla.some(c =>
    c.mentioned_user_ids.includes(mig.id) ||
    c.mentions_all ||
    c.mentioned_roles.some(r => mig.roller.includes(r as Roll))
  )
}

/** Kan personen ta tråden (admin och koordinator, tråd till en roll eller alla som ingen tagit) */
export function kanTaDen(trad: Trad, mig: Mig): boolean {
  if (!mig.arKontor || trad.root.status === 'resolved') return false
  const fr = fragorITrad(trad)
  if (fr.some(f => f.typ === 'person' && f.till === mig.id && !f.besvarad)) return false
  return fr.some(f => f.typ !== 'person' && !f.besvarad) && trad.root.author_id !== mig.id
}

/** Fritextsökning i ämne, all text, kund, ärendenummer och namn */
export function matcharSok(trad: Trad, sok: string): boolean {
  const q = sok.trim().toLowerCase()
  if (!q) return true
  const falt = [
    trad.arende.kund, trad.arende.nummer || '', trad.arende.titel, trad.arende.adress || '',
    ...trad.alla.map(c => c.content), ...trad.alla.map(c => c.author_name),
    ...trad.alla.flatMap(c => c.mentioned_user_names),
  ]
  return falt.some(f => (f || '').toLowerCase().includes(q))
}

export function arendeTypText(t: CaseType): string {
  if (t === 'private') return 'Privat'
  if (t === 'business') return 'Företag'
  return 'Avtal'
}

/** Läskvitton som text under en egen replik: "Läst av Sara 16:52", "Läst av Jonas och Sara" */
export function lastAvText(kvitton: InkorgKvitto[], mig: Mig): string {
  const andra = kvitton.filter(k => k.userId !== mig.id)
  if (andra.length === 0) return ''
  if (andra.length === 1) return `Läst av ${fornamn(andra[0].userName)} ${tidSedan(andra[0].readAt)}`
  const namn = [...new Set(andra.map(k => fornamn(k.userName)))]
  return `Läst av ${namn.slice(0, -1).join(', ')} och ${namn[namn.length - 1]}`
}

export function lastaSet(kvitton: InkorgKvitto[], userId: string): Set<string> {
  return lastaAv(kvitton, userId)
}
