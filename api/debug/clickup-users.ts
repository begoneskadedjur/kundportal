// api/debug/clickup-users.ts
// DEBUG ENDPOINT FÖR CLICKUP USER MAPPING

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Lokal Supabase-klient för serverless (ersätter frontend-importen av src/lib/supabase
// som använder import.meta.env och kraschar vid modul-load i Vercel Node)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || process.env.VITE_CLICKUP_API_TOKEN || ''
const CLICKUP_API_URL = 'https://api.clickup.com/api/v2'

// === Inlinad logik från src/services/clickupUserMapping (frontend-modul, ej importerbar i Vercel Node) ===

// Cache för att undvika dubbla API-anrop (samma beteende som originalet)
let clickUpUsersCache: any[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 15 * 60 * 1000 // 15 minuter

async function getClickUpUsers(): Promise<any[]> {
  const now = Date.now()
  if (clickUpUsersCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return clickUpUsersCache
  }

  if (!CLICKUP_API_TOKEN) {
    throw new Error('ClickUp API token is not configured')
  }

  const response = await fetch(`${CLICKUP_API_URL}/team`, {
    headers: {
      'Authorization': CLICKUP_API_TOKEN,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`ClickUp API error (${response.status}):`, errorText)
    throw new Error(`ClickUp API error: ${response.status} ${response.statusText}`)
  }

  // Säker JSON parsing (samma som ClickUpClient.request)
  const responseText = await response.text()
  let data: any
  try {
    data = JSON.parse(responseText)
  } catch (error) {
    console.error('ClickUp response was not valid JSON:', responseText.substring(0, 200))
    throw new Error('ClickUp returned invalid response format')
  }

  // ClickUp API returnerar { teams: [{ members: [{ user: {...} }] }] }
  const users: any[] = []
  if (data.teams && Array.isArray(data.teams)) {
    for (const team of data.teams) {
      if (team.members && Array.isArray(team.members)) {
        const teamUsers = team.members.map((member: any) => ({
          id: member.user.id,
          username: member.user.username,
          email: member.user.email,
          color: member.user.color,
          profilePicture: member.user.profilePicture,
          initials: member.user.initials,
          role: member.user.role,
          custom_role: member.user.custom_role,
          last_active: member.user.last_active,
          delete_date: member.user.delete_date || null,
          teams: [team.id]
        }))
        users.push(...teamUsers)
      }
    }
  }

  clickUpUsersCache = users
  cacheTimestamp = now

  console.log(`[ClickUpUserMapping] Loaded ${users.length} ClickUp users`)
  return users
}

async function createTechnicianMapping(): Promise<any[]> {
  const { data: technicians, error: techError } = await supabase
    .from('technicians')
    .select('id, name, email, is_active')
    .eq('is_active', true)

  if (techError) {
    throw new Error(`Failed to fetch technicians: ${techError.message}`)
  }

  if (!technicians || technicians.length === 0) {
    console.warn('[ClickUpUserMapping] No active technicians found')
    return []
  }

  const clickUpUsers = await getClickUpUsers()

  if (clickUpUsers.length === 0) {
    console.warn('[ClickUpUserMapping] No ClickUp users found')
    return []
  }

  // Skapa mappning baserat på email-matchning
  const mappings: any[] = []

  for (const technician of technicians) {
    if (!technician.email) {
      console.warn(`[ClickUpUserMapping] Technician ${technician.name} has no email, skipping`)
      continue
    }

    const clickUpUser = clickUpUsers.find((user: any) =>
      user.email && user.email.toLowerCase() === technician.email.toLowerCase()
    )

    if (clickUpUser) {
      mappings.push({
        supabase_id: technician.id,
        clickup_user_id: clickUpUser.id,
        name: technician.name,
        email: technician.email
      })
      console.log(`[ClickUpUserMapping] Mapped ${technician.name} (${technician.email}) -> ClickUp ID ${clickUpUser.id}`)
    } else {
      console.warn(`[ClickUpUserMapping] No ClickUp user found for technician ${technician.name} (${technician.email})`)
    }
  }

  console.log(`[ClickUpUserMapping] Created ${mappings.length} technician mappings`)
  return mappings
}

// Vercel serverless function format
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Kontrollera HTTP-metod
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Grundläggande säkerhet
    const adminKey = req.query.admin_key as string
    if (adminKey !== process.env.ADMIN_DEBUG_KEY && adminKey !== 'begone_debug_2025') {
      return res.status(401).json({ error: 'Unauthorized access' })
    }

    console.log('[Debug] ClickUp users endpoint called')

    // Hämta ClickUp users (lokal implementation ovan — ersätter tidigare frontend-imports)
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

    // Sätt headers för JSON response
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    
    return res.status(200).json(debugData)

  } catch (error) {
    console.error('[Debug] Error in clickup-users endpoint:', error)
    
    return res.status(500).json({
      error: 'Failed to fetch debug data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    })
  }
}