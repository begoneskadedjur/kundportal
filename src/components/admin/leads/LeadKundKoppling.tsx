// src/components/admin/leads/LeadKundKoppling.tsx
// Leads etapp 5: steget "Koppla eller skapa kund" när leaden är vunnen men saknar kund.
// Signerade avtal i Oneflow får aldrig kund automatiskt (leads-crm.md), så steget är tydligt och
// står överst i modalen tills kunden är kopplad. Matchningen återanvänder
// WebInquiryService.findCustomerMatches (org.nr, e-postdomän, telefon, samma som Leads (Webb)),
// och en sökning på namn, org.nr eller kundnummer finns som reserv. Ny kund skapas i befintliga
// CreateCustomerManuallyModal (med Fortnox-uppslaget) via onSkapaKund.
// customer_id sparas på leaden och databasen loggar kund_kopplad.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import { WebInquiryService } from '../../../services/webInquiryService'
import type { Lead } from '../../../types/database'
import { KUND_MATCH_LABEL, type KundMatchning } from '../../../types/webInquiry'
import { FALT, SEKTION_RUBRIK } from './leadLogik'

interface Props {
  lead: Lead
  /** Säljare, koordinator och admin skapar kunder; tekniker kopplar bara. */
  kanSkapaKund: boolean
  onKoppla: (customerId: string) => Promise<void>
  onSkapaKund: () => void
}

type Traff = { id: string; namn: string; info: string }

export default function LeadKundKoppling({ lead, kanSkapaKund, onKoppla, onSkapaKund }: Props) {
  const [forslag, setForslag] = useState<Traff[]>([])
  const [satt, setSatt] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [sok, setSok] = useState<Traff[]>([])
  const [arbetar, setArbetar] = useState<string | null>(null)

  useEffect(() => {
    let avbruten = false
    const orgnr = lead.organization_number || null
    WebInquiryService.findCustomerMatches({
      id_nummer: orgnr,
      id_nummer_typ: orgnr ? 'orgnr' : null,
      organization_number: orgnr,
      kundgrupp: lead.customer_group === 'privat' ? 'privat' : lead.customer_group === 'forening' ? 'brf_fastighet' : 'verksamhet',
      email: lead.email,
      phone: lead.phone_number ?? '',
    })
      .then((m: KundMatchning[]) => {
        if (avbruten) return
        setSatt(m[0] ? KUND_MATCH_LABEL[m[0].satt] : null)
        setForslag(
          m.slice(0, 5).map((k) => ({
            id: k.customer_id,
            namn: k.namn,
            info: [k.kundnummer ? `kundnr ${k.kundnummer}` : null, k.ar_enhet && k.huvudkontor_namn ? `enhet under ${k.huvudkontor_namn}` : null, k.har_avtal ? 'har avtal' : null]
              .filter(Boolean)
              .join(' · '),
          })),
        )
      })
      .catch(() => !avbruten && setForslag([]))
    return () => {
      avbruten = true
    }
  }, [lead.id, lead.organization_number, lead.email, lead.phone_number, lead.customer_group])

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      setSok([])
      return
    }
    const timer = window.setTimeout(() => {
      LeadService.sokKunder(t)
        .then((rader) =>
          setSok(rader.map((r) => ({ id: r.id, namn: r.company_name, info: [r.customer_number ? `kundnr ${r.customer_number}` : null, r.organization_number].filter(Boolean).join(' · ') }))),
        )
        .catch(() => setSok([]))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [q])

  const koppla = async (id: string) => {
    setArbetar(id)
    try {
      await onKoppla(id)
      toast.success('Kunden är kopplad till leaden')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunden kunde inte kopplas')
    } finally {
      setArbetar(null)
    }
  }

  const rad = (k: Traff) => (
    <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl">
      <span className="min-w-0 text-sm">
        <span className="text-white">{k.namn}</span>
        {k.info && <span className="block text-xs text-slate-400">{k.info}</span>}
      </span>
      <Button variant="secondary" size="sm" onClick={() => void koppla(k.id)} loading={arbetar === k.id} disabled={!!arbetar}>
        Koppla
      </Button>
    </li>
  )

  return (
    <div className="p-3 bg-slate-800/30 border border-[#20c58f]/40 rounded-xl space-y-3">
      <div>
        <h3 className={SEKTION_RUBRIK}>
          <Icon name="lead.vunnen" size={16} className="text-[#20c58f]" /> Koppla eller skapa kund
        </h3>
        <p className="text-xs text-slate-400 -mt-1">
          Leaden är vunnen men har ingen kund. Koppla den till kundregistret så att avtal, fakturering och statistik hänger ihop.
        </p>
      </div>

      {forslag.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Förslag (matchat på {satt})</p>
          <ul className="space-y-2">{forslag.map(rad)}</ul>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="lead-kund-sok">Sök kund</label>
        <input id="lead-kund-sok" className={FALT} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Namn, org.nr eller kundnummer" />
        {sok.length > 0 && <ul className="space-y-2 mt-2">{sok.filter((s) => !forslag.some((f) => f.id === s.id)).map(rad)}</ul>}
        {q.trim().length >= 2 && sok.length === 0 && <p className="text-xs text-slate-500 mt-1">Ingen kund hittades.</p>}
      </div>

      {kanSkapaKund && (
        <div className="pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-400">Finns kunden inte? Skapa den med uppgifterna från leaden.</span>
          <Button variant="primary" size="sm" onClick={onSkapaKund} disabled={!!arbetar}>
            <Icon name="allman.plus" size={16} className="mr-1.5" />
            Skapa kund
          </Button>
        </div>
      )}
    </div>
  )
}
