// src/components/admin/intranet/IntranetGuideStats.tsx
// Läsloggen för handbokens guider (admin, Läskvittenser > Guider).
// Per person: vilka av guiderna för personens roller som är öppnade och
// genomgångna, och varje gång en guide öppnats. Per guide: hur många i
// målgruppen som läst den. Loggen finns sedan 2026-10-22 (3.76.0).
//
// Genomgången = Markera som läst för aktuell version, eller alla rätt på
// Kolla att du kan. Öppnad = guiden öppnad minst en gång.

import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Download, RefreshCw, Loader2 } from 'lucide-react'
import { Icon } from '../../icons/Icon'
import { IntranetService, type GuideStatsData, type GuideStatsUser } from '../../../services/intranetService'
import type { IntranetDocument, IntranetGuideStat, IntranetGuideView } from '../../../types/intranet'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
  'säljare': 'Säljare',
}

type Status = 'genomgangen' | 'oppnad' | 'ej'

const STATUS: Record<Status, { text: string; dot: string; color: string }> = {
  genomgangen: { text: 'Genomgången', dot: 'bg-[#20c58f]', color: 'text-[#20c58f]' },
  oppnad: { text: 'Öppnad', dot: 'bg-amber-400', color: 'text-amber-300' },
  ej: { text: 'Ej öppnad', dot: 'bg-slate-500', color: 'text-slate-400' },
}

/** Är guiden till för personen? Samma regel som handboken, men med alla personens roller */
function galler(d: IntranetDocument, u: GuideStatsUser): boolean {
  const roller = d.audience_roles || []
  const ids = d.audience_user_ids || []
  if (roller.length === 0 && ids.length === 0) return true
  return roller.some(r => u.roller.has(r)) || ids.includes(u.user_id)
}

/** Vem guiden är för, kort */
function forVem(d: IntranetDocument): string {
  const r = d.audience_roles || []
  if (r.length === 0) return 'Alla'
  return r.map(x => ROLE_LABELS[x] || x).join(', ')
}

const tid = (s: number) => {
  if (s <= 0) return '0 min'
  if (s < 60) return `${s} s`
  const min = Math.round(s / 60)
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`
}

const datumTid = (iso: string) => new Date(iso).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })
const datum = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')

function StatusText({ s }: { s: Status }) {
  const c = STATUS[s]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs ${c.color}`}>
      <span className={`h-2 w-2 flex-none rounded-full ${c.dot}`} />
      {c.text}
    </span>
  )
}

const stegText = (st?: { max_step: number; steps_total: number | null }) =>
  st?.steps_total ? `${st.max_step} av ${st.steps_total}` : '–'

const quizText = (st?: { quiz_total: number | null; quiz_best_first_correct: number; quiz_best_correct: number }) => {
  if (!st?.quiz_total) return '–'
  if (st.quiz_best_correct === 0 && st.quiz_best_first_correct === 0) return 'Ej besvarad'
  return `${st.quiz_best_first_correct} av ${st.quiz_total} direkt, ${st.quiz_best_correct} till slut`
}

export default function IntranetGuideStats() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<GuideStatsData | null>(null)
  const [vy, setVy] = useState<'person' | 'guide'>('person')
  const [rollFilter, setRollFilter] = useState<string>('alla')
  const [oppen, setOppen] = useState<string | null>(null)

  const hamta = async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await IntranetService.getGuideStats())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte ladda läsloggen')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { hamta() }, [])

  /** Status och logg per guide och person */
  const rad = useMemo(() => {
    return (d: IntranetDocument, u: GuideStatsUser): { status: Status; st?: IntranetGuideStat; lastDatum?: string } => {
      if (!data) return { status: 'ej' }
      const key = `${d.id}:${u.user_id}`
      const st = data.stats.get(key)
      const ack = data.acks.get(key)
      const last = ack && ack.version === d.version ? ack.acknowledged_at : undefined
      const allaRatt = !!st?.quiz_total && st.quiz_best_correct >= st.quiz_total
      const status: Status = last || allaRatt ? 'genomgangen' : st ? 'oppnad' : 'ej'
      return { status, st, lastDatum: last }
    }
  }, [data])

  const personer = useMemo(() => {
    if (!data) return []
    return data.users
      .filter(u => rollFilter === 'alla' || u.roller.has(rollFilter))
      .map(u => {
        const guider = data.documents.filter(d => galler(d, u))
        const rader = guider.map(d => ({ d, ...rad(d, u) }))
        const oppnade = rader.filter(r => r.status !== 'ej').length
        const genomgangna = rader.filter(r => r.status === 'genomgangen').length
        const sekunder = rader.reduce((n, r) => n + (r.st?.active_seconds || 0), 0)
        const senast = rader.reduce<string | null>((m, r) => (r.st && (!m || r.st.last_opened_at > m) ? r.st.last_opened_at : m), null)
        return { u, rader, oppnade, genomgangna, sekunder, senast }
      })
  }, [data, rollFilter, rad])

  const guider = useMemo(() => {
    if (!data) return []
    const users = data.users.filter(u => rollFilter === 'alla' || u.roller.has(rollFilter))
    return data.documents
      .map(d => {
        const rader = users.filter(u => galler(d, u)).map(u => ({ u, ...rad(d, u) }))
        const oppnat = rader.filter(r => r.st)
        const sekunder = oppnat.reduce((n, r) => n + (r.st?.active_seconds || 0), 0)
        const quiz = oppnat.filter(r => r.st?.quiz_total && (r.st.quiz_best_correct > 0 || r.st.quiz_best_first_correct > 0))
        const forstaRatt = quiz.length
          ? Math.round((quiz.reduce((n, r) => n + (r.st!.quiz_best_first_correct / r.st!.quiz_total!), 0) / quiz.length) * 100)
          : null
        return {
          d,
          rader,
          oppnade: oppnat.length,
          genomgangna: rader.filter(r => r.status === 'genomgangen').length,
          snittTid: oppnat.length ? Math.round(sekunder / oppnat.length) : 0,
          forstaRatt,
        }
      })
      .filter(g => g.rader.length > 0)
  }, [data, rollFilter, rad])

  const exportCsv = () => {
    if (!data) return
    const header = ['Namn', 'Roll', 'Guide', 'Status', 'Öppnad antal gånger', 'Först öppnad', 'Senast öppnad', 'Aktiv tid (min)', 'Steg', 'Övning startad', 'Kolla att du kan', 'Markerad som läst']
    const rows = personer.flatMap(p => p.rader.map(r => [
      p.u.name,
      ROLE_LABELS[p.u.role] || p.u.role,
      r.d.title,
      STATUS[r.status].text,
      String(r.st?.opens ?? 0),
      r.st ? datumTid(r.st.first_opened_at) : '',
      r.st ? datumTid(r.st.last_opened_at) : '',
      r.st ? String(Math.round(r.st.active_seconds / 60)) : '0',
      stegText(r.st),
      r.st?.exercise_started ? 'Ja' : 'Nej',
      quizText(r.st),
      r.lastDatum ? datum(r.lastDatum) : '',
    ]))
    const csv = [header, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `guider_lasning_${datum(new Date().toISOString())}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="h-64 animate-pulse rounded-xl border border-slate-700 bg-slate-800/30" />

  if (error || !data) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-slate-700 bg-slate-800/30 py-10">
        <AlertCircle className="mb-2 h-8 w-8 text-red-500" />
        <p className="mb-3 text-sm text-slate-400">{error || 'Kunde inte ladda läsloggen'}</p>
        <button onClick={hamta} className="flex items-center gap-2 rounded-lg bg-[#20c58f] px-4 py-2 text-sm font-medium text-[#fff] hover:bg-[#1ab37e]">
          <RefreshCw className="h-4 w-4" />
          Försök igen
        </button>
      </div>
    )
  }

  const segment = (aktiv: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${aktiv ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`

  return (
    <div className="space-y-4">
      {/* Val och export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-slate-700 bg-slate-800/50 p-1">
            <button className={segment(vy === 'person')} onClick={() => { setVy('person'); setOppen(null) }}>Per person</button>
            <button className={segment(vy === 'guide')} onClick={() => { setVy('guide'); setOppen(null) }}>Per guide</button>
          </div>
          <select value={rollFilter} onChange={e => setRollFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#20c58f]">
            <option value="alla">Alla roller</option>
            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={hamta} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">
            <RefreshCw className="h-4 w-4" />
            Uppdatera
          </button>
          <button onClick={exportCsv} className="flex items-center gap-2 rounded-lg bg-[#20c58f] px-3 py-1.5 text-sm font-medium text-[#fff] hover:bg-[#1ab37e]">
            <Download className="h-4 w-4" />
            Exportera CSV
          </button>
        </div>
      </div>

      {vy === 'person' ? (
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Medarbetare</th>
                <th className="px-4 py-3">Genomgångna</th>
                <th className="px-4 py-3">Öppnade</th>
                <th className="px-4 py-3">Aktiv tid</th>
                <th className="px-4 py-3">Senast i en guide</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {personer.map(p => {
                const arOppen = oppen === p.u.user_id
                const andel = p.rader.length ? (p.genomgangna / p.rader.length) * 100 : 0
                return (
                  <Fragment key={p.u.user_id}>
                    <tr onClick={() => setOppen(arOppen ? null : p.u.user_id)}
                      className="cursor-pointer border-b border-slate-700/50 hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap font-medium text-white">{p.u.name}</p>
                        <p className="text-xs text-slate-500">{ROLE_LABELS[p.u.role] || p.u.role}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="whitespace-nowrap text-slate-200"><span className="font-semibold text-white">{p.genomgangna}</span> av {p.rader.length}</p>
                        <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-700" aria-hidden>
                          <div className="h-full rounded-full bg-[#20c58f]" style={{ width: `${andel}%` }} />
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{p.oppnade} av {p.rader.length}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{tid(p.sekunder)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{p.senast ? datumTid(p.senast) : <span className="text-slate-500">Aldrig</span>}</td>
                      <td className="px-2 py-3">
                        <Icon name="allman.chevron" size={16} className={`text-slate-500 transition-transform ${arOppen ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {arOppen && (
                      <tr className="border-b border-slate-700/50 bg-slate-900/40">
                        <td colSpan={6} className="px-4 py-4">
                          <PersonDetalj rader={p.rader} userId={p.u.user_id} documents={data.documents} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {personer.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Inga medarbetare med den rollen.</p>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700 bg-slate-800/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Guide</th>
                <th className="px-4 py-3">Genomgången</th>
                <th className="px-4 py-3">Öppnad</th>
                <th className="px-4 py-3">Snittid</th>
                <th className="px-4 py-3">Rätt direkt</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {guider.map(g => {
                const arOppen = oppen === g.d.id
                return (
                  <Fragment key={g.d.id}>
                    <tr onClick={() => setOppen(arOppen ? null : g.d.id)}
                      className="cursor-pointer border-b border-slate-700/50 hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{g.d.title}</p>
                        <p className="text-xs text-slate-500">För: {forVem(g.d)} · v{g.d.version}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-200"><span className="font-semibold text-white">{g.genomgangna}</span> av {g.rader.length}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{g.oppnade} av {g.rader.length}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{g.oppnade ? tid(g.snittTid) : '–'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-300">{g.forstaRatt === null ? '–' : `${g.forstaRatt} %`}</td>
                      <td className="px-2 py-3">
                        <Icon name="allman.chevron" size={16} className={`text-slate-500 transition-transform ${arOppen ? 'rotate-90' : ''}`} />
                      </td>
                    </tr>
                    {arOppen && (
                      <tr className="border-b border-slate-700/50 bg-slate-900/40">
                        <td colSpan={6} className="px-4 py-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-slate-500">
                                <th className="pb-2 pr-4 font-medium">Medarbetare</th>
                                <th className="pb-2 pr-4 font-medium">Status</th>
                                <th className="pb-2 pr-4 font-medium">Senast öppnad</th>
                                <th className="pb-2 pr-4 font-medium">Tid</th>
                                <th className="pb-2 pr-4 font-medium">Steg</th>
                                <th className="pb-2 font-medium">Kolla att du kan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {[...g.rader]
                                .sort((a, b) => ['ej', 'oppnad', 'genomgangen'].indexOf(a.status) - ['ej', 'oppnad', 'genomgangen'].indexOf(b.status) || a.u.name.localeCompare(b.u.name, 'sv'))
                                .map(r => (
                                  <tr key={r.u.user_id} className="border-t border-slate-800">
                                    <td className="py-2 pr-4 text-white">{r.u.name}</td>
                                    <td className="py-2 pr-4"><StatusText s={r.status} /></td>
                                    <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{r.st ? datumTid(r.st.last_opened_at) : '–'}</td>
                                    <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{r.st ? tid(r.st.active_seconds) : '–'}</td>
                                    <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{stegText(r.st)}</td>
                                    <td className="py-2 text-slate-300">{quizText(r.st)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Loggen började 2026-10-22, så öppningar före dess syns inte. Genomgången betyder Markera som läst för guidens
        aktuella version, eller alla rätt på Kolla att du kan. Aktiv tid räknas bara när guiden syns på skärmen och
        personen har scrollat eller klickat den senaste minuten. Rätt direkt är andelen rätt på första valet.
      </p>
    </div>
  )
}

/** En persons guider och varje gång en guide öppnats */
function PersonDetalj({ rader, userId, documents }: {
  rader: { d: IntranetDocument; status: Status; st?: IntranetGuideStat; lastDatum?: string }[]
  userId: string
  documents: IntranetDocument[]
}) {
  const [logg, setLogg] = useState<IntranetGuideView[] | null>(null)
  const [laddar, setLaddar] = useState(false)
  const titel = useMemo(() => new Map(documents.map(d => [d.id, d.title])), [documents])

  const visaLogg = async () => {
    setLaddar(true)
    try {
      setLogg(await IntranetService.getGuideViewsForUser(userId))
    } catch {
      setLogg([])
    } finally {
      setLaddar(false)
    }
  }

  const ordning: Status[] = ['ej', 'oppnad', 'genomgangen']
  const sorterade = [...rader].sort((a, b) => ordning.indexOf(a.status) - ordning.indexOf(b.status))

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="pb-2 pr-4 font-medium">Guide</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Öppnad</th>
              <th className="pb-2 pr-4 font-medium">Tid</th>
              <th className="pb-2 pr-4 font-medium">Steg</th>
              <th className="pb-2 pr-4 font-medium">Övning</th>
              <th className="pb-2 pr-4 font-medium">Kolla att du kan</th>
              <th className="pb-2 font-medium">Markerad läst</th>
            </tr>
          </thead>
          <tbody>
            {sorterade.map(r => (
              <tr key={r.d.id} className="border-t border-slate-800">
                <td className="py-2 pr-4 text-white">{r.d.title}</td>
                <td className="py-2 pr-4"><StatusText s={r.status} /></td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-300">
                  {r.st ? <>{r.st.opens} {r.st.opens === 1 ? 'gång' : 'gånger'}, senast {datumTid(r.st.last_opened_at)}</> : '–'}
                </td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{r.st ? tid(r.st.active_seconds) : '–'}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{stegText(r.st)}</td>
                <td className="whitespace-nowrap py-2 pr-4 text-slate-300">{r.st ? (r.st.exercise_started ? 'Startad' : 'Nej') : '–'}</td>
                <td className="py-2 pr-4 text-slate-300">{quizText(r.st)}</td>
                <td className="whitespace-nowrap py-2 text-slate-300">{r.lastDatum ? datum(r.lastDatum) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logg === null ? (
        <button onClick={visaLogg} disabled={laddar}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 disabled:opacity-60">
          {laddar && <Loader2 className="h-4 w-4 animate-spin" />}
          Visa varje gång en guide öppnats
        </button>
      ) : logg.length === 0 ? (
        <p className="text-sm text-slate-500">Inga öppningar sedan loggen startade.</p>
      ) : (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Varje gång, nyast först</p>
          <ol className="divide-y divide-slate-800 rounded-lg border border-slate-800">
            {logg.map(v => (
              <li key={v.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-3 py-2 text-sm">
                <span className="whitespace-nowrap text-slate-400">{datumTid(v.opened_at)}</span>
                <span className="font-medium text-white">{titel.get(v.document_id) || 'Borttagen guide'}</span>
                <span className="text-slate-400">
                  {tid(v.active_seconds)}
                  {v.steps_total ? ` · steg ${v.max_step} av ${v.steps_total}` : ''}
                  {v.exercise_started_at ? ' · övning startad' : ''}
                  {v.quiz_total && v.quiz_answered > 0 ? ` · ${v.quiz_first_correct} av ${v.quiz_total} rätt direkt` : ''}
                  {` · scrollat ${v.scroll_pct} %`}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
