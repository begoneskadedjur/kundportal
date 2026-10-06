// src/components/admin/webLeads/WebLeadBefintligKund.tsx
// Leads (Webb): rutan som visar att förfrågan kommer från en befintlig kund. Matchningen görs i
// WebInquiryService.findCustomerMatches (org.nr, e-postdomän, telefonnummer). För en avtalskund
// öppnar Skapa ärende ärendemodalen i avtalsläge; koordinatorn kan välja bort matchningen.
// Modalstandard: sektion p-3 bg-slate-800/30, inga piller, statuspunkt som text.

import { Link } from 'react-router-dom'
import { Building2, ExternalLink } from 'lucide-react'
import { KUND_MATCH_LABEL, type KundMatchning } from '../../../types/webInquiry'

interface Props {
  matchningar: KundMatchning[]
  valdId: string | null
  onValj: (customerId: string) => void
  bortvald: boolean
  onBortval: (bortvald: boolean) => void
  /** Rollens bas, för länken till kunden. */
  basePath: string
  /** Säljare skapar inga ärenden: valet och bortvalet visas då inte. */
  kanSkapaArende: boolean
}

function kundText(m: KundMatchning): string {
  const enhet = m.ar_enhet && m.huvudkontor_namn ? `, enhet under ${m.huvudkontor_namn}` : ''
  const nr = m.kundnummer ? ` (kundnr ${m.kundnummer})` : ''
  return `${m.namn}${enhet}${nr}`
}

function avtalText(m: KundMatchning): string {
  return m.avtal_till ? `avtal till ${m.avtal_till}` : 'avtal utan slutdatum'
}

export default function WebLeadBefintligKund({ matchningar, valdId, onValj, bortvald, onBortval, basePath, kanSkapaArende }: Props) {
  const avtalskunder = matchningar.filter((m) => m.har_avtal)
  const ovriga = matchningar.filter((m) => !m.har_avtal)
  if (!matchningar.length) return null

  const satt = KUND_MATCH_LABEL[matchningar[0].satt]
  const vald = avtalskunder.find((m) => m.customer_id === valdId) ?? avtalskunder[0] ?? null
  const kundLank = (id: string) => `${basePath}/befintliga-kunder/${id}`

  if (!avtalskunder.length) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-sm">
        <p className="flex items-center gap-1.5 text-slate-300">
          <Building2 className="w-4 h-4 text-slate-400" />
          Finns i kundregistret utan gällande avtal: {ovriga.slice(0, 3).map((m) => m.namn).join(', ')}
          {ovriga.length > 3 ? ` och ${ovriga.length - 3} till` : ''}
        </p>
        <p className="text-xs text-slate-500 mt-1">Matchad på {satt}. Skapa ärende gäller privat eller företag som vanligt.</p>
      </div>
    )
  }

  if (bortvald) {
    return (
      <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-sm flex flex-wrap items-center justify-between gap-2">
        <p className="text-slate-400">
          Matchningen mot {vald?.namn} är bortvald. Skapa ärende gäller privat eller företag.
        </p>
        <button type="button" onClick={() => onBortval(false)} className="text-sm text-[#20c58f] hover:underline">
          Ångra
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 bg-slate-800/30 border border-[#20c58f]/40 rounded-xl text-sm space-y-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-white font-medium">
            <span className="w-2 h-2 rounded-full bg-[#20c58f]" />
            Befintlig avtalskund: {vald?.namn}, {vald ? avtalText(vald) : ''}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Matchad på {satt}
            {vald?.ar_enhet && vald.huvudkontor_namn ? `. Enhet under ${vald.huvudkontor_namn}` : ''}
            {matchningar[0].satt !== 'orgnr' ? '. Kontrollera att det är rätt kund.' : '.'}
            {kanSkapaArende ? ' Skapa ärende öppnar ärendemodalen för avtalskunder.' : ''}
          </p>
        </div>
        {vald && (
          <Link to={kundLank(vald.customer_id)} className="inline-flex items-center gap-1.5 text-sm text-[#20c58f] hover:underline">
            <ExternalLink className="w-4 h-4" />
            Öppna kunden
          </Link>
        )}
      </div>

      {avtalskunder.length > 1 && kanSkapaArende && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-befintlig-kund">
            {avtalskunder.length} träffar. Välj kund eller enhet
          </label>
          <select
            id="wi-befintlig-kund"
            value={vald?.customer_id ?? ''}
            onChange={(e) => onValj(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
          >
            {avtalskunder.map((m) => (
              <option key={m.customer_id} value={m.customer_id}>
                {kundText(m)}, {avtalText(m)}
              </option>
            ))}
          </select>
        </div>
      )}

      {kanSkapaArende && (
        <button type="button" onClick={() => onBortval(true)} className="text-xs text-slate-400 hover:text-white underline">
          Inte samma kund, skapa ärende som privat eller företag
        </button>
      )}
    </div>
  )
}
