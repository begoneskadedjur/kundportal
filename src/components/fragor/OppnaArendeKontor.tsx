// src/components/fragor/OppnaArendeKontor.tsx
// Öppnar ett ärende för admin och koordinator i samma modal som schemat använder
// (CoordinatorSchedule.handleSearchSelectCase):
//   contract + rondering_trafikkontoret   -> RonderingCaseModal
//   contract + egenkontroll_trafikkontoret -> EgenkontrollCaseModal
//   contract övrigt                        -> EditContractCaseModal
//   private / business                     -> EditCaseModal
// Raden hämtas med samma form som schemat innan modalen öppnas.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import EditCaseModal from '../admin/technicians/EditCaseModal'
import EditContractCaseModal from '../coordinator/EditContractCaseModal'
import RonderingCaseModal from '../coordinator/RonderingCaseModal'
import EgenkontrollCaseModal from '../coordinator/EgenkontrollCaseModal'
import LoadingSpinner from '../shared/LoadingSpinner'
import type { CaseType } from '../../types/communication'

interface Props {
  arende: { id: string; typ: CaseType } | null
  onClose: () => void
}

type Modal = 'contract' | 'rondering' | 'egenkontroll' | 'clickup'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rad = any

const AVTAL_FALT = `
  *, customer:customers(
    company_name, contact_address, contact_person, contact_phone,
    contact_email, billing_email, billing_address,
    organization_number, parent_customer_id, site_name, is_multisite
  ),
  contract:contracts!cases_contract_id_fkey(
    id, address_label, contact_address, oneflow_contract_id
  )
`

export default function OppnaArendeKontor({ arende, onClose }: Props) {
  const [rad, setRad] = useState<Rad | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)

  useEffect(() => {
    setRad(null)
    setModal(null)
    if (!arende) return
    let avbruten = false
    ;(async () => {
      try {
        if (arende.typ === 'contract') {
          const { data, error } = await supabase.from('cases').select(AVTAL_FALT).eq('id', arende.id).single()
          if (error) throw error
          if (avbruten) return
          setRad(data)
          setModal(
            data.service_type === 'rondering_trafikkontoret' ? 'rondering'
              : data.service_type === 'egenkontroll_trafikkontoret' ? 'egenkontroll'
              : 'contract'
          )
        } else {
          const tabell = arende.typ === 'private' ? 'private_cases' : 'business_cases'
          const { data, error } = await supabase.from(tabell).select('*').eq('id', arende.id).single()
          if (error) throw error
          if (avbruten) return
          setRad({ ...data, case_type: arende.typ })
          setModal('clickup')
        }
      } catch (e) {
        console.error('[OppnaArendeKontor]', e)
        if (!avbruten) {
          toast.error('Kunde inte öppna ärendet')
          onClose()
        }
      }
    })()
    return () => { avbruten = true }
    // onClose ska inte trigga ny hämtning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arende?.id, arende?.typ])

  if (!arende) return null

  if (!rad || !modal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="status" aria-live="polite">
        <div className="rounded-2xl bg-slate-900 border border-slate-700 px-6 py-5">
          <LoadingSpinner text="Öppnar ärendet..." />
        </div>
      </div>
    )
  }

  const stang = () => {
    setRad(null)
    setModal(null)
    onClose()
  }

  if (modal === 'clickup') {
    return (
      <EditCaseModal
        isOpen
        onClose={stang}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess={(uppdaterat?: any) => { if (uppdaterat) setRad((p: Rad) => (p ? { ...p, ...uppdaterat } : p)) }}
        onDeleted={stang}
        caseData={rad}
      />
    )
  }
  if (modal === 'rondering') return <RonderingCaseModal isOpen onClose={stang} caseData={rad} />
  if (modal === 'egenkontroll') return <EgenkontrollCaseModal isOpen onClose={stang} caseData={rad} />
  return <EditContractCaseModal isOpen onClose={stang} onDeleted={stang} caseData={rad} />
}
