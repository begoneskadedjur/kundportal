// src/components/admin/procurement/settings/SignalSourcesSection.tsx
// Signalkällor: kurerade webbadresser till kommuners, regioners och
// bostadsbolags upphandlingsplaner (planens avsnitt 3.3). Jobbet
// api/cron/procurement-signals hämtar dem dagligen. Används både under
// Signaler och Inställningar.
//
// De seedade källorna är OVERIFIERADE: startsidor eller upphandlingssidor som
// inte granskats för att innehålla en plan. Märks tydligt tills en människa
// markerat dem som verifierade.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, ExternalLink, Plus } from 'lucide-react'
import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import Input from '../../../ui/Input'
import Select from '../../../ui/Select'
import ConfirmModal from '../../../ui/ConfirmModal'
import LoadingSpinner from '../../../shared/LoadingSpinner'
import { ProcurementService } from '../../../../services/procurementService'
import { SE_COUNTIES, BEGONE_COUNTIES } from '../../../../shared/procurementRules'
import type { ProcurementSignalSource } from '../../../../types/procurement'
import { EmptyState, LinkButton, Section, StatusDot } from '../ui'
import { fmtDateTime, tableCls } from '../uiFormat'
import { countyLabel } from '../market/format'

type Kind = ProcurementSignalSource['kind']

const SIGNAL_SOURCE_KIND_LABEL: Record<Kind, string> = {
  kommun: 'Kommun',
  region: 'Region',
  bostadsbolag: 'Bostadsbolag',
  stat: 'Statlig',
  other: 'Övrigt',
}

const KIND_OPTIONS = (Object.keys(SIGNAL_SOURCE_KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: SIGNAL_SOURCE_KIND_LABEL[k] }))

const COUNTY_OPTIONS = [
  { value: '', label: 'Inget län' },
  ...BEGONE_COUNTIES.map((c) => ({ value: c, label: SE_COUNTIES[c] })),
  ...Object.entries(SE_COUNTIES)
    .filter(([c]) => !BEGONE_COUNTIES.includes(c))
    .sort((a, b) => a[1].localeCompare(b[1], 'sv'))
    .map(([value, label]) => ({ value, label })),
]

interface Draft {
  id?: string
  name: string
  url: string
  kind: Kind
  county_code: string
  notes: string
  active: boolean
  verified: boolean
}

const EMPTY: Draft = { name: '', url: '', kind: 'kommun', county_code: '', notes: '', active: true, verified: false }

function SourceModal({ draft, onClose, onSaved }: { draft: Draft; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft)
  const [saving, setSaving] = useState(false)
  const validUrl = /^https?:\/\/\S+\.\S+/.test(d.url.trim())

  const save = async () => {
    if (!d.name.trim() || !validUrl) {
      toast.error('Ange namn och en giltig adress som börjar med https://')
      return
    }
    setSaving(true)
    try {
      await ProcurementService.saveSignalSource({
        ...(d.id ? { id: d.id } : {}),
        name: d.name.trim(),
        url: d.url.trim(),
        kind: d.kind,
        county_code: d.county_code || null,
        notes: d.notes.trim() || null,
        active: d.active,
        verified: d.verified,
      })
      toast.success('Signalkällan är sparad')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara signalkällan')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={d.id ? 'Redigera signalkälla' : 'Ny signalkälla'}
      size="md"
      footer={
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Avbryt</Button>
          <Button variant="primary" size="sm" onClick={() => void save()} loading={saving}>Spara</Button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        <Input label="Namn" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Uppsala kommun, upphandlingsplan" required />
        <Input label="Adress" value={d.url} onChange={(e) => setD({ ...d, url: e.target.value })} placeholder="https://" required error={d.url && !validUrl ? 'Adressen ska börja med https://' : undefined} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Typ" options={KIND_OPTIONS} value={d.kind} onChange={(v) => setD({ ...d, kind: v as Kind })} />
          <Select label="Län" options={COUNTY_OPTIONS} value={d.county_code} onChange={(v) => setD({ ...d, county_code: v })} />
        </div>
        <Input as="textarea" rows={2} label="Anteckning" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} className="rounded text-[#20c58f] focus:ring-[#20c58f]" />
            Aktiv, hämtas dagligen
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={d.verified} onChange={(e) => setD({ ...d, verified: e.target.checked })} className="rounded text-[#20c58f] focus:ring-[#20c58f]" />
            Verifierad: jag har kontrollerat att sidan innehåller en upphandlingsplan
          </label>
        </div>
      </div>
    </Modal>
  )
}

export function SignalSourcesSection({ title = 'Signalkällor' }: { title?: string }) {
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<ProcurementSignalSource[]>([])
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<ProcurementSignalSource | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setSources(await ProcurementService.listSignalSources())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta signalkällor')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patch = async (s: ProcurementSignalSource, p: Partial<ProcurementSignalSource>, msg: string) => {
    setBusy(s.id)
    try {
      await ProcurementService.saveSignalSource({ id: s.id, ...p })
      setSources((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...p } : x)))
      toast.success(msg)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara signalkällan')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setBusy(deleting.id)
    try {
      await ProcurementService.deleteSignalSource(deleting.id)
      setSources((prev) => prev.filter((x) => x.id !== deleting.id))
      toast.success('Signalkällan är borttagen')
      setDeleting(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta bort signalkällan')
    } finally {
      setBusy(null)
    }
  }

  const unverified = sources.filter((s) => !s.verified).length

  return (
    <Section
      title={title}
      hint="Adresser till upphandlingsplaner. Hämtas dagligen 05:30; vid ändring plockar AI ut rader om skadedjur och sanering med kvartal."
      action={
        <LinkButton onClick={() => setEditing({ ...EMPTY })}>
          <span className="inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />Lägg till</span>
        </LinkButton>
      }
    >
      {loading ? (
        <div className="py-8 flex justify-center"><LoadingSpinner /></div>
      ) : sources.length === 0 ? (
        <EmptyState title="Inga signalkällor" hint="Lägg till adresser till kommuners och bostadsbolags upphandlingsplaner." />
      ) : (
        <>
          {unverified > 0 && (
            <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-800 text-[12.5px] text-amber-300 bg-amber-500/5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {unverified} av {sources.length} källor är overifierade. De seedade adresserna är startsidor eller upphandlingssidor som hittades
                2026-09-24 och har inte granskats för att innehålla en upphandlingsplan. Öppna varje adress, rätta den vid behov och markera som verifierad.
              </span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Källa</th>
                  <th className={tableCls.th}>Typ</th>
                  <th className={tableCls.th}>Län</th>
                  <th className={tableCls.th}>Granskning</th>
                  <th className={tableCls.th}>Senast hämtad</th>
                  <th className={tableCls.th}>Senast ändrad</th>
                  <th className={tableCls.th}>Fel</th>
                  <th className={tableCls.th}>Aktiv</th>
                  <th className={tableCls.th} />
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className={`${tableCls.tr} ${s.active ? '' : 'opacity-60'}`}>
                    <td className={tableCls.td}>
                      <div className="min-w-[200px]">
                        <div className="text-slate-200">{s.name}</div>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-[#20c58f] break-all">
                          {s.url.replace(/^https?:\/\//, '').slice(0, 60)}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        {s.notes && <div className="text-[11px] text-slate-500">{s.notes}</div>}
                      </div>
                    </td>
                    <td className={tableCls.td}>{SIGNAL_SOURCE_KIND_LABEL[s.kind] ?? s.kind}</td>
                    <td className={tableCls.td}>{countyLabel(s.county_code)}</td>
                    <td className={tableCls.td}>
                      {s.verified ? <StatusDot tone="good">Verifierad</StatusDot> : <StatusDot tone="warn">Overifierad</StatusDot>}
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDateTime(s.last_fetched_at)}</td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDateTime(s.last_changed_at)}</td>
                    <td className={tableCls.td}>
                      {s.last_error ? (
                        <span className="text-red-400 text-[11.5px] block max-w-[180px] truncate" title={s.last_error}>
                          {s.last_status ? `${s.last_status}: ` : ''}{s.last_error}
                        </span>
                      ) : s.last_status && s.last_status >= 400 ? (
                        <span className="text-red-400">HTTP {s.last_status}</span>
                      ) : '–'}
                    </td>
                    <td className={tableCls.td}>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.active}
                          disabled={busy === s.id}
                          onChange={(e) => void patch(s, { active: e.target.checked }, e.target.checked ? 'Källan är aktiverad' : 'Källan är inaktiverad')}
                          className="rounded text-[#20c58f] focus:ring-[#20c58f]"
                        />
                        <span className="text-[12px] text-slate-400">{s.active ? 'Ja' : 'Nej'}</span>
                      </label>
                    </td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      <div className="flex gap-3">
                        {!s.verified && (
                          <LinkButton disabled={busy === s.id} onClick={() => void patch(s, { verified: true }, 'Markerad som verifierad')}>Verifiera</LinkButton>
                        )}
                        <LinkButton
                          tone="muted"
                          onClick={() =>
                            setEditing({
                              id: s.id,
                              name: s.name,
                              url: s.url,
                              kind: s.kind,
                              county_code: s.county_code ?? '',
                              notes: s.notes ?? '',
                              active: s.active,
                              verified: s.verified,
                            })
                          }
                        >
                          Redigera
                        </LinkButton>
                        <LinkButton tone="danger" onClick={() => setDeleting(s)}>Ta bort</LinkButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editing && (
        <SourceModal
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
        title="Ta bort signalkällan?"
        message={deleting ? `${deleting.name} tas bort. Signaler som redan hittats ligger kvar.` : ''}
        confirmLabel="Ta bort"
        variant="danger"
        loading={!!deleting && busy === deleting.id}
      />
    </Section>
  )
}
