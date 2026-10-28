// src/shared/kundSok.ts
// PostgREST-villkoret för att söka kunder på namn, org.nr eller kundnummer.
// Delas av leadsflödets koppling (LeadService.sokKunder) och kundvalet i
// Skapa avtal eller offert (AvtalsKundService.sok), så att båda söker likadant.

/** Villkor för .or(...) på customers, eller null om söktexten är för kort. */
export function kundSokVillkor(q: string): string | null {
  const t = q.trim()
  if (t.length < 2) return null
  const siffror = t.replace(/\D/g, '')
  const villkor = [`company_name.ilike.%${t.replace(/[%,()]/g, ' ')}%`]
  if (siffror.length >= 6) villkor.push(`organization_number.ilike.%${siffror.slice(0, 6)}%`)
  if (/^\d{1,6}$/.test(t)) villkor.push(`customer_number.eq.${t}`)
  return villkor.join(',')
}
