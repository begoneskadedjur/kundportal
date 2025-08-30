// src/utils/swedishDateFormat.ts - Swedish date formatting utilities

import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { sv } from 'date-fns/locale'

/**
 * Format date to Swedish format without AM/PM
 * Example: "30 aug 2025, 13:27"
 */
export function formatSwedishDateTime(date: string | Date | null): string {
  if (!date) return ''
  
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(parsedDate)) {
      return 'Ogiltigt datum'
    }
    
    return format(parsedDate, 'd MMM yyyy, HH:mm', { locale: sv })
  } catch (error) {
    console.warn('Error formatting date:', error)
    return 'Ogiltigt datum'
  }
}

/**
 * Format date to Swedish date only
 * Example: "30 augusti 2025"
 */
export function formatSwedishDate(date: string | Date | null): string {
  if (!date) return ''
  
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(parsedDate)) {
      return 'Ogiltigt datum'
    }
    
    return format(parsedDate, 'd MMMM yyyy', { locale: sv })
  } catch (error) {
    console.warn('Error formatting date:', error)
    return 'Ogiltigt datum'
  }
}

/**
 * Format relative time in Swedish
 * Example: "2 minuter sedan", "för 3 timmar sedan"
 */
export function formatSwedishRelativeTime(date: string | Date | null): string {
  if (!date) return ''
  
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(parsedDate)) {
      return 'Ogiltigt datum'
    }
    
    return formatDistanceToNow(parsedDate, { 
      addSuffix: true, 
      locale: sv 
    })
  } catch (error) {
    console.warn('Error formatting relative time:', error)
    return 'Ogiltigt datum'
  }
}

/**
 * Format short date for compact displays
 * Example: "30 aug"
 */
export function formatSwedishShortDate(date: string | Date | null): string {
  if (!date) return ''
  
  try {
    const parsedDate = typeof date === 'string' ? parseISO(date) : date
    
    if (!isValid(parsedDate)) {
      return 'Ogiltigt datum'
    }
    
    return format(parsedDate, 'd MMM', { locale: sv })
  } catch (error) {
    console.warn('Error formatting short date:', error)
    return 'Ogiltigt datum'
  }
}

/**
 * Safe date parsing that handles various input formats
 */
export function safeParseDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null
  
  try {
    if (date instanceof Date) {
      return isValid(date) ? date : null
    }
    
    const parsedDate = parseISO(date)
    return isValid(parsedDate) ? parsedDate : null
  } catch (error) {
    console.warn('Error parsing date:', error)
    return null
  }
}

/**
 * Check if a date string/Date is valid
 */
export function isValidDate(date: string | Date | null | undefined): boolean {
  const parsed = safeParseDate(date)
  return parsed !== null
}