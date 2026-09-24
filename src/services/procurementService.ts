// src/services/procurementService.ts
// Dataåtkomst för upphandlingsportalen (/admin/upphandlingar). Läsning via
// RLS (has_procurement_access), skrivning bara på de fält migrationen ger
// användare kolumnbehörighet till. Import och synk sker på servern.
//
// Plan: docs/upphandlingsportal-plan.md

import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/api'
import type {
  ProcurementAward,
  ProcurementBid,
  ProcurementBidder,
  ProcurementBuyer,
  ProcurementDocType,
  ProcurementDocument,
  ProcurementDocumentRequest,
  ProcurementEvent,
  ProcurementInboundEmail,
  ProcurementNotice,
  ProcurementNoticeSource,
  ProcurementOurStatus,
  ProcurementPriceLine,
  ProcurementQuestion,
  ProcurementRequirement,
  ProcurementSignal,
  ProcurementSignalSource,
  ProcurementSourceHealth,
  ProcurementSupplier,
  ProcurementWatchRule,
} from '../types/procurement'

export const PROCUREMENT_BUCKET = 'procurement-documents'

/** Upphandling med köpare och källor inline */
export type NoticeWithRelations = ProcurementNotice & {
  buyer: Pick<ProcurementBuyer, 'id' | 'name' | 'org_number' | 'county_name' | 'customer_id' | 'registrar_email' | 'sector'> | null
  sources: Array<Pick<ProcurementNoticeSource, 'id' | 'source' | 'source_sub' | 'source_id' | 'url' | 'fetched_at'>>
}

export type AwardWithRelations = ProcurementAward & {
  supplier: Pick<ProcurementSupplier, 'id' | 'name' | 'org_number' | 'is_begone'> | null
  buyer: Pick<ProcurementBuyer, 'id' | 'name' | 'org_number' | 'county_name' | 'customer_id'> | null
}

export type BidderWithSupplier = ProcurementBidder & {
  supplier: Pick<ProcurementSupplier, 'id' | 'name' | 'org_number' | 'is_begone'> | null
}

export interface ProcurementManagerProfile {
  user_id: string
  email: string
  display_name: string | null
}

const NOTICE_SELECT =
  '*, buyer:procurement_buyers(id, name, org_number, county_name, customer_id, registrar_email, sector), sources:procurement_notice_sources(id, source, source_sub, source_id, url, fetched_at)'
const AWARD_SELECT =
  '*, supplier:procurement_suppliers(id, name, org_number, is_begone), buyer:procurement_buyers(id, name, org_number, county_name, customer_id)'

// Supabase-klientens generiska typ känner inte alla relationer; vi castar
// medvetet på ett ställe per metod i stället för att sprida any.
function rows<T>(data: unknown): T[] {
  return (data ?? []) as T[]
}

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? 'okänt fel'}`)
}

async function currentUser(): Promise<{ id: string; name: string | null }> {
  const { data } = await supabase.auth.getUser()
  const id = data.user?.id
  if (!id) throw new Error('Du är inte inloggad')
  const { data: p } = await supabase.from('profiles').select('display_name, email').eq('user_id', id).maybeSingle()
  const prof = p as { display_name: string | null; email: string } | null
  return { id, name: prof?.display_name ?? prof?.email ?? null }
}

export interface NoticeFilter {
  minScore?: number
  statuses?: ProcurementOurStatus[]
  search?: string
  /** Bara upphandlingar där sista anbudsdag inte passerat (eller saknas) */
  openOnly?: boolean
  limit?: number
}

export class ProcurementService {
  // -------------------------------------------------------------------------
  // Upphandlingar

  static async listNotices(filter: NoticeFilter = {}): Promise<NoticeWithRelations[]> {
    let q = supabase.from('procurement_notices').select(NOTICE_SELECT)
    if (filter.minScore != null) q = q.gte('match_score', filter.minScore)
    if (filter.statuses && filter.statuses.length > 0) q = q.in('our_status', filter.statuses)
    if (filter.openOnly) q = q.or(`tender_deadline.is.null,tender_deadline.gte.${new Date().toISOString()}`)
    if (filter.search?.trim()) {
      const s = filter.search.trim().replace(/[%,()]/g, ' ')
      q = q.or(`title.ilike.%${s}%,buyer_name.ilike.%${s}%,description.ilike.%${s}%`)
    }
    const { data, error } = await q
      .order('match_score', { ascending: false })
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(filter.limit ?? 300)
    if (error) fail('Kunde inte hämta upphandlingar', error)
    return rows<NoticeWithRelations>(data)
  }

  static async getNotice(id: string): Promise<NoticeWithRelations | null> {
    const { data, error } = await supabase.from('procurement_notices').select(NOTICE_SELECT).eq('id', id).maybeSingle()
    if (error) fail('Kunde inte hämta upphandlingen', error)
    return (data as unknown as NoticeWithRelations) ?? null
  }

  /** Råposter per källa (för blocket Källor och dokument) */
  static async getNoticeSourcesRaw(noticeId: string): Promise<ProcurementNoticeSource[]> {
    const { data, error } = await supabase.from('procurement_notice_sources').select('*').eq('notice_id', noticeId).order('fetched_at')
    if (error) fail('Kunde inte hämta källposter', error)
    return rows<ProcurementNoticeSource>(data)
  }

  /** Uppdaterar användarfälten och loggar ändringen som händelse */
  static async updateNotice(
    id: string,
    patch: Partial<Pick<ProcurementNotice,
      'our_status' | 'owner_id' | 'questions_deadline' | 'criteria_type' | 'criteria_weights' | 'price_model' | 'volumes' |
      'expected_bids' | 'win_probability' | 'annual_value' | 'expected_contribution' | 'notes'>>,
    eventTitle?: string
  ): Promise<void> {
    const { error } = await supabase.from('procurement_notices').update(patch as never).eq('id', id)
    if (error) fail('Kunde inte spara upphandlingen', error)
    if (eventTitle) await this.addEvent(id, 'update', eventTitle, null, patch as Record<string, unknown>)
  }

  // -------------------------------------------------------------------------
  // Läsläge och räknare

  static async markSeen(noticeId: string): Promise<void> {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    await supabase
      .from('procurement_read_state')
      .upsert({ user_id: data.user.id, notice_id: noticeId, seen_at: new Date().toISOString() } as never, { onConflict: 'user_id,notice_id' })
  }

  static async markManySeen(noticeIds: string[]): Promise<void> {
    const { data } = await supabase.auth.getUser()
    if (!data.user || noticeIds.length === 0) return
    const now = new Date().toISOString()
    await supabase
      .from('procurement_read_state')
      .upsert(noticeIds.map((id) => ({ user_id: data.user!.id, notice_id: id, seen_at: now })) as never, { onConflict: 'user_id,notice_id' })
  }

  static async getSeenIds(): Promise<Set<string>> {
    const { data } = await supabase.from('procurement_read_state').select('notice_id')
    return new Set(rows<{ notice_id: string }>(data).map((r) => r.notice_id))
  }

  static async getUnreadCount(): Promise<number> {
    const { data, error } = await supabase.rpc('procurement_unread_count' as never)
    if (error) return 0
    return Number(data ?? 0)
  }

  // -------------------------------------------------------------------------
  // Händelser

  static async listEvents(noticeId: string): Promise<ProcurementEvent[]> {
    const { data, error } = await supabase
      .from('procurement_events')
      .select('*')
      .eq('notice_id', noticeId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) fail('Kunde inte hämta händelser', error)
    return rows<ProcurementEvent>(data)
  }

  static async addEvent(noticeId: string | null, type: string, title: string, detail?: string | null, metadata: Record<string, unknown> = {}, awardId?: string | null): Promise<void> {
    const me = await currentUser().catch(() => null)
    await supabase.from('procurement_events').insert({
      notice_id: noticeId,
      award_id: awardId ?? null,
      event_type: type,
      title,
      detail: detail ?? null,
      metadata,
      actor_id: me?.id ?? null,
      actor_name: me?.name ?? null,
    } as never)
  }

  // -------------------------------------------------------------------------
  // Personer

  /** Upphandlingsansvariga, för ansvarig-väljaren */
  static async listManagers(): Promise<ProcurementManagerProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, email, display_name')
      .eq('is_procurement_manager' as never, true as never)
      .eq('is_active', true)
      .order('display_name')
    if (error) fail('Kunde inte hämta upphandlingsansvariga', error)
    return rows<ProcurementManagerProfile>(data)
  }

  static async getDigestEnabled(): Promise<boolean> {
    const { data: u } = await supabase.auth.getUser()
    if (!u.user) return true
    const { data } = await supabase.from('procurement_user_settings').select('digest_enabled').eq('user_id', u.user.id).maybeSingle()
    return (data as { digest_enabled: boolean } | null)?.digest_enabled ?? true
  }

  static async setDigestEnabled(enabled: boolean): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    if (!u.user) throw new Error('Du är inte inloggad')
    const { error } = await supabase
      .from('procurement_user_settings')
      .upsert({ user_id: u.user.id, digest_enabled: enabled } as never, { onConflict: 'user_id' })
    if (error) fail('Kunde inte spara inställningen', error)
  }

  // -------------------------------------------------------------------------
  // Köpare

  static async listBuyers(search?: string): Promise<ProcurementBuyer[]> {
    let q = supabase.from('procurement_buyers').select('*')
    if (search?.trim()) {
      const s = search.trim().replace(/[%,()]/g, ' ')
      q = q.or(`name.ilike.%${s}%,org_number.ilike.%${s.replace(/\D/g, '') || s}%`)
    }
    const { data, error } = await q.order('name').limit(2000)
    if (error) fail('Kunde inte hämta köpare', error)
    return rows<ProcurementBuyer>(data)
  }

  static async getBuyer(id: string): Promise<ProcurementBuyer | null> {
    const { data, error } = await supabase.from('procurement_buyers').select('*').eq('id', id).maybeSingle()
    if (error) fail('Kunde inte hämta köparen', error)
    return (data as unknown as ProcurementBuyer) ?? null
  }

  static async updateBuyer(id: string, patch: Partial<Pick<ProcurementBuyer, 'customer_id' | 'registrar_email' | 'sector' | 'website' | 'notes'>>): Promise<void> {
    const { error } = await supabase.from('procurement_buyers').update(patch as never).eq('id', id)
    if (error) fail('Kunde inte spara köparen', error)
  }

  static async listNoticesForBuyer(buyerId: string): Promise<ProcurementNotice[]> {
    const { data, error } = await supabase
      .from('procurement_notices')
      .select('*')
      .eq('buyer_id', buyerId)
      .order('published_at', { ascending: false, nullsFirst: false })
    if (error) fail('Kunde inte hämta köparens upphandlingar', error)
    return rows<ProcurementNotice>(data)
  }

  // -------------------------------------------------------------------------
  // Leverantörer

  static async listSuppliers(): Promise<ProcurementSupplier[]> {
    const { data, error } = await supabase.from('procurement_suppliers').select('*').order('name').limit(5000)
    if (error) fail('Kunde inte hämta leverantörer', error)
    return rows<ProcurementSupplier>(data)
  }

  static async getSupplier(id: string): Promise<ProcurementSupplier | null> {
    const { data, error } = await supabase.from('procurement_suppliers').select('*').eq('id', id).maybeSingle()
    if (error) fail('Kunde inte hämta leverantören', error)
    return (data as unknown as ProcurementSupplier) ?? null
  }

  static async updateSupplierNotes(id: string, notes: string | null): Promise<void> {
    const { error } = await supabase.from('procurement_suppliers').update({ notes } as never).eq('id', id)
    if (error) fail('Kunde inte spara leverantören', error)
  }

  // -------------------------------------------------------------------------
  // Tilldelningar och anbudsgivare

  /**
   * Alla tilldelningar (utom felträffar) och anbudsgivare i ett anrop via RPC
   * procurement_market_dataset. PostgREST kapar vanliga svar vid max-rows
   * (1 000), vilket gav tysta tapp i Marknad och Konkurrenter.
   */
  static async listMarketDataset(): Promise<{ awards: AwardWithRelations[]; bidders: BidderWithSupplier[] }> {
    const { data, error } = await supabase.rpc('procurement_market_dataset')
    if (error) fail('Kunde inte hämta marknadsdatan', error)
    const d = (data ?? {}) as { awards?: unknown; bidders?: unknown }
    return { awards: rows<AwardWithRelations>(d.awards), bidders: rows<BidderWithSupplier>(d.bidders) }
  }

  /** Tilldelningar som flaggats som felträffar (visas och kan återställas i avtalsklockan) */
  static async listExcludedAwards(): Promise<Array<Pick<ProcurementAward, 'id' | 'title' | 'buyer_name' | 'source' | 'source_ref' | 'excluded_reason' | 'excluded_at'>>> {
    const { data, error } = await supabase
      .from('procurement_awards')
      .select('id, title, buyer_name, source, source_ref, excluded_reason, excluded_at')
      .not('excluded_reason', 'is', null)
      .order('buyer_name')
      .limit(1000)
    if (error) fail('Kunde inte hämta felträffar', error)
    return rows(data)
  }

  /**
   * Markerar tilldelningar som felträff (reason satt) eller som relevanta
   * (reason null). excluded_at sätts i båda fallen, så att synken och
   * omräkningen behåller människans beslut.
   */
  static async setAwardsExcluded(ids: string[], reason: string | null): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase
      .from('procurement_awards')
      .update({ excluded_reason: reason ? (reason.startsWith('Manuellt') ? reason : `Manuellt: ${reason}`) : null, excluded_at: new Date().toISOString() } as never)
      .in('id', ids)
    if (error) fail('Kunde inte spara felträffen', error)
    await this.addEvent(null, reason ? 'award_excluded' : 'award_included', reason ? 'Tilldelning markerad som felträff' : 'Tilldelning återställd', reason, { award_ids: ids }, ids[0])
  }

  static async listAwards(opts: { buyerId?: string; supplierId?: string; noticeId?: string; limit?: number; includeExcluded?: boolean } = {}): Promise<AwardWithRelations[]> {
    let q = supabase.from('procurement_awards').select(AWARD_SELECT)
    if (!opts.includeExcluded) q = q.is('excluded_reason', null)
    if (opts.buyerId) q = q.eq('buyer_id', opts.buyerId)
    if (opts.supplierId) q = q.eq('supplier_id', opts.supplierId)
    if (opts.noticeId) q = q.eq('notice_id', opts.noticeId)
    const { data, error } = await q.order('award_date', { ascending: false, nullsFirst: false }).limit(opts.limit ?? 5000)
    if (error) fail('Kunde inte hämta tilldelningar', error)
    return rows<AwardWithRelations>(data)
  }

  /** Rättar avtalsslutet och räknar om bearbetningsfönstret i UI:t (fönstret är importfält, se avtalsklockan) */
  static async correctAwardEnd(awardId: string, endDate: string | null): Promise<void> {
    const me = await currentUser()
    const { error } = await supabase
      .from('procurement_awards')
      .update({ corrected_end_date: endDate, corrected_by: me.id, corrected_at: new Date().toISOString() } as never)
      .eq('id', awardId)
    if (error) fail('Kunde inte rätta slutdatumet', error)
    await this.addEvent(null, 'award_end_corrected', endDate ? `Avtalsslut rättat till ${endDate}` : 'Rättat avtalsslut borttaget', null, { award_id: awardId }, awardId)
  }

  static async updateAward(awardId: string, patch: Partial<Pick<ProcurementAward, 'status' | 'owner_id' | 'notes'>>): Promise<void> {
    const { error } = await supabase.from('procurement_awards').update(patch as never).eq('id', awardId)
    if (error) fail('Kunde inte spara tilldelningen', error)
  }

  static async listBidders(opts: { noticeId?: string; sourceRefs?: string[]; supplierId?: string } = {}): Promise<BidderWithSupplier[]> {
    let q = supabase.from('procurement_bidders').select('*, supplier:procurement_suppliers(id, name, org_number, is_begone)')
    if (opts.noticeId) q = q.eq('notice_id', opts.noticeId)
    if (opts.sourceRefs && opts.sourceRefs.length > 0) q = q.in('source_ref', opts.sourceRefs)
    if (opts.supplierId) q = q.eq('supplier_id', opts.supplierId)
    const { data, error } = await q.order('rank', { ascending: true, nullsFirst: false }).limit(5000)
    if (error) fail('Kunde inte hämta anbudsgivare', error)
    return rows<BidderWithSupplier>(data)
  }

  static async verifyBidder(bidderId: string, verified: boolean): Promise<void> {
    const me = await currentUser()
    const { error } = await supabase
      .from('procurement_bidders')
      .update({ verified, verified_by: verified ? me.id : null, verified_at: verified ? new Date().toISOString() : null } as never)
      .eq('id', bidderId)
    if (error) fail('Kunde inte godkänna siffrorna', error)
  }

  static async addManualBidder(input: { noticeId: string; name: string; orgNumber?: string | null; price?: number | null; isWinner?: boolean; rank?: number | null }): Promise<void> {
    const org = input.orgNumber ? input.orgNumber.replace(/\D/g, '') : null
    const key = `manual:${input.noticeId}:${org || input.name.toLowerCase().trim()}`
    const { error } = await supabase.from('procurement_bidders').insert({
      bidder_key: key,
      notice_id: input.noticeId,
      source_ref: input.noticeId,
      org_number: org && org.length === 10 ? org : null,
      name: input.name.trim(),
      price: input.price ?? null,
      rank: input.rank ?? null,
      is_winner: !!input.isWinner,
      is_begone: org === '5593789208',
      source: 'manual',
      verified: true,
    } as never)
    if (error) fail('Kunde inte lägga till anbudsgivaren', error)
  }

  // -------------------------------------------------------------------------
  // Egna anbud (kalkylen)

  static async listBids(noticeId: string): Promise<ProcurementBid[]> {
    const { data, error } = await supabase.from('procurement_bids').select('*').eq('notice_id', noticeId).order('created_at', { ascending: false })
    if (error) fail('Kunde inte hämta kalkyler', error)
    return rows<ProcurementBid>(data)
  }

  /** Sparar en ny kalkylversion som aktuell och speglar TB och sannolikhet till upphandlingen */
  static async saveBid(noticeId: string, bid: Partial<Omit<ProcurementBid, 'id' | 'notice_id' | 'created_at' | 'updated_at'>>): Promise<ProcurementBid> {
    const me = await currentUser()
    const { error: prevErr } = await supabase.from('procurement_bids').update({ is_current: false } as never).eq('notice_id', noticeId).eq('is_current', true)
    if (prevErr) fail('Kunde inte avaktivera förra kalkylen', prevErr)
    const { data, error } = await supabase
      .from('procurement_bids')
      .insert({ ...bid, notice_id: noticeId, is_current: true, created_by: me.id } as never)
      .select('*')
      .single()
    if (error) fail('Kunde inte spara kalkylen', error)
    await supabase
      .from('procurement_notices')
      .update({ expected_contribution: bid.expected_contribution ?? null, win_probability: bid.win_probability ?? null } as never)
      .eq('id', noticeId)
    await this.addEvent(noticeId, 'bid_saved', 'Kalkyl sparad', bid.submitted_price != null ? `Lämnat pris ${bid.submitted_price}` : null)
    return data as unknown as ProcurementBid
  }

  static async updateBid(bidId: string, patch: Partial<Pick<ProcurementBid, 'submitted_price' | 'outcome' | 'lesson' | 'label'>>): Promise<void> {
    const { error } = await supabase.from('procurement_bids').update(patch as never).eq('id', bidId)
    if (error) fail('Kunde inte spara anbudet', error)
  }

  /** Egen historik för sannolikheten: vunna och avgjorda egna anbud */
  static async ownOutcomeStats(): Promise<{ wins: number; decided: number }> {
    const { data } = await supabase.from('procurement_bids').select('outcome').eq('is_current', true).in('outcome', ['won', 'lost'])
    const list = rows<{ outcome: string }>(data)
    return { wins: list.filter((r) => r.outcome === 'won').length, decided: list.length }
  }

  // -------------------------------------------------------------------------
  // Dokument

  static async listDocuments(noticeId: string): Promise<ProcurementDocument[]> {
    const { data, error } = await supabase.from('procurement_documents').select('*').eq('notice_id', noticeId).order('created_at', { ascending: false })
    if (error) fail('Kunde inte hämta dokument', error)
    return rows<ProcurementDocument>(data)
  }

  /**
   * Laddar upp till den privata bucketen, skapar dokumentraden och startar
   * AI-extraktionen (api/procurement/extract-document). Extraktionen körs i
   * bakgrunden; raden får ai_status done eller failed.
   */
  static async uploadDocument(noticeId: string, file: File, docType: ProcurementDocType, extract = true): Promise<ProcurementDocument> {
    const me = await currentUser()
    const safe = file.name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-120)
    const path = `${noticeId}/${Date.now()}_${safe}`
    const { error: upErr } = await supabase.storage.from(PROCUREMENT_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false })
    if (upErr) fail('Kunde inte ladda upp filen', upErr)
    const { data, error } = await supabase
      .from('procurement_documents')
      .insert({
        notice_id: noticeId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type || null,
        size_bytes: file.size,
        doc_type: docType,
        origin: 'upload',
        uploaded_by: me.id,
        ai_status: extract ? 'pending' : 'skipped',
      } as never)
      .select('*')
      .single()
    if (error) fail('Kunde inte spara dokumentet', error)
    const doc = data as unknown as ProcurementDocument
    await this.addEvent(noticeId, 'document_uploaded', `Dokument uppladdat: ${file.name}`)
    if (extract) void this.extractDocument(doc.id).catch(() => undefined)
    return doc
  }

  static async extractDocument(documentId: string): Promise<void> {
    const res = await apiFetch('/api/procurement/extract-document', {
      method: 'POST',
      body: JSON.stringify({ documentId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error((body as { error?: string }).error ?? `Extraktionen misslyckades (${res.status})`)
    }
  }

  static async getDocumentUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage.from(PROCUREMENT_BUCKET).createSignedUrl(path, 60 * 10)
    if (error || !data) fail('Kunde inte öppna filen', error)
    return data.signedUrl
  }

  static async deleteDocument(doc: Pick<ProcurementDocument, 'id' | 'storage_path'>): Promise<void> {
    await supabase.storage.from(PROCUREMENT_BUCKET).remove([doc.storage_path])
    const { error } = await supabase.from('procurement_documents').delete().eq('id', doc.id)
    if (error) fail('Kunde inte ta bort dokumentet', error)
  }

  static async setDocumentType(docId: string, docType: ProcurementDocType): Promise<void> {
    const { error } = await supabase.from('procurement_documents').update({ doc_type: docType } as never).eq('id', docId)
    if (error) fail('Kunde inte ändra dokumenttypen', error)
  }

  static async verifyDocument(docId: string, verified: boolean): Promise<void> {
    const me = await currentUser()
    const { error } = await supabase
      .from('procurement_documents')
      .update({ verified, verified_by: verified ? me.id : null, verified_at: verified ? new Date().toISOString() : null } as never)
      .eq('id', docId)
    if (error) fail('Kunde inte godkänna dokumentet', error)
  }

  // -------------------------------------------------------------------------
  // Begäran om handlingar och inkommande e-post

  static async listDocumentRequests(noticeId?: string): Promise<ProcurementDocumentRequest[]> {
    let q = supabase.from('procurement_document_requests').select('*')
    if (noticeId) q = q.eq('notice_id', noticeId)
    const { data, error } = await q.order('created_at', { ascending: false }).limit(500)
    if (error) fail('Kunde inte hämta begäranden', error)
    return rows<ProcurementDocumentRequest>(data)
  }

  /** Förhandsvisning eller utskick via api/procurement/request-documents */
  static async requestDocuments(input: {
    noticeId: string
    docTypes: string[]
    recipientEmail: string
    awardId?: string | null
    message?: string | null
    preview?: boolean
  }): Promise<{ subject?: string; body?: string; requestId?: string }> {
    const res = await apiFetch('/api/procurement/request-documents', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    const body = (await res.json().catch(() => ({}))) as { error?: string; subject?: string; body?: string; requestId?: string }
    if (!res.ok) throw new Error(body.error ?? `Begäran misslyckades (${res.status})`)
    return body
  }

  static async updateDocumentRequest(id: string, patch: Partial<Pick<ProcurementDocumentRequest, 'status' | 'notes' | 'received_at'>>): Promise<void> {
    const { error } = await supabase.from('procurement_document_requests').update(patch as never).eq('id', id)
    if (error) fail('Kunde inte spara begäran', error)
  }

  static async listInboundEmails(status: 'unsorted' | 'matched' | 'ignored' = 'unsorted'): Promise<ProcurementInboundEmail[]> {
    const { data, error } = await supabase
      .from('procurement_inbound_emails')
      .select('id, message_id, from_email, from_domain, to_emails, subject, text_body, received_at, notice_id, request_id, match_method, status, ai_classification, created_at')
      .eq('status', status)
      .order('received_at', { ascending: false })
      .limit(200)
    if (error) fail('Kunde inte hämta inkorgen', error)
    return rows<ProcurementInboundEmail>(data)
  }

  /** Kopplar ett osorterat mejl (och dess bilagor) till en upphandling */
  static async assignInboundEmail(emailId: string, noticeId: string | null, ignore = false): Promise<void> {
    const { error } = await supabase
      .from('procurement_inbound_emails')
      .update({ notice_id: noticeId, match_method: noticeId ? 'manual' : null, status: ignore ? 'ignored' : noticeId ? 'matched' : 'unsorted' } as never)
      .eq('id', emailId)
    if (error) fail('Kunde inte koppla e-posten', error)
    if (noticeId) {
      await supabase.from('procurement_documents').update({ notice_id: noticeId } as never).eq('inbound_email_id', emailId)
      await this.addEvent(noticeId, 'inbound_assigned', 'Inkommen e-post kopplad manuellt')
    }
  }

  // -------------------------------------------------------------------------
  // Anbudsverkstad

  static async listRequirements(noticeId: string): Promise<ProcurementRequirement[]> {
    const { data, error } = await supabase.from('procurement_requirements').select('*').eq('notice_id', noticeId).order('sort_order').order('created_at')
    if (error) fail('Kunde inte hämta kravlistan', error)
    return rows<ProcurementRequirement>(data)
  }

  static async saveRequirement(input: Partial<ProcurementRequirement> & { notice_id: string }): Promise<ProcurementRequirement> {
    const me = await currentUser()
    // Skapare sätts bara vid insert, aldrig när någon redigerar en befintlig rad
    const payload = input.id ? input : { ...input, created_by: input.created_by ?? me.id }
    const q = input.id
      ? supabase.from('procurement_requirements').update(payload as never).eq('id', input.id).select('*').single()
      : supabase.from('procurement_requirements').insert(payload as never).select('*').single()
    const { data, error } = await q
    if (error) fail('Kunde inte spara kravet', error)
    return data as unknown as ProcurementRequirement
  }

  static async deleteRequirement(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_requirements').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort kravet', error)
  }

  static async listQuestions(noticeId: string): Promise<ProcurementQuestion[]> {
    const { data, error } = await supabase.from('procurement_questions').select('*').eq('notice_id', noticeId).order('created_at')
    if (error) fail('Kunde inte hämta frågorna', error)
    return rows<ProcurementQuestion>(data)
  }

  static async saveQuestion(input: Partial<ProcurementQuestion> & { notice_id: string }): Promise<ProcurementQuestion> {
    const me = await currentUser()
    // Skapare sätts bara vid insert, aldrig när någon redigerar en befintlig rad
    const payload = input.id ? input : { ...input, created_by: input.created_by ?? me.id }
    const q = input.id
      ? supabase.from('procurement_questions').update(payload as never).eq('id', input.id).select('*').single()
      : supabase.from('procurement_questions').insert(payload as never).select('*').single()
    const { data, error } = await q
    if (error) fail('Kunde inte spara frågan', error)
    return data as unknown as ProcurementQuestion
  }

  static async deleteQuestion(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_questions').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort frågan', error)
  }

  static async listPriceLines(noticeId: string): Promise<ProcurementPriceLine[]> {
    const { data, error } = await supabase.from('procurement_price_lines').select('*').eq('notice_id', noticeId).order('sort_order').order('created_at')
    if (error) fail('Kunde inte hämta prisbilagan', error)
    return rows<ProcurementPriceLine>(data)
  }

  static async savePriceLine(input: Partial<ProcurementPriceLine> & { notice_id: string }): Promise<ProcurementPriceLine> {
    const q = input.id
      ? supabase.from('procurement_price_lines').update(input as never).eq('id', input.id).select('*').single()
      : supabase.from('procurement_price_lines').insert(input as never).select('*').single()
    const { data, error } = await q
    if (error) fail('Kunde inte spara prisraden', error)
    return data as unknown as ProcurementPriceLine
  }

  static async deletePriceLine(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_price_lines').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort prisraden', error)
  }

  // -------------------------------------------------------------------------
  // Signaler och signalkällor

  static async listSignals(statuses: ProcurementSignal['status'][] = ['new', 'watching']): Promise<ProcurementSignal[]> {
    const { data, error } = await supabase
      .from('procurement_signals')
      .select('*')
      .in('status', statuses)
      .order('expected_quarter', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) fail('Kunde inte hämta signaler', error)
    return rows<ProcurementSignal>(data)
  }

  static async updateSignal(id: string, patch: Partial<Pick<ProcurementSignal, 'status' | 'award_id' | 'notice_id'>>): Promise<void> {
    const { error } = await supabase.from('procurement_signals').update(patch as never).eq('id', id)
    if (error) fail('Kunde inte spara signalen', error)
  }

  static async listSignalSources(): Promise<ProcurementSignalSource[]> {
    const { data, error } = await supabase
      .from('procurement_signal_sources')
      .select('id, name, url, buyer_id, kind, county_code, content_hash, last_fetched_at, last_changed_at, last_status, last_error, active, verified, notes, created_at, updated_at')
      .order('county_code')
      .order('name')
    if (error) fail('Kunde inte hämta signalkällor', error)
    return rows<ProcurementSignalSource>(data)
  }

  static async saveSignalSource(input: Partial<ProcurementSignalSource>): Promise<void> {
    const q = input.id
      ? supabase.from('procurement_signal_sources').update(input as never).eq('id', input.id)
      : supabase.from('procurement_signal_sources').insert(input as never)
    const { error } = await q
    if (error) fail('Kunde inte spara signalkällan', error)
  }

  static async deleteSignalSource(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_signal_sources').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort signalkällan', error)
  }

  // -------------------------------------------------------------------------
  // Bevakningsregler och källhälsa

  static async listWatchRules(): Promise<ProcurementWatchRule[]> {
    const { data, error } = await supabase.from('procurement_watch_rules').select('*').order('rule_type').order('name')
    if (error) fail('Kunde inte hämta bevakningsregler', error)
    return rows<ProcurementWatchRule>(data)
  }

  static async saveWatchRule(input: Partial<ProcurementWatchRule>): Promise<void> {
    const q = input.id
      ? supabase.from('procurement_watch_rules').update(input as never).eq('id', input.id)
      : supabase.from('procurement_watch_rules').insert(input as never)
    const { error } = await q
    if (error) fail('Kunde inte spara regeln', error)
  }

  static async deleteWatchRule(id: string): Promise<void> {
    const { error } = await supabase.from('procurement_watch_rules').delete().eq('id', id)
    if (error) fail('Kunde inte ta bort regeln', error)
  }

  static async listSourceHealth(): Promise<ProcurementSourceHealth[]> {
    const { data, error } = await supabase.from('procurement_source_health').select('*').order('source')
    if (error) fail('Kunde inte hämta källhälsan', error)
    return rows<ProcurementSourceHealth>(data)
  }

  // -------------------------------------------------------------------------
  // Kundkoppling för köpare (customers: id, company_name, organization_number)

  /** Söker kunder på namn eller orgnr, för kundkopplingen i köparprofilen */
  static async searchCustomers(search: string, limit = 20): Promise<Array<{ id: string; company_name: string; organization_number: string | null }>> {
    const s = search.trim().replace(/[%,()]/g, ' ')
    if (!s) return []
    const digits = s.replace(/\D/g, '')
    const orgFilter = digits.length >= 4 ? `,organization_number.ilike.%${digits.length === 10 ? `${digits.slice(0, 6)}%${digits.slice(6)}` : digits}%` : ''
    const { data, error } = await supabase
      .from('customers')
      .select('id, company_name, organization_number')
      .or(`company_name.ilike.%${s}%${orgFilter}`)
      .order('company_name')
      .limit(limit)
    if (error) fail('Kunde inte söka kunder', error)
    return rows<{ id: string; company_name: string; organization_number: string | null }>(data)
  }

  /** Kundnamn för kopplade köpare */
  static async getCustomersByIds(ids: string[]): Promise<Array<{ id: string; company_name: string; organization_number: string | null }>> {
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length === 0) return []
    const { data, error } = await supabase.from('customers').select('id, company_name, organization_number').in('id', unique)
    if (error) fail('Kunde inte hämta kunder', error)
    return rows<{ id: string; company_name: string; organization_number: string | null }>(data)
  }
}
