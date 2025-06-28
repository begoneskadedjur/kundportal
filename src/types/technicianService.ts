// src/services/technicianService.ts - Service för teknikerhantering
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import type { Technician, TechnicianInsert, TechnicianUpdate, TechnicianFormData } from '../types/database'

export const technicianService = {
  async getAllTechnicians(): Promise<Technician[]> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .order('name', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error('Error fetching technicians:', error)
      toast.error('Kunde inte hämta tekniker')
      throw error
    }
  },

  async getActiveTechnicians(): Promise<Technician[]> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error('Error fetching active technicians:', error)
      toast.error('Kunde inte hämta aktiva tekniker')
      throw error
    }
  },

  async getTechniciansByRole(role: string): Promise<Technician[]> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('role', role)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error(`Error fetching technicians with role ${role}:`, error)
      toast.error(`Kunde inte hämta ${role}`)
      throw error
    }
  },

  async getTechnician(id: string): Promise<Technician> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      if (!data) throw new Error('Tekniker hittades inte')
      
      return data
    } catch (error: any) {
      console.error('Error fetching technician:', error)
      toast.error('Kunde inte hämta tekniker')
      throw error
    }
  },

  async createTechnician(technicianData: TechnicianFormData): Promise<Technician> {
    try {
      // Validera e-post format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) {
        throw new Error('Ogiltig e-postadress')
      }

      // Formatera telefonnummer (ta bort mellanslag och bindestreck)
      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }

      const insertData: TechnicianInsert = {
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
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('En tekniker med denna e-postadress finns redan')
        }
        throw error
      }
      
      toast.success('Tekniker skapad!')
      return data
    } catch (error: any) {
      console.error('Error creating technician:', error)
      toast.error(error.message || 'Kunde inte skapa tekniker')
      throw error
    }
  },

  async updateTechnician(id: string, updates: Partial<TechnicianFormData>): Promise<Technician> {
    try {
      // Formatera uppdateringar
      const updateData: TechnicianUpdate = {}
      
      if (updates.name) updateData.name = updates.name.trim()
      if (updates.role) updateData.role = updates.role
      if (updates.email) updateData.email = updates.email.toLowerCase().trim()
      if (updates.address) updateData.address = updates.address.trim()
      
      // Formatera telefonnummer
      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }
      
      if (updates.direct_phone !== undefined) {
        updateData.direct_phone = formatPhone(updates.direct_phone)
      }
      if (updates.office_phone !== undefined) {
        updateData.office_phone = formatPhone(updates.office_phone)
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
      
      toast.success('Tekniker uppdaterad!')
      return data
    } catch (error: any) {
      console.error('Error updating technician:', error)
      toast.error(error.message || 'Kunde inte uppdatera tekniker')
      throw error
    }
  },

  async toggleTechnicianStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_active: isActive })
        .eq('id', id)
      
      if (error) throw error
      
      toast.success(`Tekniker ${isActive ? 'aktiverad' : 'inaktiverad'}`)
    } catch (error: any) {
      console.error('Error toggling technician status:', error)
      toast.error('Kunde inte uppdatera tekniker-status')
      throw error
    }
  },

  async deleteTechnician(id: string): Promise<void> {
    try {
      // Kontrollera om tekniker är tilldelad några aktiva ärenden
      const { data: assignedCases, error: casesError } = await supabase
        .from('cases')
        .select('id, title')
        .eq('assigned_technician_id', id)
        .in('status', ['open', 'in_progress'])
      
      if (casesError) throw casesError
      
      if (assignedCases && assignedCases.length > 0) {
        throw new Error(`Tekniker är tilldelad ${assignedCases.length} aktiva ärenden och kan inte tas bort`)
      }

      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Tekniker borttagen')
    } catch (error: any) {
      console.error('Error deleting technician:', error)
      toast.error(error.message || 'Kunde inte ta bort tekniker')
      throw error
    }
  },

  // Hjälpfunktioner
  formatPhoneForDisplay(phone: string | null): string {
    if (!phone) return '-'
    
    // Konvertera från +46 format till 0 format för visning
    if (phone.startsWith('+46')) {
      const number = phone.slice(3)
      return `0${number.slice(0, 2)}-${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7)}`
    }
    
    return phone
  },

  formatPhoneForLink(phone: string | null): string | null {
    if (!phone) return null
    return phone // Behåll +46 format för tel: länkar
  },

  getTechnicianStats(): Promise<{
    total: number
    active: number
    byRole: Record<string, number>
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        const technicians = await this.getAllTechnicians()
        
        const stats = {
          total: technicians.length,
          active: technicians.filter(t => t.is_active).length,
          byRole: technicians.reduce((acc, technician) => {
            acc[technician.role] = (acc[technician.role] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
        
        resolve(stats)
      } catch (error) {
        reject(error)
      }
    })
  }
}