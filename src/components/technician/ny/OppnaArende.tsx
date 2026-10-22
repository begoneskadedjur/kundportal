// src/components/technician/ny/OppnaArende.tsx
// Öppnar ett ärende i samma modal som teknikerschemat använder för typen.
//
//   <OppnaArende arende={{ kalla: 'cases', id }} onClose={...} onSaved={...} />
//
// Typmappning (rättad mot TechnicianSchedule, där egenkontroll öppnades i fel modal):
//   cases + inspection/establishment/routine/contract_extra/övrigt  -> EditContractCaseModal
//   cases + rondering_trafikkontoret                                 -> RonderingCaseModal
//   cases + egenkontroll_trafikkontoret                              -> EgenkontrollCaseModal
//   private_cases / business_cases                                   -> EditCaseModal
//
// Hela raden hämtas innan modalen öppnas och mappas likadant som i TechnicianSchedule,
// så modalerna får exakt samma caseData som från schemat.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import EditCaseModal from '../../admin/technicians/EditCaseModal'
import EditContractCaseModal from '../../coordinator/EditContractCaseModal'
import RonderingCaseModal from '../../coordinator/RonderingCaseModal'
import EgenkontrollCaseModal from '../../coordinator/EgenkontrollCaseModal'
import LoadingSpinner from '../../shared/LoadingSpinner'
import type { ArendeKalla } from '../../../services/teknikerDagService'

export interface ArendeRef {
  kalla: ArendeKalla
  id: string
}

interface Props {
  arende: ArendeRef | null
  onClose: () => void
  /** Anropas när modalen stängs (och när ärendet raderats), så listan kan läsas om */
  onSaved?: () => void
}

type Modal = 'contract' | 'rondering' | 'egenkontroll' | 'clickup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rad = any

/** Samma mappning som TechnicianSchedule.fetchScheduledCases för avtalsärenden */
function mappaAvtalsarende(c: Rad, technicianId: string | null | undefined): Rad {
  const customer = c.customer || {}
  const caseType = c.service_type === 'inspection' ? 'inspection'
    : c.service_type === 'establishment' ? 'establishment'
    : c.service_type === 'rondering_trafikkontoret' ? 'rondering'
    : c.service_type === 'egenkontroll_trafikkontoret' ? 'egenkontroll'
    : 'contract'
  return {
    ...c,
    start_date: c.scheduled_start,
    due_date: c.scheduled_end,
    primary_assignee_id: c.primary_technician_id,
    primary_assignee_name: c.primary_technician_name,
    primary_assignee_email: c.primary_technician_email,
    secondary_assignee_id: c.secondary_technician_id || null,
    secondary_assignee_name: c.secondary_technician_name || null,
    tertiary_assignee_id: c.tertiary_technician_id || null,
    tertiary_assignee_name: c.tertiary_technician_name || null,
    technician_role: c.secondary_technician_id === technicianId ? 'secondary'
      : c.tertiary_technician_id === technicianId ? 'tertiary' : 'primary',
    adress: customer.contact_address || c.address?.formatted_address || c.address,
    kontaktperson: customer.contact_person || c.contact_person,
    telefon_kontaktperson: customer.contact_phone || c.contact_phone,
    email: customer.contact_email || c.contact_email,
    skadedjur: c.pest_type,
    annat_skadedjur: c.other_pest_type,
    status: c.status,
    case_price: c.price,
    case_type: caseType,
    service_type: c.service_type,
    bestallare: customer.company_name,
    organization_number: customer.organization_number,
  }
}

export default function OppnaArende({ arende, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const technicianId = profile?.technician_id
  const [rad, setRad] = useState<Rad | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [laddar, setLaddar] = useState(false)

  useEffect(() => {
    if (!arende) {
      setRad(null)
      setModal(null)
      return
    }
    let avbruten = false
    setLaddar(true)
    ;(async () => {
      try {
        if (arende.kalla === 'cases') {
          const { data, error } = await supabase.from('cases').select('*, customer:customers(*)').eq('id', arende.id).single()
          if (error) throw error
          if (avbruten) return
          setRad(mappaAvtalsarende(data, technicianId))
          setModal(
            data.service_type === 'rondering_trafikkontoret' ? 'rondering'
              : data.service_type === 'egenkontroll_trafikkontoret' ? 'egenkontroll'
              : 'contract'
          )
        } else {
          const tabell = arende.kalla === 'private' ? 'private_cases' : 'business_cases'
          const { data, error } = await supabase.from(tabell).select('*').eq('id', arende.id).single()
          if (error) throw error
          if (avbruten) return
          // Samma mappning som TechnicianSchedule för ClickUp-ärenden
          setRad({
            ...data,
            case_price: data.pris,
            case_type: arende.kalla,
            technician_role: data.secondary_assignee_id === technicianId ? 'secondary'
              : data.tertiary_assignee_id === technicianId ? 'tertiary' : 'primary',
          })
          setModal('clickup')
        }
      } catch (e) {
        console.error('[OppnaArende]', e)
        if (!avbruten) {
          toast.error('Kunde inte öppna ärendet')
          onClose()
        }
      } finally {
        if (!avbruten) setLaddar(false)
      }
    })()
    return () => { avbruten = true }
    // onClose ska inte trigga ny hämtning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arende?.kalla, arende?.id, technicianId])

  // Listan läses om när modalen stängs, alltid. Då syns allt som hänt i
  // ärendet (sparat i stegen, startad tid som sparas vid stängning, avslut)
  // utan att föräldern laddar om mitt i stegflödet.
  const stang = () => {
    setRad(null)
    setModal(null)
    onClose()
    onSaved?.()
  }

  // ClickUp-ärenden: onSuccess(uppdaterat) betyder sparat, modalen stannar öppen
  // (samma som schemat, som bara uppdaterar selectedCase)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sparatClickUp = (uppdaterat?: any) => {
    if (uppdaterat) setRad((prev: Rad) => (prev ? { ...prev, ...uppdaterat } : prev))
  }

  // Avtalsmodalerna anropar onSuccess efter varje sparning. I stegflödet sparas
  // det vid varje Vidare, så modalen ska stå kvar: inget görs här, listan läses
  // om när modalen stängs med onClose (krysset, Stäng eller sidfoten).
  // Kommer onSuccess efter att modalen redan stängts läses listan om direkt.
  const sparatAvtal = () => {
    if (!modal) onSaved?.()
  }

  const raderat = () => {
    stang()
  }

  if (!arende) return null

  if (laddar || !rad) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="status" aria-live="polite">
        <div className="rounded-2xl bg-slate-900 border border-slate-700 px-6 py-5">
          <LoadingSpinner text="Öppnar ärendet..." />
        </div>
      </div>
    )
  }

  if (modal === 'clickup') {
    return (
      <EditCaseModal
        isOpen
        onClose={stang}
        onSuccess={sparatClickUp}
        onDeleted={raderat}
        caseData={rad}
      />
    )
  }
  if (modal === 'rondering') {
    return <RonderingCaseModal isOpen onClose={stang} onSuccess={sparatAvtal} caseData={rad} />
  }
  if (modal === 'egenkontroll') {
    return <EgenkontrollCaseModal isOpen onClose={stang} onSuccess={sparatAvtal} caseData={rad} />
  }
  return (
    <EditContractCaseModal
      isOpen
      onClose={stang}
      onSuccess={sparatAvtal}
      onDeleted={raderat}
      caseData={rad}
    />
  )
}
