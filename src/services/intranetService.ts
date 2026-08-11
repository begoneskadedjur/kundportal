// src/services/intranetService.ts
// Intranät: dokument och läs- och förståelsekvittenser

import { supabase } from '../lib/supabase'
import type {
  IntranetAcknowledgement,
  IntranetDocument,
  IntranetDocumentWithStatus,
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
        .select('user_id, display_name, email, role, is_active')
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
    const users: AckMatrixUser[] = (profilesRes.data || []).map(p => ({
      user_id: p.user_id,
      name: p.display_name || p.email || 'Okänd',
      email: p.email || '',
      role: p.role,
    }))
    return { documents, users, acks }
  }
}
