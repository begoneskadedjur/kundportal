// src/services/technicianManagementService.ts - FULLSTÄNDIG OCH KORREKT VERSION

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
  abax_vehicle_id: string | null // Inkluderar det nya fältet
  is_active: boolean
  created_at: string
  updated_at: string
  // Auth-relaterade fält
  has_login?: boolean
  user_id?: string | null // Namnbyte för tydlighet
  display_name?: string | null
}

export type TechnicianFormData = {
  name: string
  role: string
  email: string
  direct_phone: string
  office_phone: string
  address: string
  abax_vehicle_id: string // Inkluderar det nya fältet
}

export type TechnicianStats = {
  total: number
  active: number
  withLogin: number
  byRole: Record<string, number>
}

export const technicianManagementService = {
  /**
   * ✅ FIX: HÄMTAR PERSONAL MER ROBUST
   * Matchar nu på e-post istället för bara foreign key för att fånga upp alla med inloggning.
   * Detta är den enda funktionen som har ändrats i grunden.
   */
  async getAllTechnicians(): Promise<Technician[]> {
    try {
      // Hämta all personal och alla profiler separat
      const [techniciansRes, profilesRes] = await Promise.all([
        supabase.from('technicians').select('*').order('name', { ascending: true }),
        supabase.from('profiles').select('user_id, email, display_name, technician_id')
      ]);

      if (techniciansRes.error) throw techniciansRes.error;
      if (profilesRes.error) throw profilesRes.error;

      // Skapa en Map för snabb uppslagning av profiler via e-post
      const profilesByEmail = new Map(profilesRes.data.map(p => [p.email.toLowerCase(), p]));

      // Berika personaldata med inloggningsinformation
      const enrichedData = (techniciansRes.data || []).map(tech => {
        const profile = profilesByEmail.get(tech.email.toLowerCase());
        return {
          ...tech,
          has_login: !!profile,
          user_id: profile?.user_id || null,
          display_name: profile?.display_name || tech.name
        };
      });
      
      console.log(`✅ StaffManagement: Loaded ${enrichedData.length} staff members with robust auth status.`);
      return enrichedData;

    } catch (error: any) {
      console.error('Error fetching staff:', error);
      toast.error('Kunde inte hämta personal');
      throw error;
    }
  },

  /**
   * Skapa ny personal (uppdaterad för Abax ID)
   */
  async createTechnician(technicianData: TechnicianFormData): Promise<Technician> {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) {
        throw new Error('Ogiltig e-postadress')
      }

      const formatPhone = (phone: string) => phone ? phone.replace(/[\s-]/g, '').replace(/^0/, '+46') : null

      const insertData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        abax_vehicle_id: technicianData.abax_vehicle_id.trim() || null,
        is_active: true
      }

      const { data, error } = await supabase.from('technicians').insert(insertData).select().single()
      
      if (error) {
        if (error.code === '23505') throw new Error('En person med denna e-postadress finns redan')
        throw error
      }
      
      toast.success('Personal skapad!')
      return { ...data, has_login: false, user_id: null }
    } catch (error: any) {
      console.error('Error creating staff member:', error)
      toast.error(error.message || 'Kunde inte skapa person')
      throw error
    }
  },

  /**
   * Uppdatera personal (uppdaterad för Abax ID)
   */
  async updateTechnician(id: string, technicianData: TechnicianFormData): Promise<Technician> {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) throw new Error('Ogiltig e-postadress')

      const { data: oldTechnician } = await supabase.from('technicians').select('name').eq('id', id).single()

      const formatPhone = (phone: string) => phone ? phone.replace(/[\s-]/g, '').replace(/^0/, '+46') : null

      const updateData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        abax_vehicle_id: technicianData.abax_vehicle_id.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await supabase.from('technicians').update(updateData).eq('id', id).select().single()
      
      if (error) {
        if (error.code === '23505') throw new Error('En person med denna e-postadress finns redan')
        throw error
      }

      if (oldTechnician && oldTechnician.name !== data.name) {
        await this.updateTechnicianNameInCases(oldTechnician.name, data.name)
      }
      
      toast.success('Personal uppdaterad!')
      return data
    } catch (error: any) {
      console.error('Error updating staff member:', error)
      toast.error(error.message || 'Kunde inte uppdatera person')
      throw error
    }
  },

  /**
    * ✅ NY FUNKTION: Uppdatera en användares lösenord (endast admin)
    */
  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    if (!userId) {
        toast.error("Användar-ID saknas, kan inte byta lösenord.");
        throw new Error("User ID is missing.");
    }
    if (newPassword.length < 6) {
        toast.error("Lösenordet måste vara minst 6 tecken långt.");
        throw new Error("Password too short.");
    }
    try {
        const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
        if (error) throw error;
        toast.success("Lösenordet har uppdaterats!");
    } catch (error: any) {
        console.error('Error updating user password:', error);
        toast.error(`Kunde inte uppdatera lösenordet: ${error.message}`);
        throw error;
    }
  },

  // ALLA NEDANSTÅENDE FUNKTIONER ÄR BEVARADE FRÅN DIN ORIGINALFIL
  
  async updateTechnicianNameInCases(oldName: string, newName: string): Promise<void> {
    try {
      console.log(`🔄 Updating staff name in cases: "${oldName}" → "${newName}"`)
      await Promise.all([
        supabase.from('private_cases').update({ primary_assignee_name: newName }).eq('primary_assignee_name', oldName),
        supabase.from('private_cases').update({ secondary_assignee_name: newName }).eq('secondary_assignee_name', oldName),
        supabase.from('private_cases').update({ tertiary_assignee_name: newName }).eq('tertiary_assignee_name', oldName),
        supabase.from('business_cases').update({ primary_assignee_name: newName }).eq('primary_assignee_name', oldName),
        supabase.from('business_cases').update({ secondary_assignee_name: newName }).eq('secondary_assignee_name', oldName),
        supabase.from('business_cases').update({ tertiary_assignee_name: newName }).eq('tertiary_assignee_name', oldName),
        supabase.from('cases').update({ assigned_technician_name: newName }).eq('assigned_technician_name', oldName),
        supabase.from('visits').update({ technician_name: newName }).eq('technician_name', oldName)
      ])
      console.log(`✅ Updated staff name in all case tables`)
    } catch (error) {
      console.error('Error updating staff name in cases:', error)
    }
  },

  async toggleTechnicianStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await supabase.from('technicians').update({ is_active: isActive }).eq('id', id)
      await supabase.from('profiles').update({ is_active: isActive }).eq('technician_id', id)
      toast.success(`Personal ${isActive ? 'aktiverad' : 'inaktiverad'}`)
    } catch (error: any) {
      console.error('Error toggling staff status:', error)
      toast.error('Kunde inte uppdatera status')
      throw error
    }
  },

  async deleteTechnician(id: string): Promise<void> {
    try {
      const { data: technician } = await supabase.from('technicians').select('name, email').eq('id', id).single()
      if (!technician) throw new Error('Personal hittades inte')
      
      const [pCheck, bCheck, cCheck, vCheck] = await Promise.all([
        supabase.from('private_cases').select('id').or(`primary_assignee_id.eq.${id},primary_assignee_name.eq.${technician.name}`).limit(1),
        supabase.from('business_cases').select('id').or(`primary_assignee_id.eq.${id},primary_assignee_name.eq.${technician.name}`).limit(1),
        supabase.from('cases').select('id').or(`assigned_technician_id.eq.${id},assigned_technician_name.eq.${technician.name}`).limit(1),
        supabase.from('visits').select('id').or(`technician_id.eq.${id},technician_name.eq.${technician.name}`).limit(1)
      ])
      
      if ((pCheck.data?.length || 0) > 0 || (bCheck.data?.length || 0) > 0 || (cCheck.data?.length || 0) > 0 || (vCheck.data?.length || 0) > 0) {
        throw new Error(`Kan inte ta bort ${technician.name} som har kopplade ärenden. Inaktivera istället.`)
      }

      const { data: profile } = await supabase.from('profiles').select('user_id').eq('technician_id', id).single()
      if (profile) {
        await supabase.from('profiles').delete().eq('technician_id', id)
        await supabase.auth.admin.deleteUser(profile.user_id)
      }
      
      await supabase.from('technicians').delete().eq('id', id)
      toast.success('Personal borttagen')
    } catch (error: any) {
      console.error('Error deleting staff member:', error)
      toast.error(error.message || 'Kunde inte ta bort person')
      throw error
    }
  },

  async enableTechnicianAuth(technicianId: string, email: string, password: string, displayName: string, role: string): Promise<void> {
    try {
      const { data: existingProfile } = await supabase.from('profiles').select('user_id').or(`technician_id.eq.${technicianId},email.eq.${email}`).single()
      if (existingProfile) throw new Error('Personen har redan inloggning aktiverat')

      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: email, password: password, email_confirm: true,
        user_metadata: { display_name: displayName, role: role, technician_id: technicianId }
      })
      if (authError) throw new Error(`Kunde inte skapa konto: ${authError.message}`)

      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: newAuthUser.user.id, email: email, is_active: true,
        technician_id: technicianId, role: role, display_name: displayName
      })
      if (profileError) {
        await supabase.auth.admin.deleteUser(newAuthUser.user.id)
        throw new Error(`Kunde inte skapa profil: ${profileError.message}`)
      }
      toast.success('Inloggning aktiverat!')
    } catch (error: any) {
      console.error('Error enabling auth:', error)
      toast.error(error.message || 'Kunde inte aktivera inloggning')
      throw error
    }
  },

  async disableTechnicianAuth(technicianId: string): Promise<void> {
    try {
      const { data: profile } = await supabase.from('profiles').select('user_id').eq('technician_id', technicianId).single()
      if (profile) {
        await supabase.from('profiles').delete().eq('technician_id', technicianId)
        await supabase.auth.admin.deleteUser(profile.user_id)
      }
      toast.success('Inloggning inaktiverat!')
    } catch (error: any) {
      console.error('Error disabling auth:', error)
      toast.error('Kunde inte inaktivera inloggning')
      throw error
    }
  },

  async getTechnicianStats(): Promise<TechnicianStats> {
    try {
      const technicians = await this.getAllTechnicians()
      return {
        total: technicians.length,
        active: technicians.filter(t => t.is_active).length,
        withLogin: technicians.filter(t => t.has_login).length,
        byRole: technicians.reduce((acc, tech) => {
          acc[tech.role] = (acc[tech.role] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
    } catch (error) {
      return { total: 0, active: 0, withLogin: 0, byRole: {} }
    }
  },

  async getTechnicianById(id: string): Promise<Technician> {
    try {
      const { data, error } = await supabase.from('technicians').select(`*, profiles!profiles_technician_id_fkey(user_id, is_active, display_name)`).eq('id', id).single()
      if (error) throw error
      return {
        ...data,
        has_login: !!data.profiles?.user_id,
        user_id: data.profiles?.user_id || null,
        display_name: data.profiles?.display_name || null
      }
    } catch (error: any) {
      console.error('Error fetching staff member:', error)
      throw error
    }
  },

  async validateTechnicianNameConsistency(): Promise<{inconsistencies: Array<{technician_name: string, table: string, count: number}>, suggestions: string[]}> {
    try {
      const { data: technicians } = await supabase.from('technicians').select('name')
      const technicianNames = new Set(technicians?.map(t => t.name) || [])
      const [privateNames, businessNames, contractNames] = await Promise.all([
        supabase.from('private_cases').select('primary_assignee_name').not('primary_assignee_name', 'is', null),
        supabase.from('business_cases').select('primary_assignee_name').not('primary_assignee_name', 'is', null),
        supabase.from('cases').select('assigned_technician_name').not('assigned_technician_name', 'is', null)
      ])
      const inconsistencies: Array<{ technician_name: string, table: string, count: number }> = []
      const privateMap = new Map<string, number>()
      privateNames.data?.forEach(row => {
        const name = row.primary_assignee_name
        if (name && !technicianNames.has(name)) {
          privateMap.set(name, (privateMap.get(name) || 0) + 1)
        }
      })
      privateMap.forEach((count, name) => {
        inconsistencies.push({ technician_name: name, table: 'private_cases', count })
      })
      // Samma logik kan läggas till för business/contract...
      return { inconsistencies, suggestions: [] }
    } catch (error) {
      return { inconsistencies: [], suggestions: ['Kunde inte validera namn-konsistens'] }
    }
  },

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