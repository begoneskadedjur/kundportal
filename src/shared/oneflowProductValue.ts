// src/shared/oneflowProductValue.ts
// Avtalets värde ur Oneflows produkttabell (3.102.0). Värdet räknas på den
// priskolumn som SYNS i avtalet, efter rabatt, gånger antal. Förut läste
// webhooken alltid price_1 även när mallen döljer den kolumnen: Anlos 2 fick
// 5 x 4 792 = 23 960 kr i stället för avtalets 5 x 5 592 = 27 960 kr
// (Oneflow 15085113, mall 8462854 med "Pris" dold och "Pris totalt" synlig).
//
// Oneflow: price.amount är priset efter rabatt, base_amount listpriset,
// discount_percent och discount_amount är ömsesidigt uteslutande
// (developer.oneflow.com/docs/product). Wizarden skriver samma pris i
// price_1 och price_2 (api/oneflow/create-contract.ts).
//
// Wizardens avtal räknas som förut med wizardProductsValue: price_1 gånger
// antal. Äldre ROT-offerter (före 3.127.0) kunde ha ett annat belopp i den
// dolda price_1. Sedan 3.127.0 skickar ROT/RUT-mallarna samma pris inkl. moms
// i båda kolumnerna (api/oneflow/create-contract.ts), så wizardProductsValue
// blir den synliga summan inkl. moms för dem. oneflowProductsValue gäller avtal
// som skapats direkt i Oneflow, och premien från dem ska bekräftas.
//
// ROT/RUT-offerter sedan 3.127.5 (variant D) har två synliga priskolumner:
// price_1 "Pris inkl. moms" och price_2 "Att betala efter ROT/RUT". Värdet
// är price_1, totalen före avdrag (visiblePriceKey väljer price_1 när den
// syns, och arRotRutGrupp talar om för synkarna att inte läsa price_2).
// Variant B (3.127.3) hade en avdragsrad sist ("ROT-avdrag 30 %", listpris 0,
// rabatt = avdraget). Den räknas aldrig in i värdet men finns kvar i rows
// (avdragsrad: true) så att webhookens kontroll ser den.

import { arAvdragsradNamn, arKolumnEfterAvdrag } from './rotRutOffert'

type Amount = { amount?: string | number | null } | null | undefined

export interface OneflowPrice {
  amount?: Amount
  base_amount?: Amount
  discount_amount?: Amount
  discount_percent?: string | number | null
}

export interface OneflowProduct {
  name?: string | null
  price_1?: OneflowPrice | null
  price_2?: OneflowPrice | null
  quantity?: { amount?: number | string | null; type?: string | null } | null
}

export interface OneflowProductGroup {
  products?: OneflowProduct[] | null
  configuration?: { columns?: Array<{ key?: string; enabled?: boolean; label?: string | null }> | null } | null
  enabled_columns?: Array<{ key?: string; enabled?: boolean; label?: string | null }> | null
}

export type PriceKey = 'price_1' | 'price_2'

export interface ProductValueRow {
  name: string
  priceKey: PriceKey
  /** Pris per enhet efter rabatt */
  unitPrice: number
  /** Listpris per enhet före rabatt */
  listPrice: number
  quantity: number
  /** unitPrice x quantity */
  total: number
  /** price_1 efter rabatt gånger antal */
  total1: number
  /** price_2 efter rabatt gånger antal */
  total2: number
  /** ROT/RUT-offertens avdragsrad (variant B): ingår aldrig i totalen */
  avdragsrad: boolean
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function amountOf(a: Amount): number | null {
  return a == null ? null : toNumber(a.amount)
}

function columnEnabled(group: OneflowProductGroup, key: string): boolean | null {
  const cols = group.configuration?.columns ?? group.enabled_columns
  if (!Array.isArray(cols)) return null
  const col = cols.find(c => c?.key === key)
  return col ? col.enabled === true : null
}

/**
 * ROT/RUT-offertens produktgrupp (variant D, 3.127.5): price_2 heter
 * "Att betala efter ROT" eller "Att betala efter RUT". Värdet är då price_1.
 */
export function arRotRutGrupp(group: OneflowProductGroup | null | undefined): boolean {
  if (!group) return false
  const cols = group.configuration?.columns ?? group.enabled_columns
  return Array.isArray(cols) && cols.some(c => c?.key === 'price_2' && arKolumnEfterAvdrag(c.label))
}

/**
 * Priskolumnen som syns i avtalet. price_1 när den syns (wizardens mallar),
 * annars price_2 när den syns. Saknas kolumninställning: price_1.
 */
export function visiblePriceKey(group: OneflowProductGroup): PriceKey {
  const p1 = columnEnabled(group, 'price_1')
  const p2 = columnEnabled(group, 'price_2')
  if (p1 === true) return 'price_1'
  if (p2 === true) return 'price_2'
  return 'price_1'
}

/** Pris per enhet efter rabatt. amount i första hand, annars listpris minus rabatt. */
export function netUnitPrice(price: OneflowPrice | null | undefined): number {
  if (!price) return 0
  const amount = amountOf(price.amount)
  if (amount != null) return amount
  const base = amountOf(price.base_amount) ?? 0
  const pct = toNumber(price.discount_percent)
  if (pct != null && pct > 0) return Math.round(base * (1 - pct / 100) * 100) / 100
  const off = amountOf(price.discount_amount)
  return off != null && off > 0 ? Math.max(0, base - off) : base
}

/**
 * ROT/RUT-offertens avdragsrad (3.127.3): namnet "ROT-avdrag 30 %" eller
 * "RUT-avdrag 50 %" och listpris 0. Ingår aldrig i avtalets värde.
 */
export function arAvdragsrad(product: OneflowProduct | null | undefined): boolean {
  if (!product || !arAvdragsradNamn(product.name)) return false
  const price = product.price_1 ?? product.price_2
  return (amountOf(price?.base_amount) ?? 0) === 0
}

/** Avdragsradens belopp per enhet (negativt). Oneflow ger amount, annars listpris minus rabatt. */
function avdragsradUnitPrice(price: OneflowPrice | null | undefined): number {
  if (!price) return 0
  const amount = amountOf(price.amount)
  if (amount != null) return amount
  return (amountOf(price.base_amount) ?? 0) - (amountOf(price.discount_amount) ?? 0)
}

function listUnitPrice(price: OneflowPrice | null | undefined): number {
  if (!price) return 0
  return amountOf(price.base_amount) ?? amountOf(price.amount) ?? 0
}

function quantityOf(p: OneflowProduct): number {
  const q = toNumber(p.quantity?.amount)
  return q == null ? 1 : q
}

/**
 * Värdet per produkt och totalt, som avtalets "Pris totalt"-rad i Oneflow.
 * Faller tillbaka till den andra priskolumnen om den synliga saknar pris.
 */
export function oneflowProductsValue(groups: OneflowProductGroup[] | null | undefined): {
  total: number
  rows: ProductValueRow[]
} {
  const rows: ProductValueRow[] = []
  for (const group of groups ?? []) {
    const visible = visiblePriceKey(group)
    const other: PriceKey = visible === 'price_1' ? 'price_2' : 'price_1'
    for (const product of group.products ?? []) {
      const avdragsrad = arAvdragsrad(product)
      const unitOf = avdragsrad ? avdragsradUnitPrice : netUnitPrice
      let key = visible
      let unit = unitOf(product[visible])
      if (!product[visible] && product[other]) {
        key = other
        unit = unitOf(product[other])
      }
      const quantity = quantityOf(product)
      rows.push({
        name: product.name ?? '',
        priceKey: key,
        unitPrice: unit,
        listPrice: listUnitPrice(product[key]),
        quantity,
        total: Math.round(unit * quantity * 100) / 100,
        total1: Math.round(unitOf(product.price_1) * quantity * 100) / 100,
        total2: Math.round(unitOf(product.price_2) * quantity * 100) / 100,
        avdragsrad,
      })
    }
  }
  const total = Math.round(rows.filter(r => !r.avdragsrad).reduce((s, r) => s + r.total, 0) * 100) / 100
  return { total, rows }
}


/**
 * Wizardens beräkning, oförändrad sedan före 3.102.0: price_1 efter rabatt
 * gånger antal. ROT/RUT-offertens avdragsrad räknas inte (3.127.3).
 */
export function wizardProductsValue(groups: OneflowProductGroup[] | null | undefined): number {
  let total = 0
  for (const group of groups ?? []) {
    for (const product of group.products ?? []) {
      if (arAvdragsrad(product)) continue
      const price = toNumber(product.price_1?.amount?.amount) ?? 0
      const q = toNumber(product.quantity?.amount)
      total += price * (q == null || q === 0 ? 1 : q)
    }
  }
  return Math.round(total * 100) / 100
}
