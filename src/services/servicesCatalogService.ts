// src/services/servicesCatalogService.ts
// Service för hantering av Tjänsteutbud (services + service_groups)

import { supabase } from '../lib/supabase'
import type {
  Service,
  ServiceGroup,
  ServiceWithGroup,
  CreateServiceInput,
  UpdateServiceInput,
  CreateServiceGroupInput,
  UpdateServiceGroupInput,
} from '../types/services'

const generateSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export class ServiceGroupService {
  static async getAllGroups(): Promise<ServiceGroup[]> {
    const { data, error } = await supabase
      .from('service_groups')
      .select('*')
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async getActiveGroups(): Promise<ServiceGroup[]> {
    const { data, error } = await supabase
      .from('service_groups')
      .select('*')
      .eq('is_active', true)
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async createGroup(input: CreateServiceGroupInput): Promise<ServiceGroup> {
    const slug = input.slug || generateSlug(input.name)
    const { data, error } = await supabase
      .from('service_groups')
      .insert({
        name: input.name,
        slug,
        description: input.description || null,
        color: input.color || '#6b7280',
        icon: input.icon || 'Package',
        sort_order: input.sort_order ?? 0,
      })
      .select().single()
    if (error) {
      if (error.code === '23505') throw new Error('En grupp med detta namn finns redan')
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  static async updateGroup(id: string, input: UpdateServiceGroupInput): Promise<ServiceGroup> {
    const { data, error } = await supabase
      .from('service_groups')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single()
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  static async deleteGroup(id: string): Promise<void> {
    const { count } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', id)
    if ((count || 0) > 0)
      throw new Error(`Kan inte ta bort gruppen – ${count} tjänst${count === 1 ? '' : 'er'} är kopplade.`)
    const { error } = await supabase.from('service_groups').delete().eq('id', id)
    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  static async getServiceCountsByGroup(): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('services')
      .select('group_id')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    const counts: Record<string, number> = {}
    data?.forEach((row) => {
      if (row.group_id) counts[row.group_id] = (counts[row.group_id] || 0) + 1
    })
    return counts
  }
}

export class ServiceCatalogService {
  static async getAllServices(): Promise<ServiceWithGroup[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*, group:service_groups!group_id(*)')
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async getActiveServicesByGroup(groupId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async getBookingServicesByGroup(groupId: string): Promise<Service[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .eq('show_in_booking', true)
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async getAllBookingServices(): Promise<ServiceWithGroup[]> {
    const { data, error } = await supabase
      .from('services')
      .select('*, group:service_groups!group_id(*)')
      .eq('is_active', true)
      .eq('show_in_booking', true)
      .order('sort_order').order('name')
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data || []
  }

  static async getServiceById(id: string): Promise<ServiceWithGroup | null> {
    const { data, error } = await supabase
      .from('services')
      .select('*, group:service_groups!group_id(*)')
      .eq('id', id)
      .single()
    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  static async createService(input: CreateServiceInput): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .insert({
        code: input.code,
        name: input.name,
        description: input.description || null,
        group_id: input.group_id || null,
        unit: input.unit || 'st',
        sort_order: input.sort_order ?? 0,
        is_active: input.is_active ?? true,
      })
      .select().single()
    if (error) {
      if (error.code === '23505') throw new Error('En tjänst med denna kod finns redan')
      throw new Error(`Databasfel: ${error.message}`)
    }
    return data
  }

  static async updateService(id: string, input: UpdateServiceInput): Promise<Service> {
    const { data, error } = await supabase
      .from('services')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select().single()
    if (error) throw new Error(`Databasfel: ${error.message}`)
    return data
  }

  static async toggleServiceActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('services')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(`Databasfel: ${error.message}`)
  }

  static async deleteService(id: string): Promise<void> {
    const { error } = await supabase.from('services').delete().eq('id', id)
    if (error) throw new Error(`Databasfel: ${error.message}`)
  }
}
