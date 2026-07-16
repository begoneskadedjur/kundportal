// src/utils/fortnoxCustomerResolver.ts
// Löser vilket Fortnox-kundnummer en kundrad ska faktureras mot.
//
// Bakgrund (multisite/Pelican-upplägget): flera enheter kan dela samma
// juridiska bolag (samma org.nr) och ska då faktureras mot SAMMA Fortnox-kund.
// customer_number är unikt per kundrad hos oss, så numret bor på EN rad
// (huvudkontoret eller en av enheterna) — övriga rader löser numret härifrån.
//
// Prioritet:
//  1. Radens eget customer_number
//  2. Huvudkontorets customer_number när enheten saknar eget org.nr
//     (ärvt org.nr = samma juridiska bolag som huvudkontoret)
//  3. Rad inom samma organisation med samma org.nr som bär ett customer_number
//  4. Valfri kundrad med samma org.nr som bär ett customer_number (äldst först)
import { supabase } from '../lib/supabase'

export async function resolveFortnoxCustomerNumber(customerId: string): Promise<number | null> {
  const { data: cust } = await supabase
    .from('customers')
    .select('customer_number, organization_number, parent_customer_id, organization_id')
    .eq('id', customerId)
    .maybeSingle()
  if (!cust) return null
  if (cust.customer_number) return cust.customer_number

  let orgNr: string | null = cust.organization_number || null

  // Enhet utan eget org.nr ärver huvudkontorets (samma juridiska bolag)
  if (!orgNr && cust.parent_customer_id) {
    const { data: parent } = await supabase
      .from('customers')
      .select('customer_number, organization_number')
      .eq('id', cust.parent_customer_id)
      .maybeSingle()
    if (parent?.customer_number) return parent.customer_number
    orgNr = parent?.organization_number || null
  }

  if (!orgNr) return null

  // Föredra bärar-raden inom samma organisation
  if (cust.organization_id) {
    const { data: inOrg } = await supabase
      .from('customers')
      .select('customer_number')
      .eq('organization_number', orgNr)
      .eq('organization_id', cust.organization_id)
      .not('customer_number', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (inOrg?.customer_number) return inOrg.customer_number
  }

  const { data: anyRow } = await supabase
    .from('customers')
    .select('customer_number')
    .eq('organization_number', orgNr)
    .not('customer_number', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return anyRow?.customer_number ?? null
}
