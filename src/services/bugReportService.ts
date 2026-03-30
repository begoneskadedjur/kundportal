// src/services/bugReportService.ts

import { supabase } from '../lib/supabase'
import type { BugReport, BugReportStatus, CreateBugReportInput } from '../types/bugReport'

export class BugReportService {
  static async create(
    input: CreateBugReportInput,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string
  ): Promise<{ data: BugReport | null; error: string | null }> {
    let image_path: string | null = null

    // Skapa rapport först för att få id
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

  static async updateStatus(id: string, status: BugReportStatus): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('bug_reports')
      .update({ status })
      .eq('id', id)

    return { error: error?.message ?? null }
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
      .createSignedUrl(path, 60 * 60) // 1 timme

    return data?.signedUrl ?? null
  }
}
