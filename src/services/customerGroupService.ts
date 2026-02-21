import { supabase } from '../lib/supabase'
import { CustomerGroup, CreateCustomerGroupInput, UpdateCustomerGroupInput } from '../types/customerGroups'

export class CustomerGroupService {
  static async getAllGroups(): Promise<CustomerGroup[]> {
    const { data, error } = await supabase
      .from('customer_groups')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`Kunde inte hämta kundgrupper: ${error.message}`)
    return data || []
  }

  static async getActiveGroups(): Promise<CustomerGroup[]> {
    const { data, error } = await supabase
      .from('customer_groups')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (error) throw new Error(`Kunde inte hämta aktiva kundgrupper: ${error.message}`)
    return data || []
  }

  static async getGroupById(id: string): Promise<CustomerGroup | null> {
    const { data, error } = await supabase
      .from('customer_groups')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return null
    return data
  }

  static async createGroup(input: CreateCustomerGroupInput): Promise<CustomerGroup> {
    const { data, error } = await supabase
      .from('customer_groups')
      .insert([input])
      .select()
      .single()

    if (error) throw new Error(`Kunde inte skapa kundgrupp: ${error.message}`)
    return data
  }

  static async updateGroup(id: string, input: UpdateCustomerGroupInput): Promise<CustomerGroup> {
    const { data, error } = await supabase
      .from('customer_groups')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`Kunde inte uppdatera kundgrupp: ${error.message}`)
    return data
  }

  static async deleteGroup(id: string): Promise<void> {
    const { error } = await supabase
      .from('customer_groups')
      .delete()
      .eq('id', id)

    if (error) throw new Error(`Kunde inte ta bort kundgrupp: ${error.message}`)
  }

  static async getCustomerCountByGroup(groupId: string): Promise<number> {
    const { count, error } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('customer_group_id', groupId)

    if (error) return 0
    return count || 0
  }

  static async allocateNumber(groupId: string): Promise<number> {
    const { data, error } = await supabase.rpc('allocate_customer_number', {
      p_group_id: groupId,
    })

    if (error) throw new Error(`Nummerallokering misslyckades: ${error.message}`)
    return data
  }
}
