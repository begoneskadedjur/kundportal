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
  static async getCustomersForDropdown(): Promise<{ id: string; company_name: string; contact_address: string | null }[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_address')
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

  /**
   * Hämta aggregerad stationssammanfattning per kund för en tekniker
   * Kombinerar utomhus- och inomhusstationer med hälsostatus
   */
  static async getCustomerStationSummaries(
    technicianId: string
  ): Promise<CustomerStationSummary[]> {
    try {
      console.log('Hämtar kundsammanfattningar för tekniker:', technicianId)

      // Hämta utomhusstationer grupperat per kund
      const { data: outdoorData, error: outdoorError } = await supabase
        .from('equipment_placements')
        .select(`
          customer_id,
          status,
          placed_at,
          customer:customers!customer_id(id, company_name, contact_address)
        `)
        .eq('placed_by_technician_id', technicianId)

      if (outdoorError) {
        console.error('Fel vid hämtning av utomhusstationer:', outdoorError)
        throw outdoorError
      }

      // Hämta inomhusstationer via floor_plans
      const { data: indoorData, error: indoorError } = await supabase
        .from('indoor_stations')
        .select(`
          id,
          status,
          placed_at,
          floor_plan:floor_plans!floor_plan_id(
            customer_id,
            customer:customers!customer_id(id, company_name, contact_address)
          )
        `)
        .eq('placed_by_technician_id', technicianId)

      if (indoorError) {
        console.error('Fel vid hämtning av inomhusstationer:', indoorError)
        throw indoorError
      }

      // Gruppera och aggregera data per kund
      const customerMap = new Map<string, {
        customer_id: string
        customer_name: string
        customer_address: string | null
        outdoor_stations: Array<{ status: string; placed_at: string }>
        indoor_stations: Array<{ status: string; placed_at: string }>
      }>()

      // Lägg till utomhusstationer
      outdoorData?.forEach((item: any) => {
        if (!item.customer) return
        const customerId = item.customer_id

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            customer_name: item.customer.company_name,
            customer_address: item.customer.contact_address,
            outdoor_stations: [],
            indoor_stations: []
          })
        }

        customerMap.get(customerId)!.outdoor_stations.push({
          status: item.status,
          placed_at: item.placed_at
        })
      })

      // Lägg till inomhusstationer
      indoorData?.forEach((item: any) => {
        if (!item.floor_plan?.customer) return
        const customerId = item.floor_plan.customer_id

        if (!customerMap.has(customerId)) {
          customerMap.set(customerId, {
            customer_id: customerId,
            customer_name: item.floor_plan.customer.company_name,
            customer_address: item.floor_plan.customer.contact_address,
            outdoor_stations: [],
            indoor_stations: []
          })
        }

        customerMap.get(customerId)!.indoor_stations.push({
          status: item.status,
          placed_at: item.placed_at
        })
      })

      // Beräkna hälsostatus och senaste aktivitet för varje kund
      const summaries: CustomerStationSummary[] = Array.from(customerMap.values()).map(customer => {
        const allStations = [...customer.outdoor_stations, ...customer.indoor_stations]

        // Beräkna hälsostatus
        const problematic = allStations.filter(s =>
          s.status === 'damaged' ||
          s.status === 'missing' ||
          s.status === 'needs_service'
        ).length

        const ratio = allStations.length > 0 ? problematic / allStations.length : 0
        let health_status: 'excellent' | 'good' | 'fair' | 'poor'
        if (ratio === 0) health_status = 'excellent'
        else if (ratio < 0.1) health_status = 'good'
        else if (ratio < 0.3) health_status = 'fair'
        else health_status = 'poor'

        // Hitta senaste placering
        const allDates = allStations.map(s => new Date(s.placed_at))
        const latestDate = allDates.length > 0
          ? new Date(Math.max(...allDates.map(d => d.getTime())))
          : null

        return {
          customer_id: customer.customer_id,
          customer_name: customer.customer_name,
          customer_address: customer.customer_address,
          outdoor_count: customer.outdoor_stations.length,
          indoor_count: customer.indoor_stations.length,
          health_status,
          latest_inspection_date: latestDate?.toISOString() || null,
          latest_inspector_name: null // Kräver separat query om vi vill ha detta
        }
      })

      // Sortera alfabetiskt som standard
      summaries.sort((a, b) => a.customer_name.localeCompare(b.customer_name, 'sv'))

      console.log('Kundsammanfattningar hämtade:', summaries.length)
      return summaries

    } catch (error) {
      console.error('EquipmentService.getCustomerStationSummaries fel:', error)
      throw error
    }
  }

  /**
   * Hämta ALLA avtalskunder med deras stationsstatistik för en tekniker
   * Visar alla kunder oavsett om teknikern har placerat stationer där eller inte
   */
  static async getAllCustomersWithStationStats(
    technicianId: string
  ): Promise<CustomerStationSummary[]> {
    try {
      console.log('Hämtar alla kunder med stationsstatistik för tekniker:', technicianId)

      // Hämta ALLA aktiva kunder
      const { data: allCustomers, error: customerError } = await supabase
        .from('customers')
        .select('id, company_name, contact_address')
        .eq('is_active', true)
        .order('company_name', { ascending: true })

      if (customerError) {
        console.error('Fel vid hämtning av kunder:', customerError)
        throw customerError
      }

      // Hämta teknikerns utomhusstationer
      const { data: outdoorData, error: outdoorError } = await supabase
        .from('equipment_placements')
        .select('customer_id, status, placed_at')
        .eq('placed_by_technician_id', technicianId)

      if (outdoorError) {
        console.error('Fel vid hämtning av utomhusstationer:', outdoorError)
        throw outdoorError
      }

      // Hämta teknikerns inomhusstationer via floor_plans
      const { data: indoorData, error: indoorError } = await supabase
        .from('indoor_stations')
        .select(`
          id,
          status,
          placed_at,
          floor_plan:floor_plans!floor_plan_id(customer_id)
        `)
        .eq('placed_by_technician_id', technicianId)

      if (indoorError) {
        console.error('Fel vid hämtning av inomhusstationer:', indoorError)
        throw indoorError
      }

      // Gruppera stationer per kund
      const stationsByCustomer = new Map<string, {
        outdoor: Array<{ status: string; placed_at: string }>
        indoor: Array<{ status: string; placed_at: string }>
      }>()

      outdoorData?.forEach((item: any) => {
        if (!stationsByCustomer.has(item.customer_id)) {
          stationsByCustomer.set(item.customer_id, { outdoor: [], indoor: [] })
        }
        stationsByCustomer.get(item.customer_id)!.outdoor.push({
          status: item.status,
          placed_at: item.placed_at
        })
      })

      indoorData?.forEach((item: any) => {
        if (!item.floor_plan?.customer_id) return
        const customerId = item.floor_plan.customer_id
        if (!stationsByCustomer.has(customerId)) {
          stationsByCustomer.set(customerId, { outdoor: [], indoor: [] })
        }
        stationsByCustomer.get(customerId)!.indoor.push({
          status: item.status,
          placed_at: item.placed_at
        })
      })

      // Skapa sammanfattning för ALLA kunder
      const summaries: CustomerStationSummary[] = (allCustomers || []).map(customer => {
        const stations = stationsByCustomer.get(customer.id) || { outdoor: [], indoor: [] }
        const allStations = [...stations.outdoor, ...stations.indoor]

        // Beräkna hälsostatus
        const problematic = allStations.filter(s =>
          s.status === 'damaged' ||
          s.status === 'missing' ||
          s.status === 'needs_service'
        ).length

        let health_status: 'excellent' | 'good' | 'fair' | 'poor'
        if (allStations.length === 0) {
          health_status = 'excellent' // Ingen station = ingen problem
        } else {
          const ratio = problematic / allStations.length
          if (ratio === 0) health_status = 'excellent'
          else if (ratio < 0.1) health_status = 'good'
          else if (ratio < 0.3) health_status = 'fair'
          else health_status = 'poor'
        }

        // Hitta senaste placering
        const allDates = allStations.map(s => new Date(s.placed_at))
        const latestDate = allDates.length > 0
          ? new Date(Math.max(...allDates.map(d => d.getTime())))
          : null

        return {
          customer_id: customer.id,
          customer_name: customer.company_name,
          customer_address: customer.contact_address,
          outdoor_count: stations.outdoor.length,
          indoor_count: stations.indoor.length,
          health_status,
          latest_inspection_date: latestDate?.toISOString() || null,
          latest_inspector_name: null
        }
      })

      console.log('Alla kunder med stationsstatistik hämtade:', summaries.length)
      return summaries

    } catch (error) {
      console.error('EquipmentService.getAllCustomersWithStationStats fel:', error)
      throw error
    }
  }

  /**
   * Hämta alla stationer för en specifik kund (både utomhus och inomhus)
   */
  static async getStationsByCustomer(customerId: string): Promise<{
    outdoor: EquipmentPlacementWithRelations[]
    indoor: any[]
  }> {
    try {
      console.log('Hämtar stationer för kund:', customerId)

      // Hämta utomhusstationer
      const { data: outdoorData, error: outdoorError } = await supabase
        .from('equipment_placements')
        .select(`
          *,
          technician:technicians!placed_by_technician_id(id, name)
        `)
        .eq('customer_id', customerId)
        .order('placed_at', { ascending: false })

      if (outdoorError) {
        console.error('Fel vid hämtning av utomhusstationer:', outdoorError)
        throw outdoorError
      }

      // Hämta floor_plans för denna kund först
      const { data: floorPlans, error: fpError } = await supabase
        .from('floor_plans')
        .select('id')
        .eq('customer_id', customerId)

      if (fpError) {
        console.error('Fel vid hämtning av planritningar:', fpError)
      }

      let indoorData: any[] = []
      if (floorPlans && floorPlans.length > 0) {
        const floorPlanIds = floorPlans.map(fp => fp.id)
        const { data: indoor, error: indoorError } = await supabase
          .from('indoor_stations')
          .select(`
            *,
            technician:technicians!placed_by_technician_id(id, name),
            floor_plan:floor_plans!floor_plan_id(id, name, customer_id)
          `)
          .in('floor_plan_id', floorPlanIds)
          .order('placed_at', { ascending: false })

        if (indoorError) {
          console.error('Fel vid hämtning av inomhusstationer:', indoorError)
        } else {
          indoorData = indoor || []
        }
      }

      // Lägg till signerade URLs för foton
      const outdoorWithUrls = await Promise.all(
        (outdoorData || []).map(async (equipment) => ({
          ...equipment,
          photo_url: equipment.photo_path
            ? await this.getEquipmentPhotoUrl(equipment.photo_path)
            : undefined
        }))
      )

      console.log('Stationer hämtade - utomhus:', outdoorWithUrls.length, 'inomhus:', indoorData.length)

      return {
        outdoor: outdoorWithUrls,
        indoor: indoorData
      }

    } catch (error) {
      console.error('EquipmentService.getStationsByCustomer fel:', error)
      throw error
    }
  }

  /**
   * Hämta aggregerad statistik för alla teknikerns stationer
   */
  static async getTechnicianStationStats(technicianId: string): Promise<{
    total: number
    outdoor: number
    indoor: number
    byStatus: Record<string, number>
    customerCount: number
  }> {
    try {
      // Hämta utomhusstationer
      const { data: outdoorData, error: outdoorError } = await supabase
        .from('equipment_placements')
        .select('status, customer_id')
        .eq('placed_by_technician_id', technicianId)

      if (outdoorError) throw outdoorError

      // Hämta inomhusstationer
      const { data: indoorData, error: indoorError } = await supabase
        .from('indoor_stations')
        .select('status, floor_plan:floor_plans!floor_plan_id(customer_id)')
        .eq('placed_by_technician_id', technicianId)

      if (indoorError) throw indoorError

      // Räkna statusar
      const byStatus: Record<string, number> = {
        active: 0,
        damaged: 0,
        missing: 0,
        removed: 0,
        needs_service: 0
      }

      const customerIds = new Set<string>()

      outdoorData?.forEach((item: any) => {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1
        customerIds.add(item.customer_id)
      })

      indoorData?.forEach((item: any) => {
        byStatus[item.status] = (byStatus[item.status] || 0) + 1
        if (item.floor_plan?.customer_id) {
          customerIds.add(item.floor_plan.customer_id)
        }
      })

      return {
        total: (outdoorData?.length || 0) + (indoorData?.length || 0),
        outdoor: outdoorData?.length || 0,
        indoor: indoorData?.length || 0,
        byStatus,
        customerCount: customerIds.size
      }

    } catch (error) {
      console.error('EquipmentService.getTechnicianStationStats fel:', error)
      return {
        total: 0,
        outdoor: 0,
        indoor: 0,
        byStatus: {},
        customerCount: 0
      }
    }
  }
}

// Typer för aggregerad data
export interface CustomerStationSummary {
  customer_id: string
  customer_name: string
  customer_address: string | null
  outdoor_count: number
  indoor_count: number
  health_status: 'excellent' | 'good' | 'fair' | 'poor'
  latest_inspection_date: string | null
  latest_inspector_name: string | null
}

export interface IndoorStationWithRelations {
  id: string
  floor_plan_id: string
  station_type: string
  station_number: string | null
  position_x_percent: number
  position_y_percent: number
  location_description: string | null
  comment: string | null
  photo_path: string | null
  status: string
  placed_at: string
  technician?: { id: string; name: string }
  floor_plan?: { id: string; name: string; customer_id: string }
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
