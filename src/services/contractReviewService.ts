// src/services/contractReviewService.ts
// Kontrollerat avtal (2026-10-28), se src/shared/contractReview.ts.
//
// markReviewed sparar en ögonblicksbild av avtalets fakturafält och vem som
// kontrollerade. getReviewStates jämför bilden med nuläget för en lista avtal i
// en fråga per 100 avtal (kund och premietrappa hämtas inbäddade, inga N+1).
// Ingenting spärras; märkningen är en hjälp för den som godkänner.
import { supabase } from '../lib/supabase'
import { toLocalISOStringWithOffset } from '../utils/dateHelpers'
import {
  buildReviewSnapshot,
  combineReviewStates,
  parseReviewSnapshot,
  reviewChecklist,
  reviewState,
  type ReviewSnapshot,
  type ReviewStateKind,
} from '../shared/contractReview'

/** Avtalet med det som behövs för bilden, kund och trappa inbäddade. */
export const REVIEW_CONTRACT_SELECT =
  'id, customer_id, oneflow_contract_id, annual_value, billing_frequency, billing_anchor_month, billing_anchor_mode, addon_rules, contract_start_date, start_date, contract_length, contract_type, display_name, reviewed_at, reviewed_by_name, review_snapshot, ' +
  'customer:customers!contracts_customer_id_fkey(customer_number, organization_number), ' +
  'premium_events:contract_premium_events(event_type, annual_value, effective_from)'

export interface ReviewContractRow {
  id: string
  customer_id: string | null
  oneflow_contract_id: string | null
  annual_value: number | string | null
  billing_frequency: string | null
  billing_anchor_month: number | null
  billing_anchor_mode?: string | null
  addon_rules?: string | null
  contract_start_date: string | null
  start_date: string | null
  contract_length: string | null
  contract_type: string | null
  display_name: string | null
  reviewed_at?: string | null
  reviewed_by_name?: string | null
  review_snapshot?: unknown
  customer: { customer_number: number | string | null; organization_number: string | null } | null
  premium_events: { event_type: string; annual_value: number | string | null; effective_from: string }[] | null
}

export interface ContractReviewInfo {
  contractId: string
  /** Kunden avtalet sitter på (avtalskartan öppnas där) */
  customerId: string | null
  state: ReviewStateKind
  /** Ändringarna sedan kontrollen (bara i läget 'andrad') */
  changes: string[]
  reviewedAt: string | null
  reviewedByName: string | null
  oneflowContractId: string | null
  /** Bilden vid kontrollen, null om avtalet aldrig kontrollerats */
  snapshot: ReviewSnapshot | null
}

export interface InvoiceReviewInfo {
  state: ReviewStateKind
  /** Avtalen bakom fakturan (flera vid samlad faktura) */
  contracts: ContractReviewInfo[]
}

/** Kolumnerna finns inte än (migrationen 20261028_avtal_kontrollerat ej körd). */
const isMissingColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42703' || /review(ed)?_/.test(error.message ?? ''))

const CHUNK = 100
const chunks = <T>(list: T[], size = CHUNK): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** Bilden av avtalet som det ser ut nu. Delas med skriptet markera18.ts. */
export function snapshotFromRow(row: ReviewContractRow): ReviewSnapshot {
  return buildReviewSnapshot({
    contract: row,
    premiumEvents: row.premium_events ?? [],
    customer: row.customer,
  })
}

export function reviewInfoFromRow(row: ReviewContractRow): ContractReviewInfo {
  const snapshot = parseReviewSnapshot(row.review_snapshot)
  const { state, changes } = reviewState(snapshot, snapshotFromRow(row))
  return {
    contractId: row.id,
    customerId: row.customer_id ?? null,
    state,
    changes,
    reviewedAt: row.reviewed_at ?? null,
    reviewedByName: row.reviewed_by_name ?? null,
    oneflowContractId: row.oneflow_contract_id ?? null,
    snapshot,
  }
}

export class ContractReviewService {
  /** Läget per avtal. Avtal som saknas i svaret (eller före migrationen) räknas som 'ej'. */
  static async getReviewStates(contractIds: ReadonlyArray<string>): Promise<Map<string, ContractReviewInfo>> {
    const ids = [...new Set(contractIds.filter(Boolean))]
    const result = new Map<string, ContractReviewInfo>()
    if (ids.length === 0) return result
    const responses = await Promise.all(
      chunks(ids).map((part) => supabase.from('contracts').select(REVIEW_CONTRACT_SELECT).in('id', part))
    )
    for (const { data, error } of responses) {
      if (error) {
        if (isMissingColumn(error)) return result
        throw new Error(error.message)
      }
      for (const row of (data ?? []) as unknown as ReviewContractRow[]) {
        result.set(row.id, reviewInfoFromRow(row))
      }
    }
    return result
  }

  /**
   * Läget per faktura. Avtalen läses ur invoices.contract_id och, för samlade
   * fakturor, ur invoice_items.contract_id. Alla avtal 'ok' ger grönt, något
   * 'andrad' ger gult. Fakturor utan avtal saknas i svaret.
   */
  static async getInvoiceReviewStates(
    invoices: ReadonlyArray<{ id: string; contract_id?: string | null }>
  ): Promise<Map<string, InvoiceReviewInfo>> {
    const byInvoice = new Map<string, Set<string>>()
    for (const inv of invoices) {
      const set = new Set<string>()
      if (inv.contract_id) set.add(inv.contract_id)
      byInvoice.set(inv.id, set)
    }
    const invoiceIds = [...byInvoice.keys()]
    // Radernas avtal: sidvis, PostgREST klipper annars vid 1 000 rader
    const itemResponses = await Promise.all(
      chunks(invoiceIds, 50).map(async (part) => {
        const rows: { invoice_id: string; contract_id: string | null }[] = []
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase
            .from('invoice_items')
            .select('invoice_id, contract_id')
            .in('invoice_id', part)
            .not('contract_id', 'is', null)
            .order('id')
            .range(from, from + 999)
          if (error) throw new Error(error.message)
          rows.push(...((data ?? []) as typeof rows))
          if (!data || data.length < 1000) break
        }
        return rows
      })
    )
    for (const rows of itemResponses) {
      for (const r of rows) {
        if (r.contract_id) byInvoice.get(r.invoice_id)?.add(r.contract_id)
      }
    }
    const allContractIds = [...new Set([...byInvoice.values()].flatMap((s) => [...s]))]
    const states = await this.getReviewStates(allContractIds)
    const result = new Map<string, InvoiceReviewInfo>()
    for (const [invoiceId, set] of byInvoice) {
      if (set.size === 0) continue
      const contracts = [...set].map(
        (id) =>
          states.get(id) ?? {
            contractId: id,
            customerId: null,
            state: 'ej' as const,
            changes: [],
            reviewedAt: null,
            reviewedByName: null,
            oneflowContractId: null,
            snapshot: null,
          }
      )
      result.set(invoiceId, { state: combineReviewStates(contracts.map((c) => c.state)), contracts })
    }
    return result
  }

  /** Läget för en faktura (fakturamodalen). null = ingen avtalskoppling. */
  static async getInvoiceReview(invoiceId: string): Promise<InvoiceReviewInfo | null> {
    const { data, error } = await supabase.from('invoices').select('id, contract_id').eq('id', invoiceId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return null
    const map = await this.getInvoiceReviewStates([data as { id: string; contract_id: string | null }])
    return map.get(invoiceId) ?? null
  }

  /**
   * Markera avtalet som kontrollerat: läser nuläget, sparar bilden och vem.
   * Utan actor används den inloggade användarens profil.
   */
  static async markReviewed(
    contractId: string,
    actor?: { profileId: string | null; name: string | null }
  ): Promise<ContractReviewInfo> {
    const { data, error } = await supabase.from('contracts').select(REVIEW_CONTRACT_SELECT).eq('id', contractId).maybeSingle()
    if (error) {
      if (isMissingColumn(error)) throw new Error('Kontrollen kan inte sparas än: databasen saknar kolumnerna för kontrollerat avtal.')
      throw new Error(error.message)
    }
    if (!data) throw new Error('Avtalet hittades inte')
    const row = data as unknown as ReviewContractRow

    let who = actor
    if (!who) {
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth.user?.id ?? null
      if (!userId) throw new Error('Inte inloggad')
      const { data: prof } = await supabase.from('profiles').select('id, display_name, email').eq('user_id', userId).maybeSingle()
      const p = prof as { id: string; display_name: string | null; email: string | null } | null
      who = { profileId: p?.id ?? null, name: p?.display_name || p?.email || null }
    }

    const snapshot = snapshotFromRow(row)
    const reviewedAt = toLocalISOStringWithOffset(new Date())
    const { error: upError } = await supabase
      .from('contracts')
      .update({
        reviewed_at: reviewedAt,
        reviewed_by: who.profileId,
        reviewed_by_name: who.name,
        review_snapshot: snapshot as unknown as Record<string, unknown>,
      })
      .eq('id', contractId)
    if (upError) throw new Error(upError.message)
    return {
      contractId,
      customerId: row.customer_id ?? null,
      state: 'ok',
      changes: [],
      reviewedAt,
      reviewedByName: who.name,
      oneflowContractId: row.oneflow_contract_id ?? null,
      snapshot,
    }
  }

  /**
   * Checklistraderna för tooltipen (kort) och rutan i fakturan (lang):
   * premie med belopp, Fortnox-kortets nummer, perioden följer avtalsåret,
   * ingen period fakturerad tidigare. Tom lista utan kontroll.
   */
  static checklist(info: ContractReviewInfo, variant: 'kort' | 'lang' = 'kort'): string[] {
    if (!info.snapshot) return []
    return reviewChecklist(info.snapshot, { variant, oneflowId: info.oneflowContractId })
  }
}
