// src/types/bugReport.ts

export type BugReportStatus = 'unhandled' | 'in_progress' | 'resolved'

export interface BugReport {
  id: string
  title: string
  description: string
  url: string | null
  image_path: string | null
  status: BugReportStatus
  reported_by_id: string | null
  reported_by_name: string | null
  reported_by_email: string | null
  reported_by_role: string | null
  created_at: string
  updated_at: string
}

export interface CreateBugReportInput {
  title: string
  description: string
  url?: string
  image?: File
}

export const BUG_STATUS_CONFIG: Record<BugReportStatus, { label: string; color: string; bgClass: string; textClass: string }> = {
  unhandled: {
    label: 'Obehandlad',
    color: 'red',
    bgClass: 'bg-red-500/20',
    textClass: 'text-red-400',
  },
  in_progress: {
    label: 'Pågående',
    color: 'amber',
    bgClass: 'bg-amber-500/20',
    textClass: 'text-amber-400',
  },
  resolved: {
    label: 'Åtgärdad',
    color: 'green',
    bgClass: 'bg-green-500/20',
    textClass: 'text-green-400',
  },
}
