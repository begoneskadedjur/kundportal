// src/shared/caseMarking.ts
// Ärendemärkningen (Arbetsorder nr, Objekt, Rum nr) på Fortnox-fakturan.
//
// Kunder som Falu kommun kräver arbetsorder och objekt på fakturan. Förut
// följde bara märkningen (invoice_marking) med som Er referens; arbetsorder
// och objekt visades i portalen och på arbetsrapporten men nådde aldrig
// fakturan (Peter 2026-10-22, faktura 1060). När fakturor skrevs för hand
// låg de i Ert ordernummer ("127070 och objekt 10551") och som textrad.
// Samma sak görs nu automatiskt.
//
// Fortnox gränser: YourOrderNumber högst 30 tecken, radtext högst 50.

export interface CaseMarkingValues {
  work_order_number?: string | null
  work_object?: string | null
  room_number?: string | null
}

export interface CaseMarkingOnInvoice {
  /** Fortnox Ert ordernummer, högst 30 tecken. Null när inget finns. */
  orderNumber: string | null
  /** Textrad överst på fakturan, högst 50 tecken. Null när inget finns. */
  rowText: string | null
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').replace(/\s+/g, ' ').trim()
  return t || null
}

const cut = (s: string, max: number) => (s.length <= max ? s : s.slice(0, max).trimEnd())

export function caseMarkingOnInvoice(values: CaseMarkingValues): CaseMarkingOnInvoice {
  const order = clean(values.work_order_number)
  const object = clean(values.work_object)
  const room = clean(values.room_number)
  if (!order && !object && !room) return { orderNumber: null, rowText: null }

  // Ert ordernummer: arbetsordern först, sedan objekt och rum med etikett
  const orderParts = [order, object ? `objekt ${object}` : null, room ? `rum ${room}` : null].filter(Boolean) as string[]
  // Radtext: varje värde med sin etikett
  const rowParts = [order ? `Arbetsorder ${order}` : null, object ? `objekt ${object}` : null, room ? `rum ${room}` : null].filter(Boolean) as string[]
  const rowText = rowParts.join(', ')

  return {
    orderNumber: cut(orderParts.join(' '), 30),
    rowText: cut(rowText.charAt(0).toUpperCase() + rowText.slice(1), 50),
  }
}
