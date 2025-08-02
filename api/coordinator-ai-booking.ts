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
    } else {
      // Remove all non-digit characters for validation
      const cleanPersonnummer = data.personnummer.replace(/\D/g, '')
      if (!cleanPersonnummer.match(/^\d{10,12}$/)) {
        errors.push('Personnummer måste vara 10-12 siffror (med eller utan bindestreck)')
      }
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
  
  // Validate address - require more than just city name
  if (data.adress && typeof data.adress === 'string') {
    const adress = data.adress.trim()
    if (adress.length < 5) {
      errors.push('Adress är för kort - ange fullständig adress')
    } else if (!/\d/.test(adress)) {
      errors.push('Adress måste innehålla gatnummer')
    } else if (adress.toLowerCase() === 'sollentuna' || adress.toLowerCase() === 'stockholm') {
      errors.push('Ange fullständig adress med gata och nummer, inte bara stad')
    }
  }
  
  // Validate technician ID format (UUID)
  if (data.primary_assignee_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.primary_assignee_id)) {
    errors.push('Tekniker-ID har ogiltigt format (måste vara UUID)')
  }
  
  return errors
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[AI Booking] Invalid method:', req.method)
    return res.status(405).json({ 
      success: false, 
      error: 'Endast POST-förfrågningar tillåtna' 
    })
  }

  try {
    console.log('[AI Booking] Starting booking process...')
    const bookingData: BookingRequest = req.body

    console.log('[AI Booking] Received booking request:', {
      case_type: bookingData.case_type,
      title: bookingData.title,
      kontaktperson: bookingData.kontaktperson,
      telefon_kontaktperson: bookingData.telefon_kontaktperson,
      personnummer: bookingData.personnummer ? '***-***-****' : 'SAKNAS',
      org_nr: bookingData.org_nr ? '**********' : 'SAKNAS',
      primary_assignee_id: bookingData.primary_assignee_id,
      primary_assignee_name: bookingData.primary_assignee_name,
      start_date: bookingData.start_date,
      due_date: bookingData.due_date,
      timestamp: new Date().toISOString()
    })

    // Validate environment variables
    console.log('[AI Booking] Checking environment variables...')
    if (!process.env.VITE_SUPABASE_URL) {
      throw new Error('VITE_SUPABASE_URL environment variable is missing')
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing')
    }
    console.log('[AI Booking] Environment variables OK')

    // Validate input data
    console.log('[AI Booking] Starting validation...')
    const validationErrors = validateBookingData(bookingData)
    if (validationErrors.length > 0) {
      console.log('[AI Booking] Validation failed:', validationErrors)
      return res.status(400).json({
        success: false,
        error: `Valideringsfel: ${validationErrors.join(', ')}`,
        message: 'Kunde inte skapa bokning på grund av felaktiga data',
        validationErrors: validationErrors
      })
    }
    console.log('[AI Booking] Validation passed')

    // Generate case number and prepare data
    console.log('[AI Booking] Generating case number...')
    const caseNumber = generateCaseNumber(bookingData.case_type)
    const timestamp = new Date().toISOString()
    console.log('[AI Booking] Generated case number:', caseNumber)
    
    // Prepare insert data based on case type
    console.log('[AI Booking] Preparing insert data for case type:', bookingData.case_type)
    const baseInsertData = {
      // Note: clickup_task_id will be set by frontend ClickUp sync (like CreateCaseModal)
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
      insertDataKeys: Object.keys(insertData),
      hasTitle: !!insertData.title,
      hasContactPerson: !!insertData.kontaktperson,
      hasRequiredField: bookingData.case_type === 'private' ? !!insertData.personnummer : !!insertData.org_nr
    })

    // Test Supabase connection first
    console.log('[AI Booking] Testing Supabase connection...')
    try {
      const { data: testData, error: testError } = await supabase
        .from('technicians')
        .select('id, name')
        .limit(1)
      
      if (testError) {
        console.error('[AI Booking] Supabase connection test failed:', testError)
        throw new Error(`Supabase-anslutning misslyckades: ${testError.message}`)
      }
      console.log('[AI Booking] Supabase connection OK, found technicians:', testData?.length)
    } catch (connError) {
      console.error('[AI Booking] Supabase connection error:', connError)
      throw new Error(`Databasanslutning misslyckades: ${connError}`)
    }

    // Insert the case into database
    console.log('[AI Booking] Attempting database insert...')
    const { data: createdCase, error: insertError } = await supabase
      .from(tableName)
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      console.error('[AI Booking] Database insert error:', {
        error: insertError,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      })
      throw new Error(`Databasfel: ${insertError.message} (Kod: ${insertError.code})`)
    }

    console.log('[AI Booking] Case created successfully:', {
      id: createdCase.id,
      case_number: createdCase.case_number,
      title: createdCase.title,
      case_type: bookingData.case_type,
      tableName: tableName
    })

    // Note: ClickUp sync will be handled by frontend after successful booking
    // This matches the pattern used in CreateCaseModal component
    console.log('[AI Booking] ClickUp sync will be handled by frontend (like CreateCaseModal)')

    // Prepare success response
    console.log('[AI Booking] Preparing success response...')
    const response: BookingResponse = {
      success: true,
      case_id: createdCase.id,
      case_number: createdCase.case_number,
      message: `${bookingData.case_type === 'private' ? 'Privatärende' : 'Företagsärende'} "${createdCase.title}" har skapats med ärendenummer ${createdCase.case_number}`
    }

    console.log('[AI Booking] Booking completed successfully:', {
      case_id: response.case_id,
      case_number: response.case_number,
      case_type: bookingData.case_type,
      duration: `${Date.now() - new Date(timestamp).getTime()}ms`
    })

    return res.status(200).json(response)

  } catch (error: any) {
    console.error('[AI Booking] Error creating case:', {
      error: error,
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
      timestamp: new Date().toISOString()
    })
    
    // Determine appropriate error message and status code
    let statusCode = 500
    let errorMessage = error.message || 'Okänt fel uppstod'
    let userMessage = 'Kunde inte skapa bokning. Försök igen eller kontakta administratör.'
    
    if (error.message?.includes('Validation')) {
      statusCode = 400
      userMessage = 'Felaktiga data i bokningsförfrågan'
    } else if (error.message?.includes('Supabase') || error.message?.includes('Database')) {
      statusCode = 500
      userMessage = 'Databasfel - kontakta administratör'
    } else if (error.message?.includes('environment variable')) {
      statusCode = 500
      userMessage = 'Serverkonfigurationsfel - kontakta administratör'
    }
    
    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: userMessage,
      timestamp: new Date().toISOString(),
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error.stack,
        cause: error.cause
      } : undefined
    })
  }
}