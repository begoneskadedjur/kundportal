// Skicka godkända till Fortnox (3.125.0): en faktura i taget, paus mellan,
// ett fel stoppar inte resten. Sändningen är mockad: inga riktiga utkast.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../../services/invoiceService', () => ({ InvoiceService: {} }))
vi.mock('../../../../services/invoiceDeliveryService', () => ({ InvoiceDeliveryError: class extends Error {} }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import { runFortnoxBatch, plainText, type BatchInvoice } from './queueActions'
import type { FortnoxSendResult } from '../../../../services/invoiceFortnoxSendService'

const inv = (id: string): BatchInvoice => ({ id, customerName: `Kund ${id}`, invoiceNumber: `INV-${id}`, amount: 1000 })

describe('runFortnoxBatch', () => {
  it('skickar i ordning, en i taget, med paus mellan', async () => {
    const log: string[] = []
    let running = 0
    const send = vi.fn(async (id: string): Promise<FortnoxSendResult> => {
      running++
      expect(running).toBe(1)
      log.push(`send ${id}`)
      await Promise.resolve()
      running--
      return { status: 'created', documentNumber: `F${id}`, invoiceNumber: `INV-${id}` }
    })
    const sleep = vi.fn(async (ms: number) => { log.push(`paus ${ms}`) })
    const progress: number[] = []

    const out = await runFortnoxBatch([inv('1'), inv('2'), inv('3')], { send, sleep, pauseMs: 1500, onProgress: (_, done) => progress.push(done) })

    expect(log).toEqual(['send 1', 'paus 1500', 'send 2', 'paus 1500', 'send 3'])
    expect(progress).toEqual([1, 2, 3])
    expect(out.map((o) => [o.status, o.message])).toEqual([
      ['created', 'Fortnox nr F1'],
      ['created', 'Fortnox nr F2'],
      ['created', 'Fortnox nr F3'],
    ])
  })

  it('ett fel stoppar inte resten och hoppade över får sin orsak', async () => {
    const results: Record<string, FortnoxSendResult | Error> = {
      a: { status: 'failed', message: 'Kunde inte skicka till Fortnox: Ogiltig artikel' },
      b: new Error('Nätverksfel'),
      c: { status: 'blocked', message: 'Kunden saknar kundnummer — lägg till det på kundkortet innan du skickar till Fortnox' },
      d: { status: 'candidates', kind: 'multiple', candidates: [], message: 'Flera' },
      e: { status: 'created', documentNumber: '77', invoiceNumber: 'INV-e' },
    }
    const send = vi.fn(async (id: string, notify: { info: (m: string, o: { icon: string }) => void }) => {
      const r = results[id]
      if (r instanceof Error) throw r
      if (r.status === 'created') notify.info('Ny Fortnox-kund 10600', { icon: 'x' })
      return r
    })

    const out = await runFortnoxBatch(['a', 'b', 'c', 'd', 'e'].map(inv), { send, pauseMs: 0 })

    expect(send).toHaveBeenCalledTimes(5)
    expect(out.map((o) => o.status)).toEqual(['failed', 'failed', 'skipped', 'skipped', 'created'])
    expect(out[1].message).toBe('Kunde inte skicka till Fortnox: Nätverksfel')
    // Inga tankstreck i listan
    expect(out[2].message).toBe('Kunden saknar kundnummer, lägg till det på kundkortet innan du skickar till Fortnox')
    expect(out[3].message).toContain('Öppna fakturan')
    expect(out[4].notes).toEqual(['Ny Fortnox-kund 10600'])
  })

  it('plainText byter tankstreck mot komma', () => {
    expect(plainText('A — B')).toBe('A, B')
  })
})
