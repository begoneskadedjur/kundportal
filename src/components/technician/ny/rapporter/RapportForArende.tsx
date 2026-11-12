// src/components/technician/ny/rapporter/RapportForArende.tsx
// Kör rätt rapportfunktion för ETT valt ärende i Mina rapporter och lämnar
// rapportens val till children. Hela raden läses först när ärendet väljs
// (listan har bara det som syns), och bara den inloggade teknikerns egna
// ärenden finns i listan. Remontera med key={rad.nyckel} vid byte av ärende.
//
//   <RapportForArende key={rad.nyckel} rad={rad}>
//     {(rapport, laddar) => ...}
//   </RapportForArende>
//
// Samma mappning som ärendemodalerna, så rapporten blir densamma som i steget Rapport:
//  - privat/företag: useWorkReportGeneration som i EditCaseModal
//  - avtal och rondering: useModernWorkReportGeneration som i EditContractCaseModal
//  - stationskontroll: useKontrollRapport (inspectionReportService)

import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../contexts/AuthContext'
import { useWorkReportGeneration } from '../../../../hooks/useWorkReportGeneration'
import { useModernWorkReportGeneration } from '../../../../hooks/useModernWorkReportGeneration'
import { formatAddress } from '../../../../utils/addressFormatter'
import { mappaAvtalsarende } from '../arendeMappning'
import { franArbetsrapport, useMinEpost, type RapportHandlingar } from './rapportHandlingar'
import { useKontrollRapport } from './useKontrollRapport'
import type { RapportRad } from './rapportLogik'

type Barn = (rapport: RapportHandlingar | null, laddar: boolean) => ReactNode

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rad = any

const TOM = { id: '', case_type: 'private' as const, title: '', status: '', created_date: new Date().toISOString() }

function Sanering({ rad, data, children }: { rad: RapportRad; data: Rad | null; children: Barn }) {
  const { epost, namn } = useMinEpost()
  const hook = useWorkReportGeneration(data ? {
    ...data,
    case_price: data.pris,
    case_type: rad.kalla === 'business' ? 'business' : 'private',
    clickup_task_id: data.id,
    assignee_name: data.primary_assignee_name,
    foretag: rad.kalla === 'business' ? 'Företag' : undefined,
    created_date: data.created_date ?? data.created_at,
  } : TOM)
  if (!data) return <>{children(null, true)}</>
  return <>{children(franArbetsrapport(hook, {
    sort: 'sanering', arendenummer: rad.arendenummer, kundEpost: rad.kundEpost, minEpost: epost, minNamn: namn,
  }), false)}</>
}

function Arende({ rad, data, children }: { rad: RapportRad; data: Rad | null; children: Barn }) {
  const { profile } = useAuth()
  const { epost, namn } = useMinEpost()
  const m = data ? mappaAvtalsarende(data, profile?.technician_id) : null
  const hook = useModernWorkReportGeneration(m ? {
    ...m,
    case_type: 'contract' as const,
    rapport: data.work_report || '',
    kontaktperson: data.contact_person || m.kontaktperson,
    telefon_kontaktperson: data.contact_phone || m.telefon_kontaktperson,
    e_post_kontaktperson: rad.kundEpost ?? undefined,
    skadedjur: data.pest_type || '',
    service_id: data.service_id ?? null,
    adress: formatAddress(data.address || m.adress),
    case_price: data.price || 0,
    primary_assignee_name: data.primary_technician_name,
    scheduled_start: data.scheduled_start ?? null,
    pest_level: data.pest_level ?? null,
    problem_rating: data.problem_rating ?? null,
    recommendations: data.recommendations || '',
    created_date: data.created_at,
  } : TOM)
  if (!data) return <>{children(null, true)}</>
  return <>{children(franArbetsrapport(hook, {
    sort: 'arende', arendenummer: rad.arendenummer, kundEpost: rad.kundEpost, kundNamn: rad.kontaktperson, minEpost: epost, minNamn: namn,
  }), false)}</>
}

function Kontroll({ rad, children }: { rad: RapportRad; children: Barn }) {
  const { epost } = useMinEpost()
  const { rapport, laddar } = useKontrollRapport({
    caseId: rad.id,
    arendenummer: rad.arendenummer,
    reservEpost: rad.kundEpost,
    reservNamn: rad.kontaktperson,
    minEpost: epost,
  })
  return <>{children(rapport, laddar)}</>
}

export function RapportForArende({ rad, children }: { rad: RapportRad; children: Barn }) {
  const [data, setData] = useState<Rad | null>(null)
  const [fel, setFel] = useState(false)

  useEffect(() => {
    if (rad.sort === 'kontroll') return
    let avbruten = false
    ;(async () => {
      const fraga = rad.kalla === 'cases'
        ? supabase.from('cases').select('*, customer:customers(*)').eq('id', rad.id).single()
        : supabase.from(rad.kalla === 'private' ? 'private_cases' : 'business_cases').select('*').eq('id', rad.id).single()
      const { data: d, error } = await fraga
      if (avbruten) return
      if (error || !d) setFel(true)
      else setData(d)
    })()
    return () => { avbruten = true }
  }, [rad.id, rad.kalla, rad.sort])

  if (fel) return <>{children(null, false)}</>
  if (rad.sort === 'kontroll') return <Kontroll rad={rad}>{children}</Kontroll>
  if (rad.sort === 'sanering') return <Sanering rad={rad} data={data}>{children}</Sanering>
  return <Arende rad={rad} data={data}>{children}</Arende>
}

export default RapportForArende
