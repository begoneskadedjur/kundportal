// src/components/admin/procurement/NewPostDialog.tsx
// Ny post på Anbud (sedan 3.65.0): direktupphandling, avrop från ramavtal och
// offertförfrågan som inte kommer via någon annonskälla. Skapas med RPC:n
// procurement_create_manual_notice i samma tabell som annonserna
// (procurement_notices.manual_type), som Bedöms på tavlan. Synkens dedup
// matchar aldrig mot egna poster (egen dedup-nyckel, likhetsfunktionerna
// hoppar över manual_type).

import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../icons/Icon'
import { ProcurementService, type ProcurementManagerProfile } from '../../../services/procurementService'
import { MANUAL_TYPE_ICON, MANUAL_TYPE_LABEL, type ProcurementBuyer, type ProcurementManualType } from '../../../types/procurement'
import { PrimaryButton, SecondaryButton } from './ui'

const inputCls =
  'w-full h-10 px-3 text-[13px] bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50'

const TYPE_HINT: Record<ProcurementManualType, string> = {
  direct: 'Köparen har frågat oss direkt under gränsen för direktupphandling.',
  call_off: 'Avrop eller förnyad konkurrensutsättning inom ett ramavtal vi redan har.',
  rfq: 'Offertförfrågan från en köpare, ofta med svar senast ett visst datum.',
}

const MANUAL_TYPES: ProcurementManualType[] = ['direct', 'call_off', 'rfq']

/** Knappen Ny post med meny för de tre posttyperna */
export function NewPostButton({ onPick }: { onPick: (t: ProcurementManualType) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <PrimaryButton onClick={() => setOpen((o) => !o)}>
        <Icon name="allman.plus" size={20} />
        Ny post
      </PrimaryButton>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1 z-40 w-60 rounded-xl border border-slate-800 bg-slate-900 shadow-xl py-1">
          {MANUAL_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                onPick(t)
              }}
              className="w-full min-h-[44px] flex items-center gap-2.5 px-3 text-[13px] text-left text-slate-200 hover:bg-slate-800/60"
            >
              <Icon name={MANUAL_TYPE_ICON[t]} size={20} className="text-slate-400" />
              {MANUAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  type: ProcurementManualType
  managers: ProcurementManagerProfile[]
  defaultOwnerId: string | null
  onClose: () => void
  onCreated: (id: string) => void
}

export default function NewPostDialog({ type, managers, defaultOwnerId, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [buyerQuery, setBuyerQuery] = useState('')
  const [buyer, setBuyer] = useState<Pick<ProcurementBuyer, 'id' | 'name' | 'county_name'> | null>(null)
  const [results, setResults] = useState<ProcurementBuyer[]>([])
  const [deadline, setDeadline] = useState('')
  const [value, setValue] = useState('')
  const [owner, setOwner] = useState(defaultOwnerId ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (buyer || buyerQuery.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(() => {
      ProcurementService.listBuyers(buyerQuery)
        .then((r) => setResults(r.slice(0, 8)))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(t)
  }, [buyerQuery, buyer])

  const amount = value.trim() ? Number(value.replace(/\s/g, '').replace(',', '.')) : null
  const amountOk = amount == null || (Number.isFinite(amount) && amount >= 0)
  const valid = title.trim().length > 0 && (buyer || buyerQuery.trim()) && amountOk

  const save = async () => {
    if (!valid) {
      toast.error(!amountOk ? 'Beloppet ska vara ett tal i kronor' : 'Fyll i titel och köpare')
      return
    }
    setSaving(true)
    try {
      const id = await ProcurementService.createManualNotice({
        type,
        title: title.trim(),
        buyerId: buyer?.id ?? null,
        buyerName: buyer ? null : buyerQuery.trim(),
        deadline: deadline || null,
        value: amount,
        ownerId: owner || null,
      })
      toast.success(`${MANUAL_TYPE_LABEL[type]} skapad`)
      onCreated(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte skapa posten')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="ny-post-titel" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 id="ny-post-titel" className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-100">
              <Icon name={MANUAL_TYPE_ICON[type]} size={20} className="text-[#20c58f]" />
              Ny {MANUAL_TYPE_LABEL[type].toLowerCase()}
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-400">{TYPE_HINT[type]}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center w-11 h-11 -mr-2 -mt-2 rounded-lg text-slate-400 hover:text-slate-100" aria-label="Stäng" title="Stäng">
            <Icon name="allman.stang" size={20} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">Titel</span>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Till exempel Råttbekämpning i förskolor" autoFocus />
          </label>
          <div className="relative">
            <span className="block text-[11px] text-slate-500 mb-1">Köpare</span>
            {buyer ? (
              <div className="flex items-center justify-between gap-2 h-10 px-3 rounded-lg border border-slate-700 bg-slate-800/50 text-[13px] text-slate-100">
                <span className="truncate">
                  {buyer.name}
                  {buyer.county_name ? <span className="text-slate-500"> · {buyer.county_name}</span> : null}
                </span>
                <button type="button" onClick={() => { setBuyer(null); setBuyerQuery('') }} className="text-[12px] text-slate-400 hover:text-slate-200">Byt</button>
              </div>
            ) : (
              <>
                <input className={inputCls} value={buyerQuery} onChange={(e) => setBuyerQuery(e.target.value)} placeholder="Sök köpare i registret eller skriv namnet" aria-label="Köpare" />
                {results.length > 0 && (
                  <ul className="absolute z-10 left-0 right-0 mt-1 rounded-lg border border-slate-800 bg-slate-900 shadow-xl divide-y divide-slate-800 max-h-60 overflow-auto">
                    {results.map((b) => (
                      <li key={b.id}>
                        <button type="button" onClick={() => setBuyer(b)} className="w-full min-h-[44px] px-3 text-left text-[13px] text-slate-200 hover:bg-slate-800/60">
                          {b.name}
                          {b.county_name && <span className="text-slate-500"> · {b.county_name}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {buyerQuery.trim().length >= 2 && results.length === 0 && <p className="mt-1 text-[11px] text-slate-500">Ingen träff i registret. Namnet sparas som fritext.</p>}
              </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] text-slate-500 mb-1">{type === 'rfq' ? 'Svar senast' : 'Sista dag'}</span>
              <input type="date" className={inputCls} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-[11px] text-slate-500 mb-1">Belopp per år (kr)</span>
              <input className={inputCls} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="120 000" />
            </label>
          </div>
          <label className="block">
            <span className="block text-[11px] text-slate-500 mb-1">Ansvarig</span>
            <select className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Ingen ansvarig</option>
              {managers.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 px-5 pb-5">
          <SecondaryButton onClick={onClose} disabled={saving}>Avbryt</SecondaryButton>
          <PrimaryButton onClick={() => void save()} disabled={saving || !valid}>
            <Icon name="allman.plus" size={20} />
            Skapa
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
