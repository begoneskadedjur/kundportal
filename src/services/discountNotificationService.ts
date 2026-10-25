// src/services/discountNotificationService.ts
// Notiser om rabatter som kräver godkännande.
//
// Sedan 3.97.0 går rabattnotiserna till rabattansvariga
// (profiles.can_approve_discounts = true), inte till alla admins. Ärendets
// notis länkar till ärendet (case_id + case_type), dokumentets notis till
// Dokumentsigneringen med dokumentet öppet (case_type null, rubriken börjar
// med DOKUMENT_RABATT_PREFIX, src/shared/dokumentNotis.ts).
//
// notifications.recipient_id pekar på profiles.id och notislistorna läser på
// inloggningens id; för personalen är de samma, och user_id används som i
// övriga notiser (bokaInService.paminnTekniker).

import { supabase } from '../lib/supabase'
import { DOKUMENT_RABATT_PREFIX } from '../shared/dokumentNotis'

type CaseType = 'private' | 'business' | 'contract'

const procent = (p: number) => p.toLocaleString('sv-SE', { maximumFractionDigits: 2 })

async function rabattansvariga(): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('can_approve_discounts', true)
  if (error) {
    console.error('Kunde inte hämta rabattansvariga för notis:', error)
    return []
  }
  return (data || []).map(p => p.user_id as string | null).filter((id): id is string => !!id)
}

async function profilFranTekniker(technicianId: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('technician_id', technicianId)
    .limit(1)
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

async function profilFranEpost(email: string): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle()
  return (data?.user_id as string | undefined) ?? null
}

export class DiscountNotificationService {
  /**
   * Notis till alla rabattansvariga om en ny rabatt på ett ärende.
   * Länken öppnar ärendet.
   */
  static async notifyApproversOfDiscountRequest(params: {
    caseId: string
    caseType: CaseType
    articleName: string
    discountPercent: number
    senderName?: string | null
    customerName?: string | null
  }): Promise<void> {
    try {
      const recipients = await rabattansvariga()
      if (recipients.length === 0) {
        console.warn('Inga rabattansvariga hittades för rabattnotisen')
        return
      }
      const sender = params.senderName || 'Någon'
      const preview = params.customerName
        ? `${sender} har gett ${procent(params.discountPercent)} % rabatt på "${params.articleName}" för ${params.customerName}. Godkänn under Godkännanden.`
        : `${sender} har gett ${procent(params.discountPercent)} % rabatt på "${params.articleName}". Godkänn under Godkännanden.`
      const { error } = await supabase.from('notifications').insert(
        recipients.map(recipient_id => ({
          recipient_id,
          case_id: params.caseId,
          case_type: params.caseType,
          title: 'Rabatt kräver godkännande',
          preview,
          sender_name: sender,
          is_read: false,
          source_comment_id: null,
          case_title: params.customerName || null,
        }))
      )
      if (error) console.error('Kunde inte skapa rabattnotiser:', error)
    } catch (error) {
      console.error('Fel vid skapande av rabattnotis:', error)
    }
  }

  /**
   * Bakåtkompatibelt namn (CaseArticleSelector). Går sedan 3.97.0 till
   * rabattansvariga, inte till alla admins.
   */
  static async notifyAdminsOfDiscountRequest(params: {
    caseId: string
    caseType: CaseType
    articleName: string
    discountPercent: number
    technicianId?: string | null
    technicianName?: string | null
    customerName?: string
  }): Promise<void> {
    let senderName = params.technicianName || null
    if (!senderName && params.technicianId) {
      const { data: technician } = await supabase
        .from('technicians')
        .select('name')
        .eq('id', params.technicianId)
        .maybeSingle()
      senderName = technician?.name ?? null
    }
    await this.notifyApproversOfDiscountRequest({
      caseId: params.caseId,
      caseType: params.caseType,
      articleName: params.articleName,
      discountPercent: params.discountPercent,
      senderName,
      customerName: params.customerName ?? null,
    })
  }

  /**
   * Svar till den som skapade offerten eller avtalet: rabatten är godkänd
   * eller avslagen. Länken öppnar dokumentet i Dokumentsigneringen.
   */
  static async notifyDocumentDiscountDecision(params: {
    contractId: string
    creatorEmail: string | null
    documentLabel: string
    customerName: string | null
    decidedBy: string
    approved: boolean
    reason?: string | null
  }): Promise<void> {
    if (!params.creatorEmail) return
    try {
      const recipient = await profilFranEpost(params.creatorEmail)
      if (!recipient) return
      const prefix = params.approved ? DOKUMENT_RABATT_PREFIX.godkand : DOKUMENT_RABATT_PREFIX.avslagen
      const kund = params.customerName || 'kunden'
      const preview = params.approved
        ? `${params.decidedBy} har godkänt rabatten. ${params.documentLabel} till ${kund} kan nu skickas.`
        : `${params.decidedBy} har avslagit rabatten${params.reason ? `. Anledning: ${params.reason}` : ''}. Ändra rabatten i ${params.documentLabel.toLowerCase()} innan den skickas.`
      const { error } = await supabase.from('notifications').insert({
        recipient_id: recipient,
        case_id: params.contractId,
        case_type: null,
        title: `${prefix} ${params.documentLabel.toLowerCase()}, ${kund}`,
        preview,
        case_title: params.customerName,
        sender_name: params.decidedBy,
        is_read: false,
      })
      if (error) console.error('Kunde inte skapa dokumentets rabattsvar:', error)
    } catch (error) {
      console.error('Fel vid dokumentets rabattsvar:', error)
    }
  }

  /**
   * Skapa notifikation när en rabatt har godkänts
   */
  static async notifyDiscountApproved(params: {
    technicianId?: string | null
    caseId: string
    caseType: CaseType
    articleName: string
    approvedBy: string
  }): Promise<void> {
    const { technicianId, caseId, caseType, articleName, approvedBy } = params

    if (!technicianId) return

    try {
      const recipient = await profilFranTekniker(technicianId)
      if (!recipient) {
        console.warn('Kunde inte hitta profil för tekniker:', technicianId)
        return
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: recipient,
          case_id: caseId,
          case_type: caseType,
          title: 'Rabatt godkänd',
          preview: `${approvedBy} har godkänt rabatten på "${articleName}"`,
          sender_name: approvedBy,
          is_read: false
        })

      if (error) {
        console.error('Kunde inte skapa godkännande-notifikation:', error)
      }
    } catch (error) {
      console.error('Fel vid skapande av godkännande-notifikation:', error)
    }
  }

  /**
   * Skapa notifikation när en rabatt har avslagits
   */
  static async notifyDiscountRejected(params: {
    technicianId?: string | null
    caseId: string
    caseType: CaseType
    articleName: string
    rejectedBy: string
    reason?: string
  }): Promise<void> {
    const { technicianId, caseId, caseType, articleName, rejectedBy, reason } = params

    if (!technicianId) return

    try {
      const recipient = await profilFranTekniker(technicianId)
      if (!recipient) {
        console.warn('Kunde inte hitta profil för tekniker:', technicianId)
        return
      }

      const preview = reason
        ? `${rejectedBy} har avslagit rabatten på "${articleName}". Anledning: ${reason}`
        : `${rejectedBy} har avslagit rabatten på "${articleName}"`

      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: recipient,
          case_id: caseId,
          case_type: caseType,
          title: 'Rabatt avslagen',
          preview,
          sender_name: rejectedBy,
          is_read: false
        })

      if (error) {
        console.error('Kunde inte skapa avslags-notifikation:', error)
      }
    } catch (error) {
      console.error('Fel vid skapande av avslags-notifikation:', error)
    }
  }
}
