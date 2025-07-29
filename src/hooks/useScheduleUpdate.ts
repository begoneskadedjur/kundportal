// src/hooks/useScheduleUpdate.ts
// Hook för att hantera schemauppdateringar vid drag & drop

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useClickUpSync } from './useClickUpSync'
import { BeGoneCaseRow } from '../types/database'
import { toSwedishISOString } from '../utils/dateHelpers'
import toast from 'react-hot-toast'

interface UpdateResult {
  success: boolean
  error?: string
  updatedCase?: BeGoneCaseRow
}

export function useScheduleUpdate() {
  const [updating, setUpdating] = useState(false)
  const { syncAfterUpdate } = useClickUpSync()

  /**
   * Uppdatera tekniker för ett ärende
   */
  const updateCaseTechnician = useCallback(async (
    caseId: string,
    caseType: 'private' | 'business',
    technicianId: string,
    technicianName: string,
    role: 'primary' | 'secondary' | 'tertiary' = 'primary'
  ): Promise<UpdateResult> => {
    setUpdating(true)
    
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases'
      
      const updateData: any = {}
      if (role === 'primary') {
        updateData.primary_assignee_id = technicianId
        updateData.primary_assignee_name = technicianName
      } else if (role === 'secondary') {
        updateData.secondary_assignee_id = technicianId
        updateData.secondary_assignee_name = technicianName
      } else {
        updateData.tertiary_assignee_id = technicianId
        updateData.tertiary_assignee_name = technicianName
      }

      const { data, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single()

      if (error) throw error

      // Synka till ClickUp i bakgrunden
      syncAfterUpdate(caseId, caseType, false) // false = ingen toast

      return {
        success: true,
        updatedCase: data as BeGoneCaseRow
      }

    } catch (error: any) {
      console.error('Fel vid uppdatering av tekniker:', error)
      return {
        success: false,
        error: error.message || 'Kunde inte uppdatera tekniker'
      }
    } finally {
      setUpdating(false)
    }
  }, [syncAfterUpdate])

  /**
   * Uppdatera tid för ett ärende
   */
  const updateCaseTime = useCallback(async (
    caseId: string,
    caseType: 'private' | 'business',
    startDate: string,
    endDate: string
  ): Promise<UpdateResult> => {
    setUpdating(true)
    
    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases'
      
      const updateData = {
        start_date: startDate,
        due_date: endDate
      }

      const { data, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single()

      if (error) throw error

      // Synka till ClickUp i bakgrunden
      syncAfterUpdate(caseId, caseType, false)

      return {
        success: true,
        updatedCase: data as BeGoneCaseRow
      }

    } catch (error: any) {
      console.error('Fel vid uppdatering av tid:', error)
      return {
        success: false,
        error: error.message || 'Kunde inte uppdatera tid'
      }
    } finally {
      setUpdating(false)
    }
  }, [syncAfterUpdate])

  /**
   * Validera om en tid är inom vanlig arbetstid (bara varning, inte blockering)
   */
  const validateWorkingHours = useCallback((startDate: Date, endDate: Date): boolean => {
    const startHour = startDate.getHours()
    const endHour = endDate.getHours()
    
    // Varna om tiden är utanför normal arbetstid (08:00-17:00)
    if (startHour < 8 || endHour > 17) {
      toast('⚠️ OBS: Detta är utanför normal arbetstid (08:00-17:00)', {
        duration: 3000,
        style: {
          background: '#f59e0b',
          color: '#fff',
        }
      })
    }
    
    // Kontrollera om det är helg
    const dayOfWeek = startDate.getDay()
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      toast('⚠️ OBS: Detta är en helgdag', {
        duration: 3000,
        style: {
          background: '#f59e0b',
          color: '#fff',
        }
      })
    }
    
    return true // Alltid tillåt, bara varna
  }, [])

  /**
   * Kontrollera överlapp med andra ärenden
   */
  const checkConflicts = useCallback(async (
    technicianId: string,
    startDate: string,
    endDate: string,
    excludeCaseId?: string
  ): Promise<boolean> => {
    try {
      // Hämta alla ärenden för tekniker på samma dag
      const startOfDay = new Date(startDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(startDate)
      endOfDay.setHours(23, 59, 59, 999)

      const promises = [
        supabase
          .from('private_cases')
          .select('id, start_date, due_date, title')
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', startOfDay.toISOString())
          .lte('start_date', endOfDay.toISOString()),
        
        supabase
          .from('business_cases')
          .select('id, start_date, due_date, title')
          .or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId},tertiary_assignee_id.eq.${technicianId}`)
          .gte('start_date', startOfDay.toISOString())
          .lte('start_date', endOfDay.toISOString())
      ]

      const [privateResult, businessResult] = await Promise.all(promises)
      
      const allCases = [
        ...(privateResult.data || []),
        ...(businessResult.data || [])
      ].filter(c => c.id !== excludeCaseId)

      // Kontrollera överlapp
      const newStart = new Date(startDate).getTime()
      const newEnd = new Date(endDate).getTime()

      for (const existingCase of allCases) {
        if (!existingCase.start_date || !existingCase.due_date) continue
        
        const existingStart = new Date(existingCase.start_date).getTime()
        const existingEnd = new Date(existingCase.due_date).getTime()

        // Kontrollera om tiderna överlappar
        if (
          (newStart >= existingStart && newStart < existingEnd) ||
          (newEnd > existingStart && newEnd <= existingEnd) ||
          (newStart <= existingStart && newEnd >= existingEnd)
        ) {
          toast.error(`⚠️ Konflikt med: ${existingCase.title}`, {
            duration: 4000
          })
          return false
        }
      }

      return true

    } catch (error) {
      console.error('Fel vid kontroll av konflikter:', error)
      return true // Tillåt om vi inte kan kontrollera
    }
  }, [])

  return {
    updating,
    updateCaseTechnician,
    updateCaseTime,
    validateWorkingHours,
    checkConflicts
  }
}