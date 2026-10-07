// src/components/admin/webLeads/WebLeadsFilterRad.tsx
// Filterraden i Leads (Webb): fritextsök, status, tjänst, kundgrupp, källa, tilldelad, datumintervall och
// Visa arkiverade, som en platt rad. Under raden står de aktiva filtren som platt text med kryss per
// filter och Rensa alla. Värdena läses och skrivs av sidan via adressen.

import { X } from 'lucide-react'
import DateField from '../../ui/DateField'
import { SearchGlass } from '../../shared/search/SearchIcons'
import { KUNDGRUPP_LABEL, STATUS_CONFIG, STATUS_ORDNING, type StaffProfile, type WebInquiryKundgrupp } from '../../../types/webInquiry'
import { KANAL_LABEL, KANAL_ORDNING, TJANST_LABEL, TJANST_ORDNING } from './leadKlassning'
import type { AktivtFilter, Flik, LeadFilter } from './leadFilter'
import type { TjanstIkon } from './WebLeadIcons'

interface Props {
  filter: LeadFilter
  flik: Flik
  staff: StaffProfile[]
  /** Tjänster som finns i underlaget, så att listan inte visar tomma val. */
  tjanster: Set<TjanstIkon>
  aktiva: AktivtFilter[]
  onAndra: (nyckel: AktivtFilter['nyckel'], varde: string) => void
  onRensa: () => void
}

const FALT_BAS =
  'h-9 px-3 bg-slate-800 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'

function falt(aktiv: boolean): string {
  return `${FALT_BAS} ${aktiv ? 'border-[#20c58f]/60 text-white' : 'border-slate-700 text-slate-300'}`
}

const DATUM = 'w-full h-9 pr-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:border-transparent'

export default function WebLeadsFilterRad({ filter, flik, staff, tjanster, aktiva, onAndra, onRensa }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <SearchGlass className="w-4 h-4" />
          </span>
          <input
            type="search"
            value={filter.q}
            onChange={(e) => onAndra('q', e.target.value)}
            placeholder="Sök namn, telefon, e-post, ort eller nummer"
            aria-label="Sök förfrågningar"
            className={`${falt(!!filter.q)} w-full pl-9 placeholder:text-slate-500`}
          />
        </div>

        {flik !== 'inkorg' && (
          <select aria-label="Status" className={falt(!!filter.status)} value={filter.status} onChange={(e) => onAndra('status', e.target.value)}>
            <option value="">Alla statusar</option>
            {STATUS_ORDNING.map((s) => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>
        )}

        <select aria-label="Tjänst" className={falt(!!filter.tjanst)} value={filter.tjanst} onChange={(e) => onAndra('tjanst', e.target.value)}>
          <option value="">Alla tjänster</option>
          {TJANST_ORDNING.filter((t) => tjanster.has(t) || t === filter.tjanst).map((t) => (
            <option key={t} value={t}>{TJANST_LABEL[t]}</option>
          ))}
        </select>

        <select aria-label="Kundgrupp" className={falt(!!filter.kundgrupp)} value={filter.kundgrupp} onChange={(e) => onAndra('kundgrupp', e.target.value)}>
          <option value="">Alla kundgrupper</option>
          {(Object.keys(KUNDGRUPP_LABEL) as WebInquiryKundgrupp[]).map((k) => <option key={k} value={k}>{KUNDGRUPP_LABEL[k]}</option>)}
        </select>

        <select aria-label="Källa" className={falt(!!filter.kalla)} value={filter.kalla} onChange={(e) => onAndra('kalla', e.target.value)}>
          <option value="">Alla källor</option>
          {KANAL_ORDNING.map((k) => <option key={k} value={k}>{KANAL_LABEL[k]}</option>)}
          <option value="artanalys">Artanalys (bildanalys)</option>
        </select>

        <select aria-label="Tilldelad" className={falt(!!filter.tilldelad)} value={filter.tilldelad} onChange={(e) => onAndra('tilldelad', e.target.value)}>
          <option value="">Alla tilldelade</option>
          <option value="mig">Mig</option>
          <option value="ingen">Ingen</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.display_name || s.email}</option>)}
        </select>

        <div className="w-[150px]">
          <DateField value={filter.fran} onChange={(v) => onAndra('fran', v)} max={filter.till || undefined} placeholder="Från" aria-label="Inkom från" clearable className={DATUM} />
        </div>
        <div className="w-[150px]">
          <DateField value={filter.till} onChange={(v) => onAndra('till', v)} min={filter.fran || undefined} placeholder="Till" aria-label="Inkom till" clearable className={DATUM} />
        </div>

        <label className="flex items-center gap-2 h-9 px-1 text-sm text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={filter.arkiv}
            onChange={(e) => onAndra('arkiv', e.target.checked ? '1' : '')}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#20c58f] focus:ring-[#20c58f] focus:ring-offset-0"
          />
          Visa arkiverade
        </label>
      </div>

      {aktiva.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="text-slate-500">Filter:</span>
          {aktiva.map((a) => (
            <span key={a.nyckel} className="flex items-center gap-1 text-slate-300">
              {a.text}
              <button
                type="button"
                onClick={() => onAndra(a.nyckel, '')}
                className="p-0.5 text-slate-500 hover:text-white rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                aria-label={`Ta bort filtret ${a.text}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {aktiva.length > 1 && (
            <button
              type="button"
              onClick={onRensa}
              className="text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
            >
              Rensa alla
            </button>
          )}
        </div>
      )}
    </div>
  )
}
