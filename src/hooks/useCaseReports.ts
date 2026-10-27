// src/hooks/useCaseReports.ts
// Ärendets rapporter för fakturamodalens ruta Utfört arbete (2026-10):
// arbetsrapporten per besök ur visits (samma källa som VisitHistoryPanel och
// useInvoiceVisit) och ärendets specialrapporter (SpecialReportService.listForCase).
// Fel ger tomma listor och en feltext, aldrig ett kast: rutan ska alltid gå
// att visa även om något inte kunde hämtas.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SpecialReportService } from '../services/specialReportService'
import type { SpecialReportCaseType, SpecialReportListItem } from '../types/specialReport'

export interface CaseVisitReport {
  id: string
  visit_number: number | null
  visit_date: string
  technician_name: string | null
  technicians?: Array<{ id: string | null; name: string; role?: string }> | null
  work_performed: string | null
  recommendations: string | null
}

export interface CaseReports {
  /** Ärendets besök, nyast först */
  visits: CaseVisitReport[]
  /** Antal besök i ärendet (högsta besöksnumret eller antalet rader) */
  visitCount: number
  specialReports: SpecialReportListItem[]
  specialError: string | null
  isLoading: boolean
}

const EMPTY: CaseReports = { visits: [], visitCount: 0, specialReports: [], specialError: null, isLoading: false }

export function useCaseReports(caseId: string | null, caseType: SpecialReportCaseType | null): CaseReports {
  const [state, setState] = useState<CaseReports>(EMPTY)

  useEffect(() => {
    if (!caseId) {
      setState(EMPTY)
      return
    }
    let cancelled = false
    setState(s => ({ ...s, isLoading: true }))

    const load = async () => {
      let visits: CaseVisitReport[] = []
      try {
        const { data, error } = await supabase
          .from('visits')
          .select('id, visit_number, visit_date, technician_name, technicians, work_performed, recommendations')
          .eq('case_id', caseId)
          .order('visit_date', { ascending: false })
        if (error) throw error
        visits = (data as CaseVisitReport[] | null) ?? []
      } catch (err) {
        console.error('[useCaseReports] Besöken kunde inte hämtas:', err)
      }

      let specialReports: SpecialReportListItem[] = []
      let specialError: string | null = null
      if (caseType) {
        try {
          specialReports = await SpecialReportService.listForCase(caseId, caseType)
        } catch (err) {
          console.error('[useCaseReports] Specialrapporterna kunde inte hämtas:', err)
          specialError = 'Specialrapporterna kunde inte hämtas'
        }
      }

      if (cancelled) return
      const maxNumber = visits.reduce((m, v) => Math.max(m, v.visit_number ?? 0), 0)
      setState({
        visits,
        visitCount: Math.max(maxNumber, visits.length),
        specialReports,
        specialError,
        isLoading: false,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [caseId, caseType])

  return state
}
