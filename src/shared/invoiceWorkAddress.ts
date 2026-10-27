// src/shared/invoiceWorkAddress.ts
// Utförandeadressen på fakturan (3.99.0). Ärendets adress skickas som
// leveransadress på Fortnox-fakturan när den skiljer sig från fakturaadressen,
// så att kunden ser var jobbet gjordes (Heimstaden, BE-0009027: fakturan till
// Malmö, jobbet på Boothsgatan i Gävle). Samma bedömning visas i
// fakturamodalens ruta Utfört arbete innan fakturan skickas.
//
// Fortnox: Delivery*-fälten på fakturan (apidocs, fortnox_Kf_InvoiceSinglePayloadItem).
// Sedan 2026-06-30 avvisas e-fakturor med leveransadress utan DeliveryCountry,
// och landet anges som namn ("Sverige"). Kundkortet påverkas inte.

import { parseSwedishAddress } from './fortnoxCustomerNumbers'
import { fortnoxText } from './invoiceAddonLines'

export type WorkAddressStatus = 'saknas' | 'samma' | 'leverans'

export interface WorkAddressResult {
  status: WorkAddressStatus
  /** Utförandeadressen som en rad, null om ärendet saknar adress */
  text: string | null
  /** Fälten till Fortnox-fakturan, bara när status är 'leverans' */
  fortnox: Record<string, string> | null
}

/** Ärendeadressen som text: jsonb med formatted_address, sträng-JSON eller ren text */
export function workAddressText(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'object') {
    const f = (raw as { formatted_address?: unknown }).formatted_address
    return typeof f === 'string' && f.trim() ? f.trim() : null
  }
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null
  if (s.startsWith('{') || s.startsWith('"')) {
    try {
      const parsed = JSON.parse(s)
      return workAddressText(parsed)
    } catch {
      return s
    }
  }
  return s
}

/** Utan "Sverige" på slutet, för visning */
export function withoutCountry(text: string): string {
  return text.replace(/,?\s*Sverige\s*$/i, '').trim()
}

function streetKey(s: string | null): string {
  return (s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

/**
 * Samma adress? Jämför gata och postnummer när båda har postnummer, annars
 * hela texten utan skiljetecken. Våning och liknande efter första kommat på
 * gatudelen räknas inte ("Boothsgatan 8 C, vån 1" = "Boothsgatan 8 C").
 */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const pa = parseSwedishAddress(a)
  const pb = parseSwedishAddress(b)
  if (pa.zipCode && pb.zipCode) {
    const zipA = pa.zipCode.replace(/\D/g, '')
    const zipB = pb.zipCode.replace(/\D/g, '')
    const gataA = streetKey((pa.address1 ?? '').split(',')[0])
    const gataB = streetKey((pb.address1 ?? '').split(',')[0])
    return zipA === zipB && gataA === gataB
  }
  return streetKey(withoutCountry(a)) === streetKey(withoutCountry(b))
}

/**
 * Bedömer utförandeadressen mot fakturaadressen och bygger Fortnox-fälten.
 * name blir DeliveryName (kundens namn på fakturan).
 */
export function invoiceWorkAddress(params: {
  workAddress: unknown
  billingAddress: string | null | undefined
  name: string | null | undefined
}): WorkAddressResult {
  const text = workAddressText(params.workAddress)
  if (!text) return { status: 'saknas', text: null, fortnox: null }
  if (sameAddress(text, params.billingAddress)) return { status: 'samma', text, fortnox: null }

  const parsed = parseSwedishAddress(text)
  const [gata, ...resten] = (parsed.address1 ?? withoutCountry(text)).split(',').map(s => s.trim()).filter(Boolean)
  const fortnox: Record<string, string> = { DeliveryCountry: 'Sverige' }
  const name = params.name?.trim()
  if (name) fortnox.DeliveryName = fortnoxText(name)
  if (gata) fortnox.DeliveryAddress1 = fortnoxText(gata)
  if (resten.length > 0) fortnox.DeliveryAddress2 = fortnoxText(resten.join(', '))
  if (parsed.zipCode) fortnox.DeliveryZipCode = parsed.zipCode
  if (parsed.city) fortnox.DeliveryCity = fortnoxText(parsed.city)
  return { status: 'leverans', text, fortnox }
}
