// src/services/floorPlanService.ts - Service för planritningar
import { supabase } from '../lib/supabase'
import type {
  FloorPlan,
  FloorPlanWithRelations,
  CreateFloorPlanInput,
  UpdateFloorPlanInput,
  FloorPlanStats
} from '../types/indoor'

export const FLOOR_PLANS_BUCKET = 'floor-plans'
export const MAX_FLOOR_PLAN_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FLOOR_PLAN_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Service för hantering av planritningar
 * Hanterar CRUD-operationer och bilduppladdning
 */
export class FloorPlanService {
  /**
   * Hämta alla planritningar för en kund
   */
  static async getFloorPlansByCustomer(customerId: string): Promise<FloorPlanWithRelations[]> {
    try {
      console.log('Hämtar planritningar för kund:', customerId)

      const { data, error } = await supabase
        .from('floor_plans')
        .select(`
          *,
          customer:customers!customer_id(id, company_name, contact_address)
        `)
        .eq('customer_id', customerId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Fel vid hämtning av planritningar:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Lägg till signerade URLs och stationsantal
      const plansWithUrls = await Promise.all(
        (data || []).map(async (plan) => {
          // Hämta antal stationer
          const { count } = await supabase
            .from('indoor_stations')
            .select('*', { count: 'exact', head: true })
            .eq('floor_plan_id', plan.id)

          return {
            ...plan,
            station_count: count || 0,
            image_url: await this.getFloorPlanImageUrl(plan.image_path)
          }
        })
      )

      console.log('Planritningar hämtade:', plansWithUrls.length)
      return plansWithUrls

    } catch (error) {
      console.error('FloorPlanService.getFloorPlansByCustomer fel:', error)
      throw error
    }
  }

  /**
   * Hämta en specifik planritning med stationer
   */
  static async getFloorPlanById(id: string): Promise<FloorPlanWithRelations | null> {
    try {
      const { data, error } = await supabase
        .from('floor_plans')
        .select(`
          *,
          customer:customers!customer_id(id, company_name, contact_address)
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null // Not found
        console.error('Fel vid hämtning av planritning:', error)
        return null
      }

      // Hämta stationer
      const { data: stations } = await supabase
        .from('indoor_stations')
        .select(`
          *,
          technician:technicians!placed_by_technician_id(id, name)
        `)
        .eq('floor_plan_id', id)
        .order('created_at', { ascending: false })

      return {
        ...data,
        stations: stations || [],
        station_count: stations?.length || 0,
        image_url: await this.getFloorPlanImageUrl(data.image_path)
      }

    } catch (error) {
      console.error('FloorPlanService.getFloorPlanById fel:', error)
      throw error
    }
  }

  /**
   * Skapa ny planritning med bilduppladdning
   */
  static async createFloorPlan(
    input: CreateFloorPlanInput,
    createdBy?: string
  ): Promise<FloorPlan> {
    try {
      console.log('Skapar planritning:', input.name)

      // Validera bild
      this.validateImage(input.image)

      // Skapa temporärt ID för storage path
      const tempId = crypto.randomUUID()
      const fileExt = input.image.name.split('.').pop()?.toLowerCase() || 'jpg'
      const imagePath = `${input.customer_id}/${tempId}/image.${fileExt}`

      // Ladda upp bild till storage
      const { error: uploadError } = await supabase.storage
        .from(FLOOR_PLANS_BUCKET)
        .upload(imagePath, input.image, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Fel vid uppladdning av bild:', uploadError)
        throw new Error(`Kunde inte ladda upp bild: ${uploadError.message}`)
      }

      // Hämta bilddimensioner
      const dimensions = await this.getImageDimensions(input.image)

      // Skapa databaspost
      const { data, error } = await supabase
        .from('floor_plans')
        .insert({
          customer_id: input.customer_id,
          name: input.name,
          description: input.description || null,
          building_name: input.building_name || null,
          image_path: imagePath,
          image_width: dimensions.width,
          image_height: dimensions.height,
          created_by: createdBy || null
        })
        .select()
        .single()

      if (error) {
        // Rensa upp den uppladdade bilden om databasinskicket misslyckas
        await supabase.storage.from(FLOOR_PLANS_BUCKET).remove([imagePath])
        console.error('Fel vid skapande av planritning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      console.log('Planritning skapad:', data.id)
      return data

    } catch (error) {
      console.error('FloorPlanService.createFloorPlan fel:', error)
      throw error
    }
  }

  /**
   * Uppdatera planritning (utan bild)
   */
  static async updateFloorPlan(id: string, input: UpdateFloorPlanInput): Promise<FloorPlan> {
    try {
      console.log('Uppdaterar planritning:', id)

      const { data, error } = await supabase
        .from('floor_plans')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Fel vid uppdatering av planritning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      return data

    } catch (error) {
      console.error('FloorPlanService.updateFloorPlan fel:', error)
      throw error
    }
  }

  /**
   * Ta bort planritning (inklusive bild och alla stationer via CASCADE)
   */
  static async deleteFloorPlan(id: string): Promise<void> {
    try {
      console.log('Tar bort planritning:', id)

      // Hämta planritning för att få image_path
      const { data: plan, error: fetchError } = await supabase
        .from('floor_plans')
        .select('image_path')
        .eq('id', id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Kunde inte hitta planritning: ${fetchError.message}`)
      }

      // Ta bort databaspost (stationer raderas via CASCADE)
      const { error } = await supabase
        .from('floor_plans')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Fel vid borttagning av planritning:', error)
        throw new Error(`Databasfel: ${error.message}`)
      }

      // Ta bort bild från storage
      if (plan?.image_path) {
        await supabase.storage.from(FLOOR_PLANS_BUCKET).remove([plan.image_path])
      }

      console.log('Planritning borttagen:', id)

    } catch (error) {
      console.error('FloorPlanService.deleteFloorPlan fel:', error)
      throw error
    }
  }

  /**
   * Byt ut bilden för en befintlig planritning
   * Bevarar alla stationer och metadata — bara bilden byts ut
   */
  static async replaceFloorPlanImage(id: string, newImage: File): Promise<FloorPlan> {
    try {
      console.log('Byter bild för planritning:', id)

      // Validera ny bild
      this.validateImage(newImage)

      // Hämta befintlig planritning
      const { data: existing, error: fetchError } = await supabase
        .from('floor_plans')
        .select('image_path, customer_id')
        .eq('id', id)
        .single()

      if (fetchError || !existing) {
        throw new Error('Kunde inte hitta planritningen')
      }

      // Ladda upp ny bild
      const tempId = crypto.randomUUID()
      const fileExt = newImage.name.split('.').pop()?.toLowerCase() || 'jpg'
      const newImagePath = `${existing.customer_id}/${tempId}/image.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(FLOOR_PLANS_BUCKET)
        .upload(newImagePath, newImage, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`Kunde inte ladda upp bild: ${uploadError.message}`)
      }

      // Hämta nya bilddimensioner
      const dimensions = await this.getImageDimensions(newImage)

      // Uppdatera DB
      const { data, error: updateError } = await supabase
        .from('floor_plans')
        .update({
          image_path: newImagePath,
          image_width: dimensions.width,
          image_height: dimensions.height,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()

      if (updateError) {
        // Rensa ny bild om DB-uppdatering misslyckas
        await supabase.storage.from(FLOOR_PLANS_BUCKET).remove([newImagePath])
        throw new Error(`Databasfel: ${updateError.message}`)
      }

      // Ta bort gammal bild från storage
      if (existing.image_path) {
        await supabase.storage.from(FLOOR_PLANS_BUCKET).remove([existing.image_path])
      }

      console.log('Planritningsbild utbytt:', id)
      return data

    } catch (error) {
      console.error('FloorPlanService.replaceFloorPlanImage fel:', error)
      throw error
    }
  }

  /**
   * Hämta signerad URL för planritningsbild
   */
  static async getFloorPlanImageUrl(imagePath: string): Promise<string | undefined> {
    try {
      if (!imagePath) return undefined

      const { data, error } = await supabase.storage
        .from(FLOOR_PLANS_BUCKET)
        .createSignedUrl(imagePath, 3600) // 1 timme

      if (error) {
        console.error('Fel vid skapande av signerad URL:', error)
        return undefined
      }

      return data.signedUrl
    } catch (error) {
      console.error('FloorPlanService.getFloorPlanImageUrl fel:', error)
      return undefined
    }
  }

  /**
   * Hämta statistik för inomhusplaceringar
   */
  static async getStats(customerId?: string): Promise<FloorPlanStats> {
    try {
      let floorPlanQuery = supabase
        .from('floor_plans')
        .select('*', { count: 'exact', head: true })

      let stationQuery = supabase
        .from('indoor_stations')
        .select('station_type, status')

      if (customerId) {
        floorPlanQuery = floorPlanQuery.eq('customer_id', customerId)

        // För stationer, behöver vi joina via floor_plans
        const { data: plans } = await supabase
          .from('floor_plans')
          .select('id')
          .eq('customer_id', customerId)

        if (plans && plans.length > 0) {
          const planIds = plans.map(p => p.id)
          stationQuery = stationQuery.in('floor_plan_id', planIds)
        }
      }

      const [{ count: floorPlanCount }, { data: stations }] = await Promise.all([
        floorPlanQuery,
        stationQuery
      ])

      // Räkna per typ och status
      const byType: Record<string, number> = {
        mechanical_trap: 0,
        bait_station: 0,
        concrete_station: 0
      }
      const byStatus: Record<string, number> = {
        active: 0,
        removed: 0,
        missing: 0,
        damaged: 0
      }

      for (const station of stations || []) {
        if (station.station_type in byType) {
          byType[station.station_type]++
        }
        if (station.status in byStatus) {
          byStatus[station.status]++
        }
      }

      return {
        total_floor_plans: floorPlanCount || 0,
        total_stations: stations?.length || 0,
        stations_by_type: byType as any,
        stations_by_status: byStatus as any
      }

    } catch (error) {
      console.error('FloorPlanService.getStats fel:', error)
      throw error
    }
  }

  /**
   * Hämta kunder som dropdown (med antal planritningar)
   */
  static async getCustomersWithFloorPlans(): Promise<Array<{
    id: string
    company_name: string
    floor_plan_count: number
    station_count: number
  }>> {
    try {
      // Hämta alla aktiva kunder
      const { data: customers, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('status', 'active')
        .order('company_name')

      if (error) throw error

      // Hämta antal planritningar och stationer per kund
      const customersWithCounts = await Promise.all(
        (customers || []).map(async (customer) => {
          const { count: floorPlanCount } = await supabase
            .from('floor_plans')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', customer.id)

          // Hämta plan-IDs för att räkna stationer
          const { data: plans } = await supabase
            .from('floor_plans')
            .select('id')
            .eq('customer_id', customer.id)

          let stationCount = 0
          if (plans && plans.length > 0) {
            const { count } = await supabase
              .from('indoor_stations')
              .select('*', { count: 'exact', head: true })
              .in('floor_plan_id', plans.map(p => p.id))
              .eq('status', 'active')
            stationCount = count || 0
          }

          return {
            ...customer,
            floor_plan_count: floorPlanCount || 0,
            station_count: stationCount
          }
        })
      )

      return customersWithCounts

    } catch (error) {
      console.error('FloorPlanService.getCustomersWithFloorPlans fel:', error)
      throw error
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Validera bildformat och storlek
   */
  private static validateImage(file: File): void {
    if (!ALLOWED_FLOOR_PLAN_TYPES.includes(file.type)) {
      throw new Error(
        `Ogiltigt bildformat. Tillåtna format: ${ALLOWED_FLOOR_PLAN_TYPES.map(t => t.split('/')[1]).join(', ')}`
      )
    }

    if (file.size > MAX_FLOOR_PLAN_SIZE) {
      throw new Error(
        `Bilden är för stor. Maxstorlek: ${MAX_FLOOR_PLAN_SIZE / 1024 / 1024}MB`
      )
    }
  }

  /**
   * Hämta bilddimensioner från File
   */
  private static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.width, height: img.height })
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Kunde inte läsa bilddimensioner'))
      }

      img.src = url
    })
  }
}
