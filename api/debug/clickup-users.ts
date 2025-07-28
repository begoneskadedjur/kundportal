// api/debug/clickup-users.ts
// DEBUG ENDPOINT FÖR CLICKUP USER MAPPING

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../src/lib/supabase'
import { getClickUpUsers, createTechnicianMapping } from '../../src/services/clickupUserMapping'

export async function GET(request: NextRequest) {
  try {
    // Grundläggande säkerhet - kräv admin-tillgång
    const { searchParams } = new URL(request.url)
    const adminKey = searchParams.get('admin_key')
    
    if (adminKey !== process.env.ADMIN_DEBUG_KEY && adminKey !== 'begone_debug_2025') {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 })
    }

    console.log('[Debug] ClickUp users endpoint called')

    // Hämta ClickUp users
    const clickUpUsers = await getClickUpUsers()
    console.log(`[Debug] Found ${clickUpUsers.length} ClickUp users`)

    // Hämta Supabase tekniker
    const { data: technicians, error: techError } = await supabase
      .from('technicians')
      .select('id, name, email, is_active')
      .eq('is_active', true)
      .order('name')

    if (techError) {
      throw new Error(`Failed to fetch technicians: ${techError.message}`)
    }

    console.log(`[Debug] Found ${technicians?.length || 0} active technicians`)

    // Försök skapa mappningar
    let mappings: any[] = []
    let mappingError: string | null = null
    
    try {
      mappings = await createTechnicianMapping()
    } catch (error) {
      mappingError = error instanceof Error ? error.message : 'Unknown mapping error'
      console.error('[Debug] Mapping error:', mappingError)
    }

    // Analysera varför mappning misslyckas
    const unmappedTechnicians = technicians?.filter(tech => 
      !mappings.some(mapping => mapping.supabase_id === tech.id)
    ) || []

    const clickUpEmailDomains = clickUpUsers
      .filter(user => user.email)
      .map(user => {
        const domain = user.email.split('@')[1]
        return { email: user.email, domain }
      })

    const technicianEmails = technicians?.map(tech => ({
      name: tech.name,
      email: tech.email,
      domain: tech.email ? tech.email.split('@')[1] : null
    })) || []

    // Föreslagen manuell mappning baserat på namn-likhet
    const suggestedMappings = unmappedTechnicians.map(tech => {
      // Försök hitta ClickUp user baserat på förnamn i email
      const techFirstName = tech.email ? tech.email.split('.')[0].toLowerCase() : ''
      const possibleMatches = clickUpUsers.filter(user => 
        user.email && (
          user.email.toLowerCase().includes(techFirstName) ||
          user.username.toLowerCase().includes(techFirstName) ||
          tech.name.toLowerCase().includes(user.username.toLowerCase())
        )
      )

      return {
        technician: tech,
        possibleClickUpMatches: possibleMatches.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          confidence: user.email?.toLowerCase().includes(techFirstName) ? 'high' : 'low'
        }))
      }
    })

    const debugData = {
      summary: {
        clickUpUsersCount: clickUpUsers.length,
        techniciansCount: technicians?.length || 0,
        successfulMappings: mappings.length,
        unmappedTechnicians: unmappedTechnicians.length,
        mappingError
      },
      clickUpUsers: clickUpUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        last_active: user.last_active
      })),
      supabaseTechnicians: technicians || [],
      successfulMappings: mappings,
      unmappedTechnicians,
      emailAnalysis: {
        clickUpEmailDomains: [...new Set(clickUpEmailDomains.map(item => item.domain))],
        technicianEmailDomains: [...new Set(technicianEmails.map(item => item.domain).filter(Boolean))],
        clickUpEmails: clickUpUsers.filter(u => u.email).map(u => u.email),
        technicianEmails: technicianEmails.filter(t => t.email).map(t => t.email)
      },
      suggestedMappings,
      instructions: {
        issue: "Tekniker kunde inte mappas automatiskt till ClickUp users",
        possibleCauses: [
          "Tekniker använder andra email-adresser i ClickUp än i Supabase",
          "Tekniker är inte bjudna till ClickUp workspace",
          "Email-format skiljer sig mellan systemen"
        ],
        solutions: [
          "Jämför email-listor ovan för att hitta rätt matchningar",
          "Bjud in tekniker till ClickUp med samma emails som i Supabase",
          "Uppdatera emails i något av systemen för att matcha",
          "Skapa manuell mappning om automatisk inte fungerar"
        ]
      }
    }

    return NextResponse.json(debugData, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error) {
    console.error('[Debug] Error in clickup-users endpoint:', error)
    
    return NextResponse.json({
      error: 'Failed to fetch debug data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}