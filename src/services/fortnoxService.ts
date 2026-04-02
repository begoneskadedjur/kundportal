// Fortnox API-klient — anropar intern proxy som hanterar auth
// Alla anrop går till /api/fortnox/proxy?path=...

async function fortnoxRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/fortnox/proxy?path=${encodeURIComponent(path)}`, {
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
  Phone1: string
  Address1: string
  ZipCode: string
  City: string
  Active: boolean
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

  async createInvoice(invoice: Record<string, unknown>): Promise<FortnoxInvoice> {
    const data = await fortnoxRequest<{ Invoice: FortnoxInvoice }>('invoices', 'POST', {
      Invoice: invoice,
    })
    return data.Invoice
  },
}
