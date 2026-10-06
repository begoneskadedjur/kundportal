// src/utils/oneflowPrefill.ts
// Delad hjälp för att öppna offert-/avtalsguiden (OneflowContractCreator) med en
// kund förifylld. Guiden läser ?prefill=offer|contract och JSON:en i
// sessionStorage['prefill_customer_data'] vid mount (se OneflowContractCreator.tsx).

import type { NavigateFunction } from 'react-router-dom'

export type OneflowDocumentType = 'offer' | 'contract'
export type OneflowRolePrefix = '/admin' | '/koordinator' | '/technician'

/** Minsta kunddata som behövs för förifyllning. Fälten följer customers-tabellen. */
export interface PrefillCustomer {
  company_name?: string | null
  organization_number?: string | null
  contact_person?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  contact_address?: string | null
  price_list_id?: string | null
  customer_group_id?: string | null
}

export const PREFILL_STORAGE_KEY = 'prefill_customer_data'

const CREATOR_ROUTES: Record<OneflowRolePrefix, string> = {
  '/admin': '/admin/skapa-avtal',
  '/koordinator': '/koordinator/oneflow-contract-creator',
  '/technician': '/technician/oneflow',
}

export function oneflowCreatorRoute(rolePrefix: OneflowRolePrefix): string {
  return CREATOR_ROUTES[rolePrefix]
}

/**
 * Privatperson eller företag ur org.nr/personnummer. Tredje siffran i ett
 * organisationsnummer är alltid 2 eller högre; i ett personnummer är den
 * månadens första siffra (0 eller 1).
 */
export function isPrivateIdNumber(idNumber: string | null | undefined): boolean {
  const digits = (idNumber || '').replace(/\D/g, '')
  const ten = digits.length === 12 ? digits.slice(2) : digits
  if (ten.length !== 10) return false
  return Number(ten[2]) < 2
}

export function buildPrefillFromCustomer(customer: PrefillCustomer, documentType: OneflowDocumentType) {
  const individual = isPrivateIdNumber(customer.organization_number)
  return {
    documentType,
    partyType: individual ? 'individual' : 'company',
    Kontaktperson: customer.contact_person || (individual ? customer.company_name || '' : ''),
    'e-post-kontaktperson': customer.contact_email || '',
    'telefonnummer-kontaktperson': customer.contact_phone || '',
    'utforande-adress': customer.contact_address || '',
    foretag: individual ? '' : customer.company_name || '',
    'org-nr': customer.organization_number || '',
    ...(customer.price_list_id ? { selectedPriceListId: customer.price_list_id } : {}),
    ...(customer.customer_group_id ? { customer_group_id: customer.customer_group_id } : {}),
    // Gå direkt till mallvalet
    targetStep: 2,
  }
}

/**
 * Öppna guiden. Med kund skrivs förifyllningen till sessionStorage och
 * ?prefill=<typ> läggs på. Guiden läser förifyllningen bara vid mount, så står
 * man redan på guiden laddas sidan om.
 */
export function openOneflowCreator(
  navigate: NavigateFunction,
  rolePrefix: OneflowRolePrefix,
  documentType: OneflowDocumentType,
  customer?: PrefillCustomer | null,
) {
  const route = oneflowCreatorRoute(rolePrefix)
  const url = `${route}?prefill=${documentType}`
  try {
    if (customer) {
      sessionStorage.setItem(PREFILL_STORAGE_KEY, JSON.stringify(buildPrefillFromCustomer(customer, documentType)))
    } else {
      // Ingen gammal förifyllning får följa med in i en tom guide
      sessionStorage.removeItem(PREFILL_STORAGE_KEY)
    }
  } catch {
    // sessionStorage kan vara blockerad; guiden öppnas då utan förifyllning
  }

  if (window.location.pathname === route) {
    window.location.assign(url)
    return
  }
  navigate(url)
}
