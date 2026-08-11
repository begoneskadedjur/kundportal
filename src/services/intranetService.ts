// src/services/intranetService.ts
// Intranät: dokument och läs- och förståelsekvittenser

import { supabase } from '../lib/supabase'
import type {
  IntranetAcknowledgement,
  IntranetContact,
  IntranetDocument,
  IntranetDocumentWithStatus,
  IntranetPost,
  IntranetResponsibility,
  KmaStats,
} from '../types/intranet'

export interface AckMatrixUser {
  user_id: string
  name: string
  email: string
  role: string
}

export interface AckMatrixData {
  documents: IntranetDocument[]
  users: AckMatrixUser[]
  /** key: `${document_id}:${user_id}` -> senaste kvittens */
  acks: Map<string, IntranetAcknowledgement>
}

export class IntranetService {
  /** Publicerade dokument berikade med den inloggades kvittensstatus */
  static async getDocumentsWithStatus(userId: string): Promise<IntranetDocumentWithStatus[]> {
    const [{ data: docs, error: docsError }, { data: acks, error: acksError }] = await Promise.all([
      supabase
        .from('intranet_documents')
        .select('*')
        .eq('is_published', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('intranet_acknowledgements')
        .select('*')
        .eq('user_id', userId)
        .order('acknowledged_at', { ascending: false }),
    ])
    if (docsError) throw docsError
    if (acksError) throw acksError

    const ackList = (acks || []) as IntranetAcknowledgement[]
    return ((docs || []) as IntranetDocument[]).map(doc => {
      const docAcks = ackList.filter(a => a.document_id === doc.id)
      return {
        ...doc,
        currentAck: docAcks.find(a => a.version === doc.version) || null,
        latestAck: docAcks[0] || null,
      }
    })
  }

  /** Ett dokument via slug, med den inloggades kvittensstatus */
  static async getDocumentBySlug(slug: string, userId: string): Promise<IntranetDocumentWithStatus | null> {
    const { data: doc, error } = await supabase
      .from('intranet_documents')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    if (!doc) return null

    const { data: acks, error: acksError } = await supabase
      .from('intranet_acknowledgements')
      .select('*')
      .eq('user_id', userId)
      .eq('document_id', doc.id)
      .order('acknowledged_at', { ascending: false })
    if (acksError) throw acksError

    const ackList = (acks || []) as IntranetAcknowledgement[]
    return {
      ...(doc as IntranetDocument),
      currentAck: ackList.find(a => a.version === (doc as IntranetDocument).version) || null,
      latestAck: ackList[0] || null,
    }
  }

  /**
   * Kvittera läsning av aktuell version. Namn och e-post snapshotas
   * så att revisionsloggen står sig även om profilen ändras.
   */
  static async acknowledge(
    doc: IntranetDocument,
    user: { id: string; name: string | null; email: string | null }
  ): Promise<IntranetAcknowledgement> {
    const { data, error } = await supabase
      .from('intranet_acknowledgements')
      .insert({
        document_id: doc.id,
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        version: doc.version,
      })
      .select('*')
    if (error) {
      // 23505 = redan kvitterad (dubbelklick) - hämta befintlig i stället
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('intranet_acknowledgements')
          .select('*')
          .eq('document_id', doc.id)
          .eq('user_id', user.id)
          .eq('version', doc.version)
          .maybeSingle()
        if (existing) return existing as IntranetAcknowledgement
      }
      throw error
    }
    if (!data || data.length === 0) {
      throw new Error('Kvittensen kunde inte sparas (ingen rad skapades)')
    }
    return data[0] as IntranetAcknowledgement
  }

  /** Antal olästa obligatoriska dokument för badge i menyn */
  static async getUnreadCount(userId: string): Promise<number> {
    const [{ data: docs, error: docsError }, { data: acks, error: acksError }] = await Promise.all([
      supabase
        .from('intranet_documents')
        .select('id, version')
        .eq('is_published', true)
        .eq('requires_acknowledgement', true),
      supabase
        .from('intranet_acknowledgements')
        .select('document_id, version')
        .eq('user_id', userId),
    ])
    if (docsError || acksError) return 0
    const acked = new Set((acks || []).map(a => `${a.document_id}:${a.version}`))
    return (docs || []).filter(d => !acked.has(`${d.id}:${d.version}`)).length
  }

  /** Admin: full läsmatris över interna användare x dokument */
  static async getAckMatrix(): Promise<AckMatrixData> {
    const [docsRes, acksRes, profilesRes] = await Promise.all([
      supabase
        .from('intranet_documents')
        .select('*')
        .eq('is_published', true)
        .eq('requires_acknowledgement', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('intranet_acknowledgements')
        .select('*')
        .order('acknowledged_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('user_id, display_name, email, role, is_active, technician:technicians(name)')
        .eq('is_active', true)
        .in('role', ['admin', 'koordinator', 'technician', 'säljare'])
        .order('display_name', { ascending: true }),
    ])
    if (docsRes.error) throw docsRes.error
    if (acksRes.error) throw acksRes.error
    if (profilesRes.error) throw profilesRes.error

    const documents = (docsRes.data || []) as IntranetDocument[]
    const acks = new Map<string, IntranetAcknowledgement>()
    // Sorterad nyast först - första träffen per nyckel är senaste kvittensen
    for (const ack of (acksRes.data || []) as IntranetAcknowledgement[]) {
      const key = `${ack.document_id}:${ack.user_id}`
      if (!acks.has(key)) acks.set(key, ack)
    }
    // Endast dokument som kräver kvittens ingår i matrisen (guider räknas inte)
    const users: AckMatrixUser[] = (profilesRes.data || []).map(p => {
      const technician = p.technician as { name: string | null } | { name: string | null }[] | null
      const technicianName = Array.isArray(technician) ? technician[0]?.name : technician?.name
      return {
        user_id: p.user_id,
        name: p.display_name || technicianName || p.email || 'Okänd',
        email: p.email || '',
        role: p.role,
      }
    })
    // Sortera på visningsnamn (profiler utan display_name hamnar annars fel)
    users.sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    return { documents, users, acks }
  }

  // ─── Anslagstavla ───

  static async getPosts(): Promise<IntranetPost[]> {
    const { data, error } = await supabase
      .from('intranet_posts')
      .select('*')
      .eq('is_published', true)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
    if (error) throw error
    return (data || []) as IntranetPost[]
  }

  static async createPost(post: {
    title: string
    body: string
    pinned: boolean
    author_user_id: string
    author_name: string | null
  }): Promise<IntranetPost> {
    const { data, error } = await supabase
      .from('intranet_posts')
      .insert(post)
      .select('*')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Anslaget kunde inte sparas')
    return data[0] as IntranetPost
  }

  static async updatePost(id: string, changes: { title: string; body: string; pinned: boolean }): Promise<void> {
    const { data, error } = await supabase
      .from('intranet_posts')
      .update(changes)
      .eq('id', id)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Anslaget kunde inte uppdateras')
  }

  static async deletePost(id: string): Promise<void> {
    const { error } = await supabase.from('intranet_posts').delete().eq('id', id)
    if (error) throw error
  }

  // ─── Kontakter & ansvar ───

  static async getResponsibilities(): Promise<IntranetResponsibility[]> {
    const { data, error } = await supabase
      .from('intranet_responsibilities')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    return (data || []) as IntranetResponsibility[]
  }

  static async getContacts(): Promise<IntranetContact[]> {
    const { data, error } = await supabase
      .from('technicians')
      .select('id, name, role, email, direct_phone, office_phone, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) throw error
    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      role: t.role,
      email: t.email,
      direct_phone: t.direct_phone,
      office_phone: t.office_phone,
    }))
  }

  // ─── KMA-statistik ───

  static async getKmaStats(): Promise<KmaStats> {
    const { data, error } = await supabase.rpc('intranet_kma_stats')
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
      open_count: Number(row?.open_count || 0),
      handled_this_year: Number(row?.handled_this_year || 0),
      reported_this_year: Number(row?.reported_this_year || 0),
    }
  }
}
