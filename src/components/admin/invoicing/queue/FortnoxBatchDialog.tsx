// src/components/admin/invoicing/queue/FortnoxBatchDialog.tsx
// Skicka godkända till Fortnox (3.125.0): bekräftelse, förlopp och resultat
// när flera godkända fakturor blir utkast i Fortnox. Fakturorna skickas en i
// taget med runFortnoxBatch (queueActions.ts) och sendInvoiceToFortnox, samma
// väg som Skapa utkast i Fortnox i fakturamodalen. Ett fel stoppar inte resten.

import { useEffect, useState } from 'react'
import Modal from '../../../ui/Modal'
import { Icon } from '../../../icons/Icon'
import { sendInvoiceToFortnox } from '../../../../services/invoiceFortnoxSendService'
import { StatusText } from './QueueParts'
import { fmtKr, type Tone } from './queueUtils'
import { runFortnoxBatch, type BatchInvoice, type BatchOutcome, type BatchStatus } from './queueActions'

type Phase = 'confirm' | 'running' | 'done'

const STATUS_TONE: Record<BatchStatus, Tone> = { created: 'green', failed: 'red', skipped: 'orange' }

const utkast = (n: number) => `${n} utkast`

export default function FortnoxBatchDialog({
  invoices,
  amountLabel,
  actor,
  onClose,
  onFinished,
}: {
  /** Tom lista = stängd */
  invoices: BatchInvoice[]
  /** "exkl. moms" eller "inkl. moms", som listan visar beloppen */
  amountLabel: string
  actor: { userId: string; name: string } | null
  onClose: () => void
  /** Körningen är klar: listan laddas om */
  onFinished: () => void
}) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [outcomes, setOutcomes] = useState<Map<string, BatchOutcome>>(new Map())
  const [done, setDone] = useState(0)

  const open = invoices.length > 0
  const listKey = invoices.map((i) => i.id).join(',')
  useEffect(() => {
    setPhase('confirm')
    setOutcomes(new Map())
    setDone(0)
  }, [listKey])

  if (!open) return null

  const n = invoices.length
  const total = invoices.reduce((s, i) => s + i.amount, 0)
  const all = [...outcomes.values()]
  const count = (st: BatchStatus) => all.filter((o) => o.status === st).length

  const start = async () => {
    setPhase('running')
    try {
      await runFortnoxBatch(invoices, {
        send: (id, notify) => sendInvoiceToFortnox(id, { notify, actor, requireStatus: 'ready' }),
        onProgress: (outcome, d) => {
          setOutcomes((prev) => new Map(prev).set(outcome.id, outcome))
          setDone(d)
        },
      })
    } finally {
      setPhase('done')
      onFinished()
    }
  }

  const close = () => {
    if (phase !== 'running') onClose()
  }

  const title =
    phase === 'confirm' ? `Skapa ${utkast(n)} i Fortnox`
    : phase === 'running' ? 'Skapar utkast i Fortnox'
    : 'Utkast i Fortnox'

  const btnSecondary =
    'min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
  const btnPrimary =
    'min-h-[44px] px-4 rounded-lg bg-[#20c58f] hover:bg-[#1bab7c] text-[#fff] text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

  const footer = (
    <div className="flex flex-wrap justify-end gap-2 px-4 py-2.5">
      {phase === 'confirm' && (
        <>
          <button type="button" onClick={onClose} className={btnSecondary}>Avbryt</button>
          <button type="button" onClick={start} autoFocus className={btnPrimary}>
            <Icon name="rapport.skicka" size={16} />
            Skapa {utkast(n)}
          </button>
        </>
      )}
      {phase === 'running' && (
        <button type="button" disabled className={btnPrimary}>
          <Icon name="allman.laddar" size={16} className="animate-spin" />
          Skapar {Math.min(done + 1, n)} av {n}
        </button>
      )}
      {phase === 'done' && (
        <button type="button" onClick={onClose} autoFocus className={btnPrimary}>Stäng</button>
      )}
    </div>
  )

  return (
    <Modal isOpen onClose={close} preventClose={phase === 'running'} size="md" zIndex={110} title={title} footer={footer}>
      <div className="p-4 space-y-3">
        {phase === 'confirm' ? (
          <p className="text-sm text-slate-300">
            Varje faktura blir ett utkast i Fortnox, en i taget, på samma sätt som Skapa utkast i Fortnox i fakturan. Fakturadatum blir idag. Utkasten bokförs och skickas till kunden i Fortnox.
          </p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-white font-medium tabular-nums">{done} av {n}</span>
              {phase === 'done' && (
                <span className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                  <StatusText tone="green">{utkast(count('created'))} skapade</StatusText>
                  {count('failed') > 0 && <StatusText tone="red">{count('failed')} misslyckades</StatusText>}
                  {count('skipped') > 0 && <StatusText tone="orange">{count('skipped')} hoppades över</StatusText>}
                </span>
              )}
            </div>
            <div
              className="h-1.5 rounded-full bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={n}
              aria-valuenow={done}
              aria-label="Förlopp"
            >
              <div className="h-full bg-[#20c58f] transition-all duration-300" style={{ width: `${(done / n) * 100}%` }} />
            </div>
          </div>
        )}

        <ul className="bg-slate-800/30 border border-slate-700 rounded-xl divide-y divide-slate-700/50 max-h-[50vh] overflow-y-auto">
          {invoices.map((inv, idx) => {
            const o = outcomes.get(inv.id)
            const current = phase === 'running' && !o && idx === done
            return (
              <li key={inv.id} className="px-3 py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-white">
                    {inv.customerName}
                    <span className="text-slate-500 font-mono text-xs"> · {inv.invoiceNumber ?? '-'}</span>
                  </span>
                  <span className="text-slate-200 tabular-nums whitespace-nowrap">{fmtKr(inv.amount)}</span>
                </div>
                {o ? (
                  <div className="mt-0.5 space-y-0.5">
                    <StatusText tone={STATUS_TONE[o.status]}>{o.message}</StatusText>
                    {o.notes.map((note, i) => (
                      <p key={i} className="text-[11px] text-slate-500">{note}</p>
                    ))}
                  </div>
                ) : current ? (
                  <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
                    <Icon name="allman.laddar" size={16} className="animate-spin" /> Skapar utkast
                  </span>
                ) : phase !== 'confirm' ? (
                  <span className="mt-0.5 block text-xs text-slate-500">Väntar</span>
                ) : null}
              </li>
            )
          })}
        </ul>

        {phase === 'confirm' && (
          <p className="text-xs text-slate-500 flex items-baseline justify-between gap-3">
            <span>Totalt</span>
            <span className="tabular-nums text-slate-300">{fmtKr(total)} {amountLabel}</span>
          </p>
        )}
        {phase === 'done' && count('created') < n && (
          <p className="text-xs text-slate-500">
            Fakturor som misslyckades eller hoppades över ligger kvar i listan. Öppna dem för att se vad som saknas och skapa utkastet därifrån.
          </p>
        )}
      </div>
    </Modal>
  )
}
