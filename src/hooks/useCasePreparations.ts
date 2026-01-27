// src/hooks/useCasePreparations.ts
// Hook för hantering av preparatanvändning i modal-komponenter

import { useState, useEffect, useCallback } from 'react'
import { CasePreparationService } from '../services/casePreparationService'
import {
  CasePreparationWithDetails,
  CasePreparationType,
  PreparationUnit
} from '../types/casePreparations'
import { Preparation } from '../types/preparations'
import toast from 'react-hot-toast'

interface UseCasePreparationsProps {
  caseId: string | null
  caseType: CasePreparationType
  pestType: string | null
  technicianId?: string | null
  technicianName?: string | null
  enabled?: boolean
}

interface UseCasePreparationsReturn {
  // Data
  casePreparations: CasePreparationWithDetails[]
  availablePreparations: Preparation[]

  // Loading states
  loading: boolean
  savingPreparation: boolean

  // Actions
  addPreparation: (
    preparationId: string,
    quantity: number,
    unit?: PreparationUnit,
    notes?: string
  ) => Promise<void>
  updatePreparation: (
    id: string,
    quantity: number,
    unit?: PreparationUnit,
    notes?: string
  ) => Promise<void>
  removePreparation: (id: string) => Promise<void>
  refreshPreparations: () => Promise<void>
}

export function useCasePreparations({
  caseId,
  caseType,
  pestType,
  technicianId,
  technicianName,
  enabled = true
}: UseCasePreparationsProps): UseCasePreparationsReturn {
  const [casePreparations, setCasePreparations] = useState<CasePreparationWithDetails[]>([])
  const [availablePreparations, setAvailablePreparations] = useState<Preparation[]>([])
  const [loading, setLoading] = useState(false)
  const [savingPreparation, setSavingPreparation] = useState(false)

  // Ladda preparat för ärendet
  const fetchCasePreparations = useCallback(async () => {
    if (!caseId || !enabled) return

    try {
      const data = await CasePreparationService.getCasePreparations(caseId, caseType)
      setCasePreparations(data)
    } catch (error) {
      console.error('Fel vid hämtning av preparatanvändning:', error)
    }
  }, [caseId, caseType, enabled])

  // Ladda tillgängliga preparat baserat på pest_type
  const fetchAvailablePreparations = useCallback(async () => {
    if (!enabled) return

    try {
      let data: Preparation[]

      if (pestType && pestType !== 'Övrigt' && pestType !== 'Inspektion') {
        // Filtrera på skadedjurstyp
        data = await CasePreparationService.getPreparationsForPestType(pestType)
      } else {
        // Hämta alla aktiva om ingen pest_type eller om "Övrigt"
        data = await CasePreparationService.getAllActivePreparations()
      }

      setAvailablePreparations(data)
    } catch (error) {
      console.error('Fel vid hämtning av preparat:', error)
    }
  }, [pestType, enabled])

  // Initial laddning
  useEffect(() => {
    setLoading(true)
    Promise.all([fetchCasePreparations(), fetchAvailablePreparations()]).finally(() =>
      setLoading(false)
    )
  }, [fetchCasePreparations, fetchAvailablePreparations])

  // Uppdatera tillgängliga preparat när pest_type ändras
  useEffect(() => {
    fetchAvailablePreparations()
  }, [pestType, fetchAvailablePreparations])

  // Lägg till preparat
  const addPreparation = useCallback(
    async (
      preparationId: string,
      quantity: number,
      unit: PreparationUnit = 'st',
      notes?: string
    ) => {
      if (!caseId) return

      setSavingPreparation(true)
      try {
        await CasePreparationService.addPreparation({
          case_id: caseId,
          case_type: caseType,
          preparation_id: preparationId,
          quantity,
          unit,
          dosage_notes: notes,
          applied_by_technician_id: technicianId || undefined,
          applied_by_technician_name: technicianName || undefined
        })

        await fetchCasePreparations()
        toast.success('Preparat tillagt')
      } catch (error) {
        console.error('Fel vid tillägg av preparat:', error)
        toast.error('Kunde inte lägga till preparat')
      } finally {
        setSavingPreparation(false)
      }
    },
    [caseId, caseType, technicianId, technicianName, fetchCasePreparations]
  )

  // Uppdatera preparat
  const updatePreparation = useCallback(
    async (id: string, quantity: number, unit?: PreparationUnit, notes?: string) => {
      setSavingPreparation(true)
      try {
        await CasePreparationService.updatePreparation(id, {
          quantity,
          unit,
          dosage_notes: notes
        })

        await fetchCasePreparations()
        toast.success('Preparat uppdaterat')
      } catch (error) {
        console.error('Fel vid uppdatering av preparat:', error)
        toast.error('Kunde inte uppdatera preparat')
      } finally {
        setSavingPreparation(false)
      }
    },
    [fetchCasePreparations]
  )

  // Ta bort preparat
  const removePreparation = useCallback(
    async (id: string) => {
      setSavingPreparation(true)
      try {
        await CasePreparationService.removePreparation(id)
        await fetchCasePreparations()
        toast.success('Preparat borttaget')
      } catch (error) {
        console.error('Fel vid borttagning av preparat:', error)
        toast.error('Kunde inte ta bort preparat')
      } finally {
        setSavingPreparation(false)
      }
    },
    [fetchCasePreparations]
  )

  return {
    casePreparations,
    availablePreparations,
    loading,
    savingPreparation,
    addPreparation,
    updatePreparation,
    removePreparation,
    refreshPreparations: fetchCasePreparations
  }
}
