// api/coordinator-ai-booking.ts
// AI-driven booking endpoint for coordinators to create private_cases and business_cases

import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Database } from '../src/types/database'

// Use service role key for admin operations (bypasses RLS)
const supabase = createClient<Database>(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BookingRequest {
  case_type: 'private' | 'business'
  
  // Required fields
  title: string
  
  // Optional core fields
  description?: string
  status?: string
  priority?: string
  
  // Contact information
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  
  // Case-specific fields
  skadedjur?: string
  adress?: any // JSONB address object
  pris?: number
  
  // Scheduling
  start_date?: string // ISO timestamp
  due_date?: string   // ISO timestamp
  
  // Private case specific
  personnummer?: string
  r_rot_rut?: string
  r_fastighetsbeteckning?: string
  r_arbetskostnad?: number
  r_material_utrustning?: number
  r_servicebil?: number
  
  // Business case specific  
  org_nr?: string
  markning_faktura?: string
  e_post_faktura?: string
  bestallare?: string
  skicka_erbjudande?: string
  
  // Technician assignments (up to 3)
  primary_assignee_id?: string
  primary_assignee_name?: string
  primary_assignee_email?: string
  secondary_assignee_id?: string
  secondary_assignee_name?: string
  secondary_assignee_email?: string
  tertiary_assignee_id?: string
  tertiary_assignee_name?: string
  tertiary_assignee_email?: string
  
  // Additional fields
  rapport?: string
  skicka_bokningsbekraftelse?: string
  reklamation?: string
  vaggloss_angade_rum?: string
  annat_skadedjur?: string
  filer?: any // JSONB
  avvikelser_tillbud_olyckor?: string
  status_saneringsrapport?: string
}

interface BookingResponse {
  success: boolean
  case_id?: string
  case_number?: string
  message: string
  error?: string
}

// Generate unique case number
function generateCaseNumber(caseType: 'private' | 'business'): string {
  const prefix = caseType === 'private' ? 'PR' : 'BU'
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substr(2, 4).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

// Validate required fields
function validateBookingData(data: BookingRequest): string[] {
  const errors: string[] = []
  
  if (!data.title?.trim()) {
    errors.push('Titel är obligatorisk')
  }
  
  if (!['private', 'business'].includes(data.case_type)) {
    errors.push('Ärendetyp måste vara "private" eller "business"')
  }
  
  // Validate REQUIRED fields for each case type
  if (data.case_type === 'private') {
    if (!data.personnummer || !data.personnummer.trim()) {
      errors.push('Personnummer är obligatoriskt för privatpersoner')
    } else if (!data.personnummer.match(/^\d{10,12}$/)) {
      errors.push('Personnummer måste vara 10-12 siffror')
    }
  }
  
  if (data.case_type === 'business') {
    if (!data.org_nr || !data.org_nr.trim()) {
      errors.push('Organisationsnummer är obligatoriskt för företag')
    } else if (!data.org_nr.match(/^\d{10}$/)) {
      errors.push('Organisationsnummer måste vara 10 siffror')
    }
  }
  
  // Validate dates
  if (data.start_date && isNaN(new Date(data.start_date).getTime())) {
    errors.push('Starttid har ogiltigt format')
  }
  
  if (data.due_date && isNaN(new Date(data.due_date).getTime())) {
    errors.push('Sluttid har ogiltigt format')
  }
  
  // Validate price
  if (data.pris !== undefined && (isNaN(data.pris) || data.pris < 0)) {
    errors.push('Pris måste vara ett positivt nummer')
  }
  
  return errors
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Endast POST-förfrågningar tillåtna' 
    })
  }

  try {
    const bookingData: BookingRequest = req.body

    console.log('[AI Booking] Received booking request:', {
      case_type: bookingData.case_type,
      title: bookingData.title,
      kontaktperson: bookingData.kontaktperson,
      timestamp: new Date().toISOString()
    })

    // Validate input data
    const validationErrors = validateBookingData(bookingData)
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Valideringsfel: ${validationErrors.join(', ')}`,
        message: 'Kunde inte skapa bokning på grund av felaktiga data'
      })
    }

    // Generate case number and prepare data
    const caseNumber = generateCaseNumber(bookingData.case_type)
    const timestamp = new Date().toISOString()
    
    // Prepare insert data based on case type
    const baseInsertData = {
      clickup_task_id: '', // Will be set after ClickUp sync
      case_number: caseNumber,
      title: bookingData.title,
      description: bookingData.description || null,
      status: bookingData.status || 'Öppen',
      priority: bookingData.priority || 'Normal',
      
      // Assignees
      primary_assignee_id: bookingData.primary_assignee_id || null,
      primary_assignee_name: bookingData.primary_assignee_name || null,
      primary_assignee_email: bookingData.primary_assignee_email || null,
      secondary_assignee_id: bookingData.secondary_assignee_id || null,
      secondary_assignee_name: bookingData.secondary_assignee_name || null,
      secondary_assignee_email: bookingData.secondary_assignee_email || null,
      tertiary_assignee_id: bookingData.tertiary_assignee_id || null,
      tertiary_assignee_name: bookingData.tertiary_assignee_name || null,
      tertiary_assignee_email: bookingData.tertiary_assignee_email || null,
      
      // Scheduling
      start_date: bookingData.start_date || null,
      due_date: bookingData.due_date || null,
      
      // Common custom fields
      adress: bookingData.adress || null,
      kontaktperson: bookingData.kontaktperson || null,
      telefon_kontaktperson: bookingData.telefon_kontaktperson || null,
      e_post_kontaktperson: bookingData.e_post_kontaktperson || null,
      skadedjur: bookingData.skadedjur || null,
      pris: bookingData.pris || null,
      rapport: bookingData.rapport || null,
      skicka_bokningsbekraftelse: bookingData.skicka_bokningsbekraftelse || null,
      reklamation: bookingData.reklamation || null,
      vaggloss_angade_rum: bookingData.vaggloss_angade_rum || null,
      annat_skadedjur: bookingData.annat_skadedjur || null,
      filer: bookingData.filer || null,
      avvikelser_tillbud_olyckor: bookingData.avvikelser_tillbud_olyckor || null,
      status_saneringsrapport: bookingData.status_saneringsrapport || null,
      
      // Billing
      billing_status: 'pending' as const
    }

    let insertData: any
    let tableName: string

    if (bookingData.case_type === 'private') {
      tableName = 'private_cases'
      insertData = {
        ...baseInsertData,
        // Private case specific fields
        personnummer: bookingData.personnummer || null,
        r_rot_rut: bookingData.r_rot_rut || null,
        r_fastighetsbeteckning: bookingData.r_fastighetsbeteckning || null,
        r_arbetskostnad: bookingData.r_arbetskostnad || null,
        r_material_utrustning: bookingData.r_material_utrustning || null,
        r_servicebil: bookingData.r_servicebil || null
      }
    } else {
      tableName = 'business_cases'
      insertData = {
        ...baseInsertData,
        // Business case specific fields
        org_nr: bookingData.org_nr || null,
        markning_faktura: bookingData.markning_faktura || null,
        e_post_faktura: bookingData.e_post_faktura || null,
        bestallare: bookingData.bestallare || null,
        skicka_erbjudande: bookingData.skicka_erbjudande || null
      }
    }

    console.log('[AI Booking] Inserting case data:', {
      tableName,
      caseNumber,
      insertDataKeys: Object.keys(insertData)
    })

    // Insert the case into database
    const { data: createdCase, error: insertError } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[AI Booking] Database insert error:', insertError)
      throw new Error(`Databasfel: ${insertError.message}`)
    }

    console.log('[AI Booking] Case created successfully:', {
      id: createdCase.id,
      case_number: createdCase.case_number,
      title: createdCase.title
    })

    // Sync to ClickUp in background
    try {
      console.log('[AI Booking] Starting ClickUp synchronization...')
      
      // Import and use the ClickUp sync function
      const { syncCaseToClickUp } = await import('../src/services/clickupSync')
      const syncResult = await syncCaseToClickUp(createdCase.id, bookingData.case_type)
      
      if (syncResult.success) {
        console.log('[AI Booking] ClickUp sync successful:', syncResult.clickup_task_id)
        
        // Update the case with ClickUp task ID
        await supabase
          .from(tableName)
          .update({ clickup_task_id: syncResult.clickup_task_id })
          .eq('id', createdCase.id)
      } else {
        console.warn('[AI Booking] ClickUp sync failed:', syncResult.error)
      }
    } catch (syncError) {
      console.error('[AI Booking] ClickUp sync error:', syncError)
      // Don't fail the booking if ClickUp sync fails
    }

    // Prepare success response
    const response: BookingResponse = {
      success: true,
      case_id: createdCase.id,
      case_number: createdCase.case_number,
      message: `${bookingData.case_type === 'private' ? 'Privatärende' : 'Företagsärende'} "${createdCase.title}" har skapats med ärendenummer ${createdCase.case_number}`
    }

    return res.status(200).json(response)

  } catch (error: any) {
    console.error('[AI Booking] Error creating case:', error)
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Okänt fel uppstod',
      message: 'Kunde inte skapa bokning. Försök igen eller kontakta administratör.'
    })
  }
}