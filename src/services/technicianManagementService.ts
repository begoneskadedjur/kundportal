// src/services/technicianManagementService.ts - CRUD & AUTH HANTERING FÖR TEKNIKER
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export type Technician = {
  id: string
  name: string
  role: string
  email: string
  direct_phone: string | null
  office_phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  // Auth-relaterade fält
  has_login?: boolean
  auth_user_id?: string | null
  display_name?: string | null
}

export type TechnicianFormData = {
  name: string
  role: string
  email: string
  direct_phone: string
  office_phone: string
  address: string
}

export type TechnicianStats = {
  total: number
  active: number
  withLogin: number
  byRole: Record<string, number>
}

export const technicianManagementService = {
  /**
   * Hämta alla tekniker med auth-status
   * VIKTIGT: Behåller alla FK-kopplingar till ärenden och integerar med befintlig technicianService.ts
   */
  async getAllTechnicians(): Promise<Technician[]> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select(`
          *,
          profiles!profiles_technician_id_fkey(
            user_id,
            is_active,
            display_name
          )
        `)
        .order('name', { ascending: true })
      
      if (error) throw error
      
      // Enricha med login-status utan att påverka befintliga relationer
      const enrichedData = (data || []).map(tech => ({
        ...tech,
        has_login: !!tech.profiles?.user_id,
        auth_user_id: tech.profiles?.user_id || null,
        display_name: tech.profiles?.display_name || null
      }))
      
      console.log(`✅ TechnicianManagement: Loaded ${enrichedData.length} technicians with auth status`)
      return enrichedData
    } catch (error: any) {
      console.error('Error fetching technicians:', error)
      toast.error('Kunde inte hämta tekniker')
      throw error
    }
  },

  /**
   * Skapa ny tekniker (utan auth initialt)
   * VIKTIGT: Behåller kompatibilitet med befintlig technicianService.ts som använder namn-matchning
   */
  async createTechnician(technicianData: TechnicianFormData): Promise<Technician> {
    try {
      // Validera e-post format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) {
        throw new Error('Ogiltig e-postadress')
      }

      // Formatera telefonnummer
      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }

      const insertData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        is_active: true
      }

      const { data, error } = await supabase
        .from('technicians')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('En tekniker med denna e-postadress finns redan')
        }
        throw error
      }
      
      console.log(`✅ TechnicianManagement: Created technician: ${data.name} (${data.id})`)
      console.log(`🔍 Name format preserved for analytics compatibility: "${data.name}"`)
      toast.success('Tekniker skapad!')
      return { ...data, has_login: false, auth_user_id: null }
    } catch (error: any) {
      console.error('Error creating technician:', error)
      toast.error(error.message || 'Kunde inte skapa tekniker')
      throw error
    }
  },

  /**
   * Uppdatera tekniker
   * VIKTIGT: Uppdaterar även namn i ärenden via trigger om namn ändras
   */
  async updateTechnician(id: string, technicianData: TechnicianFormData): Promise<Technician> {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) {
        throw new Error('Ogiltig e-postadress')
      }

      // Hämta gamla namnet för att kontrollera om det ändras
      const { data: oldTechnician } = await supabase
        .from('technicians')
        .select('name')
        .eq('id', id)
        .single()

      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }

      const updateData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('technicians')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('En tekniker med denna e-postadress finns redan')
        }
        throw error
      }

      // Om namnet ändrats, uppdatera även ärenden (för analytics-kompatibilitet)
      if (oldTechnician && oldTechnician.name !== data.name) {
        console.log(`🔄 TechnicianManagement: Name changed from "${oldTechnician.name}" to "${data.name}"`)
        await this.updateTechnicianNameInCases(oldTechnician.name, data.name)
      }
      
      console.log(`✅ TechnicianManagement: Updated technician: ${data.name} (${data.id})`)
      toast.success('Tekniker uppdaterad!')
      return data
    } catch (error: any) {
      console.error('Error updating technician:', error)
      toast.error(error.message || 'Kunde inte uppdatera tekniker')
      throw error
    }
  },

  /**
   * Uppdatera teknikernamn i alla ärenden (för att bevara analytics-kopplingar)
   * KRITISKT: Säkerställer att befintlig technicianService.ts fortfarande hittar ärenden
   */
  async updateTechnicianNameInCases(oldName: string, newName: string): Promise<void> {
    try {
      console.log(`🔄 Updating technician name in cases: "${oldName}" → "${newName}"`)
      
      // Uppdatera alla assignee-fält i private_cases
      await Promise.all([
        supabase
          .from('private_cases')
          .update({ primary_assignee_name: newName })
          .eq('primary_assignee_name', oldName),
        supabase
          .from('private_cases')
          .update({ secondary_assignee_name: newName })
          .eq('secondary_assignee_name', oldName),
        supabase
          .from('private_cases')
          .update({ tertiary_assignee_name: newName })
          .eq('tertiary_assignee_name', oldName)
      ])

      // Uppdatera alla assignee-fält i business_cases
      await Promise.all([
        supabase
          .from('business_cases')
          .update({ primary_assignee_name: newName })
          .eq('primary_assignee_name', oldName),
        supabase
          .from('business_cases')
          .update({ secondary_assignee_name: newName })
          .eq('secondary_assignee_name', oldName),
        supabase
          .from('business_cases')
          .update({ tertiary_assignee_name: newName })
          .eq('tertiary_assignee_name', oldName)
      ])

      // Uppdatera avtalskunder
      await supabase
        .from('cases')
        .update({ assigned_technician_name: newName })
        .eq('assigned_technician_name', oldName)

      // Uppdatera besök
      await supabase
        .from('visits')
        .update({ technician_name: newName })
        .eq('technician_name', oldName)

      console.log(`✅ Updated technician name in all case tables`)
    } catch (error) {
      console.error('Error updating technician name in cases:', error)
      // Inte kritiskt - logga bara felet
    }
  },

  /**
   * Aktivera/inaktivera tekniker
   * VIKTIGT: Påverkar INTE befintliga ärendekopplingar (assignee data bevaras för analytics)
   */
  async toggleTechnicianStatus(id: string, isActive: boolean): Promise<void> {
    try {
      // Uppdatera tekniker
      const { error: techError } = await supabase
        .from('technicians')
        .update({ is_active: isActive })
        .eq('id', id)
      
      if (techError) throw techError

      // Uppdatera även profil-status om den finns
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: isActive })
        .eq('technician_id', id)

      if (profileError) {
        console.warn('Could not update profile status:', profileError)
        // Fortsätt ändå - profil kanske inte finns
      }
      
      console.log(`✅ TechnicianManagement: Technician ${isActive ? 'activated' : 'deactivated'}: ${id}`)
      toast.success(`Tekniker ${isActive ? 'aktiverad' : 'inaktiverad'}`)
    } catch (error: any) {
      console.error('Error toggling technician status:', error)
      toast.error('Kunde inte uppdatera tekniker-status')
      throw error
    }
  },

  /**
   * Ta bort tekniker med säkerhetskontroll
   * VARNING: Kontrollerar först om tekniker har ärenden
   */
  async deleteTechnician(id: string): Promise<void> {
    try {
      // Hämta teknikernamn först
      const { data: technician } = await supabase
        .from('technicians')
        .select('name, email')
        .eq('id', id)
        .single()

      if (!technician) {
        throw new Error('Tekniker hittades inte')
      }

      // Kontrollera om tekniker har ärenden (både via UUID och namn)
      const [privateCheck, businessCheck, contractCheck, visitsCheck] = await Promise.all([
        // Kontrollera både UUID och namn-kopplingar för BeGone ärenden
        supabase.from('private_cases').select('id').or(`primary_assignee_id.eq.${id},primary_assignee_name.eq.${technician.name}`).limit(1),
        supabase.from('business_cases').select('id').or(`primary_assignee_id.eq.${id},primary_assignee_name.eq.${technician.name}`).limit(1),
        supabase.from('cases').select('id').or(`assigned_technician_id.eq.${id},assigned_technician_name.eq.${technician.name}`).limit(1),
        supabase.from('visits').select('id').or(`technician_id.eq.${id},technician_name.eq.${technician.name}`).limit(1)
      ])

      const hasPrivateCases = privateCheck.data && privateCheck.data.length > 0
      const hasBusinessCases = businessCheck.data && businessCheck.data.length > 0
      const hasContractCases = contractCheck.data && contractCheck.data.length > 0
      const hasVisits = visitsCheck.data && visitsCheck.data.length > 0

      if (hasPrivateCases || hasBusinessCases || hasContractCases || hasVisits) {
        const caseTypes = []
        if (hasPrivateCases) caseTypes.push('privatpersonsärenden')
        if (hasBusinessCases) caseTypes.push('företagsärenden')
        if (hasContractCases) caseTypes.push('avtalsärenden')
        if (hasVisits) caseTypes.push('besöksrapporter')
        
        throw new Error(
          `Kan inte ta bort ${technician.name} som har ${caseTypes.join(', ')}. ` +
          'Inaktivera istället för att bevara ärendehistorik och analytics-data.'
        )
      }

      // Ta bort auth först om det finns
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('technician_id', id)
        .single()

      if (profile) {
        await supabase.from('profiles').delete().eq('technician_id', id)
        await supabase.auth.admin.deleteUser(profile.user_id)
        console.log(`🗑️ Removed auth for technician: ${technician.name}`)
      }

      // Ta bort tekniker
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      console.log(`✅ TechnicianManagement: Deleted technician: ${technician.name} (${id})`)
      toast.success('Tekniker borttagen')
    } catch (error: any) {
      console.error('Error deleting technician:', error)
      toast.error(error.message || 'Kunde inte ta bort tekniker')
      throw error
    }
  },

  /**
   * Aktivera inloggning för befintlig tekniker
   */
  async enableTechnicianAuth(
    technicianId: string, 
    email: string, 
    password: string, 
    displayName: string
  ): Promise<void> {
    try {
      // Kontrollera om tekniker redan har auth
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('technician_id', technicianId)
        .single()

      if (existingProfile) {
        throw new Error('Tekniker har redan inloggning aktiverat')
      }

      // Skapa auth user
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          role: 'technician',
          technician_id: technicianId
        }
      })

      if (authError) {
        throw new Error(`Kunde inte skapa användarkonto: ${authError.message}`)
      }

      // Skapa profil
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newAuthUser.user.id,
          user_id: newAuthUser.user.id,
          email: email,
          customer_id: null,
          is_admin: false,
          is_active: true,
          technician_id: technicianId,
          role: 'technician',
          display_name: displayName
        })

      if (profileError) {
        // Rensa upp auth user vid fel
        await supabase.auth.admin.deleteUser(newAuthUser.user.id)
        throw new Error(`Kunde inte skapa profil: ${profileError.message}`)
      }

      console.log(`✅ TechnicianManagement: Enabled auth for technician: ${technicianId}`)
      toast.success('Inloggning aktiverat för tekniker!')

    } catch (error: any) {
      console.error('Error enabling technician auth:', error)
      toast.error(error.message || 'Kunde inte aktivera inloggning')
      throw error
    }
  },

  /**
   * Inaktivera inloggning för tekniker
   */
  async disableTechnicianAuth(technicianId: string): Promise<void> {
    try {
      // Hitta profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('technician_id', technicianId)
        .single()

      if (profile) {
        // Ta bort profil
        await supabase
          .from('profiles')
          .delete()
          .eq('technician_id', technicianId)

        // Ta bort auth user
        await supabase.auth.admin.deleteUser(profile.user_id)
      }

      console.log(`✅ TechnicianManagement: Disabled auth for technician: ${technicianId}`)
      toast.success('Inloggning inaktiverat!')

    } catch (error: any) {
      console.error('Error disabling technician auth:', error)
      toast.error('Kunde inte inaktivera inloggning')
      throw error
    }
  },

  /**
   * Hämta statistik för management dashboard
   */
  async getTechnicianStats(): Promise<TechnicianStats> {
    try {
      const technicians = await this.getAllTechnicians()
      
      const stats = {
        total: technicians.length,
        active: technicians.filter(t => t.is_active).length,
        withLogin: technicians.filter(t => t.has_login).length,
        byRole: technicians.reduce((acc, technician) => {
          acc[technician.role] = (acc[technician.role] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
      
      return stats
    } catch (error) {
      return { total: 0, active: 0, withLogin: 0, byRole: {} }
    }
  },

  /**
   * Hämta enskild tekniker med auth-info
   */
  async getTechnicianById(id: string): Promise<Technician> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select(`
          *,
          profiles!profiles_technician_id_fkey(
            user_id,
            is_active,
            display_name
          )
        `)
        .eq('id', id)
        .single()
      
      if (error) throw error
      
      return {
        ...data,
        has_login: !!data.profiles?.user_id,
        auth_user_id: data.profiles?.user_id || null,
        display_name: data.profiles?.display_name || null
      }
    } catch (error: any) {
      console.error('Error fetching technician:', error)
      throw error
    }
  },

  /**
   * Kontrollera namkonsistens mellan technicians och cases
   * Hjälpfunktion för att säkerställa att analytics-data är korrekt
   */
  async validateTechnicianNameConsistency(): Promise<{
    inconsistencies: Array<{
      technician_name: string
      table: string
      count: number
    }>
    suggestions: string[]
  }> {
    try {
      console.log('🔍 Validating technician name consistency...')
      
      // Hämta alla tekniker
      const { data: technicians } = await supabase
        .from('technicians')
        .select('name')
      
      const technicianNames = new Set(technicians?.map(t => t.name) || [])
      
      // Hämta alla unika tekniker-namn från cases
      const [privateNames, businessNames, contractNames] = await Promise.all([
        supabase.from('private_cases').select('primary_assignee_name').not('primary_assignee_name', 'is', null),
        supabase.from('business_cases').select('primary_assignee_name').not('primary_assignee_name', 'is', null),
        supabase.from('cases').select('assigned_technician_name').not('assigned_technician_name', 'is', null)
      ])

      const inconsistencies: Array<{ technician_name: string, table: string, count: number }> = []
      const suggestions: string[] = []

      // Kontrollera private cases
      const privateMap = new Map<string, number>()
      privateNames.data?.forEach(row => {
        const name = row.primary_assignee_name
        if (!technicianNames.has(name)) {
          privateMap.set(name, (privateMap.get(name) || 0) + 1)
        }
      })
      privateMap.forEach((count, name) => {
        inconsistencies.push({ technician_name: name, table: 'private_cases', count })
      })

      // Liknande för andra tabeller...
      
      if (inconsistencies.length > 0) {
        suggestions.push('Några tekniker-namn i ärenden matchar inte technicians-tabellen.')
        suggestions.push('Detta kan påverka analytics-data från technicianService.ts')
        suggestions.push('Överväg att köra namn-synkronisering eller kontrollera stavning.')
      }

      return { inconsistencies, suggestions }
    } catch (error) {
      console.error('Error validating name consistency:', error)
      return { inconsistencies: [], suggestions: ['Kunde inte validera namn-konsistens'] }
    }
  },

  /**
   * Hjälpfunktioner för visning (kompatibla med befintlig kod)
   */
  formatPhoneForDisplay(phone: string | null): string {
    if (!phone) return '-'
    
    if (phone.startsWith('+46')) {
      const number = phone.slice(3)
      return `0${number.slice(0, 2)}-${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7)}`
    }
    
    return phone
  },

  formatPhoneForLink(phone: string | null): string | null {
    if (!phone) return null
    return phone
  }
}