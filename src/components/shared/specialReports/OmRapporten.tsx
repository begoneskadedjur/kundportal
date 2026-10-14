// src/components/shared/specialReports/OmRapporten.tsx
// Vyn "Om rapporten" i redigeraren (3.53.0): en mörkgrön framsidesbanderoll
// med titeln, period, version, fyra siffror och en kartminiatyr, ett kundkort
// som fungerar för alla ärendetyper, typ av rapport som tre kort och
// inledningen med startfraser. Banderollen har fasta färger (samma i båda
// temana), korten följer temat via slate-klasserna.

import { useRef, type KeyboardEvent } from 'react'
import { Icon, type IconName } from '../../icons/Icon'
import type { SpecialReportCaseType, SpecialReportDocType, SpecialReportFull } from '../../../types/specialReport'
import AreaMiniMap from './AreaMiniMap'
import { DOC_TYPES, KORT, SNYGGA_KNAPP, TEXTFALT, fargForDel, foreslaDokumenttyp } from './specialReportUtils'

const DOK_INFO: Record<SpecialReportDocType, { ikon: IconName; text: string }> = {
  Inspektionsrapport: { ikon: 'rapport.inspektion', text: 'Vad vi undersökte och hittade' },
  Saneringsrapport: { ikon: 'rapport.sanering', text: 'Vad vi gjorde för att bli av med problemet' },
  Åtgärdsrapport: { ikon: 'rapport.atgard', text: 'Arbete som utförts, till exempel tätning' },
}

const KUNDTYP: Record<SpecialReportCaseType, string> = {
  contract: 'Avtalskund',
  business: 'Företag, engångsuppdrag',
  private: 'Privatperson',
}

const STARTFRASER = ['Kunden kontaktade oss om', 'Uppdraget omfattar', 'Rapporten beskriver']

/** Initialer ur namnet: första bokstaven i de två första orden */
function initialer(namn: string): string {
  const ord = namn.trim().split(/\s+/).filter(Boolean)
  const bokstaver = ord.slice(0, 2).map(o => Array.from(o)[0] ?? '').join('')
  return bokstaver.toUpperCase() || '?'
}

const antal = (n: number, en: string, flera: string) => `${n === 1 ? en : flera}`

interface OmRapportenProps {
  report: SpecialReportFull
  onTitle: (titel: string) => void
  onDocType: (typ: SpecialReportDocType) => void
  onIntro: (text: string | null) => void
  onPolish: () => void
}

export default function OmRapporten({ report, onTitle, onDocType, onIntro, onPolish }: OmRapportenProps) {
  const introRef = useRef<HTMLTextAreaElement>(null)
  const typRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ── Siffror och period ──
  const datum = report.sections.flatMap(s => s.events.map(e => e.event_date)).filter(Boolean).sort()
  const fran = datum[0] ?? null
  const till = datum[datum.length - 1] ?? null
  const period = fran && till ? (fran === till ? fran : `${fran} till ${till}`) : 'Inga händelser än'
  const antalHandelser = report.sections.reduce((n, s) => n + s.events.length, 0)
  const antalBilder = report.sections.reduce((n, s) => n + s.images.length, 0)
  const omraden = report.sections
    .map((s, i) => ({ area: s.area ?? [], color: fargForDel(s.color, i) }))
    .filter(o => o.area.length >= 3)
  const siffror: [number, string][] = [
    [report.sections.length, antal(report.sections.length, 'del', 'delar')],
    [antalHandelser, antal(antalHandelser, 'händelse', 'händelser')],
    [antalBilder, antal(antalBilder, 'bild', 'bilder')],
    [omraden.length, antal(omraden.length, 'ritat område', 'ritade områden')],
  ]

  // ── Kunden ──
  const kundnamn = report.customer_name?.trim() || report.contact_name?.trim() || 'Okänd kund'
  const adressDelar = (report.address ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const telefon = report.contact_phone?.trim() || null
  // Bara siffror och plus i tel:-länken, ingen länk om inget nummer blir kvar
  const telLank = telefon?.replace(/[^\d+]/g, '') || null
  const epost = report.contact_email?.trim() || null
  const adress = report.address?.trim() || null

  // ── Typ av rapport ──
  const forslag = foreslaDokumenttyp(report.title)
  const valdIndex = Math.max(0, DOC_TYPES.indexOf(report.doc_type))
  const typPil = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const steg = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (!steg) return
    e.preventDefault()
    const n = (i + steg + DOC_TYPES.length) % DOC_TYPES.length
    onDocType(DOC_TYPES[n])
    typRefs.current[n]?.focus()
  }

  // ── Inledningens startfraser: vid markören, eller i ett tomt fält ──
  const sattIn = (fras: string) => {
    const falt = introRef.current
    const nu = report.intro ?? ''
    let start = nu.length
    let slut = nu.length
    // Knapparna tar inte fokus vid klick, så fältet har kvar markören. Utan fokus läggs frasen sist
    if (falt && document.activeElement === falt) {
      start = falt.selectionStart ?? nu.length
      slut = falt.selectionEnd ?? start
    }
    const fore = nu.slice(0, start)
    const efter = nu.slice(slut)
    const mellanslagFore = fore && !/\s$/.test(fore) ? ' ' : ''
    const insatt = `${mellanslagFore}${fras} `
    const ny = fore + insatt + efter.replace(/^ /, '')
    onIntro(ny)
    const markor = (fore + insatt).length
    requestAnimationFrame(() => {
      introRef.current?.focus()
      introRef.current?.setSelectionRange(markor, markor)
    })
  }

  return (
    <div className="@container space-y-2.5">
      {/* ── Framsidesbanderoll: fasta färger ── */}
      <section
        aria-label="Rapportens framsida"
        className="relative flex flex-col gap-5 overflow-hidden rounded-[22px] bg-[#0f2a22] p-5 text-[#fff] @2xl:flex-row @2xl:items-stretch @2xl:gap-7 @2xl:px-[30px] @2xl:py-[26px]"
      >
        <span className="pointer-events-none absolute -right-10 -top-16 h-[360px] w-[360px] rounded-full bg-[#20c58f]/[0.12]" aria-hidden="true" />
        <div className="relative flex min-w-0 flex-1 flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6ee7b7]">Rapportens framsida</span>
          <div data-falt="rapport:title">
            <input
              aria-label="Rapportens titel"
              value={report.title}
              onChange={e => onTitle(e.target.value)}
              className="w-full border-0 border-b-2 border-transparent bg-transparent px-0 py-0.5 text-2xl font-extrabold text-[#fff] placeholder-[#ffffff66] outline-none focus:border-[#6ee7b7] focus:ring-0 @2xl:text-[30px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-[18px] gap-y-1.5 text-[13px] text-[#a7f3d0]">
            <span className="flex items-center gap-1.5">
              <Icon name="rapport.lank" size={16} />
              <span className="font-mono">{report.case_number || 'Ärendenummer saknas'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Icon name="allman.kalender" size={16} />
              {period}
            </span>
            <span>Version {report.current_version} pågår</span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-x-[22px] gap-y-3 border-t border-[#ffffff22] pt-3.5 @md:flex">
            {siffror.map(([n, etikett]) => (
              <span key={etikett} className="flex flex-col">
                <span className="text-[26px] font-extrabold leading-tight">{n}</span>
                <span className="text-xs text-[#a7f3d0]">{etikett}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="relative h-[190px] w-full flex-shrink-0 overflow-hidden rounded-2xl border-2 border-[#ffffff33] @2xl:w-[300px]">
          {omraden.length > 0 ? (
            <>
              <AreaMiniMap areas={omraden} view={report.map_view} className="absolute inset-0 h-full w-full bg-[#3f5a3c]" />
              {report.address && (
                <span className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-20px)] truncate rounded-lg bg-[#0f172a]/80 px-2 py-1 text-[11px] text-[#fff]">
                  {report.address}
                </span>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#ffffff0d] px-5 text-center">
              <Icon name="rapport.adress" size={32} className="text-[#6ee7b7]" />
              <span className="text-sm font-semibold text-[#fff]">{adressDelar[0] || 'Adress saknas'}</span>
              {adressDelar.length > 1 && <span className="text-xs text-[#a7f3d0]">{adressDelar.slice(1).join(', ')}</span>}
              <span className="text-[11px] text-[#a7f3d0]/80">Inga områden ritade</span>
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2.5 @2xl:grid-cols-[1.1fr_1fr]">
        {/* ── Kunden ── */}
        <section aria-label="Kunden" className={`@container flex flex-col gap-3.5 rounded-xl p-3 @2xl:px-3.5 @2xl:py-3 ${KORT}`}>
          <span className="text-[13px] font-bold text-white">Kunden</span>
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-indigo-500/10 text-base font-extrabold text-indigo-400" aria-hidden="true">
              {initialer(kundnamn)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="break-words text-base font-bold text-white">{kundnamn}</span>
              <span className="text-xs text-slate-400">{KUNDTYP[report.case_type] ?? 'Kund'}</span>
              {/* Kundnummer för alla typer när det finns (privatpersoner kan ha ett via Fortnox-spegeln), varning bara för avtalskunder */}
              {report.customer_number ? (
                <span className="text-[13px] text-slate-300">Kundnummer <span className="font-mono">{report.customer_number}</span></span>
              ) : report.case_type === 'contract' ? (
                <span className="flex items-center gap-1.5 text-[13px] text-amber-400">
                  <span className="h-[7px] w-[7px] rounded-full bg-amber-400" aria-hidden="true" />
                  Kundnummer saknas i Fortnox
                </span>
              ) : null}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 @sm:grid-cols-2">
            <KundRad ikon="rapport.person" etikett="Kontaktperson" varde={report.contact_name?.trim() || null} />
            <KundRad ikon="kontakt.telefon" etikett="Telefon" varde={telefon} href={telLank ? `tel:${telLank}` : undefined} />
            <KundRad ikon="kontakt.mejl" etikett="E-post" varde={epost} href={epost ? `mailto:${epost.replace(/\s+/g, '')}` : undefined} />
            <KundRad
              ikon="rapport.adress"
              etikett="Adress"
              varde={adress}
              href={adress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adress)}` : undefined}
              nyFlik
            />
          </div>
        </section>

        {/* ── Typ av rapport ── */}
        <section aria-label="Typ av rapport" data-falt="rapport:doc_type" className={`flex flex-col gap-3 rounded-xl p-3 @2xl:px-3.5 @2xl:py-3 ${KORT}`}>
          <span className="text-[13px] font-bold text-white" id="typ-av-rapport">Typ av rapport</span>
          <div role="radiogroup" aria-labelledby="typ-av-rapport" className="flex flex-col gap-2">
            {DOC_TYPES.map((d, i) => {
              const vald = report.doc_type === d
              return (
                <button
                  key={d}
                  ref={el => { typRefs.current[i] = el }}
                  type="button"
                  role="radio"
                  aria-checked={vald}
                  tabIndex={i === valdIndex ? 0 : -1}
                  onClick={() => onDocType(d)}
                  onKeyDown={e => typPil(e, i)}
                  className={`flex min-h-[60px] items-center gap-3 rounded-[14px] border-2 px-3 py-2.5 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60 ${
                    vald ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${vald ? 'bg-[#20c58f] text-[#04140d]' : 'bg-slate-800 text-slate-400'}`}>
                    <Icon name={DOK_INFO[d].ikon} size={20} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-sm text-white ${vald ? 'font-bold' : 'font-semibold'}`}>{d}</span>
                    <span className="text-xs text-slate-400">{DOK_INFO[d].text}</span>
                  </span>
                  {forslag === d && <span className="flex-shrink-0 text-[11px] text-emerald-400">Förslag för ärendet</span>}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      {/* ── Inledning ── */}
      <section aria-label="Inledning" className={`flex flex-col gap-2.5 rounded-xl p-3 @2xl:px-3.5 @2xl:py-3 ${KORT}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] font-bold text-white">Inledning</span>
            <span className="text-xs text-slate-400">Det första kunden läser. Två eller tre meningar räcker.</span>
          </span>
          <button type="button" aria-label="Snygga till inledningen" title="Snygga till inledningen" onClick={onPolish} className={SNYGGA_KNAPP}>
            <Icon name="rapport.snygga" size={16} />
            <span className="hidden sm:inline">Snygga till</span>
          </button>
        </div>
        <div data-falt="rapport:intro">
          <textarea
            ref={introRef}
            aria-label="Inledning"
            value={report.intro ?? ''}
            onChange={e => onIntro(e.target.value || null)}
            rows={4}
            placeholder={`Till exempel: ${kundnamn === 'Okänd kund' ? 'Kunden' : kundnamn} kontaktade oss om spår av råttor i två byggnader. Vi har inspekterat, åtgärdat och följt upp.`}
            className={`${TEXTFALT} rounded-[14px] px-4 py-3 text-[15px]`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Börja med</span>
          {STARTFRASER.map(f => (
            <button
              key={f}
              type="button"
              // Markören i fältet ska inte tappas innan frasen sätts in
              onMouseDown={e => e.preventDefault()}
              onClick={() => sattIn(f)}
              className="h-11 rounded-[10px] border border-dashed border-slate-600 px-3 text-xs text-slate-300 hover:border-[#20c58f] hover:text-white"
            >
              {f} ...
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/** En rad i kundkortet: ikon, etikett och värde. Länk när det finns något att öppna */
function KundRad({ ikon, etikett, varde, href, nyFlik = false }: { ikon: IconName; etikett: string; varde: string | null; href?: string; nyFlik?: boolean }) {
  const innehall = (
    <>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-emerald-400 shadow-[0_1px_2px_rgba(15,23,42,0.08)]">
        <Icon name={ikon} size={16} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] text-slate-500">{etikett}</span>
        <span className={`break-words text-[13px] ${varde ? 'text-white' : 'text-slate-500'}`}>{varde ?? 'Saknas'}</span>
      </span>
    </>
  )
  const klass = 'flex min-h-[52px] items-center gap-2.5 rounded-xl bg-slate-800/60 px-3 py-2'
  if (!href || !varde) return <div className={klass}>{innehall}</div>
  return (
    <a
      href={href}
      {...(nyFlik ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`${klass} transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60`}
    >
      {innehall}
    </a>
  )
}
