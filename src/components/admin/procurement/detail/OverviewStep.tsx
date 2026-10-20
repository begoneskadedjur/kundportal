// src/components/admin/procurement/detail/OverviewStep.tsx
// Steg 1 Översikt (docs/upphandlingsportal-ux-plan.md avsnitt 3): tre frågor.
// Vad (AI-sammanfattning, det här avgör affären, omfattning), är den värd det
// (årsvärde, förväntat antal anbud, sannolikhet, förväntat TB) och köparen i
// korthet (nuvarande leverantör, avtalsslut, byter köparen leverantör, länk
// till köparprofilen). Under dem tidslinjens datum på en rad, konkurrensen i
// korthet och anteckningar. Ersätter blocken Identitet, Tidslinje (datumen),
// Affären (sammanfattningen), Köparhistorik och Konkurrens sedan 3.64.0.
// I RFI-läget (sedan 3.71.0) ersätts "Är den värd det" av en kort förklaring
// av vad en RFI är och när svaret ska vara inne.

import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { AwardWithRelations, NoticeWithRelations } from '../../../../services/procurementService'
import { NOTICE_KIND_LABEL } from '../../../../types/procurement'
import { SE_COUNTIES, annualValueOf, estimateWinProbability, swedishDate, todaySwedish, windowReferenceEnd } from '../../../../shared/procurementRules'
import { Icon } from '../../../icons/Icon'
import { LinkButton } from '../ui'
import { daysUntil, fmtDate, fmtKr, fmtKrShort, fmtNum, fmtPct, fmtRelativeDays } from '../uiFormat'
import { BlurText, Block, inputCls, type SaveNotice } from './fields'
import { errMsg, stockholmIso, switchConclusion, winnerKey, winnerName } from './helpers'
import { procurementPath } from '../../../../lib/procurementPortal'
import OptionPeriodHint from '../clock/OptionPeriodHint'
import { optionPeriodOfAward } from '../clock/optionPeriod'

const RULE_LABEL: Record<string, string> = {
  cpv_hard: 'CPV-träff',
  cpv_soft: 'Närliggande CPV',
  keyword: 'Nyckelord',
  negative: 'Negativt ord',
  county: 'Län',
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function dayOf(v: string | null | undefined): string | null {
  if (!v) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : swedishDate(v)
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-1 text-[13px]">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-200 tabular-nums min-w-0 break-words">{children}</dd>
    </div>
  )
}

interface Props {
  notice: NoticeWithRelations
  buyerAwards: AwardWithRelations[]
  noticeAwards: AwardWithRelations[]
  onSave: SaveNotice
  /** RFI-läget: förklaring och Svar senast i stället för affärens värde */
  rfi?: { questions: number; approved: number } | null
}

export default function OverviewStep({ notice, buyerAwards, noticeAwards, onSave, rfi = null }: Props) {
  const [showDesc, setShowDesc] = useState(false)
  const [showReasons, setShowReasons] = useState(false)
  const [editQ, setEditQ] = useState(false)
  const [qDate, setQDate] = useState(dayOf(notice.questions_deadline) ?? '')

  const annual = notice.annual_value ?? annualValueOf(notice.estimated_value, notice.duration_months)
  const buyerBids = median(buyerAwards.map((a) => Number(a.bids_received)).filter((n) => n > 0))
  const expectedBids = notice.expected_bids ?? (buyerBids != null ? Math.round(buyerBids) : null)
  const prob =
    notice.win_probability ??
    estimateWinProbability({ expectedOtherBids: expectedBids && expectedBids > 1 ? expectedBids - 1 : null, criteriaType: notice.criteria_type }).probability
  const counties = notice.county_names.length > 0 ? notice.county_names : notice.county_codes.map((c) => SE_COUNTIES[c] ?? c)

  // Köparen i korthet: senaste omgången (flera vinnare samma dag räknas som en)
  const buyer = useMemo(() => {
    const dated = buyerAwards.filter((a) => a.award_date && a.notice_id !== notice.id).sort((a, b) => String(b.award_date).localeCompare(String(a.award_date)))
    const latestDate = dated[0]?.award_date ?? null
    const latest = dated.filter((a) => a.award_date === latestDate)
    // Basavtalets slut (eller rättat slut) som slutdatum, optionstiden bakom ikonen (sedan 3.66.0)
    const endOf = (a: AwardWithRelations) => windowReferenceEnd({ correctedEnd: a.corrected_end_date, baseEnd: a.base_end_date, calcEnd: a.calc_end_date })
    const endAward = [...latest].filter((a) => endOf(a)).sort((a, b) => String(endOf(a)).localeCompare(String(endOf(b)))).pop() ?? null
    const end = endAward ? endOf(endAward) : null
    const period = endAward ? optionPeriodOfAward(endAward) : null
    return { latest, latestDate, end, period, conclusion: switchConclusion(buyerAwards) }
  }, [buyerAwards, notice.id])

  // Konkurrensen i korthet: leverantörer som vunnit hos köparen, flest vinster först
  const rivals = useMemo(() => {
    const map = new Map<string, { name: string; id: string | null; wins: number; begone: boolean; last: string | null }>()
    for (const a of buyerAwards) {
      const k = winnerKey(a)
      if (!k) continue
      const r = map.get(k) ?? { name: winnerName(a), id: a.supplier_id, wins: 0, begone: !!a.supplier?.is_begone, last: null }
      r.wins++
      const y = a.award_date?.slice(0, 4) ?? null
      if (y && (!r.last || y > r.last)) r.last = y
      map.set(k, r)
    }
    return [...map.values()].sort((a, b) => b.wins - a.wins).slice(0, 4)
  }, [buyerAwards])

  const awardDate = dayOf(notice.award_decision_at) ?? dayOf(noticeAwards.find((a) => a.award_date)?.award_date ?? null)
  const points: Array<{ key: string; label: string; date: string | null; edit?: boolean }> = rfi
    ? [
        { key: 'published', label: 'Publicerad', date: notice.published_at },
        { key: 'deadline', label: 'Svar senast', date: notice.tender_deadline },
      ]
    : [
        { key: 'published', label: 'Publicerad', date: notice.published_at },
        { key: 'questions', label: 'Frågor senast', date: notice.questions_deadline, edit: true },
        { key: 'deadline', label: 'Sista anbudsdag', date: notice.tender_deadline },
        { key: 'award', label: awardDate && daysUntil(awardDate)! < 0 ? 'Tilldelning' : 'Tilldelning väntas', date: awardDate },
        { key: 'start', label: 'Avtalsstart', date: notice.contract_start },
        { key: 'end', label: 'Avtalsslut', date: notice.contract_end },
      ]
  const nextKey = points.find((p) => p.date && (daysUntil(p.date) ?? -1) >= 0)?.key

  const saveQuestions = async () => {
    try {
      await onSave({ questions_deadline: qDate ? stockholmIso(qDate, '23:59') : null }, qDate ? `Frågor senast satt till ${qDate}` : 'Frågor senast borttaget')
      setEditQ(false)
      toast.success('Datumet sparat')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara datumet'))
    }
  }

  const saveNotes = async (v: string | null) => {
    try {
      await onSave({ notes: v }, 'Anteckningar ändrade')
      toast.success('Anteckningarna sparade')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara anteckningarna'))
    }
  }

  const reasons = notice.match_reasons ?? []

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Block title="Vad" framed={false}>
          {notice.ai_summary ? (
            <p className="text-[13.5px] leading-relaxed text-slate-300 whitespace-pre-line">{notice.ai_summary}</p>
          ) : notice.description ? (
            <>
              <p className={`text-[13.5px] leading-relaxed text-slate-300 whitespace-pre-line ${showDesc ? '' : 'line-clamp-6'}`}>{notice.description}</p>
              {notice.description.length > 400 && (
                <LinkButton tone="muted" onClick={() => setShowDesc((s) => !s)}>
                  {showDesc ? 'Visa mindre' : 'Visa hela beskrivningen'}
                </LinkButton>
              )}
            </>
          ) : (
            <p className="text-[13px] text-slate-500">Ingen beskrivning. Lägg in underlaget i steget Underlag så sammanfattar AI det.</p>
          )}
          {notice.ai_deciders && notice.ai_deciders.length > 0 && (
            <>
              <h3 className="mt-4 mb-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">Det här avgör affären</h3>
              <ul className="space-y-1">
                {notice.ai_deciders.map((d, i) => (
                  <li key={i} className="flex gap-2 text-[13px] text-slate-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#20c58f] shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </>
          )}
          <dl className="mt-4">
            <Row label="Län">{counties.length > 0 ? counties.join(', ') : '–'}</Row>
            <Row label="Typ">
              {NOTICE_KIND_LABEL[notice.notice_kind] ?? notice.notice_kind}
              {notice.is_framework != null ? `, ${notice.is_framework ? 'ramavtal' : 'kontrakt'}` : ''}
              {notice.procedure_type ? `, ${notice.procedure_type}` : ''}
            </Row>
            <Row label="Matchpoäng">
              <button type="button" onClick={() => setShowReasons((s) => !s)} className="text-left hover:text-[#20c58f]" aria-expanded={showReasons}>
                <span className={notice.match_score >= 100 ? 'text-[#20c58f] font-semibold' : ''}>{notice.match_score}</span>
                <span className="text-slate-500"> {notice.match_score >= 100 ? 'direktträff' : notice.match_score >= 60 ? 'träff' : 'under tröskeln'}, {showReasons ? 'dölj varför' : 'visa varför'}</span>
              </button>
            </Row>
          </dl>
          {showReasons && (
            <ul className="mt-1 space-y-0.5">
              {reasons.length === 0 && <li className="text-[12px] text-slate-500">Ingen förklaring sparad.</li>}
              {reasons.map((r, i) => (
                <li key={i} className="flex items-baseline gap-2 text-[12px] text-slate-400">
                  <span className={`tabular-nums w-10 text-right ${r.points < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                    {r.points > 0 ? '+' : ''}
                    {r.points}
                  </span>
                  <span>
                    {RULE_LABEL[r.rule] ?? r.rule}: {r.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        {rfi ? (
          <Block icon="upphandling.rfi" title="Det här är en RFI" framed={false}>
            <p className="text-[13.5px] leading-relaxed text-slate-300">
              En RFI (förfrågan om information) är köparens sätt att lära sig marknaden innan upphandlingen skrivs. Den är inte bindande och har inget pris. BeGone svarar på köparens frågor, och svaren kan påverka vilka krav som ställs i den kommande upphandlingen.
            </p>
            <dl className="mt-4">
              <Row label="Svar senast">
                {notice.tender_deadline ? (
                  <>
                    {fmtDate(notice.tender_deadline)} <span className="text-slate-500">{fmtRelativeDays(notice.tender_deadline)}</span>
                  </>
                ) : (
                  'Ej angivet'
                )}
              </Row>
              <Row label="Frågor">{rfi.questions > 0 ? `${rfi.questions}, ${rfi.approved} godkända svar` : 'Inte inlästa, se Underlag'}</Row>
            </dl>
          </Block>
        ) : (
        <Block title="Är den värd det" framed={false}>
          <dl>
            <Row label="Årsvärde">
              <span className={notice.annual_value == null && annual != null ? 'text-slate-400' : ''}>{annual != null ? fmtKr(annual) : '–'}</span>
              {notice.annual_value == null && annual != null && <span className="block text-[11px] text-slate-500">beräknat ur värde och avtalstid</span>}
            </Row>
            <Row label="Uppskattat totalt">
              {fmtKr(notice.estimated_value)}
              {notice.value_currency && notice.value_currency !== 'SEK' ? ` (${notice.value_currency})` : ''}
            </Row>
            <Row label="Avtalstid">
              {notice.duration_months ? `${fmtNum(notice.duration_months)} månader` : '–'}
              {notice.renewal_max != null ? `, högst ${notice.renewal_max} förlängningar` : ''}
            </Row>
            <Row label="Förväntade anbud">
              {expectedBids != null ? fmtNum(expectedBids) : '–'}
              {notice.expected_bids == null && buyerBids != null ? <span className="text-slate-500">, median hos köparen</span> : null}
            </Row>
            <Row label="Sannolikhet">
              {fmtPct(prob)}
              {notice.win_probability == null && <span className="text-slate-500">, grov bas</span>}
            </Row>
            <Row label="Förväntat TB">{notice.expected_contribution != null ? `${fmtKr(notice.expected_contribution)}/år` : 'Räknas i steget Kalkyl'}</Row>
          </dl>
        </Block>
        )}

        <Block title="Köparen i korthet" framed={false}>
          {!notice.buyer_id ? (
            <p className="text-[13px] text-slate-500">Köparen är inte kopplad till registret. Historiken visas när köparen matchats på orgnr.</p>
          ) : (
            <>
              <dl>
                <Row label="Nuvarande avtal">
                  {buyer.latest.length > 0
                    ? `${buyer.latest.map((a) => winnerName(a)).join(' och ')}${buyer.latestDate ? ` sedan ${buyer.latestDate.slice(0, 4)}` : ''}`
                    : 'Ingen känd tilldelning'}
                </Row>
                <Row label="Avtalsslut">
                  <span className="inline-flex items-center gap-1">
                    {fmtDate(buyer.end)}
                    <OptionPeriodHint period={buyer.period} today={todaySwedish()} />
                  </span>
                </Row>
                <Row label="Senast">{buyer.latest[0]?.bids_received != null ? `${buyer.latest[0].bids_received} anbud` : '–'}</Row>
                <Row label="Kontaktperson">
                  {notice.contact_name || notice.contact_email ? (
                    <span className="inline-flex flex-col">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="upphandling.kontaktperson" size={16} className="text-slate-500" />
                        {notice.contact_name ?? notice.contact_email}
                      </span>
                      {(notice.contact_phone || (notice.contact_name && notice.contact_email)) && (
                        <span className="text-[12px] text-slate-400 break-all">{[notice.contact_phone, notice.contact_name ? notice.contact_email : null].filter(Boolean).join(' · ')}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-500">Ingen i annonsen, se köparprofilen</span>
                  )}
                </Row>
              </dl>
              <p className="mt-2 text-[12.5px] text-slate-400">{buyer.conclusion}</p>
              <Link to={procurementPath(`/kopare/${notice.buyer_id}`)} className="inline-flex items-center min-h-[44px] text-[13px] text-[#20c58f] hover:underline">
                Hela köparprofilen
              </Link>
            </>
          )}
        </Block>
      </div>

      <Block icon="allman.kalender" title="När" framed={false}>
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-3 border-t border-slate-800 pt-3">
          {points.map((p) => {
            const d = daysUntil(p.date)
            const past = d != null && d < 0
            return (
              <li key={p.key} className="relative pl-3.5 min-w-0">
                <span className={`absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full ${!p.date ? 'bg-slate-700' : p.key === nextKey ? 'bg-amber-400' : past ? 'bg-slate-600' : 'bg-[#20c58f]'}`} />
                {p.edit && editQ ? (
                  <div className="flex flex-col gap-1">
                    <input type="date" className={`${inputCls} w-full`} value={qDate} onChange={(e) => setQDate(e.target.value)} aria-label="Frågor senast" />
                    <span className="flex gap-3">
                      <LinkButton onClick={() => void saveQuestions()}>Spara</LinkButton>
                      <LinkButton tone="muted" onClick={() => setEditQ(false)}>Avbryt</LinkButton>
                    </span>
                  </div>
                ) : (
                  <>
                    <div className={`text-[13px] font-semibold tabular-nums ${!p.date ? 'text-slate-600' : past ? 'text-slate-400' : 'text-slate-100'}`}>{fmtDate(p.date)}</div>
                    <div className="text-[12px] text-slate-500">
                      {p.label}
                      {p.date && p.key === nextKey ? `, ${fmtRelativeDays(p.date)}` : ''}
                    </div>
                    {p.edit && (
                      <LinkButton
                        tone="muted"
                        onClick={() => {
                          setQDate(dayOf(notice.questions_deadline) ?? '')
                          setEditQ(true)
                        }}
                      >
                        Ändra
                      </LinkButton>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ol>
      </Block>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Block icon="upphandling.konkurrent" title="Konkurrensen i korthet" framed={false}>
          {rivals.length === 0 ? (
            <p className="text-[13px] text-slate-500">Inga kända vinnare hos köparen. I marknaden i stort brukar två anbudsgivare svara.</p>
          ) : (
            <ul className="divide-y divide-slate-800 border-y border-slate-800">
              {rivals.map((r) => (
                <li key={r.name} className="flex items-center gap-3 py-2 text-[13px]">
                  {r.id ? (
                    <Link to={procurementPath(`/konkurrenter/${r.id}`)} className={`flex-1 min-w-0 truncate hover:text-[#20c58f] ${r.begone ? 'text-[#20c58f]' : 'text-slate-200'}`}>
                      {r.name}
                    </Link>
                  ) : (
                    <span className={`flex-1 min-w-0 truncate ${r.begone ? 'text-[#20c58f]' : 'text-slate-200'}`}>{r.name}</span>
                  )}
                  <span className="text-[12px] tabular-nums text-slate-500">
                    {r.wins === 1 ? '1 vinst' : `${r.wins} vinster`}
                    {r.last ? `, senast ${r.last}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {buyerAwards.some((a) => a.value != null) && (
            <p className="mt-2 text-[12px] text-slate-500">
              Kända värden hos köparen {fmtKrShort(Math.min(...buyerAwards.filter((a) => a.value != null).map((a) => Number(a.value))))} till{' '}
              {fmtKrShort(Math.max(...buyerAwards.filter((a) => a.value != null).map((a) => Number(a.value))))}, oftast ramtak.
            </p>
          )}
        </Block>

        <Block icon="allman.anteckning" title="Anteckningar" framed={false}>
          <BlurText value={notice.notes} multiline rows={4} onCommit={(v) => void saveNotes(v)} placeholder="Interna anteckningar, t.ex. samtal med köparen" ariaLabel="Anteckningar" />
        </Block>
      </div>
    </div>
  )
}
