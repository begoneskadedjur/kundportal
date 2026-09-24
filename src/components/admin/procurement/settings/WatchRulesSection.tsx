// src/components/admin/procurement/settings/WatchRulesSection.tsx
// Bevakningsregler (planens avsnitt 7): lista, redigera och förhandsvisa
// poäng. Förhandsvisningen kör samma scoreNotice som synken, via
// ProcurementMatchService.scoreWithSavedRules, så poängen blir densamma.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import Select from '../../../ui/Select'
import ConfirmModal from '../../../ui/ConfirmModal'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { ProcurementService } from '../../../../services/procurementService'
import { ProcurementMatchService, type MatchResult } from '../../../../services/procurementMatchService'
import { BEGONE_COUNTIES, NOTIFY_SCORE, SE_COUNTIES } from '../../../../shared/procurementRules'
import type { ProcurementRuleType, ProcurementWatchRule } from '../../../../types/procurement'
import { EmptyState, LinkButton, Section, StatusDot } from '../ui'
import { fmtNum, tableCls } from '../uiFormat'
import { COUNTY_OPTIONS, countyLabel } from '../market/format'

const RULE_TYPE_LABEL: Record<ProcurementRuleType, string> = {
  cpv_hard: 'Hård CPV-träff',
  cpv_soft: 'Närliggande CPV',
  keyword: 'Nyckelord',
  negative: 'Negativa ord',
  county: 'Län',
}

const RULE_TYPE_HINT: Record<ProcurementRuleType, string> = {
  cpv_hard: 'CPV som börjar på prefixet ger full poäng direkt.',
  cpv_soft: 'Närliggande CPV ger baspoäng när minst ett nyckelord också finns.',
  keyword: 'Poäng per nyckelord i titel eller beskrivning.',
  negative: 'Dras av när ordet finns, utom vid hård CPV-träff. Ange negativ poäng.',
  county: 'Tillägg när leveransorten ligger i något av länen.',
}

const TYPE_OPTIONS = (Object.keys(RULE_TYPE_LABEL) as ProcurementRuleType[]).map((t) => ({ value: t, label: RULE_TYPE_LABEL[t] }))

function splitList(s: string, digits = false): string[] {
  return [...new Set(s.split(/[,;\n]/).map((x) => (digits ? x.replace(/\D/g, '') : x.trim().toLowerCase())).filter(Boolean))]
}

interface Draft {
  id?: string
  name: string
  rule_type: ProcurementRuleType
  cpv: string
  keywords: string
  county_codes: string[]
  points: string
  active: boolean
}

function toDraft(r?: ProcurementWatchRule): Draft {
  if (!r) return { name: '', rule_type: 'keyword', cpv: '', keywords: '', county_codes: [], points: '10', active: true }
  return {
    id: r.id,
    name: r.name,
    rule_type: r.rule_type,
    cpv: r.cpv_prefixes.join(', '),
    keywords: r.keywords.join(', '),
    county_codes: r.county_codes,
    points: String(r.points),
    active: r.active,
  }
}

function RuleModal({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const [saving, setSaving] = useState(false)
  const showCpv = d.rule_type === 'cpv_hard' || d.rule_type === 'cpv_soft'
  const showKw = d.rule_type === 'keyword' || d.rule_type === 'negative'
  const showCounty = d.rule_type === 'county'

  const save = async () => {
    const points = Number(d.points.replace(',', '.'))
    if (!d.name.trim() || !Number.isFinite(points)) {
      toast.error('Ange namn och poäng')
      return
    }
    setSaving(true)
    try {
      await ProcurementService.saveWatchRule({
        ...(d.id ? { id: d.id } : {}),
        name: d.name.trim(),
        rule_type: d.rule_type,
        cpv_prefixes: showCpv ? splitList(d.cpv, true) : [],
        keywords: showKw ? splitList(d.keywords) : [],
        county_codes: showCounty ? d.county_codes : [],
        points: Math.round(points),
        active: d.active,
      })
      toast.success('Regeln är sparad')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara regeln')
    } finally {
      setSaving(false)
    }
  }

  const toggleCounty = (c: string) =>
    setD((p) => ({ ...p, county_codes: p.county_codes.includes(c) ? p.county_codes.filter((x) => x !== c) : [...p.county_codes, c] }))

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={d.id ? 'Redigera regel' : 'Ny bevakningsregel'}
      size="md"
      footer={
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Avbryt</Button>
          <Button variant="primary" size="sm" onClick={() => void save()} loading={saving}>Spara</Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <Input label="Namn" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} required />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Typ" options={TYPE_OPTIONS} value={d.rule_type} onChange={(v) => setD({ ...d, rule_type: v as ProcurementRuleType })} />
          <Input label="Poäng" inputMode="numeric" value={d.points} onChange={(e) => setD({ ...d, points: e.target.value })} />
        </div>
        <p className="text-[11px] text-slate-500">{RULE_TYPE_HINT[d.rule_type]}</p>
        {showCpv && (
          <Input label="CPV-prefix" value={d.cpv} onChange={(e) => setD({ ...d, cpv: e.target.value })} placeholder="9092, 7033" helperText="Kommaseparerade, bara siffror" />
        )}
        {showKw && (
          <Input
            as="textarea"
            rows={3}
            label={d.rule_type === 'negative' ? 'Negativa ord' : 'Nyckelord'}
            value={d.keywords}
            onChange={(e) => setD({ ...d, keywords: e.target.value })}
            placeholder="skadedjur, råttor, gnagare"
            helperText="Kommaseparerade. Matchas som delsträng utan hänsyn till versaler."
          />
        )}
        {showCounty && (
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <div className="text-xs font-medium text-slate-400 mb-2">Län</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {Object.entries(SE_COUNTIES).map(([code, label]) => (
                <label key={code} className="flex items-center gap-2 text-[12.5px] text-slate-300">
                  <input type="checkbox" checked={d.county_codes.includes(code)} onChange={() => toggleCounty(code)} className="rounded text-[#20c58f] focus:ring-[#20c58f]" />
                  {label}
                  {BEGONE_COUNTIES.includes(code) && <span className="text-[10.5px] text-[#20c58f]">BeGone</span>}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} className="rounded text-[#20c58f] focus:ring-[#20c58f]" />
          Aktiv
        </label>
      </div>
    </Modal>
  )
}

function RulePreview() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cpv, setCpv] = useState('')
  const [county, setCounty] = useState('')
  const [result, setResult] = useState<MatchResult | null>(null)
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!title.trim()) {
      toast.error('Skriv en testtitel')
      return
    }
    setRunning(true)
    try {
      const r = await ProcurementMatchService.scoreWithSavedRules({
        title: title.trim(),
        description: description.trim() || null,
        cpv_codes: splitList(cpv, true),
        county_codes: county ? [county] : [],
      })
      setResult(r)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte räkna poäng')
    } finally {
      setRunning(false)
    }
  }

  const level = result ? ProcurementMatchService.level(result.score) : null
  const countyOptions = [{ value: '', label: 'Inget län' }, ...COUNTY_OPTIONS.filter((o) => o.value !== 'begone' && o.value !== 'all')]

  return (
    <div className="p-4 space-y-3 border-t border-slate-800">
      <div className="text-xs font-medium text-slate-400">Förhandsvisa poäng</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Testtitel, t.ex. Skadedjursbekämpning för Uppsalahem" />
        <Input value={cpv} onChange={(e) => setCpv(e.target.value)} placeholder="CPV, t.ex. 90922000, 70330000" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Beskrivning (valfri)" />
        <Select options={countyOptions} value={county} onChange={setCounty} placeholder="Inget län" />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void run()} loading={running}>Räkna poäng</Button>
        {result && level && (
          <div className="flex items-center gap-3">
            <span className="text-[19px] font-semibold tabular-nums text-slate-100">{result.score}</span>
            <StatusDot tone={level === 'direct' ? 'good' : level === 'match' ? 'warn' : 'muted'}>
              {level === 'direct' ? 'Direktnotis' : level === 'match' ? 'Träff med notis' : `Under tröskeln ${NOTIFY_SCORE}`}
            </StatusDot>
          </div>
        )}
      </div>
      {result && result.reasons.length > 0 && (
        <ul className="text-[12.5px] divide-y divide-slate-800 rounded-lg border border-slate-800">
          {result.reasons.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="text-slate-300">{r.label}</span>
              <span className={`tabular-nums ${r.points < 0 ? 'text-red-400' : 'text-slate-100'}`}>{r.points > 0 ? `+${r.points}` : r.points}</span>
            </li>
          ))}
        </ul>
      )}
      {result && result.reasons.length === 0 && <p className="text-[12px] text-slate-500">Ingen regel slog till.</p>}
    </div>
  )
}

export function WatchRulesSection() {
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<ProcurementWatchRule[]>([])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<ProcurementWatchRule | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setRules(await ProcurementService.listWatchRules())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta bevakningsregler')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = async (r: ProcurementWatchRule) => {
    try {
      await ProcurementService.saveWatchRule({ id: r.id, active: !r.active })
      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !r.active } : x)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara regeln')
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await ProcurementService.deleteWatchRule(deleting.id)
      setRules((prev) => prev.filter((x) => x.id !== deleting.id))
      toast.success('Regeln är borttagen')
      setDeleting(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta bort regeln')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      title="Bevakningsregler"
      hint={`Notis vid ${NOTIFY_SCORE} poäng, direktnotis vid 100. Ändringar gäller nya hämtningar; redan matchade upphandlingar behåller sin poäng.`}
      action={
        <LinkButton onClick={() => setEditing(toDraft())}>
          <span className="inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Ny regel</span>
        </LinkButton>
      }
    >
      {loading ? (
        <div className="py-8 flex justify-center"><LoadingSpinner /></div>
      ) : rules.length === 0 ? (
        <EmptyState title="Inga regler i databasen" hint="Synken använder då standardreglerna ur procurementRules.ts." />
      ) : (
        <div className="overflow-x-auto">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Regel</th>
                <th className={tableCls.th}>Typ</th>
                <th className={tableCls.th}>Villkor</th>
                <th className={tableCls.thRight}>Poäng</th>
                <th className={tableCls.th}>Aktiv</th>
                <th className={tableCls.th} />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const cond =
                  r.rule_type === 'cpv_hard' || r.rule_type === 'cpv_soft'
                    ? r.cpv_prefixes.join(', ')
                    : r.rule_type === 'county'
                      ? r.county_codes.map(countyLabel).join(', ')
                      : r.keywords.join(', ')
                return (
                  <tr key={r.id} className={`${tableCls.tr} ${r.active ? '' : 'opacity-60'}`}>
                    <td className={tableCls.td}><div className="min-w-[160px] text-slate-200">{r.name}</div></td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{RULE_TYPE_LABEL[r.rule_type]}</td>
                    <td className={tableCls.td}><div className="max-w-[320px] text-[12px] text-slate-400 line-clamp-2" title={cond}>{cond || '–'}</div></td>
                    <td className={`${tableCls.tdRight} ${r.points < 0 ? 'text-red-400' : ''}`}>{fmtNum(r.points)}</td>
                    <td className={tableCls.td}>
                      <input type="checkbox" checked={r.active} onChange={() => void toggle(r)} className="rounded text-[#20c58f] focus:ring-[#20c58f]" aria-label="Aktiv" />
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      <div className="flex gap-3">
                        <LinkButton tone="muted" onClick={() => setEditing(toDraft(r))}>Redigera</LinkButton>
                        <LinkButton tone="danger" onClick={() => setDeleting(r)}>Ta bort</LinkButton>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <RulePreview />

      {editing && (
        <RuleModal
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void load()
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => void remove()}
        title="Ta bort regeln?"
        message={deleting ? `${deleting.name} tas bort från matchningen.` : ''}
        confirmLabel="Ta bort"
        variant="danger"
        loading={busy}
      />
    </Section>
  )
}
