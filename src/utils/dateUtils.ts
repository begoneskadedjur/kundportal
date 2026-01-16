// src/utils/dateUtils.ts
// Datumhjälpfunktioner för formatering

/**
 * Formaterar tiden sedan ett datum på svenska
 * T.ex. "2 minuter sedan", "1 timme sedan", "3 dagar sedan"
 */
export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return 'just nu';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? 'minut' : 'minuter'} sedan`;
  }

  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'timme' : 'timmar'} sedan`;
  }

  if (diffDays < 7) {
    return `${diffDays} ${diffDays === 1 ? 'dag' : 'dagar'} sedan`;
  }

  if (diffWeeks < 4) {
    return `${diffWeeks} ${diffWeeks === 1 ? 'vecka' : 'veckor'} sedan`;
  }

  if (diffMonths < 12) {
    return `${diffMonths} ${diffMonths === 1 ? 'månad' : 'månader'} sedan`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} ${diffYears === 1 ? 'år' : 'år'} sedan`;
}

/**
 * Formaterar ett datum till svensk ISO-format (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Formaterar ett datum med tid (YYYY-MM-DD HH:mm)
 */
export function formatDateTime(date: Date): string {
  const dateStr = formatDate(date);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}
