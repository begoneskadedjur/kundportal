// src/services/clickupUserMapping.ts
// MAPPA SUPABASE TEKNIKER TILL CLICKUP USER IDs

import { supabase } from '../lib/supabase'
import { ClickUpClient } from './clickup/client'

const CLICKUP_API_TOKEN = import.meta.env.VITE_CLICKUP_API_TOKEN || ''

export interface ClickUpUser {
  id: number
  username: string
  email: string
  color: string
  profilePicture: string
  initials: string
  role: number
  custom_role: any
  last_active: string
  delete_date: string
  teams: any[]
}

export interface TechnicianMapping {
  supabase_id: string
  clickup_user_id: number
  name: string
  email: string
}

// Cache för att undvika API-anrop
let clickUpUsersCache: ClickUpUser[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 15 * 60 * 1000 // 15 minuter

/**
 * Hämta alla ClickUp users från API
 */
export async function getClickUpUsers(): Promise<ClickUpUser[]> {
  // Kontrollera cache
  const now = Date.now()
  if (clickUpUsersCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return clickUpUsersCache
  }

  if (!CLICKUP_API_TOKEN) {
    throw new Error('ClickUp API token is not configured')
  }

  try {
    const client = new ClickUpClient(CLICKUP_API_TOKEN)
    const response = await client.getTeamMembers()
    
    // ClickUp API returnerar { teams: [{ members: [...] }] }
    const users: ClickUpUser[] = []
    if (response.teams && Array.isArray(response.teams)) {
      for (const team of response.teams) {
        if (team.members && Array.isArray(team.members)) {
          users.push(...team.members)
        }
      }
    }

    // Uppdatera cache
    clickUpUsersCache = users
    cacheTimestamp = now

    console.log(`[ClickUpUserMapping] Loaded ${users.length} ClickUp users`)
    return users

  } catch (error) {
    console.error('[ClickUpUserMapping] Failed to fetch ClickUp users:', error)
    throw error
  }
}

/**
 * Skapa mappning mellan Supabase tekniker och ClickUp users
 */
export async function createTechnicianMapping(): Promise<TechnicianMapping[]> {
  try {
    // Hämta alla tekniker från Supabase
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

    // Hämta ClickUp users
    const clickUpUsers = await getClickUpUsers()

    if (clickUpUsers.length === 0) {
      console.warn('[ClickUpUserMapping] No ClickUp users found')
      return []
    }

    // Skapa mappning baserat på email-matchning
    const mappings: TechnicianMapping[] = []
    
    for (const technician of technicians) {
      if (!technician.email) {
        console.warn(`[ClickUpUserMapping] Technician ${technician.name} has no email, skipping`)
        continue
      }

      // Hitta matchande ClickUp user baserat på email
      const clickUpUser = clickUpUsers.find(user => 
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

  } catch (error) {
    console.error('[ClickUpUserMapping] Failed to create technician mapping:', error)
    throw error
  }
}

/**
 * Hämta ClickUp user ID från Supabase tekniker ID
 */
export async function getClickUpUserIdFromTechnicianId(technicianId: string): Promise<number | null> {
  try {
    const mappings = await createTechnicianMapping()
    const mapping = mappings.find(m => m.supabase_id === technicianId)
    return mapping ? mapping.clickup_user_id : null
  } catch (error) {
    console.error('[ClickUpUserMapping] Failed to get ClickUp user ID:', error)
    return null
  }
}

/**
 * Konvertera en array av Supabase tekniker-IDs till ClickUp user-IDs
 */
export async function convertTechnicianIdsToClickUpUserIds(technicianIds: (string | null)[]): Promise<number[]> {
  const validIds = technicianIds.filter((id): id is string => Boolean(id))
  
  if (validIds.length === 0) {
    return []
  }

  try {
    const mappings = await createTechnicianMapping()
    const clickUpUserIds: number[] = []

    for (const technicianId of validIds) {
      const mapping = mappings.find(m => m.supabase_id === technicianId)
      if (mapping) {
        clickUpUserIds.push(mapping.clickup_user_id)
      } else {
        console.warn(`[ClickUpUserMapping] No ClickUp mapping found for technician ID: ${technicianId}`)
      }
    }

    return clickUpUserIds
  } catch (error) {
    console.error('[ClickUpUserMapping] Failed to convert technician IDs:', error)
    return []
  }
}

/**
 * Rensa cache (för utveckling/debugging)
 */
export function clearUserMappingCache(): void {
  clickUpUsersCache = null
  cacheTimestamp = 0
  console.log('[ClickUpUserMapping] Cache cleared')
}