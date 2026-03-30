// src/services/bugReportService.ts

import { supabase } from '../lib/supabase'
import type { BugReport, BugReportStatus, CreateBugReportInput } from '../types/bugReport'
import { BUG_STATUS_CONFIG } from '../types/bugReport'

const BUG_ADMIN_ID = '4ef86aa9-8f9f-4602-a4fd-967d0424697a'

export class BugReportService {
  static async create(
    input: CreateBugReportInput,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string
  ): Promise<{ data: BugReport | null; error: string | null }> {
    // Skapa rapport
    const { data: report, error: insertError } = await supabase
      .from('bug_reports')
      .insert({
        title: input.title,
        description: input.description,
        url: input.url || null,
        image_path: null,
        status: 'unhandled',
        reported_by_id: userId,
        reported_by_name: userName,
        reported_by_email: userEmail,
        reported_by_role: userRole,
      })
      .select()
      .single()

    if (insertError) return { data: null, error: insertError.message }

    // Ladda upp bild om sådan finns
    let image_path: string | null = null
    if (input.image && report) {
      const uploadResult = await BugReportService.uploadImage(input.image, report.id)
      if (uploadResult.path) {
        image_path = uploadResult.path
        await supabase
          .from('bug_reports')
          .update({ image_path })
          .eq('id', report.id)
      }
    }

    // Notis till christian.k@begone.se om ny buggrapport
    if (userId !== BUG_ADMIN_ID) {
      await supabase.from('notifications').insert({
        recipient_id: BUG_ADMIN_ID,
        case_id: null,
        case_type: null,
        title: 'Ny buggrapport inkom',
        preview: `${userName}: ${input.title}`,
        sender_id: userId,
        sender_name: userName,
        source_comment_id: null,
        case_title: input.title,
      })
    }

    return { data: { ...report, image_path }, error: null }
  }

  static async getAll(): Promise<BugReport[]> {
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return []
    return data as BugReport[]
  }

  static async getOwn(): Promise<BugReport[]> {
    const { data, error } = await supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return []
    return data as BugReport[]
  }

  static async updateStatus(
    id: string,
    status: BugReportStatus,
    adminId: string
  ): Promise<{ error: string | null }> {
    // Hämta rapporten för att kunna skicka notis till rapportören
    const { data: report } = await supabase
      .from('bug_reports')
      .select('reported_by_id, reported_by_name, title')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('bug_reports')
      .update({ status })
      .eq('id', id)

    if (error) return { error: error.message }

    // Skicka notis till rapportören (om det inte är admin själv)
    if (report?.reported_by_id && report.reported_by_id !== BUG_ADMIN_ID) {
      await supabase.from('notifications').insert({
        recipient_id: report.reported_by_id,
        case_id: null,
        case_type: null,
        title: 'Din buggrapport uppdaterades',
        preview: `Status ändrades till: ${BUG_STATUS_CONFIG[status].label}`,
        sender_id: adminId,
        sender_name: 'BeGone Support',
        source_comment_id: null,
        case_title: report.title,
      })
    }

    return { error: null }
  }

  static async uploadImage(file: File, reportId: string): Promise<{ path: string | null }> {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${reportId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('bug-reports')
      .upload(path, file, { cacheControl: '3600', upsert: false })

    if (error) return { path: null }
    return { path }
  }

  static async getImageUrl(path: string): Promise<string | null> {
    const { data } = await supabase.storage
      .from('bug-reports')
      .createSignedUrl(path, 60 * 60)

    return data?.signedUrl ?? null
  }
}
