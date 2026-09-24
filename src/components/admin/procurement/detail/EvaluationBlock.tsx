// src/components/admin/procurement/detail/EvaluationBlock.tsx
// Block 5: utvärdering. Kriterietyp och kriterier med vikter. TED:s vikter är
// oanvändbara (planens avsnitt 2), så vikterna läses ur underlaget med AI
// eller skrivs in här för hand.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import type { NoticeWithRelations } from '../../../../services/procurementService'
import { CRITERIA_TYPE_LABEL, type ProcurementCriteriaType } from '../../../../types/procurement'
import Button from '../../../ui/Button'
import { LinkButton } from '../ui'
import { fmtNum, tableCls } from '../uiFormat'
import { Block, NumberField, inputCls, selectCls, type SaveNotice } from './fields'
import { errMsg } from './helpers'

type Criterion = { name: string; weight: number | null; type?: string | null }

const TYPE_OPTIONS = [
  { value: 'price', label: 'Pris' },
  { value: 'quality', label: 'Kvalitet' },
  { value: 'other', label: 'Övrigt' },
]

export default function EvaluationBlock({ notice, onSave }: { notice: NoticeWithRelations; onSave: SaveNotice }) {
  const [rows, setRows] = useState<Criterion[]>(notice.criteria_weights ?? [])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRows(notice.criteria_weights ?? [])
  }, [notice.criteria_weights])

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(notice.criteria_weights ?? []), [rows, notice.criteria_weights])
  const sum = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0)

  const setType = async (t: string) => {
    try {
      await onSave({ criteria_type: (t || null) as ProcurementCriteriaType | null }, `Kriterietyp: ${t ? CRITERIA_TYPE_LABEL[t as ProcurementCriteriaType] : 'okänd'}`)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara kriterietypen'))
    }
  }

  const saveRows = async () => {
    setSaving(true)
    try {
      const clean = rows.filter((r) => r.name.trim()).map((r) => ({ name: r.name.trim(), weight: r.weight, type: r.type ?? null }))
      await onSave({ criteria_weights: clean.length > 0 ? clean : null }, 'Utvärderingskriterier ändrade')
      toast.success('Kriterierna sparade')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara kriterierna'))
    } finally {
      setSaving(false)
    }
  }

  const update = (i: number, patch: Partial<Criterion>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  return (
    <Block
      id="utvardering"
      num="5"
      title="Utvärdering"
      hint="Vikterna i TED är oanvändbara. Vikter och prismodell läses ur förfrågningsunderlaget, av AI eller för hand."
    >
      <div className="p-4 space-y-4">
        <div className="max-w-xs">
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Kriterietyp</label>
          <select className={selectCls} value={notice.criteria_type ?? ''} onChange={(e) => void setType(e.target.value)} aria-label="Kriterietyp">
            <option value="">Okänd</option>
            {(Object.keys(CRITERIA_TYPE_LABEL) as ProcurementCriteriaType[]).map((t) => (
              <option key={t} value={t}>{CRITERIA_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto -mx-4">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Kriterium</th>
                <th className={`${tableCls.thRight} w-28`}>Vikt</th>
                <th className={`${tableCls.th} w-36`}>Typ</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-[12px] text-slate-600">
                    Inga kriterier ännu.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={i} className={tableCls.tr}>
                  <td className={tableCls.td}>
                    <input className={inputCls} value={r.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="T.ex. Pris, Kvalitet i egenkontroll" aria-label="Kriterium" />
                  </td>
                  <td className={tableCls.td}>
                    <NumberField value={r.weight} onChange={(n) => update(i, { weight: n })} suffix="%" ariaLabel="Vikt" />
                  </td>
                  <td className={tableCls.td}>
                    <select className={selectCls} value={r.type ?? 'other'} onChange={(e) => update(i, { type: e.target.value })} aria-label="Typ">
                      {TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className={tableCls.td}>
                    <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="p-1 text-slate-500 hover:text-red-400" aria-label="Ta bort kriterium">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <LinkButton onClick={() => setRows((rs) => [...rs, { name: '', weight: null, type: 'quality' }])}>
              <span className="inline-flex items-center gap-1">
                <Plus className="w-3 h-3" /> Lägg till kriterium
              </span>
            </LinkButton>
            {rows.length > 0 && (
              <span className={`text-[12px] tabular-nums ${Math.abs(sum - 100) < 0.01 || sum === 0 ? 'text-slate-500' : 'text-amber-400'}`}>
                Summa {fmtNum(sum, 1)} %
              </span>
            )}
          </div>
          {dirty && (
            <Button size="sm" onClick={() => void saveRows()} loading={saving}>
              Spara kriterier
            </Button>
          )}
        </div>
      </div>
    </Block>
  )
}
