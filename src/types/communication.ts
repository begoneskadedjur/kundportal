// src/types/communication.ts
// Kommunikationssystem med @mentions och notifikationer

// === ENUMS & KONSTANTER ===

export type CaseType = 'private' | 'business' | 'contract';
export type AuthorRole = 'admin' | 'koordinator' | 'technician';
export type SystemEventType =
  | 'status_change'
  | 'technician_assigned'
  | 'technician_unassigned'
  | 'scheduled'
  | 'rescheduled'
  | 'price_updated'
  | 'case_created';

export type MentionType = 'user' | 'role' | 'all';

// === BILAGOR ===

export interface CommentAttachment {
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  uploaded_at: string;
}

// === KOMMENTARER ===

export interface CaseComment {
  id: string;
  case_id: string;
  case_type: CaseType;
  author_id: string;
  author_name: string;
  author_role: AuthorRole;
  content: string;
  attachments: CommentAttachment[];
  mentioned_user_ids: string[];
  mentioned_roles: string[];
  mentions_all: boolean;
  is_system_comment: boolean;
  system_event_type: SystemEventType | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseCommentInsert {
  case_id: string;
  case_type: CaseType;
  author_id: string;
  author_name: string;
  author_role: AuthorRole;
  content: string;
  attachments?: CommentAttachment[];
  mentioned_user_ids?: string[];
  mentioned_roles?: string[];
  mentions_all?: boolean;
  is_system_comment?: boolean;
  system_event_type?: SystemEventType | null;
}

export interface CaseCommentUpdate {
  content?: string;
  attachments?: CommentAttachment[];
  is_edited?: boolean;
  edited_at?: string;
}

// === NOTIFIKATIONER ===

export interface Notification {
  id: string;
  recipient_id: string;
  source_comment_id: string | null;
  case_id: string;
  case_type: CaseType;
  title: string;
  preview: string;
  case_title: string | null;
  sender_id: string;
  sender_name: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationInsert {
  recipient_id: string;
  source_comment_id?: string | null;
  case_id: string;
  case_type: CaseType;
  title: string;
  preview: string;
  case_title?: string | null;
  sender_id: string;
  sender_name: string;
}

// === MENTIONS ===

export interface MentionSuggestion {
  type: MentionType;
  id?: string;          // User ID för 'user' type
  role?: string;        // Roll för 'role' type
  displayName: string;  // Visningsnamn
  subtitle?: string;    // T.ex. "Tekniker" eller "Alla tekniker (5)"
  avatarUrl?: string;   // Profilbild om tillgänglig
}

export interface ParsedMention {
  type: MentionType;
  value: string;        // Det som skrevs efter @
  userId?: string;      // User ID om det är en specifik användare
  role?: string;        // Roll om det är en rollmention
  startIndex: number;   // Position i texten
  endIndex: number;     // Slutposition i texten
}

// === SYSTEM EVENTS ===

export interface SystemCommentData {
  eventType: SystemEventType;
  oldValue?: string;
  newValue?: string;
  technicianName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

// === SÖKNING ===

export interface CommentSearchResult {
  comment: CaseComment;
  case_id: string;
  case_type: CaseType;
  case_title: string;
  highlight: string;    // Text med sökord highlightat
}

// === UI STATE ===

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  hasMore: boolean;
}

export interface CommentSectionState {
  comments: CaseComment[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

// === KONFIGURATION ===

export const ROLE_MENTIONS: Record<string, { displayName: string; role: string }> = {
  'tekniker': { displayName: '@tekniker', role: 'technician' },
  'koordinator': { displayName: '@koordinator', role: 'koordinator' },
  'admin': { displayName: '@admin', role: 'admin' },
  'alla': { displayName: '@alla', role: 'all' },
};

export const ROLE_COLORS: Record<AuthorRole, { bg: string; text: string; border: string }> = {
  admin: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/40' },
  koordinator: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  technician: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/40' },
};

export const ROLE_DISPLAY_NAMES: Record<AuthorRole, string> = {
  admin: 'Admin',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
};

export const SYSTEM_EVENT_MESSAGES: Record<SystemEventType, (data: SystemCommentData) => string> = {
  status_change: (data) => `Status ändrad från "${data.oldValue}" till "${data.newValue}"`,
  technician_assigned: (data) => `${data.technicianName} tilldelades ärendet`,
  technician_unassigned: (data) => `${data.technicianName} togs bort från ärendet`,
  scheduled: (data) => `Ärendet bokades till ${data.scheduledDate} kl. ${data.scheduledTime}`,
  rescheduled: (data) => `Ärendet ombokades till ${data.scheduledDate} kl. ${data.scheduledTime}`,
  price_updated: (data) => `Pris ändrat från ${data.oldValue} kr till ${data.newValue} kr`,
  case_created: () => `Ärendet skapades`,
};

// === HJÄLPFUNKTIONER ===

export function formatCommentTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Just nu';
  if (diffMinutes < 60) return `${diffMinutes} min sedan`;
  if (diffHours < 24) return `${diffHours} timmar sedan`;
  if (diffDays < 7) return `${diffDays} dagar sedan`;

  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function truncatePreview(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export function getMentionTriggerRegex(): RegExp {
  // Inkludera svenska bokstäver (åäöÅÄÖ) samt vanliga tecken
  return /@([\wåäöÅÄÖ]*)$/;
}

export function extractMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  // Inkludera svenska bokstäver (åäöÅÄÖ) i regex
  const regex = /@([\wåäöÅÄÖ]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const value = match[1].toLowerCase();
    const startIndex = match.index;
    const endIndex = match.index + match[0].length;

    if (value === 'alla') {
      mentions.push({ type: 'all', value, startIndex, endIndex });
    } else if (ROLE_MENTIONS[value]) {
      mentions.push({
        type: 'role',
        value,
        role: ROLE_MENTIONS[value].role,
        startIndex,
        endIndex
      });
    } else {
      // Specifik användare (ID måste lösas upp senare)
      mentions.push({ type: 'user', value, startIndex, endIndex });
    }
  }

  return mentions;
}
