// src/components/admin/leads/LeadDelning.tsx
// Överlåt eller dela: byt ägare (RPC lead_overlat, valfritt att stå kvar som delad) och dela leaden med
// en eller flera kollegor (lead_dela / lead_sluta_dela). Bara ägaren och admin/koordinator ändrar;
// en delad kollega kan lämna delningen själv. Allt hamnar i tidslinjen via databasen.

import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { X } from 'lucide-react'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import type { Lead } from '../../../types/database'
import type { LeadMedlem, LeadPerson } from '../../../types/leads'

interface Props {
  lead: Lead
  medlemmar: LeadMedlem[]
  personal: LeadPerson[]
  minProfilId: string | null
  kanOverlata: boolean
  namnFor: (id: string | null) => string
  onKlar: () => void
  onStang: () => void
}

export default function LeadDelning({ lead, medlemmar, personal, minProfilId, kanOverlata, namnFor, onKlar, onStang }: Props) {
  const [nyAgare, setNyAgare] = useState('')
  const [behall, setBehall] = useState(true)
  const [dela, setDela] = useState('')
  const [arbetar, setArbetar] = useState(false)

  const aktiva = useMemo(() => personal.filter((p) => p.aktiv), [personal])
  const agarVal = aktiva.filter((p) => p.id !== lead.owner_profile_id).map((p) => ({ value: p.id, label: p.id === minProfilId ? `${p.namn} (jag)` : p.namn }))
  const delaVal = aktiva
    .filter((p) => p.id !== lead.owner_profile_id && !medlemmar.some((m) => m.profile_id === p.id))
    .map((p) => ({ value: p.id, label: p.id === minProfilId ? `${p.namn} (jag)` : p.namn }))

  const kor = async (fn: () => Promise<unknown>, ok: string) => {
    setArbetar(true)
    try {
      await fn()
      toast.success(ok)
      onKlar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Det gick inte att spara')
    } finally {
      setArbetar(false)
    }
  }

  return (
    <div className="p-3 bg-slate-800/30 border border-[#20c58f]/50 rounded-xl space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Icon name="lead.dela" size={16} className="text-[#20c58f]" /> Överlåt eller dela
        </p>
        <button type="button" onClick={onStang} className="p-1 text-slate-400 hover:text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]" aria-label="Stäng">
          <X className="w-4 h-4" />
        </button>
      </div>

      {kanOverlata && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">
            Ägare nu: <span className="text-white">{namnFor(lead.owner_profile_id) || 'ingen'}</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Select label="Ny ägare" value={nyAgare} onChange={setNyAgare} options={agarVal} placeholder="Välj kollega" />
            <Button
              variant="primary"
              size="sm"
              disabled={!nyAgare || arbetar}
              onClick={() => void kor(() => LeadService.overlat(lead.id, nyAgare, behall && !!lead.owner_profile_id), `Leaden är överlåten till ${namnFor(nyAgare)}`)}
            >
              <Icon name="lead.agare" size={16} className="mr-1.5" /> Överlåt
            </Button>
          </div>
          {lead.owner_profile_id && (
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={behall}
                onChange={(e) => setBehall(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0"
              />
              {lead.owner_profile_id === minProfilId ? 'Behåll mig som delad så att jag fortsatt ser leaden' : `Behåll ${namnFor(lead.owner_profile_id)} som delad`}
            </label>
          )}
        </div>
      )}

      <div className={`space-y-2 ${kanOverlata ? 'pt-3 border-t border-slate-700/50' : ''}`}>
        <p className="text-xs font-medium text-slate-400">Delad med</p>
        {medlemmar.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen än.</p>
        ) : (
          <ul className="space-y-1">
            {medlemmar.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-200">{namnFor(m.profile_id) || 'Okänd'}</span>
                {(kanOverlata || m.profile_id === minProfilId) && (
                  <button
                    type="button"
                    disabled={arbetar}
                    onClick={() => void kor(() => LeadService.slutaDela(lead.id, m.profile_id), m.profile_id === minProfilId ? 'Du har lämnat delningen' : 'Delningen är borttagen')}
                    className="text-xs text-slate-400 hover:text-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
                  >
                    {m.profile_id === minProfilId ? 'Lämna' : 'Ta bort'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {kanOverlata && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
            <Select label="Dela med" value={dela} onChange={setDela} options={delaVal} placeholder="Välj kollega" />
            <Button
              variant="secondary"
              size="sm"
              disabled={!dela || arbetar}
              onClick={() => void kor(async () => { await LeadService.dela(lead.id, [dela]); setDela('') }, `Leaden är delad med ${namnFor(dela)}`)}
            >
              <Icon name="lead.dela" size={16} className="mr-1.5" /> Dela
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
