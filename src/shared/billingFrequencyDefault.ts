// src/shared/billingFrequencyDefault.ts
// Faktureringsintervall när ett avtal skapas ur kundkortet (steg 13 i
// docs/planer/avtalsar-exakt-arsdag-teknik.md, "Ingen tyst månadsfakturering").
//
// Bakgrund: customers.billing_frequency hade standardvärdet 'monthly', så
// kundrader som ingen tagit ställning till stod som månadsvis. Avtal som
// skapades ur kundkortet ärvde värdet rakt av (så fick Falu månadsfakturering).
//
// Regeln, med Christians beslut 2026-10-30 (årsvis är standard om inget
// motsäger det; kunder utan premie sätts tills vidare till årsvis; avrop
// faktureras per ärende eller samlat per månad, inte med ett intervall):
// - Avropsavtal: inget intervall.
// - Avtal med premie: kundradens intervall ärvs om det finns, annars årsvis.
//   Båda fallen ber om kontroll på avtalet, eftersom ingen valt intervallet
//   för just det här avtalet.
// - Avtal utan premie: årsvis (tilläggen följer avtalsåret), ingen kontroll
//   eftersom intervallet bara styr tilläggsstationer.

export type BillingFrequencyValue = 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'on_demand'

const PERIODIC = new Set(['monthly', 'quarterly', 'semi_annual', 'annual'])

export function isAvropContractType(t: string | null | undefined): boolean {
  return !!t && /^avropsavtal/i.test(t.trim())
}

export interface MaterializedFrequency {
  value: BillingFrequencyValue | null
  /** Värdet valdes inte för avtalet: kompletthetsraden ber om kontroll */
  needsCheck: boolean
}

export function materializedBillingFrequency(input: {
  customerFrequency: string | null | undefined
  annualValue: number | null | undefined
  contractType: string | null | undefined
}): MaterializedFrequency {
  if (isAvropContractType(input.contractType)) return { value: null, needsCheck: false }
  const annual = Number(input.annualValue ?? 0)
  if (annual > 0) {
    const inherited = input.customerFrequency && PERIODIC.has(input.customerFrequency) ? input.customerFrequency : null
    return { value: (inherited ?? 'annual') as BillingFrequencyValue, needsCheck: true }
  }
  return { value: 'annual', needsCheck: false }
}
