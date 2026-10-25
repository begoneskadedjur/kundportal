// src/shared/dokumentNotis.ts
// Notiser om ett dokument (offert eller avtal i contracts): påminnelse om
// uppföljning (Påminn teknikern, src/services/bokaInService.ts paminnTekniker)
// och rabatt på dokumentet (att godkänna, godkänd, avslagen). Notisen har
// case_id = contracts.id och case_type null: notifications_case_type_check
// saknar en dokumenttyp och kan inte utökas utan att constrainten byts.
// Notislistorna känner igen den på rubrikens början.

export const DOKUMENT_PAMINNELSE_PREFIX = 'Påminnelse: följ upp'

/** Rabatt på en offert eller ett avtal (src/services/discountNotificationService.ts) */
export const DOKUMENT_RABATT_PREFIX = {
  att_godkanna: 'Rabatt att godkänna:',
  godkand: 'Rabatt godkänd:',
  avslagen: 'Rabatt avslagen:',
} as const

const DOKUMENT_PREFIX = [DOKUMENT_PAMINNELSE_PREFIX, ...Object.values(DOKUMENT_RABATT_PREFIX)]

/** Notis som ska öppna Dokumentsigneringen (påminnelse eller rabatt på dokument) */
export function arDokumentPaminnelse(n: { case_type?: string | null; title?: string | null }): boolean {
  const titel = n.title ?? ''
  return !n.case_type && DOKUMENT_PREFIX.some(p => titel.startsWith(p))
}

/** Dokumentsigneringen med dokumentet öppet, i den portal användaren står i */
export function dokumentPaminnelseLank(caseId: string | null | undefined, pathname: string): string {
  const base = pathname.includes('/koordinator')
    ? '/koordinator'
    : pathname.includes('/admin')
      ? '/admin'
      : pathname.includes('/saljare')
        ? '/saljare'
        : '/technician'
  return `${base}/dokumentsignering${caseId ? `?id=${caseId}` : ''}`
}
