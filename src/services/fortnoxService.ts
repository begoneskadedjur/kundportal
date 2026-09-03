// Fortnox API-klient — anropar intern proxy som hanterar auth
// Alla anrop går till /api/fortnox/proxy?path=...

import { supabase, getAuthHeaders } from '../lib/supabase'
import { buildFortnoxCustomerCard, orgDigits } from '../shared/fortnoxCustomerNumbers'

async function fortnoxRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  // Dela upp path och query-parametrar så de enkodas korrekt var för sig
  const [basePath, queryString] = path.split('?')
  const proxyUrl = queryString
    ? `/api/fortnox/proxy?path=${encodeURIComponent(basePath)}&${queryString}`
    : `/api/fortnox/proxy?path=${encodeURIComponent(basePath)}`
  const res = await fetch(proxyUrl, {
    method,
    headers: await getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }))
    // Fortnox felstruktur: { ErrorInformation: { message, code } } eller { error: string }
    const message =
      errBody?.ErrorInformation?.message ||
      errBody?.error ||
      `Fortnox API-fel: ${res.status}`
    const err = new Error(message) as Error & { status: number }
    err.status = res.status
    throw err
  }

  return res.json()
}

export interface FortnoxCustomer {
  CustomerNumber: string
  Name: string
  OrganisationNumber: string
  Email: string
  EmailInvoice: string
  EmailInvoiceBCC: string
  Phone1: string
  Phone2: string
  Fax: string
  WWW: string
  Address1: string
  Address2: string
  ZipCode: string
  City: string
  Country: string
  CountryCode: string
  DeliveryName: string
  DeliveryAddress1: string
  DeliveryAddress2: string
  DeliveryZipCode: string
  DeliveryCity: string
  DeliveryCountry: string
  DeliveryPhone: string
  Active: boolean
  CustomerType: string
  Comments: string
  Currency: string
  PriceList: string
  PaymentTerms: string
  VATType: string
  OurReference: string
  YourReference: string
  CostCenter: string
  Project: string
  CreditLimit: number
  InvoiceDiscount: number
  GLN: string
}

export interface FortnoxInvoice {
  DocumentNumber: string
  CustomerNumber: string
  CustomerName: string
  Total: number
  Balance: number
  DueDate: string
  InvoiceDate: string
  Sent: boolean
  FinalPayDate: string | null
}

export interface FortnoxInvoiceRow {
  ArticleNumber: string | null
  Description: string
  DeliveredQuantity: number | string
  Price: number | string
  Total: number | string
  VAT: number | string
  Discount?: number | string
}

/** Fakturan som GET /invoices/{nr} ger: huvud + rader. */
export interface FortnoxInvoiceDetail extends FortnoxInvoice {
  Net: number | string
  TotalVAT: number | string
  Booked: boolean
  Cancelled: boolean
  YourReference: string | null
  OurReference: string | null
  ExternalInvoiceReference1: string | null
  Remarks: string | null
  OrganisationNumber?: string | null
  InvoiceRows: FortnoxInvoiceRow[]
}

// Adress- och personnummerhjälparna bor i src/shared så servern
// (allocate-customer) bygger kundkortet exakt som frontend.
export { parseSwedishAddress, isPersonnummer } from '../shared/fortnoxCustomerNumbers'

export const FortnoxService = {
  // Anslutningsstatus
  async getConnectionStatus(): Promise<{ connected: boolean; companyName?: string }> {
    try {
      const data = await fortnoxRequest<{ CompanyInformation: { CompanyName: string } }>(
        'companyinformation'
      )
      return { connected: true, companyName: data.CompanyInformation.CompanyName }
    } catch {
      return { connected: false }
    }
  },

  // Kunder
  async getCustomers(page = 1): Promise<{ customers: FortnoxCustomer[]; totalPages: number }> {
    const data = await fortnoxRequest<{
      Customers: FortnoxCustomer[]
      MetaInformation: { '@TotalPages': number }
    }>(`customers?page=${page}&limit=100`)
    return {
      customers: data.Customers ?? [],
      totalPages: data.MetaInformation?.['@TotalPages'] ?? 1,
    }
  },

  async getCustomer(customerNumber: string): Promise<FortnoxCustomer> {
    const data = await fortnoxRequest<{ Customer: FortnoxCustomer }>(`customers/${customerNumber}`)
    return data.Customer
  },

  async createCustomer(customer: Partial<FortnoxCustomer>): Promise<FortnoxCustomer> {
    const data = await fortnoxRequest<{ Customer: FortnoxCustomer }>('customers', 'POST', {
      Customer: customer,
    })
    return data.Customer
  },

  async updateCustomer(
    customerNumber: string,
    customer: Partial<FortnoxCustomer>
  ): Promise<FortnoxCustomer> {
    const data = await fortnoxRequest<{ Customer: FortnoxCustomer }>(
      `customers/${customerNumber}`,
      'PUT',
      { Customer: customer }
    )
    return data.Customer
  },

  // Fakturor
  async getInvoices(customerNumber?: string): Promise<FortnoxInvoice[]> {
    const path = customerNumber
      ? `invoices?customernumber=${customerNumber}`
      : 'invoices'
    const data = await fortnoxRequest<{ Invoices: FortnoxInvoice[] }>(path)
    return data.Invoices ?? []
  },

  /**
   * En faktura med rader, för import av redan fakturerade avtalsperioder
   * (avtalskartan § 7: "koppla Fortnox-faktura").
   */
  async getInvoice(documentNumber: string | number): Promise<FortnoxInvoiceDetail> {
    const data = await fortnoxRequest<{ Invoice: FortnoxInvoiceDetail }>(`invoices/${documentNumber}`)
    return data.Invoice
  },

  async createInvoice(invoice: Record<string, unknown>): Promise<FortnoxInvoice> {
    const data = await fortnoxRequest<{ Invoice: FortnoxInvoice }>('invoices', 'POST', {
      Invoice: invoice,
    })
    return data.Invoice
  },

  async cancelInvoice(documentNumber: string): Promise<void> {
    await fortnoxRequest(`invoices/${documentNumber}/cancel`, 'PUT')
  },

  // Hämta eller skapa kund i Fortnox baserat på vårt customer_number.
  // Befintliga Fortnox-kunder lämnas orörda (ekonomi äger deras inställningar);
  // de extra fälten används bara när kunden skapas.
  async findOrCreateCustomer(customer: {
    customer_number: number
    company_name: string
    organization_number?: string | null
    billing_email?: string | null
    billing_address?: string | null
    phone?: string | null
    // 'PRIVATE' | 'COMPANY'. Utelämnad → härleds från org-/personnummer.
    customer_type?: 'PRIVATE' | 'COMPANY'
    // Kod i Fortnox betalningsvillkor, t.ex. '10' | '20' | '30'
    terms_of_payment?: string | null
    // "Priser inkl. moms" på kundkortet (privatpersoner = true)
    show_price_vat_included?: boolean
    // Vår referens — teknikerns namn
    our_reference?: string | null
    // Opt-in: kräv att befintlig Fortnox-kund på numret har SAMMA org-/personnummer.
    // Utan flaggan används numret så fort det finns (avtalsflödet, oförändrat).
    verify_organization_number?: boolean
  }): Promise<string> {
    const customerNumberStr = String(customer.customer_number)

    // Försök hämta befintlig kund
    let existing: FortnoxCustomer | null = null
    try {
      const res = await fortnoxRequest<{ Customer: FortnoxCustomer }>(`customers/${customerNumberStr}`)
      existing = res?.Customer ?? null
    } catch {
      existing = null // Kund finns inte — skapa ny
    }

    if (existing?.CustomerNumber) {
      if (customer.verify_organization_number) {
        const ours = orgDigits(customer.organization_number)
        const theirs = orgDigits(existing.OrganisationNumber)
        if (ours && theirs && ours !== theirs) {
          throw new Error(
            `Kundnummer ${customerNumberStr} tillhör "${existing.Name}" (${existing.OrganisationNumber}) i Fortnox, ` +
            `inte ${customer.company_name}. Rätta kundnumret på kundkortet innan fakturan skickas.`
          )
        }
      }
      return existing.CustomerNumber
    }

    // Skapa ny kund i Fortnox med vårt kundnummer. Kortet byggs av samma
    // funktion som serverns allocate-customer (org.nr-format, adressdelning,
    // betalningsvillkor).
    const { card } = buildFortnoxCustomerCard({
      name: customer.company_name,
      organization_number: customer.organization_number,
      billing_email: customer.billing_email,
      billing_address: customer.billing_address,
      phone: customer.phone,
      customer_type: customer.customer_type,
      terms_of_payment: customer.terms_of_payment,
      show_price_vat_included: customer.show_price_vat_included,
      our_reference: customer.our_reference,
    })
    const newCustomer = await fortnoxRequest<{ Customer: FortnoxCustomer }>('customers', 'POST', {
      Customer: { CustomerNumber: customerNumberStr, ...card },
    })
    return newCustomer.Customer.CustomerNumber
  },

  // Registrera ROT/RUT-avdrag (fastighetsbeteckning + belopp) för en skapad
  // faktura. Fortnox kräver detta som separat resurs — fakturan bär bara
  // TaxReductionType + husarbetesflaggor per rad.
  async createTaxReduction(reduction: {
    asked_amount: number
    customer_name: string
    property_designation: string
    document_number: string
    social_security_number?: string | null
    residence_association_org_nr?: string | null
  }): Promise<void> {
    await fortnoxRequest('taxreductions', 'POST', {
      TaxReduction: {
        AskedAmount: Math.round(reduction.asked_amount),
        CustomerName: reduction.customer_name,
        PropertyDesignation: reduction.property_designation,
        ReferenceDocumentType: 'INVOICE',
        ReferenceNumber: reduction.document_number,
        ...(reduction.social_security_number
          ? { SocialSecurityNumber: reduction.social_security_number }
          : {}),
        ...(reduction.residence_association_org_nr
          ? { ResidenceAssociationOrganisationNumber: reduction.residence_association_org_nr }
          : {}),
      },
    })
  },

  // Hämta eller skapa artikel i Fortnox baserat på vårt article_code
  async findOrCreateArticle(article: {
    code: string
    name: string
    unit?: string | null
    vat_rate?: number | string | null
  }): Promise<string> {
    // Försök hämta befintlig artikel — ignorera bara 404
    try {
      const existing = await fortnoxRequest<{ Article: { ArticleNumber: string } }>(
        `articles/${encodeURIComponent(article.code)}`
      )
      if (existing?.Article?.ArticleNumber) {
        return existing.Article.ArticleNumber
      }
    } catch (err) {
      // Kasta vidare om det inte är 404
      if ((err as any)?.status !== 404) throw err
    }

    // Fortnox kräver VAT som heltal (25, inte "25.00")
    const vatNum = article.vat_rate != null ? Math.round(Number(article.vat_rate)) : null

    const newArticle = await fortnoxRequest<{ Article: { ArticleNumber: string } }>('articles', 'POST', {
      Article: {
        ArticleNumber: article.code,
        Description: article.name,
        Type: 'SERVICE',
        ...(article.unit ? { Unit: article.unit } : {}),
        ...(vatNum != null ? { VAT: vatNum } : {}),
      },
    })
    return newArticle.Article.ArticleNumber
  },

  // Säkerställer att alla artiklar i fakturaraderna finns i Fortnox.
  // Slår först upp i services-tabellen (tjänsteutbudet), faller tillbaka på
  // articles-tabellen för gamla artikel-rader. Kör findOrCreateArticle
  // parallellt för varje unik kod — idempotent tack vare GET-före-POST.
  async ensureArticlesExistForInvoiceItems(
    items: Array<{ article_code: string | null; article_name: string; vat_rate: number }>
  ): Promise<void> {
    const uniqueCodes = Array.from(
      new Set(items.map(i => i.article_code).filter((c): c is string => !!c))
    )
    if (uniqueCodes.length === 0) return

    // Slå upp primärt i services (tjänsteutbudet)
    const { data: servicesData } = await supabase
      .from('services')
      .select('code, name, unit')
      .in('code', uniqueCodes)
    const serviceMap = new Map((servicesData || []).map(s => [s.code, s]))

    // Fall tillbaka på articles för koder som inte finns i services
    const missing = uniqueCodes.filter(c => !serviceMap.has(c))
    const articleMap = new Map<string, { code: string; name: string; unit: string | null }>()
    if (missing.length > 0) {
      const { data: articlesData } = await supabase
        .from('articles')
        .select('code, name, unit')
        .in('code', missing)
      for (const a of articlesData || []) articleMap.set(a.code, a)
    }

    await Promise.all(
      uniqueCodes.map(async code => {
        const source = serviceMap.get(code) || articleMap.get(code)
        const fallbackItem = items.find(i => i.article_code === code)
        try {
          await this.findOrCreateArticle({
            code,
            name: source?.name || fallbackItem?.article_name || code,
            unit: source?.unit || 'st',
            vat_rate: fallbackItem?.vat_rate ?? 25,
          })
        } catch (err: any) {
          // 409 Conflict = artikeln finns redan → behandla som ok
          if (err?.status === 409) return
          throw new Error(
            `Kunde inte synka artikel ${code} till Fortnox: ${err?.message || 'okänt fel'}`
          )
        }
      })
    )
  },
}
