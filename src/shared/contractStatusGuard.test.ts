import { describe, expect, it } from 'vitest'
import {
  isSignedContractRow,
  oneflowNextPageUrl,
  signedContractDeviation,
  syncStatusDecision,
  webhookMayChangeStatus,
} from './contractStatusGuard'

describe('isSignedContractRow', () => {
  it('signerat och aktivt avtal räknas', () => {
    expect(isSignedContractRow({ type: 'contract', status: 'active' })).toBe(true)
    expect(isSignedContractRow({ type: 'contract', status: 'signed' })).toBe(true)
    expect(isSignedContractRow({ type: null, status: 'active' })).toBe(true)
  })
  it('offerter, osignerade och avslutade räknas inte', () => {
    expect(isSignedContractRow({ type: 'offer', status: 'signed' })).toBe(false)
    expect(isSignedContractRow({ type: 'contract', status: 'pending' })).toBe(false)
    expect(isSignedContractRow({ type: 'contract', status: 'trashed' })).toBe(false)
    expect(isSignedContractRow(null)).toBe(false)
  })
})

describe('syncStatusDecision', () => {
  it('rör aldrig ett aktivt avtal när Oneflow säger signed (gamla nattliga skrivningen)', () => {
    expect(syncStatusDecision({ type: 'contract', status: 'active' }, 'signed')).toEqual({ change: false, reason: 'signerat' })
  })
  it('rör aldrig ett signerat avtal som avböjts, makulerats eller gått ut i Oneflow', () => {
    for (const state of ['declined', 'canceled', 'cancelled', 'expired', 'pending', 'overdue']) {
      expect(syncStatusDecision({ type: 'contract', status: 'signed' }, state).change).toBe(false)
      expect(syncStatusDecision({ type: 'contract', status: 'active' }, state).change).toBe(false)
    }
  })
  it('rör aldrig ett uppsagt eller avslutat avtal', () => {
    expect(syncStatusDecision({ status: 'pending', terminated_at: '2026-11-01' }, 'signed')).toEqual({ change: false, reason: 'uppsagt' })
    expect(syncStatusDecision({ status: 'trashed' }, 'signed')).toEqual({ change: false, reason: 'avslutat' })
    expect(syncStatusDecision({ status: 'ended' }, 'signed')).toEqual({ change: false, reason: 'avslutat' })
    expect(syncStatusDecision({ status: 'declined' }, 'signed')).toEqual({ change: false, reason: 'avslutat' })
  })
  it('före signering följer synken Oneflow uppåt', () => {
    expect(syncStatusDecision({ type: 'contract', status: 'pending' }, 'signed')).toEqual({ change: true, to: 'signed' })
    expect(syncStatusDecision({ type: 'contract', status: 'pending' }, 'declined')).toEqual({ change: true, to: 'declined' })
    expect(syncStatusDecision({ type: 'contract', status: 'pending' }, 'expired')).toEqual({ change: true, to: 'overdue' })
    expect(syncStatusDecision({ type: 'offer', status: 'overdue' }, 'completed')).toEqual({ change: true, to: 'signed' })
  })
  it('före signering: ingen nedgradering och ingen skrivning vid samma status', () => {
    expect(syncStatusDecision({ status: 'overdue' }, 'pending')).toEqual({ change: false, reason: 'nedgradering' })
    expect(syncStatusDecision({ status: 'pending' }, 'published')).toEqual({ change: false, reason: 'samma' })
  })
  it('signerad offert rörs inte heller', () => {
    expect(syncStatusDecision({ type: 'offer', status: 'signed' }, 'declined').change).toBe(false)
  })
})

describe('signedContractDeviation', () => {
  it('loggar signerat avtal som Oneflow visar avböjt', () => {
    expect(signedContractDeviation({ type: 'contract', status: 'active' }, 'declined')).toBe('declined')
    expect(signedContractDeviation({ type: 'contract', status: 'signed' }, 'canceled')).toBe('canceled')
  })
  it('ingen avvikelse när Oneflow också säger signerat, eller för osignerade', () => {
    expect(signedContractDeviation({ type: 'contract', status: 'active' }, 'signed')).toBeNull()
    expect(signedContractDeviation({ type: 'contract', status: 'active' }, 'completed')).toBeNull()
    expect(signedContractDeviation({ type: 'contract', status: 'pending' }, 'declined')).toBeNull()
  })
})

describe('webhookMayChangeStatus', () => {
  it('delete, decline och livscykel får inte ändra signerade avtal', () => {
    expect(webhookMayChangeStatus({ type: 'contract', status: 'active' })).toBe(false)
    expect(webhookMayChangeStatus({ type: 'contract', status: 'signed' })).toBe(false)
  })
  it('före signering, offerter och okända rader körs som förut', () => {
    expect(webhookMayChangeStatus({ type: 'contract', status: 'pending' })).toBe(true)
    expect(webhookMayChangeStatus({ type: 'offer', status: 'signed' })).toBe(true)
    expect(webhookMayChangeStatus(null)).toBe(true)
  })
})

describe('oneflowNextPageUrl', () => {
  it('följer href', () => {
    expect(oneflowNextPageUrl({ _links: { next: { href: 'https://api.oneflow.com/v1/contracts?limit=100&offset=100' } } }))
      .toBe('https://api.oneflow.com/v1/contracts?limit=100&offset=100')
  })
  it('slutar när href är null (objektet finns alltid)', () => {
    expect(oneflowNextPageUrl({ _links: { next: { href: null } } })).toBeNull()
    expect(oneflowNextPageUrl({ _links: {} })).toBeNull()
    expect(oneflowNextPageUrl([])).toBeNull()
    expect(oneflowNextPageUrl(null)).toBeNull()
  })
  it('skickar aldrig nyckeln till en annan värd', () => {
    expect(oneflowNextPageUrl({ _links: { next: { href: 'https://evil.example/v1/contracts' } } })).toBeNull()
    expect(oneflowNextPageUrl({ _links: { next: { href: 'http://api.oneflow.com/v1/contracts' } } })).toBeNull()
  })
  it('relativ href löses mot api.oneflow.com', () => {
    expect(oneflowNextPageUrl({ _links: { next: { href: '/v1/contracts?offset=200' } } }))
      .toBe('https://api.oneflow.com/v1/contracts?offset=200')
  })
})
