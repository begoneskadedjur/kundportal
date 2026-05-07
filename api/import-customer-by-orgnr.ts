// api/import-customer-by-orgnr.ts
// Importerar en kund från Fortnox + Oneflow baserat på org.nummer
// action=preview: hämtar och returnerar data utan att spara
// action=confirm: sparar den (eventuellt redigerade) datan
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getValidAccessToken } from './fortnox/refresh'
import fetch from 'node-fetch'

// Stöder både SUPABASE_SERVICE_KEY och SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
const FORTNOX_API = 'https://api.fortnox.se/3'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Normalisera org.nr: ta bort allt utom siffror, lägg sedan tillbaka bindestreck (XXXXXX-XXXX)
function normalizeOrgNr(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) {
    return `${digits.slice(0, 6)}-${digits.slice(6)}`
  }
  return digits
}

const setCorsHeaders = (res: VercelResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

// ─── Fortnox ─────────────────────────────────────────────────────────────────

async function fetchFortnoxCustomerByOrgNr(orgNr: string) {
  const accessToken = await getValidAccessToken()
  const orgNrDigits = orgNr.replace(/\D/g, '')

  // Försök direkt filtrering på organisationsnummer
  const url = `${FORTNOX_API}/customers?organisationnumber=${encodeURIComponent(orgNr)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (res.ok) {
    const data = await res.json() as { Customers: any[] }
    const customers = data.Customers ?? []
    if (customers.length > 0) {
      return await fetchFortnoxCustomerFull(customers[0].CustomerNumber, accessToken)
    }
  }

  // Fallback: iterera sidvis och matcha manuellt
  console.log('⚠️ Direktfilter gav inget – söker manuellt i kundlista...')
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const pageRes = await fetch(`${FORTNOX_API}/customers?page=${page}&limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!pageRes.ok) break

    const pageData = await pageRes.json() as {
      Customers: any[]
      MetaInformation: { '@TotalPages': number }
    }
    totalPages = pageData.MetaInformation?.['@TotalPages'] ?? 1
    const match = (pageData.Customers ?? []).find((c: any) => {
      return (c.OrganisationNumber || '').replace(/\D/g, '') === orgNrDigits
    })
    if (match) return await fetchFortnoxCustomerFull(match.CustomerNumber, accessToken)
    page++
  }

  return null
}

async function fetchFortnoxCustomerFull(customerNumber: string, accessToken: string) {
  const res = await fetch(`${FORTNOX_API}/customers/${customerNumber}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json() as { Customer: any }
  return data.Customer ?? null
}

// ─── Oneflow ──────────────────────────────────────────────────────────────────

// Läs token inuti funktioner (inte på modulnivå) – Vercel sätter env efter modulinitiering
const getOneflowHeaders = () => ({
  'x-oneflow-api-token': process.env.ONEFLOW_API_TOKEN!,
  'x-oneflow-user-email': 'info@begone.se',
  Accept: 'application/json',
})


// Multi-kontrakt-refaktor (Fas 3): hämtar ALLA signerade/aktiva Oneflow-kontrakt
// för ett org.nr. Offerter (state ∉ {signed, active}) filtreras bort innan full-
// fetch så vi aldrig importerar opåskrivna kontrakt. Hämtar full kontraktsdata +
// parties parallellt.
async function fetchOneflowContractsByOrgNr(orgNr: string): Promise<Array<{ contract: any; parties: any[] }>> {
  // Org.numret lagras som ett data_field med custom_id "org-nr" i Oneflow-kontrakten
  // Använd filter[data_field_match]=org-nr:<värde> för direkt match
  // Prova både med och utan bindestreck (714800-2590 och 7148002590)
  const variants = [orgNr, orgNr.replace(/\D/g, '')]
  const uniqueVariants = [...new Set(variants)]

  let contracts: any[] = []

  for (const variant of uniqueVariants) {
    const url = `https://api.oneflow.com/v1/contracts?limit=100&offset=0&filter[data_field_match]=${encodeURIComponent(`org-nr:${variant}`)}`
    console.log(`🔍 Oneflow söker data_field_match org-nr: ${variant}`)

    const listRes = await fetch(url, { headers: getOneflowHeaders() })
    if (!listRes.ok) {
      const body = await listRes.text().catch(() => '')
      console.error(`❌ Oneflow filter API-fel: ${listRes.status}`, body)
      continue
    }

    const listData = await listRes.json() as { data: any[]; count: number }
    contracts = listData.data ?? []
    console.log(`📋 Oneflow: ${contracts.length} träff(ar) för org.nr ${variant}`)
    if (contracts.length > 0) break
  }

  if (contracts.length === 0) return []

  // Filtrera bort offerter/draft/declined — endast signerade/aktiva får importeras
  const ACTIVE_STATES = new Set(['signed', 'active'])
  const signed = contracts.filter(c => ACTIVE_STATES.has(String(c.state ?? '')))
  console.log(`✅ Filtrerade till ${signed.length} signerade/aktiva av ${contracts.length}`)
  if (signed.length === 0) return []

  // Sortera senast uppdaterat först (stabil UI-ordning)
  signed.sort((a, b) => (b.updated_time ?? '').localeCompare(a.updated_time ?? ''))

  // Hämta full contract + parties parallellt per id
  const results = await Promise.all(signed.map(async (basic) => {
    const inlineParties: any[] = Array.isArray(basic.parties) ? basic.parties : basic.parties?.data ?? []

    const fullRes = await fetch(
      `https://api.oneflow.com/v1/contracts/${basic.id}`,
      { headers: getOneflowHeaders() }
    )
    if (!fullRes.ok) {
      console.error(`❌ Oneflow full-fetch fel för ${basic.id}: ${fullRes.status}`)
      return null
    }
    const fullContract = await fullRes.json() as any

    let parties = inlineParties
    if (parties.length === 0) {
      const partiesRes = await fetch(
        `https://api.oneflow.com/v1/contracts/${basic.id}/parties`,
        { headers: getOneflowHeaders() }
      )
      if (partiesRes.ok) {
        const pd = await partiesRes.json() as any
        parties = Array.isArray(pd) ? pd : pd.data ?? []
      }
    }

    return { contract: fullContract, parties }
  }))

  return results.filter((r): r is { contract: any; parties: any[] } => r !== null)
}

const CONTRACT_TYPE_MAP: Record<string, string> = {
  '8486368': 'Skadedjursavtal',
  '8462854': 'Avtal Mekaniska fällor',
  '9324573': 'Avtal Betesstationer',
  '8465556': 'Avtal Betongstationer',
  '8732196': 'Avtal Indikationsfällor',
}

function parseContractLengthMonths(text: string | null): number {
  if (!text) return 36
  const match = text.match(/(\d+)\s*(år|year|months?|månader?)/i)
  if (!match) return 36
  const n = parseInt(match[1])
  return /år|year/i.test(match[2]) ? n * 12 : n
}

// Strict-variant: returnerar null vid okänt format. Används för normalisering
// av annual_value där fel default skulle förvränga kundens årstakt.
function parseContractLengthMonthsStrict(text: string | null | undefined): number | null {
  if (!text) return null
  const match = String(text).match(/(\d+)\s*(år|year|years|months?|månader?|månad|mån)/i)
  if (!match) return null
  const n = parseInt(match[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return /år|year/i.test(match[2]) ? n * 12 : n
}

// Returnerar total_contract_value eller null för avropsavtal.
// Null när annual_value saknas/0 eller contract_length inte kan tolkas.
function computeTotalContractValue(
  annualValue: number | string | null | undefined,
  contractLengthText: string | null | undefined
): number | null {
  const annual =
    typeof annualValue === 'string' ? parseFloat(annualValue) : annualValue
  if (annual == null || !Number.isFinite(annual) || annual <= 0) return null
  if (!contractLengthText) return null

  const match = String(contractLengthText).trim().match(/(\d+(?:[.,]\d+)?)\s*(år|year|years|months?|månader?|månad|mån|m)?/i)
  if (!match) return null

  const n = parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null

  const unit = (match[2] || '').toLowerCase()
  const months = /^(år|year|years)$/.test(unit) ? Math.round(n * 12) : Math.round(n)

  return Math.round(annual * (months / 12))
}

function extractOneflowData(contractData: { contract: any; parties: any[] }) {
  const { contract, parties } = contractData
  const customerParty = parties.find((p: any) => !p.my_party)
  const begoneParty = parties.find((p: any) => p.my_party)

  const templateId = String(contract.template?.id ?? contract.template_id ?? '')
  const contract_type = CONTRACT_TYPE_MAP[templateId] || null

  const dataFields: Record<string, string> = {}
  const fields: any[] = Array.isArray(contract.data_fields) ? contract.data_fields : []
  for (const field of fields) {
    const customId = field.custom_id || field._private_ownerside?.custom_id
    if (customId && field.value) dataFields[customId] = field.value
  }

  const contact_person =
    dataFields['Kontaktperson'] || customerParty?.participants?.[0]?.name || null
  const contact_email =
    dataFields['e-post-kontaktperson'] || customerParty?.participants?.[0]?.email || null
  const contact_phone =
    dataFields['telefonnummer-kontaktperson'] || customerParty?.participants?.[0]?.phone || null
  const contact_address = dataFields['utforande-adress'] || null
  const agreement_text = dataFields['avtalsobjekt'] || null
  const contract_start_date = parseDate(dataFields['begynnelsedag']) || null
  const contract_length = dataFields['avtalslngd'] || null
  const company_name_oneflow = dataFields['foretag'] || customerParty?.name || null

  // Säljare — BeGone-parten (my_party)
  const begoneParticipant = begoneParty?.participants?.[0]
  const sales_person = begoneParticipant?.name || null
  const sales_person_email = begoneParticipant?.email || null

  // Account Manager — Oneflow-fält "Anställd" / "E-post anställd"
  const assigned_account_manager = dataFields['anstalld'] || null
  const account_manager_email = dataFields['e-post-anstlld'] || null

  // Kontraktsslut — beräknat från start + längd
  let contract_end_date: string | null = null
  if (contract_start_date) {
    const months = parseContractLengthMonths(contract_length)
    const start = new Date(contract_start_date)
    start.setMonth(start.getMonth() + months)
    contract_end_date = start.toISOString().split('T')[0]
  }

  // Produktvärde — Oneflow-summan motsvarar avtalets TOTALVÄRDE (för hela
  // avtalstiden), inte årstakt. Normalisera till årstakt baserat på avtalslängd
  // så att resten av systemet (fakturaplan, dashboards) får konsekvent data.
  let contract_total_value: number | null = null
  const products: any[] = contract.product_groups
    ? contract.product_groups.flatMap((g: any) => g.products || [])
    : contract.products ?? []

  if (products.length > 0) {
    contract_total_value = products.reduce((sum: number, p: any) => {
      const amount = parseFloat(p.total_amount?.amount ?? p.unit_price?.amount ?? '0')
      return sum + amount * (p.quantity ?? 1)
    }, 0)
  }

  const contract_length_months = parseContractLengthMonthsStrict(contract_length)
  let annual_value: number | null = null
  if (contract_total_value && contract_total_value > 0) {
    if (contract_length_months && contract_length_months > 0) {
      annual_value = Math.round(contract_total_value * (12 / contract_length_months))
    } else {
      // Fallback: avtalslängd okänd → anta 12 mån (samma som tidigare beteende)
      annual_value = Math.round(contract_total_value)
    }
  }

  const selectedProducts = products.map((p: any) => ({
    name: p.name,
    quantity: p.quantity,
    price: parseFloat(p.unit_price?.amount ?? '0'),
    description: p.description ?? '',
  }))

  return {
    contact_person,
    contact_email,
    contact_phone,
    contact_address,
    // Multi-kontrakt-refaktor: address_label används som primär identifierare i UI
    // när en kund har flera avtal. Default = utförande-adress; kan editeras av admin.
    address_label: contact_address,
    contract_start_date,
    contract_end_date,
    contract_length,
    company_name_oneflow,
    annual_value: annual_value && annual_value > 0 ? annual_value : null,
    total_contract_value: contract_total_value,
    products: selectedProducts.length > 0 ? selectedProducts : null,
    oneflow_contract_id: String(contract.id),
    contract_type,
    agreement_text,
    sales_person,
    sales_person_email,
    assigned_account_manager,
    account_manager_email,
  }
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return null
}

// ─── Fortnox fakturor ─────────────────────────────────────────────────────────

async function fetchFortnoxInvoices(customerNumber: string, accessToken: string) {
  const url = `${FORTNOX_API}/invoices?customernumber=${encodeURIComponent(customerNumber)}&limit=20&sortby=invoicedate&sortorder=descending`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json() as { Invoices: any[] }
  return data.Invoices ?? []
}

async function fetchFortnoxInvoiceFull(docNr: string, accessToken: string) {
  const res = await fetch(`${FORTNOX_API}/invoices/${docNr}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })
  if (!res.ok) return null
  const data = await res.json() as { Invoice: any }
  return data.Invoice ?? null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Endast POST tillåtet' })

  try {
    const { action, org_nr, customer_data, selected_contracts } = req.body

    // ── CONFIRM: spara redan hämtad+redigerad data ───────────────────────────
    if (action === 'confirm') {
      if (!customer_data) {
        return res.status(400).json({ success: false, error: 'customer_data krävs för confirm' })
      }

      const normalized = normalizeOrgNr(String(customer_data.organization_number || ''))

      // Dublettkoll igen (säkerhet)
      const { data: existing } = await supabase
        .from('customers')
        .select('id, company_name')
        .eq('organization_number', normalized)
        .maybeSingle()

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'Kund finns redan i systemet',
          existing_customer: existing,
        })
      }

      // Auto-beräkna total_contract_value från annual_value × avtalslängd
      // Null för avropsavtal (saknar annual_value eller contract_length)
      const computedTotalContractValue = computeTotalContractValue(
        customer_data.annual_value,
        customer_data.contract_length
      )

      const insertPayload = {
        ...customer_data,
        organization_number: normalized,
        source_type: 'import',
        total_contract_value:
          customer_data.total_contract_value ?? computedTotalContractValue,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('customers')
        .insert(insertPayload)
        .select()
        .single()

      if (insertError || !inserted) {
        console.error('❌ DB insert fel:', insertError)
        return res.status(500).json({
          success: false,
          error: 'Kunde inte spara kunden',
          details: insertError?.message,
        })
      }

      // ── Multi-kontrakt-refaktor (Fas 3) ─────────────────────────────────
      // Om klienten skickar selected_contracts: skapa en contracts-rad per
      // kontrakt. Customers-fälten på inserted är fortfarande satta från
      // customer_data (för bakåtkompatibilitet med synth-fallback i ContractService),
      // men sanningen lever framöver per kontrakt.
      // Vid fel: rulla tillbaka customer-raden så vi inte lämnar kvarvarande state.
      let insertedContracts: any[] = []
      if (Array.isArray(selected_contracts) && selected_contracts.length > 0) {
        const contractRows = selected_contracts.map((c: any, idx: number) => {
          const contractTotalValue = computeTotalContractValue(c.annual_value, c.contract_length)
          // Beräkna contract_end_date från start + längd om saknas
          let endDate: string | null = c.contract_end_date ?? null
          if (!endDate && c.contract_start_date && c.contract_length) {
            const months = parseContractLengthMonthsStrict(c.contract_length)
            if (months) {
              const d = new Date(c.contract_start_date)
              d.setMonth(d.getMonth() + months)
              endDate = d.toISOString().split('T')[0]
            }
          }
          return {
            customer_id: inserted.id,
            oneflow_contract_id: c.oneflow_contract_id,
            source_type: 'manual',
            type: 'contract',
            status: 'active',
            template_id: 'imported',
            company_name: inserted.company_name,
            organization_number: normalized,
            contact_person: c.contact_person ?? null,
            contact_email: c.contact_email ?? null,
            contact_phone: c.contact_phone ?? null,
            contact_address: c.contact_address ?? null,
            agreement_text: c.agreement_text ?? null,
            total_value: contractTotalValue ?? c.total_contract_value ?? null,
            selected_products: c.products ?? null,
            // Nya billing-fält (Fas 1)
            annual_value: c.annual_value ?? null,
            total_contract_value: contractTotalValue ?? c.total_contract_value ?? null,
            contract_start_date: c.contract_start_date ?? null,
            contract_end_date: endDate,
            contract_length: c.contract_length ?? null,
            contract_type: c.contract_type ?? null,
            address_label: c.address_label ?? c.contact_address ?? null,
            display_order: idx,
            // Faktureringsfält ärver från customers vid import — admin justerar
            // sedan per kontrakt via BillingSettingsModal (Fas 6).
            billing_frequency: customer_data.billing_frequency ?? null,
            billing_anchor_month: customer_data.billing_anchor_month ?? null,
            billing_active: customer_data.billing_active ?? true,
            notice_period_months: customer_data.notice_period_months ?? null,
          }
        })

        const { data: contractInsertData, error: contractError } = await supabase
          .from('contracts')
          .insert(contractRows)
          .select()

        if (contractError || !contractInsertData) {
          console.error('❌ Contracts insert fel:', contractError)
          // Rollback: hard delete customer-raden
          await supabase.from('customers').delete().eq('id', inserted.id)
          return res.status(500).json({
            success: false,
            error: 'Kunde inte spara avtal — kunden rullades tillbaka',
            details: contractError?.message,
          })
        }
        insertedContracts = contractInsertData
        console.log(`✅ ${insertedContracts.length} kontrakt skapade för kund ${inserted.id}`)
      }

      return res.status(200).json({
        success: true,
        customer: inserted,
        contracts: insertedContracts,
      })
    }

    // ── PREVIEW: hämta data men spara inte ──────────────────────────────────
    if (!org_nr) {
      return res.status(400).json({ success: false, error: 'org_nr krävs' })
    }

    const normalized = normalizeOrgNr(String(org_nr))
    if (normalized.replace(/\D/g, '').length !== 10) {
      return res.status(400).json({ success: false, error: 'Ogiltigt org.nummer – måste vara 10 siffror' })
    }

    console.log('🔍 Preview för org.nr:', normalized)

    // Dublettkoll
    const { data: existing } = await supabase
      .from('customers')
      .select('id, company_name, customer_number')
      .eq('organization_number', normalized)
      .maybeSingle()

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Kund finns redan i systemet',
        existing_customer: existing,
      })
    }

    // Fortnox
    console.log('📊 Hämtar från Fortnox...')
    const fortnoxCustomer = await fetchFortnoxCustomerByOrgNr(normalized).catch(err => {
      console.error('⚠️ Fortnox-fel:', err.message)
      return null
    })

    if (!fortnoxCustomer) {
      return res.status(404).json({
        success: false,
        error: 'Kund hittades inte i Fortnox. Kontrollera att org.numret stämmer.',
      })
    }

    console.log('✅ Fortnox-kund:', fortnoxCustomer.Name)

    // Fortnox fakturor
    const accessToken = await getValidAccessToken()
    const fortnoxInvoices = await fetchFortnoxInvoices(fortnoxCustomer.CustomerNumber, accessToken).catch(err => {
      console.error('⚠️ Fortnox fakturor-fel:', err.message)
      return []
    })
    console.log(`📄 Fortnox: ${fortnoxInvoices.length} fakturor hämtade`)

    // Hämta fakturarader parallellt för alla fakturor
    const invoicesWithRows = await Promise.all(
      fortnoxInvoices.map(async (inv: any) => {
        const full = await fetchFortnoxInvoiceFull(inv.DocumentNumber, accessToken).catch(() => null)
        return { ...inv, InvoiceRows: full?.InvoiceRows ?? [] }
      })
    )
    console.log(`📄 Fortnox: raddetaljer hämtade för ${invoicesWithRows.length} fakturor`)

    // Oneflow + kundgrupp parallellt
    console.log('📋 Hämtar från Oneflow + kundgrupper...')
    const customerNumber = parseInt(fortnoxCustomer.CustomerNumber) || null

    const [oneflowDataList, customerGroupResult] = await Promise.all([
      fetchOneflowContractsByOrgNr(normalized).catch(err => {
        console.error('⚠️ Oneflow-fel:', err.message)
        return [] as Array<{ contract: any; parties: any[] }>
      }),
      customerNumber
        ? supabase
            .from('customer_groups')
            .select('id, name')
            .lte('series_start', customerNumber)
            .gte('series_end', customerNumber)
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    // Extrahera ALLA signerade/aktiva kontrakt
    const oneflowContracts = oneflowDataList.map(extractOneflowData)
    const primary = oneflowContracts[0] ?? null
    const suggestedGroup = (customerGroupResult as any)?.data ?? null
    console.log(`✅ Oneflow-kontrakt: ${oneflowContracts.length} st`)
    console.log(suggestedGroup ? `👥 Kundgrupp: ${suggestedGroup.name}` : '⚠️ Ingen kundgrupp matchad')

    // Bygg förslag på kunddata (ej sparat ännu)
    const billingParts = [
      fortnoxCustomer.Address1,
      fortnoxCustomer.Address2,
      [fortnoxCustomer.ZipCode, fortnoxCustomer.City].filter(Boolean).join(' '),
    ].filter(Boolean)

    // preview behåller första-kontraktets fält för bakåtkompatibilitet med
    // existerande UI (tills Fas 4 byter till contracts-arrayen).
    const preview = {
      company_name: fortnoxCustomer.Name,
      organization_number: normalized,
      customer_number: customerNumber,
      billing_email: fortnoxCustomer.EmailInvoice || fortnoxCustomer.Email || null,
      billing_address: billingParts.length > 0 ? billingParts.join(', ') : null,
      currency: fortnoxCustomer.Currency || 'SEK',
      is_active: fortnoxCustomer.Active !== false,
      contact_person: primary?.contact_person ?? null,
      contact_email: primary?.contact_email ?? null,
      contact_phone: primary?.contact_phone ?? null,
      contact_address: primary?.contact_address ?? null,
      contract_start_date: primary?.contract_start_date ?? null,
      contract_end_date: primary?.contract_end_date ?? null,
      contract_length: primary?.contract_length ?? null,
      annual_value: primary?.annual_value ?? null,
      products: primary?.products ?? null,
      oneflow_contract_id: primary?.oneflow_contract_id ?? null,
      contract_type: primary?.contract_type ?? null,
      agreement_text: primary?.agreement_text ?? null,
      sales_person: primary?.sales_person ?? null,
      sales_person_email: primary?.sales_person_email ?? null,
      assigned_account_manager: primary?.assigned_account_manager ?? null,
      account_manager_email: primary?.account_manager_email ?? null,
      customer_group_id: suggestedGroup?.id ?? null,
    }

    return res.status(200).json({
      success: true,
      preview,
      // Multi-kontrakt-refaktor (Fas 3): alla extraherade kontrakt. UI:t använder
      // detta i Fas 4 för att rendera väljbara kontrakt med checkboxar. När
      // contracts.length <= 1 är beteendet identiskt med tidigare.
      contracts: oneflowContracts,
      invoices: invoicesWithRows,
      sources: { fortnox: true, oneflow: oneflowContracts.length > 0 },
      suggested_group: suggestedGroup,
    })
  } catch (err: any) {
    console.error('❌ Import-fel:', err)
    return res.status(500).json({
      success: false,
      error: 'Internt serverfel',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
}
