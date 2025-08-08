// src/constants/customerOptions.ts - Konstanter för kundalternativ

// Servicefrekvens alternativ
export const SERVICE_FREQUENCIES = [
  { value: 'monthly', label: 'Månadsvis' },
  { value: 'quarterly', label: 'Kvartalsvis' },
  { value: 'biannually', label: 'Halvårsvis' },
  { value: 'yearly', label: 'Årligen' },
  { value: 'as_needed', label: 'Vid behov' },
  { value: 'one_time', label: 'Engångsuppdrag' }
] as const

export type ServiceFrequency = typeof SERVICE_FREQUENCIES[number]['value']

// Företagsstorlek alternativ
export const CUSTOMER_SIZES = [
  { value: 'small', label: 'Litet (1-10 anställda)' },
  { value: 'medium', label: 'Medelstort (11-100 anställda)' },
  { value: 'large', label: 'Stort (100+ anställda)' }
] as const

export type CustomerSize = typeof CUSTOMER_SIZES[number]['value']

// Mappning från verksamhetstyp till branschkategori
export const BUSINESS_TYPE_TO_INDUSTRY: Record<string, string> = {
  'brf': 'Fastigheter & Bostäder',
  'restaurant': 'Restaurang & Mat',
  'hotel': 'Hotell & Turism', 
  'fastighetsägare': 'Fastigheter & Bostäder',
  'boendeverksamhet': 'Fastigheter & Bostäder',
  'livsmedelsbutik': 'Handel & Butik',
  'hästgård': 'Jordbruk & Djur',
  'såverk': 'Industri & Tillverkning',
  'fastighetsförvaltning': 'Fastigheter & Bostäder',
  'livsmedelsindustri': 'Industri & Tillverkning',
  'samfällighet': 'Fastigheter & Bostäder',
  'annat': 'Övrigt'
}

// Få branschkategori baserat på verksamhetstyp
export const getIndustryCategory = (businessType: string): string => {
  return BUSINESS_TYPE_TO_INDUSTRY[businessType] || 'Övrigt'
}

// Alla branschkategorier (för manuell redigering om det behövs)
export const INDUSTRY_CATEGORIES = [
  'Fastigheter & Bostäder',
  'Restaurang & Mat',
  'Hotell & Turism',
  'Handel & Butik', 
  'Jordbruk & Djur',
  'Industri & Tillverkning',
  'Övrigt'
] as const

export type IndustryCategory = typeof INDUSTRY_CATEGORIES[number]