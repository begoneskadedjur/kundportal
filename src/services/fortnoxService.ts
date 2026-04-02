// Fortnox API-klient — anropar intern proxy som hanterar auth
// Alla anrop går till /api/fortnox/proxy?path=...

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
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Fortnox API-fel: ${res.status}`)
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
    }>(`customers?page=${page}&limit=100&customernumberto=6999`)
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

  async createInvoice(invoice: Record<string, unknown>): Promise<FortnoxInvoice> {
    const data = await fortnoxRequest<{ Invoice: FortnoxInvoice }>('invoices', 'POST', {
      Invoice: invoice,
    })
    return data.Invoice
  },
}
