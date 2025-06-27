// src/constants/businessTypes.ts
export const BUSINESS_TYPES = [
  { value: 'brf', label: 'BRF', icon: '🏢' },
  { value: 'restaurant', label: 'Restaurang', icon: '🍽️' },
  { value: 'hotel', label: 'Hotell', icon: '🏨' },
  { value: 'fastighetsägare', label: 'Fastighetsägare', icon: '🏗️' },
  { value: 'boendeverksamhet', label: 'Boendeverksamhet', icon: '🏠' },
  { value: 'livsmedelsbutik', label: 'Livsmedelsbutik', icon: '🛒' },
  { value: 'hästgård', label: 'Hästgård', icon: '🐎' },
  { value: 'såverk', label: 'Såverk', icon: '🪵' },
  { value: 'fastighetsförvaltning', label: 'Fastighetsförvaltning', icon: '🏘️' },
  { value: 'livsmedelsindustri', label: 'Livsmedelsindustri', icon: '🏭' },
  { value: 'samfällighet', label: 'Samfällighet', icon: '🏞️' },
  { value: 'annat', label: 'Annat', icon: '📋' }
] as const

export type BusinessType = typeof BUSINESS_TYPES[number]['value']

export const getBusinessTypeLabel = (value: string): string => {
  const businessType = BUSINESS_TYPES.find(bt => bt.value === value)
  return businessType ? businessType.label : 'Okänd'
}

export const getBusinessTypeIcon = (value: string): string => {
  const businessType = BUSINESS_TYPES.find(bt => bt.value === value)
  return businessType ? businessType.icon : '📋'
}