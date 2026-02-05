// src/services/discountNotificationService.ts
// Service för att skicka notifikationer om rabatter som kräver godkännande

import { supabase } from '../lib/supabase'

export class DiscountNotificationService {
  /**
   * Skapa notifikation till alla admins när en rabatt kräver godkännande
   */
  static async notifyAdminsOfDiscountRequest(params: {
    caseId: string
    caseType: 'private' | 'business' | 'contract'
    articleName: string
    discountPercent: number
    technicianId?: string | null
    technicianName?: string | null
    customerName?: string
  }): Promise<void> {
    const {
      caseId,
      caseType,
      articleName,
      discountPercent,
      technicianId,
      technicianName,
      customerName
    } = params

    try {
      // Hämta alla admin-användare
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .eq('role', 'admin')

      if (adminError) {
        console.error('Kunde inte hämta admins för notifikation:', adminError)
        return
      }

      if (!admins?.length) {
        console.warn('Inga admin-användare hittades för rabatt-notifikation')
        return
      }

      // Hämta tekniker-namn om inte redan angivet
      let senderName = technicianName || 'Tekniker'
      if (!technicianName && technicianId) {
        const { data: technician } = await supabase
          .from('technicians')
          .select('name')
          .eq('id', technicianId)
          .single()

        if (technician?.name) {
          senderName = technician.name
        }
      }

      // Skapa notifikationer för varje admin
      const notifications = admins.map(admin => ({
        recipient_id: admin.id,
        case_id: caseId,
        case_type: caseType,
        title: 'Rabatt kräver godkännande',
        preview: customerName
          ? `${senderName} har gett ${discountPercent}% rabatt på "${articleName}" för ${customerName}`
          : `${senderName} har gett ${discountPercent}% rabatt på "${articleName}"`,
        sender_name: senderName,
        sender_id: technicianId || null,
        is_read: false,
        source_comment_id: null, // Inte kopplat till en kommentar
        case_title: customerName || null
      }))

      const { error: notifyError } = await supabase
        .from('notifications')
        .insert(notifications)

      if (notifyError) {
        console.error('Kunde inte skapa rabatt-notifikationer:', notifyError)
        return
      }

      console.log(`[DiscountNotificationService] Skickade ${admins.length} notifikationer för rabatt på ${articleName}`)
    } catch (error) {
      console.error('Fel vid skapande av rabatt-notifikation:', error)
    }
  }

  /**
   * Skapa notifikation när en rabatt har godkänts
   */
  static async notifyDiscountApproved(params: {
    technicianId?: string | null
    caseId: string
    caseType: 'private' | 'business' | 'contract'
    articleName: string
    approvedBy: string
  }): Promise<void> {
    const { technicianId, caseId, caseType, articleName, approvedBy } = params

    if (!technicianId) return

    try {
      // Hämta tekniker-profil-ID (profiles.id, inte technicians.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('technician_id', technicianId)
        .single()

      if (profileError || !profile) {
        console.warn('Kunde inte hitta profil för tekniker:', technicianId)
        return
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: profile.id,
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
    caseType: 'private' | 'business' | 'contract'
    articleName: string
    rejectedBy: string
    reason?: string
  }): Promise<void> {
    const { technicianId, caseId, caseType, articleName, rejectedBy, reason } = params

    if (!technicianId) return

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('technician_id', technicianId)
        .single()

      if (profileError || !profile) {
        console.warn('Kunde inte hitta profil för tekniker:', technicianId)
        return
      }

      const preview = reason
        ? `${rejectedBy} har avslagit rabatten på "${articleName}". Anledning: ${reason}`
        : `${rejectedBy} har avslagit rabatten på "${articleName}"`

      const { error } = await supabase
        .from('notifications')
        .insert({
          recipient_id: profile.id,
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
