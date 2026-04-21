export interface CustomerGroup {
  id: string
  name: string
  series_start: number
  series_end: number
  current_counter: number
  description: string | null
  sort_order: number
  is_active: boolean
  is_private_default: boolean
  created_at: string
  updated_at: string
}

export interface CreateCustomerGroupInput {
  name: string
  series_start: number
  series_end: number
  current_counter: number
  description?: string
  sort_order?: number
}

export interface UpdateCustomerGroupInput {
  name?: string
  series_start?: number
  series_end?: number
  current_counter?: number
  description?: string
  sort_order?: number
  is_active?: boolean
  is_private_default?: boolean
}
