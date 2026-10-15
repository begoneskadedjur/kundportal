import { describe, expect, it } from 'vitest'
import {
  caseStatusForDocument,
  customerDocumentStatusLabel,
  documentEventText,
  documentKindOf,
  documentStepKey,
  isContractDocumentStatus,
  isDocumentSentStatus,
  isDocumentSignedAwaitingStatus,
  isDocumentStepStatus,
  isSignedContractStatus,
  isSignedDocument,
  normalizeSignedDocument,
  sameDocumentStep,
  signedDocumentsOrFilter,
} from './documentStatus'

describe('ärendestatusar för dokument', () => {
  it('avtal och offert är samma steg', () => {
    expect(isDocumentSentStatus('Offert skickad')).toBe(true)
    expect(isDocumentSentStatus('Avtal skickat')).toBe(true)
    expect(isDocumentSignedAwaitingStatus('Offert signerad - boka in')).toBe(true)
    expect(isDocumentSignedAwaitingStatus('Avtal signerat - Etablera')).toBe(true)
    expect(isDocumentStepStatus('Bokad')).toBe(false)
    expect(isDocumentSentStatus(null)).toBe(false)
    expect(sameDocumentStep('Avtal skickat', 'Offert skickad')).toBe(true)
    expect(sameDocumentStep('Avtal signerat - Etablera', 'Offert skickad')).toBe(false)
    expect(documentStepKey('Avtal signerat - Etablera')).toBe('Offert signerad - boka in')
    expect(documentStepKey('Bokad')).toBe('Bokad')
  })

  it('väljer status efter dokumentslag', () => {
    expect(caseStatusForDocument('contract', 'sent')).toBe('Avtal skickat')
    expect(caseStatusForDocument('contract', 'signed')).toBe('Avtal signerat - Etablera')
    expect(caseStatusForDocument('offer', 'sent')).toBe('Offert skickad')
    expect(caseStatusForDocument('offer', 'signed')).toBe('Offert signerad - boka in')
    expect(documentKindOf('contract')).toBe('contract')
    expect(documentKindOf('offer')).toBe('offer')
    expect(documentKindOf(null)).toBe('offer')
    expect(isContractDocumentStatus('Avtal skickat')).toBe(true)
    expect(isContractDocumentStatus('Offert skickad')).toBe(false)
  })

  it('loggtexter säger avtal för avtal', () => {
    expect(documentEventText('contract', 'sent', 'Pär-Eric Nilsson')).toBe('Avtal skickat till Pär-Eric Nilsson')
    expect(documentEventText('contract', 'signed', 'Pär-Eric Nilsson')).toBe('Avtal signerat av Pär-Eric Nilsson')
    expect(documentEventText('offer', 'signed', '')).toBe('Offert signerad av mottagaren')
    expect(documentEventText('contract', 'declined')).toBe('Avtal nekat av mottagaren')
    expect(documentEventText('offer', 'expired')).toBe('Offertens giltighetstid har gått ut')
  })

  it('kundportalens etiketter', () => {
    expect(customerDocumentStatusLabel('Avtal signerat - Etablera')).toBe('Avtal signerat')
    expect(customerDocumentStatusLabel('Offert signerad - boka in')).toBe('Offert signerad')
    expect(customerDocumentStatusLabel('Bokad')).toBeNull()
  })
})

describe('signerade dokument', () => {
  it('signed och active är signerade avtal', () => {
    expect(isSignedContractStatus('signed')).toBe(true)
    expect(isSignedContractStatus('active')).toBe(true)
    expect(isSignedContractStatus('pending')).toBe(false)
  })

  it('active räknas som signerat bara med signeringsdatum', () => {
    expect(isSignedDocument({ status: 'signed' })).toBe(true)
    expect(isSignedDocument({ status: 'active', signed_at: '2026-10-15' })).toBe(true)
    expect(isSignedDocument({ status: 'active', signed_at: null })).toBe(false)
  })

  it('normaliserar aktivt avtal till signed och flyttar tidpunkten till signeringsdagen', () => {
    const row = { id: 'a', status: 'active', signed_at: '2026-08-31', status_updated_at: '2026-10-15T03:01:11+00:00' }
    expect(normalizeSignedDocument(row)).toEqual({ ...row, status: 'signed', status_updated_at: '2026-08-31T12:00:00' })
    const sameDay = { id: 'b', status: 'active', signed_at: '2026-10-15', status_updated_at: '2026-10-15T11:45:44+00:00' }
    expect(normalizeSignedDocument(sameDay).status_updated_at).toBe('2026-10-15T11:45:44+00:00')
    const pending = { id: 'c', status: 'pending', signed_at: null }
    expect(normalizeSignedDocument(pending)).toBe(pending)
    expect(normalizeSignedDocument({ status: 'active', signed_at: '2026-10-01' })).toEqual({ status: 'signed', signed_at: '2026-10-01' })
  })

  it('PostgREST-filtret tar med aktiva avtal från vår kedja', () => {
    expect(signedDocumentsOrFilter(['pending', 'signed'])).toBe(
      'status.in.(pending,signed),and(status.eq.active,signed_at.not.is.null,created_by_email.not.is.null)'
    )
  })
})
