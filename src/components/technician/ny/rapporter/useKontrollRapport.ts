// src/components/technician/ny/rapporter/useKontrollRapport.ts
// Kontrollrapporten (stationskontroll) som rapportval i nya arbetsvyn.
// Samma tjänster som InspectionReportSection: PDF, Excel och e-post via
// inspectionReportService. Sessionen läses när caseId eller uppdatera ändras,
// så att rapporten finns direkt efter att kontrollen klarmarkerats.
// rapport är null tills det finns en avslutad kontrollrunda på ärendet,
// laddar är sann medan sessionen hämtas första gången.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { getInspectionSessionByCaseId } from '../../../../services/inspectionSessionService'
import {
  generateInspectionExcel, generateInspectionPDF, sendInspectionReportEmail,
} from '../../../../services/inspectionReportService'
import type { InspectionSessionWithRelations } from '../../../../types/inspectionSession'
import { RAPPORT_NAMN } from './rapportLogik'
import type { RapportHandlingar } from './rapportHandlingar'

interface Opt {
  /** null: ingen hämtning (till exempel inte stationskontroll eller gamla vyn) */
  caseId: string | null
  arendenummer: string | null
  /** Används om kundkortet saknar kontakt-e-post */
  reservEpost?: string | null
  reservNamn?: string | null
  minEpost: string | null
  /** Ändras när sessionen ska läsas om (efter klarmarkering) */
  uppdatera?: number
}

function felText(e: unknown, standard: string): string {
  return e instanceof Error && e.message ? e.message : standard
}

export function useKontrollRapport({ caseId, arendenummer, reservEpost, reservNamn, minEpost, uppdatera = 0 }: Opt): { rapport: RapportHandlingar | null; laddar: boolean } {
  const [session, setSession] = useState<InspectionSessionWithRelations | null>(null)
  const [hamtadFor, setHamtadFor] = useState<string | null>(null)
  const [upptagen, setUpptagen] = useState(false)

  useEffect(() => {
    if (!caseId) { setSession(null); return }
    let avbruten = false
    getInspectionSessionByCaseId(caseId)
      .then(s => { if (!avbruten) setSession(s) })
      .finally(() => { if (!avbruten) setHamtadFor(caseId) })
    return () => { avbruten = true }
  }, [caseId, uppdatera])

  const laddar = !!caseId && hamtadFor !== caseId
  if (!caseId || !session || session.case_id !== caseId || session.status !== 'completed') return { rapport: null, laddar }

  const kundEpost = session.customer?.contact_email?.trim() || reservEpost?.trim() || null
  const kundNamn = session.customer?.contact_person || reservNamn || ''

  const kor = async (fn: () => Promise<void>, fel: string): Promise<boolean> => {
    setUpptagen(true)
    try {
      await fn()
      return true
    } catch (e) {
      console.error('Kontrollrapport:', e)
      toast.error(felText(e, fel), { duration: 8000 })
      return false
    } finally {
      setUpptagen(false)
    }
  }

  return { laddar: false, rapport: {
    sort: 'kontroll',
    rapportNamn: RAPPORT_NAMN.kontroll,
    arendenummer,
    kundEpost,
    kundNamn,
    minEpost,
    upptagen,
    kanSkapas: true,
    laddaNed: async () => {
      await kor(async () => { await generateInspectionPDF(session.id); toast.success('PDF nedladdad') }, 'Kunde inte skapa rapporten')
    },
    laddaNedExcel: async () => {
      await kor(async () => { await generateInspectionExcel(session.id); toast.success('Excel nedladdad') }, 'Kunde inte skapa rapporten')
    },
    skickaTillKund: epost => kor(async () => {
      const { sentTo } = await sendInspectionReportEmail(session.id, {
        to: epost,
        // Hälsningsfrasen bara när mottagaren är kundens egen kontaktadress
        recipientName: kundEpost && epost.trim().toLowerCase() === kundEpost.toLowerCase() ? kundNamn : '',
        caseNumber: arendenummer ?? undefined,
      })
      toast.success(`Kontrollrapporten skickad till ${sentTo}`)
    }, 'Kunde inte skicka rapporten'),
    skickaTillMig: () => minEpost
      ? kor(async () => {
          const { sentTo } = await sendInspectionReportEmail(session.id, { to: minEpost, recipientName: '', caseNumber: arendenummer ?? undefined })
          toast.success(`Kontrollrapporten skickad till ${sentTo}`)
        }, 'Kunde inte skicka rapporten')
      : Promise.resolve(false),
  } }
}
