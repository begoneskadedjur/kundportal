// src/services/equipmentService.ts - Service för utrustningsplacering
import { supabase } from '../lib/supabase'
import {
  EquipmentPlacement,
  EquipmentPlacementInsert,
  EquipmentPlacementUpdate,
  EquipmentPlacementWithRelations,
  EquipmentStatus,
  EquipmentStats,
  EquipmentType
} from '../types/database'

export const EQUIPMENT_IMAGES_BUCKET = 'equipment-images'
export const MAX_EQUIPMENT_IMAGE_SIZE = 5 * 1024 * 1024 // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

/**
 * Service för hantering av utrustningsplaceringar
 * Hanterar CRUD-operationer, bilduppladdning och statistik
 */
export class EquipmentService {
  /**
   * Hämta all utrustning för en kund
   */
  static async getEquipmentByCustomer(customerId: string): Promise<EquipmentPlacementWithRelations[]> {
    try {
      console.log('Hämtar utrustning för kund:', customerId)

      const { data, error } = await supabase
        .from('equipment_placements')
        .select(`
          *,
          technician:technicians!placed_by_technician_id(id, name)
        `)
        .eq('customer_id', customerId)
        .order('placed_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av utrustning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Lägg till signerade URLs för foton
      const equipmentWithUrls = await Promise.all(
        (data || []).map(async (equipment) => ({
          ...equipment,
          photo_url: equipment.photo_path
            ? await this.getEquipmentPhotoUrl(equipment.photo_path)
            : undefined
        }))
      )

      console.log('Utrustning hämtad:', equipmentWithUrls.length)
      return equipmentWithUrls

    } catch (error) {
      console.error('EquipmentService.getEquipmentByCustomer fel:', error)
      throw error
    }
  }

  /**
   * Hämta utrustning placerad av en specifik tekniker
   */
  static async getEquipmentByTechnician(technicianId: string): Promise<EquipmentPlacementWithRelations[]> {
    try {
      console.log('Hämtar utrustning för tekniker:', technicianId)

      const { data, error } = await supabase
        .from('equipment_placements')
        .select(`
          *,
          customer:customers!customer_id(id, company_name, contact_address)
        `)
        .eq('placed_by_technician_id', technicianId)
        .order('placed_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av teknikers utrustning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Lägg till signerade URLs för foton
      const equipmentWithUrls = await Promise.all(
        (data || []).map(async (equipment) => ({
          ...equipment,
          photo_url: equipment.photo_path
            ? await this.getEquipmentPhotoUrl(equipment.photo_path)
            : undefined
        }))
      )

      return equipmentWithUrls

    } catch (error) {
      console.error('EquipmentService.getEquipmentByTechnician fel:', error)
      throw error
    }
  }

  /**
   * Hämta all utrustning (för admin/koordinator)
   */
  static async getAllEquipment(): Promise<EquipmentPlacementWithRelations[]> {
    try {
      const { data, error } = await supabase
        .from('equipment_placements')
        .select(`
          *,
          customer:customers!customer_id(id, company_name, contact_address),
          technician:technicians!placed_by_technician_id(id, name)
        `)
        .order('placed_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av all utrustning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data || []

    } catch (error) {
      console.error('EquipmentService.getAllEquipment fel:', error)
      throw error
    }
  }

  /**
   * Hämta en specifik utrustning via ID
   */
  static async getEquipmentById(id: string): Promise<EquipmentPlacementWithRelations | null> {
    try {
      const { data, error } = await supabase
        .from('equipment_placements')
        .select(`
          *,
          customer:customers!customer_id(id, company_name, contact_address),
          technician:technicians!placed_by_technician_id(id, name)
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Fel vid hämtning av utrustning:', error)
        return null
      }

      return {
        ...data,
        photo_url: data.photo_path
          ? await this.getEquipmentPhotoUrl(data.photo_path)
          : undefined
      }

    } catch (error) {
      console.error('EquipmentService.getEquipmentById fel:', error)
      return null
    }
  }

  /**
   * Skapa ny utrustningsplacering
   */
  static async createEquipment(data: EquipmentPlacementInsert): Promise<{
    success: boolean
    equipment?: EquipmentPlacement
    error?: string
  }> {
    try {
      console.log('Skapar ny utrustning:', data)

      const { data: equipment, error } = await supabase
        .from('equipment_placements')
        .insert([data])
        .select()
        .single()

      if (error) {
        console.error('Fel vid skapande av utrustning:', error)
        throw error
      }

      console.log('Utrustning skapad:', equipment.id)
      return { success: true, equipment }

    } catch (error) {
      console.error('EquipmentService.createEquipment fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte skapa utrustning'
      }
    }
  }

  /**
   * Uppdatera utrustning
   */
  static async updateEquipment(
    id: string,
    data: EquipmentPlacementUpdate
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Uppdaterar utrustning:', id, data)

      const { error } = await supabase
        .from('equipment_placements')
        .update(data)
        .eq('id', id)

      if (error) {
        console.error('Fel vid uppdatering av utrustning:', error)
        throw error
      }

      console.log('Utrustning uppdaterad:', id)
      return { success: true }

    } catch (error) {
      console.error('EquipmentService.updateEquipment fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte uppdatera utrustning'
      }
    }
  }

  /**
   * Uppdatera utrustningsstatus med spårbarhet
   */
  static async updateEquipmentStatus(
    id: string,
    status: EquipmentStatus,
    technicianId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Uppdaterar status för utrustning:', id, status)

      const { error } = await supabase
        .from('equipment_placements')
        .update({
          status,
          status_updated_at: new Date().toISOString(),
          status_updated_by: technicianId
        })
        .eq('id', id)

      if (error) {
        console.error('Fel vid statusuppdatering:', error)
        throw error
      }

      console.log('Status uppdaterad:', id, status)
      return { success: true }

    } catch (error) {
      console.error('EquipmentService.updateEquipmentStatus fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte uppdatera status'
      }
    }
  }

  /**
   * Ta bort utrustning (endast admin)
   */
  static async deleteEquipment(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Tar bort utrustning:', id)

      // Hämta foto-sökväg först för att ta bort från storage
      const { data: equipment } = await supabase
        .from('equipment_placements')
        .select('photo_path')
        .eq('id', id)
        .single()

      // Ta bort foto om det finns
      if (equipment?.photo_path) {
        await this.deleteEquipmentPhoto(equipment.photo_path)
      }

      // Ta bort utrustningspost och returnera borttagen rad för verifiering
      const { data: deletedRows, error } = await supabase
        .from('equipment_placements')
        .delete()
        .eq('id', id)
        .select('id')

      if (error) {
        console.error('Fel vid borttagning av utrustning:', error)
        throw error
      }

      // Verifiera att raden faktiskt togs bort (RLS kan blockera tyst)
      if (!deletedRows || deletedRows.length === 0) {
        console.error('Borttagning blockerad - inga rader påverkades (troligen RLS)')
        throw new Error('Du har inte behörighet att ta bort denna utrustning')
      }

      console.log('Utrustning borttagen:', id, 'Raderade:', deletedRows.length)
      return { success: true }

    } catch (error) {
      console.error('EquipmentService.deleteEquipment fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte ta bort utrustning'
      }
    }
  }

  /**
   * Ladda upp utrustningsfoto
   */
  static async uploadEquipmentPhoto(
    equipmentId: string,
    file: File
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      console.log('Laddar upp foto för utrustning:', equipmentId, file.name)

      // Validera filtyp
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return {
          success: false,
          error: 'Ogiltigt filformat. Tillåtna: JPEG, PNG, WebP, HEIC'
        }
      }

      // Validera filstorlek
      if (file.size > MAX_EQUIPMENT_IMAGE_SIZE) {
        return {
          success: false,
          error: `Filen är för stor. Max ${MAX_EQUIPMENT_IMAGE_SIZE / 1024 / 1024}MB.`
        }
      }

      // Generera unik sökväg
      const timestamp = Date.now()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const filePath = `${equipmentId}/${timestamp}_${sanitizedName}`

      // Ladda upp till storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(EQUIPMENT_IMAGES_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Fel vid uppladdning till storage:', uploadError)
        throw uploadError
      }

      // Uppdatera utrustningspost med foto-sökväg
      const { error: updateError } = await supabase
        .from('equipment_placements')
        .update({ photo_path: uploadData.path })
        .eq('id', equipmentId)

      if (updateError) {
        // Rensa uppladdad fil vid fel
        await supabase.storage.from(EQUIPMENT_IMAGES_BUCKET).remove([filePath])
        console.error('Fel vid uppdatering av fotosökväg:', updateError)
        throw updateError
      }

      console.log('Foto uppladdat:', uploadData.path)
      return { success: true, path: uploadData.path }

    } catch (error) {
      console.error('EquipmentService.uploadEquipmentPhoto fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte ladda upp foto'
      }
    }
  }

  /**
   * Hämta signerad URL för utrustningsfoto
   */
  static async getEquipmentPhotoUrl(photoPath: string): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(EQUIPMENT_IMAGES_BUCKET)
        .createSignedUrl(photoPath, 3600) // 1 timme giltighetstid

      if (error) {
        console.error('Fel vid skapande av signerad URL:', error)
        return null
      }

      return data.signedUrl

    } catch (error) {
      console.error('EquipmentService.getEquipmentPhotoUrl fel:', error)
      return null
    }
  }

  /**
   * Ta bort utrustningsfoto
   */
  static async deleteEquipmentPhoto(photoPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Tar bort foto:', photoPath)

      const { error } = await supabase.storage
        .from(EQUIPMENT_IMAGES_BUCKET)
        .remove([photoPath])

      if (error) {
        console.error('Fel vid borttagning av foto:', error)
        throw error
      }

      return { success: true }

    } catch (error) {
      console.error('EquipmentService.deleteEquipmentPhoto fel:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Kunde inte ta bort foto'
      }
    }
  }

  /**
   * Hämta statistik för en kunds utrustning
   */
  static async getEquipmentStats(customerId: string): Promise<EquipmentStats> {
    try {
      const { data, error } = await supabase
        .from('equipment_placements')
        .select('equipment_type, status, placed_at')
        .eq('customer_id', customerId)

      if (error) {
        console.error('Fel vid hämtning av statistik:', error)
        throw error
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const stats: EquipmentStats = {
        total: data?.length || 0,
        byType: {
          mechanical_trap: 0,
          concrete_station: 0,
          bait_station: 0
        },
        byStatus: {
          active: 0,
          removed: 0,
          missing: 0
        },
        recentPlacements: 0
      }

      data?.forEach((item) => {
        stats.byType[item.equipment_type as EquipmentType]++
        stats.byStatus[item.status as EquipmentStatus]++
        if (new Date(item.placed_at) >= thirtyDaysAgo) {
          stats.recentPlacements++
        }
      })

      return stats

    } catch (error) {
      console.error('EquipmentService.getEquipmentStats fel:', error)
      return {
        total: 0,
        byType: { mechanical_trap: 0, concrete_station: 0, bait_station: 0 },
        byStatus: { active: 0, removed: 0, missing: 0 },
        recentPlacements: 0
      }
    }
  }

  /**
   * Hämta alla kunder (för dropdown-val)
   */
  static async getCustomersForDropdown(): Promise<{ id: string; company_name: string }[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('is_active', true)
        .order('company_name', { ascending: true })

      if (error) {
        console.error('Fel vid hämtning av kunder:', error)
        return []
      }

      return data || []

    } catch (error) {
      console.error('EquipmentService.getCustomersForDropdown fel:', error)
      return []
    }
  }
}

// Hjälpfunktion för att formatera koordinater
export const formatCoordinates = (lat: number, lng: number): string => {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

// Hjälpfunktion för att beräkna avstånd mellan två punkter (Haversine formula)
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371 // Jordens radie i km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c // Avstånd i km
}
