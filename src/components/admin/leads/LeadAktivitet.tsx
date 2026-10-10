// src/components/admin/leads/LeadAktivitet.tsx
// Aktivitet i leaden: skrivfält med Anteckning, Samtal, Mejl och Möte, och en samlad tidslinje där
// systemets händelser (skrivna av databasen med före och efter) och människans aktiviteter ligger i
// samma ström, nyast först.

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { Icon, type IconName } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import {
  AKTIVITET_ETIKETT,
  FORLUSTORSAK_ETIKETT,
  KALLA_ETIKETT,
  MANUELLA_AKTIVITETER,
  STAGE_ETIKETT,
  type LeadAktivitet as Aktivitet,
  type LeadAktivitetManuell,
  type LeadForlustorsak,
  type LeadSource,
  type LeadStage,
} from '../../../types/leads'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import { formatSvTid } from '../webLeads/format'
import { FALT, SEKTION, SEKTION_RUBRIK, kr, segment } from './leadLogik'

export interface LeadAktivitetRef {
  /** Välj typ och sätt fokus i skrivfältet (Logga samtal i åtgärdsraden) */
  borja: (kind: LeadAktivitetManuell) => void
}

interface Props {
  leadId: string
  aktiviteter: Aktivitet[]
  laddar: boolean
  minProfilId: string | null
  namnFor: (id: string | null) => string
  onSparad: () => void
}

const IKON: Partial<Record<Aktivitet['kind'], IconName>> = {
  anteckning: 'allman.anteckning',
  samtal: 'kontakt.telefon',
  mejl: 'kontakt.mejl',
  mote: 'kontakt.mote',
  skapad: 'lead.lead',
  agare: 'lead.agare',
  varde: 'lead.varde',
  nasta_steg: 'lead.nasta-steg',
  parkerad: 'lead.parkerad',
  forlorad: 'lead.forlorad',
  delad: 'lead.dela',
  delning_borttagen: 'lead.dela',
  kund_kopplad: 'allman.foretag',
  arende_kopplat: 'arende.arende',
  offert_skickad: 'dok.offert',
  offert_avbojd: 'dok.offert',
  avtal_signerat: 'dok.avtal',
}

const stegNamn = (v: string | null) => (v && v in STAGE_ETIKETT ? STAGE_ETIKETT[v as LeadStage] : v ?? '')
const krEller = (v: string | null) => (v ? kr(Number(v)) : 'ej satt')
// Databasen skriver timestamptz som text ('2026-10-13 12:17:27+00'); gör den till ISO så att alla webbläsare tolkar den
const tid = (v: string | null) => (v ? formatSvTid(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')) : '')

function aktivitetText(a: Aktivitet, namnFor: (id: string | null) => string): string {
  switch (a.kind) {
    case 'skapad':
      return `Lead skapad${a.till_varde && a.till_varde in KALLA_ETIKETT ? `, källa ${KALLA_ETIKETT[a.till_varde as LeadSource].toLowerCase()}` : ''}`
    case 'stage':
      return `${stegNamn(a.fran_varde)} → ${stegNamn(a.till_varde)}`
    case 'agare':
      return `Ägare: ${namnFor(a.fran_varde) || 'ingen'} → ${namnFor(a.till_varde) || 'ingen'}`
    case 'varde':
      return `Årspremie: ${krEller(a.fran_varde)} → ${krEller(a.till_varde)}`
    case 'nasta_steg':
      return `Nästa steg: ${a.text || 'inget'}${a.till_varde ? ` · ${tid(a.till_varde)}` : ''}${a.fran_varde ? ` (var ${tid(a.fran_varde)})` : ''}`
    case 'parkerad':
      return `Parkerad till ${a.till_varde ?? ''}`
    case 'forlorad':
      return `Förlorad: ${a.till_varde && a.till_varde in FORLUSTORSAK_ETIKETT ? FORLUSTORSAK_ETIKETT[a.till_varde as LeadForlustorsak] : 'okänd orsak'}${a.text ? `. ${a.text}` : ''}`
    case 'delad':
      return `Delad med ${namnFor(a.till_varde) || 'en kollega'}`
    case 'delning_borttagen':
      return `Delningen med ${namnFor(a.till_varde) || 'en kollega'} togs bort`
    case 'kund_kopplad':
      return 'Kopplad till en kund i kundregistret'
    case 'arende_kopplat':
      return 'Ärende kopplat'
    case 'offert_skickad':
      return `Offert skickad${a.text ? `. ${a.text}` : ''}`
    case 'offert_avbojd':
      return 'Offerten avböjdes'
    case 'avtal_signerat':
      return 'Avtalet signerat'
    default:
      return a.text ?? ''
  }
}

const LeadAktivitet = forwardRef<LeadAktivitetRef, Props>(function LeadAktivitet(
  { leadId, aktiviteter, laddar, minProfilId, namnFor, onSparad },
  ref,
) {
  const [kind, setKind] = useState<LeadAktivitetManuell>('anteckning')
  const [text, setText] = useState('')
  const [sparar, setSparar] = useState(false)
  const falt = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    borja: (k) => {
      setKind(k)
      falt.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => falt.current?.focus(), 150)
    },
  }))

  const spara = async () => {
    if (!text.trim() || !minProfilId) return
    setSparar(true)
    try {
      await LeadService.loggaAktivitet(leadId, minProfilId, kind, text, toLocalISOStringWithOffset(new Date()))
      setText('')
      onSparad()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktiviteten kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className={SEKTION}>
      <h3 className={SEKTION_RUBRIK}>
        <Icon name="allman.historik" size={16} className="text-[#20c58f]" /> Aktivitet
      </h3>
      <div className="flex flex-wrap border-b border-slate-700/50 mb-2" role="tablist" aria-label="Typ av aktivitet">
        {MANUELLA_AKTIVITETER.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={segment(kind === k)} onClick={() => setKind(k)}>
            {AKTIVITET_ETIKETT[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 mb-3">
        <textarea
          ref={falt}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void spara()
          }}
          rows={2}
          maxLength={4000}
          placeholder={kind === 'samtal' ? 'Vad sades i samtalet?' : kind === 'mote' ? 'Vad kom ni fram till?' : kind === 'mejl' ? 'Vad skickades eller kom in?' : 'Skriv vad som hände'}
          className={`flex-1 ${FALT}`}
        />
        <Button variant="primary" size="sm" disabled={sparar || !text.trim()} onClick={() => void spara()}>
          Spara
        </Button>
      </div>

      {laddar && aktiviteter.length === 0 ? (
        <p className="text-sm text-slate-500">Hämtar historiken...</p>
      ) : aktiviteter.length === 0 ? (
        <p className="text-sm text-slate-500">Ingen historik än.</p>
      ) : (
        <ul className="space-y-2">
          {aktiviteter.map((a) => {
            const manuell = (MANUELLA_AKTIVITETER as string[]).includes(a.kind)
            return (
              <li key={a.id} className="flex gap-2.5 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl text-sm">
                <Icon name={IKON[a.kind] ?? 'allman.historik'} size={16} className={`flex-none mt-0.5 ${manuell ? 'text-[#20c58f]' : 'text-slate-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-white whitespace-pre-wrap break-words">
                    {manuell && <span className="font-medium">{AKTIVITET_ETIKETT[a.kind]}: </span>}
                    {aktivitetText(a, namnFor)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono">{formatSvTid(a.occurred_at)}</span>
                    {' · '}
                    {a.profile_id ? namnFor(a.profile_id) || 'Okänd' : 'Systemet'}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
})

export default LeadAktivitet
