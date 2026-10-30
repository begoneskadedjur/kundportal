// src/shared/contractWorkItems.ts
// Arbetslistan på avtalskartan (steg 10 i docs/planer/avtalsar-exakt-arsdag-teknik.md).
// Ren modul: typer, texter och länkar. Raderna kommer från RPC:n
// contract_work_items (SQL bygger instruktionen); brickorna att besluta byggs
// också på kartan ur samma regel, med addonDecideInstruction.

export type WorkItemKind =
  | 'coverage_cancelled'
  | 'coverage_conflict'
  | 'addon_decide'
  | 'addon_no_case'
  | 'gap_invoice'
  | 'anchor_verify'

export const WORK_ITEM_KINDS: WorkItemKind[] = [
  'coverage_cancelled',
  'coverage_conflict',
  'addon_decide',
  'addon_no_case',
  'gap_invoice',
  'anchor_verify',
]

/** En rad ur contract_work_items. */
export interface ContractWorkItem {
  kind: WorkItemKind
  root_customer_id: string
  root_name: string
  unit_id: string | null
  unit_name: string | null
  contract_id: string | null
  station_kind: 'outdoor' | 'indoor' | null
  station_ids: string[] | null
  station_count: number
  case_id: string | null
  case_number: string | null
  invoice_id: string | null
  invoice_number: string | null
  coverage_ids: string[] | null
  conflict_ids: string[] | null
  period_from: string | null
  period_to: string | null
  annual_kr: number | null
  v2: boolean
  instruction: string
  sort_order: number
  sort_at: string | null
}

/** Rubrik per uppgiftstyp, kort och i klartext */
export const WORK_ITEM_TITLE: Record<WorkItemKind, string> = {
  coverage_cancelled: 'Makulerad faktura',
  coverage_conflict: 'Dubbel täckning',
  addon_decide: 'Tillägg att besluta',
  addon_no_case: 'Station utan ärende',
  gap_invoice: 'Faktura att skapa',
  anchor_verify: 'Avtalsdag att kontrollera',
}

export function isWorkItemKind(v: string | null | undefined): v is WorkItemKind {
  return !!v && (WORK_ITEM_KINDS as string[]).includes(v)
}

/**
 * Samma text som SQL-funktionen ger för addon_decide. Gamla avtal får inte
 * meningen om pro rata: där skapas pro rata vid utsättningen som förut.
 */
export function addonDecideInstruction(count: number, unitName: string, v2: boolean): string {
  const st = count === 1 ? 'tilläggsstation' : 'tilläggsstationer'
  return (
    `${count} ${st} på ${unitName} väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg.` +
    (v2 ? ' Pro rata skapas först efter beslutet.' : '')
  )
}

/** Sortering som i SQL: typens ordning, sedan äldst först */
export function sortWorkItems<T extends Pick<ContractWorkItem, 'sort_order' | 'sort_at'>>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    if (a.sort_at && b.sort_at) return a.sort_at.localeCompare(b.sort_at)
    if (a.sort_at) return -1
    if (b.sort_at) return 1
    return 0
  })
}

export interface WorkItemLinkIds {
  rootId: string
  contractId?: string | null
  unitId?: string | null
}

/**
 * Direktlänk till kartan på rätt ställe:
 * ?tab=avtalskarta&panel=innehall&todo=<kind>&contract=<id>&unit=<id>
 * base = '/admin' eller '/koordinator'.
 */
export function buildWorkItemLink(base: string, kind: WorkItemKind | null, ids: WorkItemLinkIds): string {
  const q = new URLSearchParams()
  q.set('tab', 'avtalskarta')
  q.set('panel', kind === 'anchor_verify' ? 'fakturering' : 'innehall')
  if (kind) q.set('todo', kind)
  if (ids.contractId) q.set('contract', ids.contractId)
  if (ids.unitId) q.set('unit', ids.unitId)
  return `${base}/befintliga-kunder/${ids.rootId}?${q.toString()}`
}

export interface WorkItemTarget {
  kind: WorkItemKind | null
  contractId: string | null
  unitId: string | null
}

/** Läser ?todo=, ?contract= och ?unit= ur en querysträng */
export function parseWorkItemLink(search: string): WorkItemTarget | null {
  const q = new URLSearchParams(search)
  const todo = q.get('todo')
  const contractId = q.get('contract')
  const unitId = q.get('unit')
  if (!todo && !contractId && !unitId) return null
  return { kind: isWorkItemKind(todo) ? todo : null, contractId: contractId || null, unitId: unitId || null }
}

/** Första uppgiften för en kund, för notisens länk */
export function firstWorkItemFor(items: ContractWorkItem[], rootId: string): ContractWorkItem | null {
  return sortWorkItems(items.filter((i) => i.root_customer_id === rootId))[0] ?? null
}

/** Texten för kundlistan och notisen: "3 att göra på avtalskartan" */
export function workItemsCountLabel(n: number): string {
  return `${n} att göra på avtalskartan`
}
