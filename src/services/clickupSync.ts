// src/services/clickupSync.ts
// ENKEL SYNC SERVICE SOM ANVÄNDER BEFINTLIGA KOMPONENTER

import { supabase } from '../lib/supabase'
import { ClickUpClient } from './clickup/client'
import { 
  convertSupabaseToClickUp,
  convertSupabaseToClickUpAsync, 
  convertClickUpToSupabase, 
  getListIdFromCaseType,
  getCaseTypeFromListId 
} from './clickupFieldMapper'

const CLICKUP_API_TOKEN = import.meta.env.VITE_CLICKUP_API_TOKEN || ''

// Kontrollera att token är satt
if (!CLICKUP_API_TOKEN) {
  console.warn('[ClickUpSync] VITE_CLICKUP_API_TOKEN is not set. ClickUp sync will be disabled.')
}

export interface SyncResult {
  success: boolean
  error?: string
  clickup_task_id?: string
  data?: any
}

class ClickUpSyncService {
  private client: ClickUpClient

  constructor() {
    this.client = new ClickUpClient(CLICKUP_API_TOKEN)
  }

  /**
   * Synkronisera efter att koordinator har skapat ett ärende
   * Anropas från CreateCaseModal efter lyckad Supabase insert
   */
  async syncCaseToClickUp(caseId: string, caseType: 'private' | 'business'): Promise<SyncResult> {
    try {
      // Kontrollera att token finns
      if (!CLICKUP_API_TOKEN) {
        return { success: false, error: 'ClickUp API token is not configured' }
      }

      console.log(`[ClickUpSync] Syncing case ${caseId} to ClickUp...`)

      // 1. Hämta case data från Supabase
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases'
      const { data: caseData, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', caseId)
        .single()

      if (fetchError || !caseData) {
        return { success: false, error: `Could not fetch case: ${fetchError?.message}` }
      }

      // 2. Konvertera till ClickUp format med geocoding
      const clickupTask = await convertSupabaseToClickUpAsync(caseData, caseType)
      const listId = getListIdFromCaseType(caseType)
      
      // DEBUG: Logga alla custom fields för att identifiera dropdown värden
      console.log(`[DEBUG] All custom fields being sent to ClickUp:`, clickupTask.custom_fields)
      
      // DEBUG: Detaljerad logging av varje field
      clickupTask.custom_fields?.forEach((field, index) => {
        console.log(`[DEBUG] Field ${index}:`, {
          id: field.id,
          value: field.value,
          valueType: typeof field.value,
          valueLength: field.value && typeof field.value === 'string' ? field.value.length : 'N/A'
        })
      })
      
      // DEBUG: Kontrollera om några fields har invalid IDs
      const invalidField = clickupTask.custom_fields?.find(f => !f.id || typeof f.id !== 'string' || f.id.length < 36)
      if (invalidField) {
        console.error(`[ERROR] Invalid custom field found:`, invalidField)
        console.error(`[ERROR] Field ID is:`, typeof invalidField.id, invalidField.id)
        throw new Error(`Invalid custom field ID: ${invalidField.id}`)
      }
      
      console.log(`[ClickUpSync] Sending task to ClickUp:`, {
        listId,
        taskName: clickupTask.name,
        customFieldsCount: clickupTask.custom_fields?.length || 0,
        addressField: clickupTask.custom_fields?.find(f => f.id === '0a889578-6c38-4fe2-bda4-6258f628bb68')
      })

      // 3. Skapa task i ClickUp
      const createdTask = await this.client.createTask(listId, clickupTask)

      // 4. Uppdatera Supabase med ClickUp task ID
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ 
          clickup_task_id: createdTask.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId)

      if (updateError) {
        console.error('[ClickUpSync] Failed to update clickup_task_id:', updateError)
        return { success: false, error: `Failed to save ClickUp ID: ${updateError.message}` }
      }

      console.log(`[ClickUpSync] Successfully synced case ${caseId} to ClickUp task ${createdTask.id}`)
      return { 
        success: true, 
        clickup_task_id: createdTask.id,
        data: createdTask
      }

    } catch (error) {
      console.error('[ClickUpSync] Error syncing to ClickUp:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Uppdatera befintlig ClickUp task
   * Anropas från EditCaseModal efter lyckad Supabase update
   */
  async updateClickUpTask(caseId: string, caseType: 'private' | 'business'): Promise<SyncResult> {
    try {
      // Kontrollera att token finns
      if (!CLICKUP_API_TOKEN) {
        return { success: false, error: 'ClickUp API token is not configured' }
      }

      console.log(`[ClickUpSync] Updating ClickUp task for case ${caseId}...`)

      // 1. Hämta case data från Supabase  
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases'
      const { data: caseData, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', caseId)
        .single()

      if (fetchError || !caseData) {
        return { success: false, error: `Could not fetch case: ${fetchError?.message}` }
      }

      if (!caseData.clickup_task_id) {
        // Om ingen ClickUp task finns, skapa en ny
        return this.syncCaseToClickUp(caseId, caseType)
      }

      // 2. Konvertera till ClickUp format med geocoding
      const clickupTask = await convertSupabaseToClickUpAsync(caseData, caseType)

      // 3. Separera custom fields från task data (enligt ClickUp API dokumentation)
      const { custom_fields, ...taskDataWithoutCustomFields } = clickupTask
      
      // 4. Uppdatera task metadata först
      const updatedTask = await this.client.updateTask(caseData.clickup_task_id, taskDataWithoutCustomFields)
      
      // 5. Uppdatera custom fields separat (enligt ClickUp API dokumentation)
      if (custom_fields && Array.isArray(custom_fields)) {
        console.log(`[ClickUpSync] Updating ${custom_fields.length} custom fields...`)
        
        for (const field of custom_fields) {
          try {
            await this.client.setCustomField(caseData.clickup_task_id, field.id, field.value)
            console.log(`[ClickUpSync] Updated custom field ${field.id} with value:`, field.value)
          } catch (fieldError) {
            console.error(`[ClickUpSync] Failed to update custom field ${field.id}:`, fieldError)
            // Fortsätt med andra fält även om ett misslyckas
          }
        }
      }

      console.log(`[ClickUpSync] Successfully updated ClickUp task ${caseData.clickup_task_id}`)
      return { 
        success: true, 
        clickup_task_id: caseData.clickup_task_id,
        data: updatedTask
      }

    } catch (error) {
      console.error('[ClickUpSync] Error updating ClickUp task:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Synkronisera från ClickUp till Supabase
   * Används av webhook för att hantera ändringar gjorda direkt i ClickUp
   */
  async syncFromClickUp(taskId: string, listId: string): Promise<SyncResult> {
    try {
      console.log(`[ClickUpSync] Syncing from ClickUp task ${taskId}...`)

      // 1. Avgör case type från list ID
      const caseType = getCaseTypeFromListId(listId)
      if (!caseType) {
        return { success: false, error: `Unknown list ID: ${listId}` }
      }

      // 2. Hämta task från ClickUp
      const clickupTask = await this.client.getTask(taskId)

      // 3. Konvertera till Supabase format
      const supabaseData = convertClickUpToSupabase(clickupTask, caseType)

      // 4. Uppdatera eller skapa i Supabase
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases'
      
      const { data: existingCase } = await supabase
        .from(tableName)
        .select('id')
        .eq('clickup_task_id', taskId)
        .single()

      if (existingCase) {
        // Uppdatera befintligt case
        const { error: updateError } = await supabase
          .from(tableName)
          .update({
            ...supabaseData,
            updated_at: new Date().toISOString()
          })
          .eq('clickup_task_id', taskId)

        if (updateError) {
          return { success: false, error: `Failed to update case: ${updateError.message}` }
        }
      } else {
        // Skapa nytt case
        const { error: insertError } = await supabase
          .from(tableName)
          .insert(supabaseData)

        if (insertError) {
          return { success: false, error: `Failed to create case: ${insertError.message}` }
        }
      }

      console.log(`[ClickUpSync] Successfully synced from ClickUp task ${taskId}`)
      return { success: true, data: supabaseData }

    } catch (error) {
      console.error('[ClickUpSync] Error syncing from ClickUp:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  /**
   * Bulk sync - synkronisera flera cases samtidigt
   */
  async bulkSyncToClickUp(caseIds: string[], caseType: 'private' | 'business'): Promise<SyncResult[]> {
    const results: SyncResult[] = []
    
    for (const caseId of caseIds) {
      const result = await this.syncCaseToClickUp(caseId, caseType)
      results.push(result)
      
      // Liten paus för att inte överbelasta API:et
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    return results
  }
}

// Singleton instance
export const clickupSync = new ClickUpSyncService()

// Convenience functions för enkel användning i komponenter
export const syncCaseToClickUp = (caseId: string, caseType: 'private' | 'business') => 
  clickupSync.syncCaseToClickUp(caseId, caseType)

export const updateClickUpTask = (caseId: string, caseType: 'private' | 'business') => 
  clickupSync.updateClickUpTask(caseId, caseType)

export const syncFromClickUp = (taskId: string, listId: string) => 
  clickupSync.syncFromClickUp(taskId, listId)