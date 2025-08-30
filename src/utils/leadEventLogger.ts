// src/utils/leadEventLogger.ts - Centralized utility for logging lead events with error handling and retry logic

import { supabase } from '../lib/supabase'
import { toast } from 'react-hot-toast'
import { EventType } from '../types/database'

interface LogLeadEventOptions {
  leadId: string
  eventType: EventType
  title: string
  description: string
  data?: any
  userId: string
  retries?: number
  showErrorToUser?: boolean
}

const DEFAULT_RETRIES = 2
const RETRY_DELAY_MS = 1000

/**
 * Logs a lead event with built-in error handling and retry logic
 * This ensures consistent event logging across all lead management components
 */
export async function logLeadEvent({
  leadId,
  eventType,
  title,
  description,
  data = null,
  userId,
  retries = DEFAULT_RETRIES,
  showErrorToUser = false
}: LogLeadEventOptions): Promise<boolean> {
  let currentAttempt = 0
  
  while (currentAttempt <= retries) {
    try {
      const { error } = await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: eventType,
          title: title.trim(),
          description: description.trim(),
          data,
          created_by: userId
        })

      if (error) {
        throw error
      }

      // Success - event logged
      return true
      
    } catch (error: any) {
      currentAttempt++
      
      // Log the error for debugging
      console.warn(`Lead event logging attempt ${currentAttempt} failed:`, {
        leadId,
        eventType,
        title,
        error: error.message || error
      })

      // If this was our last attempt, handle the failure
      if (currentAttempt > retries) {
        // Show error to user only if requested (for critical events)
        if (showErrorToUser) {
          toast.error('Kunde inte spara händelselogg - huvudoperationen lyckades')
        }
        
        // Log detailed error for monitoring
        console.error('Failed to log lead event after all retries:', {
          leadId,
          eventType,
          title,
          description,
          data,
          userId,
          error: error.message || error,
          attempts: currentAttempt
        })
        
        return false
      }
      
      // Wait before retry (exponential backoff)
      const delay = RETRY_DELAY_MS * Math.pow(1.5, currentAttempt - 1)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return false
}

/**
 * Batch logs multiple lead events with error handling
 * Useful for operations that generate multiple events
 */
export async function logLeadEventsBatch(
  events: Omit<LogLeadEventOptions, 'retries' | 'showErrorToUser'>[]
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  
  // Process events in parallel for better performance
  const results = await Promise.allSettled(
    events.map(event => logLeadEvent({ ...event, showErrorToUser: false }))
  )
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value === true) {
      success++
    } else {
      failed++
      console.warn(`Batch event ${index} failed:`, events[index])
    }
  })
  
  return { success, failed }
}

/**
 * Helper function for common lead event patterns
 */
export const LeadEventHelpers = {
  /**
   * Log a status change event
   */
  logStatusChange: async (
    leadId: string,
    oldStatus: string,
    newStatus: string,
    oldStatusLabel: string,
    newStatusLabel: string,
    userId: string,
    userEmail?: string
  ) => {
    return logLeadEvent({
      leadId,
      eventType: 'status_changed',
      title: `Status ändrad till ${newStatusLabel}`,
      description: `Status ändrad från "${oldStatusLabel}" till "${newStatusLabel}"`,
      data: {
        old_status: oldStatus,
        new_status: newStatus,
        old_status_label: oldStatusLabel,
        new_status_label: newStatusLabel,
        changed_by_profile: userEmail
      },
      userId,
      showErrorToUser: false
    })
  },

  /**
   * Log a technician assignment event
   */
  logTechnicianAssignment: async (
    leadId: string,
    technicianId: string,
    technicianName: string,
    isPrimary: boolean,
    notes: string | null,
    userId: string,
    userEmail?: string
  ) => {
    return logLeadEvent({
      leadId,
      eventType: 'assigned',
      title: `Kollega tilldelad: ${technicianName}`,
      description: `Kollega ${technicianName} har tilldelats ${isPrimary ? 'som primär' : 'som sekundär'} kollega`,
      data: {
        technician_id: technicianId,
        technician_name: technicianName,
        is_primary: isPrimary,
        notes,
        assigned_by_profile: userEmail
      },
      userId
    })
  },

  /**
   * Log a comment/note addition event
   */
  logCommentAdded: async (
    leadId: string,
    commentType: string,
    commentContent: string,
    userId: string,
    userEmail?: string
  ) => {
    const truncatedContent = commentContent.length > 100 
      ? commentContent.substring(0, 100) + '...'
      : commentContent

    return logLeadEvent({
      leadId,
      eventType: 'note_added',
      title: 'Ny kommentar tillagd',
      description: `Ny kommentar (${commentType}) har lagts till`,
      data: {
        comment_type: commentType,
        comment_content: truncatedContent,
        action: 'created',
        created_by_profile: userEmail
      },
      userId
    })
  },

  /**
   * Log a general update event
   */
  logGeneralUpdate: async (
    leadId: string,
    description: string,
    updatedFields: string[],
    userId: string,
    userEmail?: string
  ) => {
    return logLeadEvent({
      leadId,
      eventType: 'updated',
      title: 'Lead information uppdaterad',
      description,
      data: {
        updated_fields: updatedFields,
        updated_by_profile: userEmail
      },
      userId
    })
  }
}