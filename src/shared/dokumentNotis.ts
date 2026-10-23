// src/shared/dokumentNotis.ts
// Påminnelse om ett dokument (Påminn teknikern, src/services/bokaInService.ts
// paminnTekniker). Notisen har case_id = contracts.id och case_type null:
// notifications_case_type_check saknar en dokumenttyp och kan inte utökas utan
// att constrainten byts. Notislistorna känner igen den på rubrikens början.

export const DOKUMENT_PAMINNELSE_PREFIX = 'Påminnelse: följ upp'

export function arDokumentPaminnelse(n: { case_type?: string | null; title?: string | null }): boolean {
  return !n.case_type && (n.title ?? '').startsWith(DOKUMENT_PAMINNELSE_PREFIX)
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
