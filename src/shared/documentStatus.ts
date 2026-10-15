// src/shared/documentStatus.ts
// Ärendestatusar och signeringsregler för dokument (offert och avtal) som
// skickas via Oneflow. Ren modul utan databas: delas av webhooken
// (api/oneflow/webhook.ts), signeringsbehandlingen (api/_lib/contractSigning.ts)
// och alla vyer som visar ärendets dokumentsteg.
//
// Beslut 2026-10-15 (Christian): ett avtal får egna ärendestatusar,
// "Avtal skickat" och "Avtal signerat - Etablera". Offerter behåller
// "Offert skickad" och "Offert signerad - boka in". Listor, schema, dashboards,
// kundresa, sök och kundportalen behandlar avtalsstatusarna som SAMMA steg
// som offertstatusarna; jämför därför alltid via hjälparna här, aldrig mot en
// enskild sträng.

export const OFFER_SENT_STATUS = 'Offert skickad' as const
export const OFFER_SIGNED_STATUS = 'Offert signerad - boka in' as const
export const CONTRACT_SENT_STATUS = 'Avtal skickat' as const
export const CONTRACT_SIGNED_STATUS = 'Avtal signerat - Etablera' as const

/** Dokumentet är skickat och väntar på kundens signatur */
export const DOCUMENT_SENT_STATUSES: readonly string[] = [OFFER_SENT_STATUS, CONTRACT_SENT_STATUS]
/** Dokumentet är signerat och ärendet väntar på bokning (offert) eller etablering (avtal) */
export const DOCUMENT_SIGNED_AWAITING_STATUSES: readonly string[] = [OFFER_SIGNED_STATUS, CONTRACT_SIGNED_STATUS]
/** Alla fyra dokumentstatusar */
export const DOCUMENT_STEP_STATUSES: readonly string[] = [...DOCUMENT_SENT_STATUSES, ...DOCUMENT_SIGNED_AWAITING_STATUSES]

export type DocumentKind = 'offer' | 'contract'
export type DocumentStep = 'sent' | 'signed'

export function isDocumentSentStatus(status: string | null | undefined): boolean {
  return !!status && DOCUMENT_SENT_STATUSES.includes(status)
}

export function isDocumentSignedAwaitingStatus(status: string | null | undefined): boolean {
  return !!status && DOCUMENT_SIGNED_AWAITING_STATUSES.includes(status)
}

/** Skickat eller signerat: ärendet står i dokumentflödet */
export function isDocumentStepStatus(status: string | null | undefined): boolean {
  return isDocumentSentStatus(status) || isDocumentSignedAwaitingStatus(status)
}

/** Statusen gäller ett avtal (inte en offert) */
export function isContractDocumentStatus(status: string | null | undefined): boolean {
  return status === CONTRACT_SENT_STATUS || status === CONTRACT_SIGNED_STATUS
}

/** contracts.type → dokumentslag. Allt som inte uttryckligen är ett avtal behandlas som offert. */
export function documentKindOf(type: string | null | undefined): DocumentKind {
  return type === 'contract' ? 'contract' : 'offer'
}

/** Ärendestatusen för ett dokumentsteg */
export function caseStatusForDocument(kind: DocumentKind, step: DocumentStep): string {
  if (kind === 'contract') return step === 'sent' ? CONTRACT_SENT_STATUS : CONTRACT_SIGNED_STATUS
  return step === 'sent' ? OFFER_SENT_STATUS : OFFER_SIGNED_STATUS
}

/**
 * Nyckeln för filter och räkning per steg: avtalets statusar räknas som
 * offertens ("Avtal skickat" → "Offert skickad"). Övriga statusar oförändrade.
 */
export function documentStepKey(status: string): string
export function documentStepKey(status: string | null | undefined): string | null | undefined
export function documentStepKey(status: string | null | undefined): string | null | undefined {
  if (isDocumentSentStatus(status)) return OFFER_SENT_STATUS
  if (isDocumentSignedAwaitingStatus(status)) return OFFER_SIGNED_STATUS
  return status
}

/** Två statusar är samma steg (avtal och offert räknas lika) */
export function sameDocumentStep(a: string | null | undefined, b: string | null | undefined): boolean {
  return documentStepKey(a) === documentStepKey(b)
}

/** "Avtal" eller "Offert", för rubriker och etiketter */
export function documentWord(kind: DocumentKind): string {
  return kind === 'contract' ? 'Avtal' : 'Offert'
}

export type DocumentEvent = 'sent' | 'signed' | 'declined' | 'expired'

/** Loggtexten i ärendets kommunikationspanel och i händelseloggen */
export function documentEventText(kind: DocumentKind, event: DocumentEvent, name?: string | null): string {
  const who = (name ?? '').trim() || 'mottagaren'
  if (kind === 'contract') {
    switch (event) {
      case 'sent': return `Avtal skickat till ${who}`
      case 'signed': return `Avtal signerat av ${who}`
      case 'declined': return 'Avtal nekat av mottagaren'
      case 'expired': return 'Avtalets giltighetstid har gått ut'
    }
  }
  switch (event) {
    case 'sent': return `Offert skickad till ${who}`
    case 'signed': return `Offert signerad av ${who}`
    case 'declined': return 'Offert nekad av mottagaren'
    case 'expired': return 'Offertens giltighetstid har gått ut'
  }
}

/** Kundvänlig etikett för dokumentstegen (kundportalen) */
export function customerDocumentStatusLabel(status: string | null | undefined): string | null {
  switch (status) {
    case OFFER_SENT_STATUS: return 'Offert skickad'
    case OFFER_SIGNED_STATUS: return 'Offert signerad'
    case CONTRACT_SENT_STATUS: return 'Avtal skickat'
    case CONTRACT_SIGNED_STATUS: return 'Avtal signerat'
    default: return null
  }
}

// --- Signerade dokument (contracts.status) ---------------------------------
//
// Triggern contract_signed_becomes_active byter signed → active direkt när
// avtalets startdatum redan passerat. Ett avtal som signeras på eller efter
// startdagen står alltså aldrig som 'signed' i databasen. Både 'signed' och
// 'active' är signerade avtal.

/** contracts.status för ett signerat (levande) avtal eller en signerad offert */
export function isSignedContractStatus(status: string | null | undefined): boolean {
  return status === 'signed' || status === 'active'
}

/**
 * Dokumentet räknas som signerat i dokumentsigneringen (kö, statistik,
 * signeringsgrad): 'signed', eller 'active' med signeringsdatum.
 */
export function isSignedDocument(doc: { status?: string | null; signed_at?: string | null }): boolean {
  if (doc.status === 'signed') return true
  return doc.status === 'active' && !!doc.signed_at
}

/**
 * Normaliserar ett dokument för dokumentsigneringens vyer: ett aktivt avtal
 * med signeringsdatum visas som 'signed' (samma steg: signerat, väntar på
 * bokning eller etablering). Övriga rader lämnas orörda.
 */
export function normalizeSignedDocument<T extends { status: string; signed_at?: string | null; status_updated_at?: string | null }>(doc: T): T {
  if (doc.status !== 'active' || !doc.signed_at) return doc
  // status_updated_at är när avtalet blev aktivt. Har det skett senare än
  // signeringsdagen (nattjobbet) räknas signeringstiden från signeringsdagen.
  const at = doc.status_updated_at
  const signedAt = at && at.slice(0, 10) <= doc.signed_at ? at : `${doc.signed_at}T12:00:00`
  return 'status_updated_at' in doc ? { ...doc, status: 'signed', status_updated_at: signedAt } : { ...doc, status: 'signed' }
}

/**
 * PostgREST-filter (.or) för dokumentsigneringens frågor: de vanliga
 * statusarna plus aktiva avtal från vår kedja (wizarden, created_by_email)
 * med signeringsdatum. Äldre importerade aktiva avtal hör inte till kön.
 */
export function signedDocumentsOrFilter(statuses: readonly string[]): string {
  return `status.in.(${statuses.join(',')}),and(status.eq.active,signed_at.not.is.null,created_by_email.not.is.null)`
}
