// src/components/technician/ny/arendeMappning.ts
// Mappning av en cases-rad till modalernas caseData. Används av OppnaArende
// och av Mina rapporter (RapportForArende), så att rapporten byggs på samma data.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Rad = any

/** Samma mappning som TechnicianSchedule.fetchScheduledCases för avtalsärenden */
export function mappaAvtalsarende(c: Rad, technicianId: string | null | undefined): Rad {
  const customer = c.customer || {}
  const caseType = c.service_type === 'inspection' ? 'inspection'
    : c.service_type === 'establishment' ? 'establishment'
    : c.service_type === 'rondering_trafikkontoret' ? 'rondering'
    : c.service_type === 'egenkontroll_trafikkontoret' ? 'egenkontroll'
    : 'contract'
  return {
    ...c,
    start_date: c.scheduled_start,
    due_date: c.scheduled_end,
    primary_assignee_id: c.primary_technician_id,
    primary_assignee_name: c.primary_technician_name,
    primary_assignee_email: c.primary_technician_email,
    secondary_assignee_id: c.secondary_technician_id || null,
    secondary_assignee_name: c.secondary_technician_name || null,
    tertiary_assignee_id: c.tertiary_technician_id || null,
    tertiary_assignee_name: c.tertiary_technician_name || null,
    technician_role: c.secondary_technician_id === technicianId ? 'secondary'
      : c.tertiary_technician_id === technicianId ? 'tertiary' : 'primary',
    adress: customer.contact_address || c.address?.formatted_address || c.address,
    kontaktperson: customer.contact_person || c.contact_person,
    telefon_kontaktperson: customer.contact_phone || c.contact_phone,
    email: customer.contact_email || c.contact_email,
    skadedjur: c.pest_type,
    annat_skadedjur: c.other_pest_type,
    status: c.status,
    case_price: c.price,
    case_type: caseType,
    service_type: c.service_type,
    bestallare: customer.company_name,
    organization_number: customer.organization_number,
  }
}
