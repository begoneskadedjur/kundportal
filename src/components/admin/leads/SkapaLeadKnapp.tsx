// src/components/admin/leads/SkapaLeadKnapp.tsx
// Leads etapp 5: knappen "Skapa lead" i engångsärenden (privat och företag), både i kontorets
// ärendemodal och i teknikerns vy. Har ärendet redan en lead visas "Lead skapad · Företag →" i stället
// (läses via origin_case_type/origin_case_id i RPC lead_arende_underlag). Ser anroparen inte ärendet
// (RLS-regeln för rollen) visas ingenting. Beslut 3: bara engångsärenden, inte avtalsärenden,
// rondering, egenkontroll eller Försäljningsmöjligheter.

import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import type { LeadArendeUnderlag, LeadPaArende } from '../../../types/leads'
import SkapaLeadModal from './SkapaLeadModal'
import { leadsSidaFor } from './leadLogik'

interface Props {
  caseType: 'private' | 'business'
  caseId: string
  className?: string
}

export default function SkapaLeadKnapp({ caseType, caseId, className = '' }: Props) {
  const { pathname } = useLocation()
  const leadsSida = leadsSidaFor(pathname)
  const tabell = caseType === 'business' ? 'business_cases' : 'private_cases'
  const [underlag, setUnderlag] = useState<LeadArendeUnderlag | null>(null)
  const [befintlig, setBefintlig] = useState<LeadPaArende | null>(null)
  const [visa, setVisa] = useState(false)

  const ladda = useCallback(async () => {
    try {
      const u = await LeadService.arendeUnderlag(tabell, caseId)
      setUnderlag(u)
      setBefintlig(u.befintlig)
    } catch {
      // Ser man inte ärendet (eller saknar rätt) visas ingen knapp
      setUnderlag(null)
      setBefintlig(null)
    }
  }, [tabell, caseId])

  useEffect(() => {
    void ladda()
  }, [ladda])

  if (!underlag) return null

  if (befintlig) {
    const text = (
      <>
        <Icon name="lead.lead" size={16} className="text-[#20c58f] shrink-0" />
        <span className="truncate">Lead skapad · {befintlig.company_name}</span>
        {befintlig.kan_oppna && <span aria-hidden>→</span>}
      </>
    )
    return befintlig.kan_oppna ? (
      <Link
        to={`${leadsSida}?id=${befintlig.id}`}
        className={`inline-flex items-center gap-1.5 min-w-0 text-sm text-slate-200 hover:text-[#20c58f] ${className}`}
        title="Öppna leaden"
      >
        {text}
      </Link>
    ) : (
      <span className={`inline-flex items-center gap-1.5 min-w-0 text-sm text-slate-300 ${className}`} title="Leaden ägs av en kollega">
        {text}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setVisa(true)}
        className={`inline-flex items-center gap-1.5 h-8 px-2.5 bg-slate-800/50 border border-slate-700 hover:border-[#20c58f]/50 rounded-lg text-slate-300 hover:text-white text-xs font-medium transition-colors ${className}`}
        title="Tipsa om ett löpande avtal eller merförsäljning"
      >
        <Icon name="lead.tips" size={16} className="text-[#20c58f] shrink-0" />
        Skapa lead
      </button>
      <SkapaLeadModal
        isOpen={visa}
        underlag={underlag}
        leadsSida={leadsSida}
        onClose={() => {
          setVisa(false)
          // En anteckning på en dubblett ändrar inget här, men en kollega kan ha skapat en lead under tiden
          void ladda()
        }}
        onKlar={(svar) => {
          setVisa(false)
          setBefintlig({ id: svar.lead_id, company_name: svar.company_name, stage: 'ny', kan_oppna: svar.kan_oppna })
        }}
      />
    </>
  )
}
