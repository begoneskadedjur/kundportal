// src/pages/shared/intranet/guider/_nyvy_min_dag.tsx
// Delade delar för guiderna i gruppen Min dag i nya arbetsvyn (2026-10-24):
// guide-din-dag, guide-schema-tekniker, guide-mina-arenden, guide-sokrutan-tekniker
// och guide-rapportera-tillbud.
//
// Efterbildningar av portalens sidor, kontrollerade mot källkoden:
//   Idag   pages/technician/ny/NyIdag.tsx (Nästa uppdrag, Dagens rutt, Att göra, Imorgon)
//   Karta  pages/technician/ny/NyKarta.tsx (dagväljaren, numrerade stopp, valt stopp)
//   Knappar components/technician/ny/besokUi.tsx (Navigera, Ring, Öppna)
//   Restid components/technician/ny/RestidRad.tsx ("Ca 12 min med bil härifrån, 8,4 km")
//   Mer    pages/technician/ny/NyMer.tsx (grupperna ur nyNavConfig utom bottenmenyns sidor)
//   Ärendet EditCaseModal i stegflödet: steget Framme med Jag är framme
// Allt utspelar sig måndag 2026-10-26 klockan 07:35. Påhittade kunder.

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { TYP_IKON } from '../../../../components/technician/ny/besokTyp'
import type { BesokTyp } from '../../../../services/teknikerDagService'
import { Markor, type MarkorProps } from '../skarmkit'
import { NyArende, NyHjalp, useGuideEnhet, type NyMarkor } from '../skarmkit/nyvy'

// ─── Markörer och tryck ────────────────────────────

/** Ett tryck i skärmen, med målets namn (samma namn som markören) */
export type Tryck = (mal: string) => void

/** Markören för ett mål inne i sidan, om stegets markör pekar dit */
export type Mk = (mal: string) => MarkorProps | undefined

export function gorMk(markor?: NyMarkor): Mk {
  return mal => (markor && markor.mal === mal ? markor : undefined)
}

export const ingenMk: Mk = () => undefined

// ─── Rullning ──────────────────────────────────────

const MARKOR_KLASS = 'ring-[#20c58f]'

/**
 * Sidans innehåll som går att rulla, som i portalen. Telefonen är bara 520 px hög, så
 * det markerade målet rullas fram av sig själv när det annars hamnar utanför skärmen.
 */
export function Rulla({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const ruta = ref.current
    if (!ruta) return
    let el: Element | null = null
    try { el = ruta.querySelector(`.${CSS.escape(MARKOR_KLASS)}`) } catch { el = null }
    if (!el) return
    const r = ruta.getBoundingClientRect()
    const e = el.getBoundingClientRect()
    if (e.top < r.top + 8) ruta.scrollTop += e.top - r.top - 24
    else if (e.bottom > r.bottom - 8) ruta.scrollTop += e.bottom - r.bottom + 24
  })
  return (
    <div ref={ref} className={`h-full overflow-y-auto overscroll-contain [scrollbar-width:none] ${className}`}>
      {children}
    </div>
  )
}

// ─── Exempeldagen ──────────────────────────────────

export const DATUM_IDAG = 'Måndag 26 oktober'
export const UNDER_IDAG = 'Måndag 26 oktober, 3 besök'

export interface ExBesok {
  id: string
  tid: string
  slut: string
  kund: string
  typ: BesokTyp
  /** besokBeskrivning: "Privat, råttor" eller typens namn */
  beskr: string
  adress: string
  ort: string
  nr: string
  status: string
  telefon?: string
}

export const IDAG: ExBesok[] = [
  { id: 'fam', tid: '08:00', slut: '09:30', kund: 'Familjen Exempel', typ: 'private', beskr: 'Privat, råttor', adress: 'Exempelvägen 4, Södertälje', ort: 'Södertälje', nr: 'BE-0001234', status: 'Bokad', telefon: '070-123 45 67' },
  { id: 'ab', tid: '10:30', slut: '12:00', kund: 'Exempel AB', typ: 'inspection', beskr: 'Kontrollbesök', adress: 'Industrivägen 12, Södertälje', ort: 'Södertälje', nr: 'BE-0001190', status: 'Bokad', telefon: '08-123 456 78' },
  { id: 'brf', tid: '13:00', slut: '15:00', kund: 'Brf Exempelgården', typ: 'establishment', beskr: 'Etablering', adress: 'Gårdsvägen 3, Nykvarn', ort: 'Nykvarn', nr: 'BE-0001301', status: 'Bokad', telefon: '070-765 43 21' },
]

export const IMORGON: ExBesok[] = [
  { id: 'brf2', tid: '08:00', slut: '09:00', kund: 'Brf Exempelgården', typ: 'inspection', beskr: 'Kontrollbesök', adress: 'Gårdsvägen 3, Nykvarn', ort: 'Nykvarn', nr: 'BE-0001302', status: 'Bokad', telefon: '070-765 43 21' },
  { id: 'fam2', tid: '10:00', slut: '11:00', kund: 'Familjen Exempel', typ: 'private', beskr: 'Privat, råttor', adress: 'Exempelvägen 4, Södertälje', ort: 'Södertälje', nr: 'BE-0001234', status: 'Återbesök', telefon: '070-123 45 67' },
]

/** Restiden till nästa stopp, som RestidRad skriver den */
export const RESTID = { text: 'Ca 12 min med bil härifrån, 8,4 km', kalla: 'Från telefonen' }

// ─── Små delar ─────────────────────────────────────

const PUNKT: Record<'gron' | 'gul' | 'rod' | 'bla' | 'gra', string> = {
  gron: 'bg-[#20c58f]', gul: 'bg-amber-500', rod: 'bg-red-500', bla: 'bg-sky-500', gra: 'bg-slate-500',
}
const PUNKT_TEXT: Record<keyof typeof PUNKT, string> = {
  gron: 'text-[#20c58f]', gul: 'text-amber-500', rod: 'text-red-400', bla: 'text-sky-400', gra: 'text-slate-400',
}

/** Status som punkt och text, som StatusPunkt i portalen */
export function Punkt({ ton, children }: { ton: keyof typeof PUNKT; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10.5px] font-medium ${PUNKT_TEXT[ton]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 flex-none rounded-full ${PUNKT[ton]}`} />
      {children}
    </span>
  )
}

/** Rubrik som HjalpText: rubrik med ikon, grå förklaring under */
export function Rubrik({ rubrik, ikon, hoger, children }: { rubrik: string; ikon?: IconName; hoger?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white">
          {ikon && <Icon name={ikon} size={16} className="h-3.5 w-3.5 text-[#20c58f]" />}
          {rubrik}
        </p>
        {hoger}
      </div>
      {children && <p className="text-[10.5px] leading-snug text-slate-400">{children}</p>}
    </div>
  )
}

/** Klickbar del med markör. block = full bredd. */
export function Mal({ id, mk, tryck, block = true, className = '', children }: {
  id: string; mk: Mk; tryck?: Tryck; block?: boolean; className?: string; children: ReactNode
}) {
  return (
    <Markor markor={mk(id)} block={block}>
      <button type="button" onClick={() => tryck?.(id)} className={`${block ? 'w-full' : ''} text-left ${className}`}>
        {children}
      </button>
    </Markor>
  )
}

/** Navigera, Ring och Öppna (BesokKnappar). Målen heter <prefix>navigera, <prefix>ring och <prefix>oppna. */
export function BesokKnappar({ mk, tryck, prefix = '', liten = false }: { mk: Mk; tryck?: Tryck; prefix?: string; liten?: boolean }) {
  const bas = `flex ${liten ? 'h-7' : 'h-8'} w-full items-center justify-center gap-1 rounded-lg text-[11px] font-semibold`
  const knapp = (id: string, text: string, ikon: IconName, prim: boolean) => (
    <Markor markor={mk(`${prefix}${id}`)} block>
      <button type="button" onClick={() => tryck?.(`${prefix}${id}`)}
        className={`${bas} ${prim ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 bg-slate-900 text-white'}`}>
        <Icon name={ikon} size={16} className="h-3.5 w-3.5" />{text}
      </button>
    </Markor>
  )
  return (
    <div className="grid grid-cols-[1.3fr_1fr_1fr] gap-1.5">
      {knapp('navigera', 'Navigera', 'falt.navigera', true)}
      {knapp('ring', 'Ring', 'kontakt.telefon', false)}
      {knapp('oppna', 'Öppna', 'arende.arende', false)}
    </div>
  )
}

/** Restidsraden med bilen */
export function RestidRad() {
  return (
    <div className="flex items-start gap-1.5">
      <Icon name="falt.bil" size={16} className="mt-px h-3.5 w-3.5 flex-none text-[#20c58f]" />
      <p className="min-w-0 leading-tight">
        <span className="block text-[11px] font-medium text-white">{RESTID.text}</span>
        <span className="block text-[10px] text-slate-400">{RESTID.kalla}</span>
      </p>
    </div>
  )
}

// ─── Idag ──────────────────────────────────────────

/** Mål på Idag: navigera, ring, oppna, rutt:<id>, karta-lank, attgora:avsluta, attgora:boka, imorgon */
export function IdagSida({ mk = ingenMk, tryck, klara = [] }: { mk?: Mk; tryck?: Tryck; klara?: string[] }) {
  const enhet = useGuideEnhet()
  const nasta = IDAG.find(b => !klara.includes(b.id))
  const vanster = (
    <div className="grid min-w-0 gap-2.5">
      <section>
        <Rubrik rubrik="Nästa uppdrag" ikon="falt.framme">Navigera öppnar vägbeskrivningen, Ring ringer kontaktpersonen och Öppna visar hela ärendet.</Rubrik>
        {nasta ? (
          <article className="grid gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900 p-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="flex items-baseline gap-1.5">
                <span className="font-mono text-[18px] font-bold text-white">{nasta.tid}</span>
                <span className="text-[10.5px] text-slate-400">om 25 min</span>
              </p>
              <p className="flex items-center gap-1 text-[10.5px] text-slate-300"><Icon name={TYP_IKON[nasta.typ]} size={16} className="h-3.5 w-3.5 text-slate-400" />{nasta.beskr}</p>
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">{nasta.kund}</p>
              <p className="text-[11px] text-slate-400">{nasta.adress}</p>
            </div>
            <RestidRad />
            <BesokKnappar mk={mk} tryck={tryck} />
          </article>
        ) : (
          <p className="rounded-xl border border-slate-700/60 bg-slate-900 p-2.5 text-[11px] text-slate-300">Alla dagens besök är klara.</p>
        )}
      </section>
      <section>
        <Rubrik rubrik="Dagens rutt" ikon="falt.rutt"
          hoger={<Mal id="karta-lank" mk={mk} tryck={tryck} block={false} className="flex items-center gap-1 text-[10.5px] font-medium text-[#20c58f]"><Icon name="falt.karta" size={16} className="h-3 w-3" />Visa på karta</Mal>}>
          Besöken i den ordning de är bokade. Tryck på ett besök för att öppna ärendet.
        </Rubrik>
        <ol className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
          {IDAG.map((b, i) => {
            const klart = klara.includes(b.id)
            const arNasta = nasta?.id === b.id
            return (
              <li key={b.id} className="border-b border-slate-700/60 last:border-b-0">
                <Mal id={`rutt:${b.id}`} mk={mk} tryck={tryck} className="flex items-center gap-2 px-2 py-1.5">
                  <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-bold ${klart ? 'bg-[#20c58f]/15 text-[#20c58f]' : arNasta ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 text-slate-300'}`}>
                    {klart ? <Icon name="allman.bock" size={16} className="h-3 w-3" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12px] font-medium text-white">{b.kund}</span>
                      <span className="font-mono text-[11px] text-slate-300">{b.tid}</span>
                    </span>
                    <span className="block truncate text-[10.5px] text-slate-400">{klart ? 'Klart' : arNasta ? `Nästa, ${b.beskr.toLowerCase()}` : b.beskr}, {b.adress}</span>
                  </span>
                </Mal>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
  const hoger = (
    <div className="grid min-w-0 content-start gap-2.5">
      <section>
        <Rubrik rubrik="Att göra" ikon="falt.attgora">Det som väntar på dig och som inte hör till dagens besök.</Rubrik>
        <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
          {([
            { id: 'attgora:boka', antal: 1, rubrik: 'Ärende att boka', detalj: 'Tid saknas', ton: 'gra' as const },
            { id: 'attgora:avsluta', antal: 1, rubrik: 'Besök att avsluta', detalj: 'Datumet har passerat', ton: 'rod' as const },
          ]).map(r => (
            <div key={r.id} className="border-b border-slate-700/60 last:border-b-0">
              <Mal id={r.id} mk={mk} tryck={tryck} className="flex items-center gap-2 px-2 py-1.5">
                <span className="w-5 text-center font-mono text-[13px] font-bold text-white">{r.antal}</span>
                <span className="min-w-0 flex-1 text-[11.5px] text-white">{r.rubrik}</span>
                <Punkt ton={r.ton}>{r.detalj}</Punkt>
                <Icon name="allman.chevron" size={16} className="h-3 w-3 flex-none text-slate-500" />
              </Mal>
            </div>
          ))}
        </div>
      </section>
      <Mal id="imorgon" mk={mk} tryck={tryck} className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-900 px-2 py-2">
        <Icon name="falt.imorgon" size={20} className="h-4 w-4 flex-none text-slate-400" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-medium text-white">Imorgon, {IMORGON.length} besök</span>
          <span className="block truncate text-[10.5px] text-slate-400">Första {IMORGON[0].tid}, {IMORGON[0].kund}</span>
        </span>
        <Icon name="allman.chevron" size={16} className="h-3 w-3 text-slate-500" />
      </Mal>
    </div>
  )
  if (enhet === 'dator') return <div className="grid grid-cols-[minmax(0,1fr)_200px] items-start gap-3">{vanster}{hoger}</div>
  return <Rulla><div className="grid gap-2.5">{vanster}{hoger}</div></Rulla>
}

// ─── Karta ─────────────────────────────────────────

/** Mål på Karta: dag:idag, dag:imorgon, position, stopp:<nr>, och knapparna med prefix stopp- */
export function KartaSida({ dag, vald, klara = [], mk = ingenMk, tryck }: { dag: 'idag' | 'imorgon'; vald: number; klara?: string[]; mk?: Mk; tryck?: Tryck }) {
  const enhet = useGuideEnhet()
  const stopp = dag === 'idag' ? IDAG : IMORGON
  const valt = stopp[Math.min(vald, stopp.length - 1)]
  const valtNr = stopp.indexOf(valt) + 1
  const lagen: [number, number][] = dag === 'idag' ? [[28, 58], [48, 42], [72, 30]] : [[68, 34], [34, 60]]

  const karta = (
    <div className={`relative overflow-hidden bg-[#1f2a33] ${enhet === 'dator' ? 'min-h-[360px] flex-1' : 'h-[150px] flex-none'}`}>
      <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(35deg,#334155_0_2px,transparent_2px_26px)]" aria-hidden />
      <div className="absolute inset-0 opacity-20 [background:repeating-linear-gradient(-55deg,#475569_0_1px,transparent_1px_40px)]" aria-hidden />
      {stopp.map((b, i) => {
        const [x, y] = lagen[i]
        const arVald = b.id === valt.id
        const klart = klara.includes(b.id)
        return (
          <button key={b.id} type="button" onClick={() => tryck?.(`stopp:${i + 1}`)} aria-label={`${i + 1}. ${b.kund}`}
            className={`absolute flex items-center justify-center rounded-full border-2 text-[11px] font-bold ${arVald ? 'h-7 w-7 border-[#04281c] bg-[#20c58f] text-[#04281c]' : klart ? 'h-6 w-6 border-white bg-slate-500 text-[#fff]' : 'h-6 w-6 border-white bg-slate-900 text-[#fff]'}`}
            style={{ left: `${x}%`, top: `${y}%` }}>
            {i + 1}
          </button>
        )
      })}
      <span className="absolute left-[12%] top-[72%] h-4 w-4 rounded-full border-[3px] border-white bg-sky-500" aria-hidden />
      <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
        <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 shadow-lg">
          {(['idag', 'imorgon'] as const).map(d => (
            <Markor key={d} markor={mk(`dag:${d}`)}>
              <button type="button" onClick={() => tryck?.(`dag:${d}`)}
                className={`h-7 rounded-md px-2 text-[10.5px] font-medium ${dag === d ? 'bg-[#20c58f] text-[#04281c]' : 'text-slate-300'}`}>
                {d === 'idag' ? `Idag, ${IDAG.length} stopp` : `Imorgon, ${IMORGON.length} stopp`}
              </button>
            </Markor>
          ))}
        </div>
        <Markor markor={mk('position')}>
          <button type="button" onClick={() => tryck?.('position')} aria-label="Visa min position"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-sky-400 shadow-lg">
            <Icon name="falt.position" size={20} className="h-4 w-4" />
          </button>
        </Markor>
      </div>
    </div>
  )

  const panel = (
    <section className={`relative z-10 overflow-hidden bg-slate-900 ${enhet === 'dator' ? 'w-[230px] flex-none border-l border-slate-700/60 p-2.5' : '-mt-3 flex-1 rounded-t-2xl border-t border-slate-700/60 px-2.5 pb-2 pt-1.5'}`}>
      {enhet === 'mobil' && <span aria-hidden className="mx-auto mb-1.5 block h-1 w-8 rounded-full bg-slate-600" />}
      <p className="text-[11.5px] font-semibold text-white">Siffrorna visar ordningen du kör i</p>
      <div className="mt-1.5 flex items-start gap-2">
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#20c58f] text-[12px] font-bold text-[#04281c]">{valtNr}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-400">Stopp {valtNr} av {stopp.length}{dag === 'idag' && valtNr === 1 ? ', nästa, om 25 min' : ''}</p>
          <p className="truncate text-[12.5px] font-semibold text-white">{valt.kund}</p>
          <p className="truncate text-[10.5px] text-slate-400">{valt.adress}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-300"><span className="font-mono font-semibold">{valt.tid}</span><Icon name={TYP_IKON[valt.typ]} size={16} className="h-3 w-3 text-slate-400" />{valt.beskr}</p>
          {dag === 'idag' && <div className="mt-1"><RestidRad /></div>}
        </div>
      </div>
      <div className="mt-1.5"><BesokKnappar mk={mk} tryck={tryck} prefix="stopp-" liten /></div>
      <ol className="mt-1.5 border-t border-slate-700/60">
        {stopp.map((b, i) => (
          <li key={b.id} className="border-b border-slate-700/60 last:border-b-0">
            <Mal id={`stopp:${i + 1}`} mk={mk} tryck={tryck} className="flex items-center gap-1.5 py-1">
              <span className={`flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold ${b.id === valt.id ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 text-slate-300'}`}>{i + 1}</span>
              <span className="w-9 flex-none font-mono text-[10.5px] text-slate-300">{b.tid}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-white">{b.kund}</span>
              <span className="max-w-[35%] truncate text-[10px] text-slate-400">{b.beskr}</span>
            </Mal>
          </li>
        ))}
      </ol>
    </section>
  )

  if (enhet === 'dator') return <div className="-m-3 flex min-h-[380px]">{karta}{panel}</div>
  return <div className="-m-2.5 flex h-[calc(100%+20px)] flex-col">{karta}{panel}</div>
}

// ─── Mer (telefon) ─────────────────────────────────

/** Sidan Mer i telefonen: allt som inte står i bottenmenyn. Mål nav:<namn>. */
export function MerSida({ mk = ingenMk, tryck }: { mk?: Mk; tryck?: Tryck }) {
  const iBotten = new Set(['Idag', 'Karta', 'Mina ärenden'])
  return (
    <div className="grid gap-2 overflow-hidden">
      {NY_NAV_GRUPPER.map(g => {
        const lankar = g.lankar.filter(l => !iBotten.has(l.label))
        if (!lankar.length) return null
        return (
          <div key={g.label}>
            <p className="px-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
            <div className="rounded-lg border border-slate-700/60 bg-slate-900">
              {lankar.map(l => (
                <Mal key={l.label} id={`nav:${l.label}`} mk={mk} tryck={tryck} className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-slate-200">
                  <Icon name={l.ikon} size={16} className="text-slate-400" />{l.label}
                </Mal>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Ärendet i stegflödet ──────────────────────────

/** Ärendet öppnat på steget Framme, som EditCaseModal i nya vyn. Mål: nasta, stang, flikvy, verktyg. */
export function ArendeFramme({ b, markor, tryck }: { b: ExBesok; markor?: NyMarkor; tryck?: Tryck }) {
  const privat = b.typ === 'private' || b.typ === 'business'
  return (
    <NyArende
      typ={privat ? 'privat' : b.typ === 'establishment' ? 'establishment' : 'inspection'}
      aktivt="framme" nr={b.nr} status={b.status} statusFarg="bg-sky-400" kund={`${b.kund}, ${b.adress}`}
      nastaText="Jag är framme" markor={markor}
      onNasta={() => tryck?.('nasta')} onIkon={m => tryck?.(m)}>
      <NyHjalp rubrik="Är du framme hos kunden?">Tryck på den gröna knappen när du står på plats. Kontrollera kontakten och adressen.</NyHjalp>
      <div className="grid gap-1.5">
        <span className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 text-[11.5px] font-semibold text-white"><Icon name="falt.navigera" size={16} />Öppna i kartor</span>
        {b.telefon && <span className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/60 text-[11.5px] font-semibold text-white"><Icon name="kontakt.telefon" size={16} />Ring {b.telefon}</span>}
      </div>
    </NyArende>
  )
}
