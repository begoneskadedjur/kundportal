// src/components/admin/customers/record/PaymentBlockSection.tsx
// Betalningsspärren på kundkortet (3.128.0):
// - PaymentBlockStrip: röd rad under sidhuvudet i alla flikar när kunden är spärrad
// - PaymentBlockSection: fliken Fakturering. Status, manuell spärr, hävning
//   (kommentar krävs, auto-spärr pausar automatiken till ett datum), paus,
//   undantag per faktura och historik.
// Hävning görs BARA här; Skapa ärende och övriga stopp har ingen förbikoppling.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import { useAuth } from '../../../../contexts/AuthContext'
import Modal from '../../../ui/Modal'
import Button from '../../../ui/Button'
import { Icon } from '../../../icons/Icon'
import { addDaysIso, swedishDay } from '../../../../shared/invoiceSchedule'
import {
  PaymentBlockService,
  formatBlockAmount,
  paymentBlockSummary,
  type CustomerPaymentBlockFields,
  type PaymentBlockHistoryRow,
  type PaymentBlockSettings,
  type PaymentBlockStatus,
} from '../../../../services/paymentBlockService'

// ─── Gemensam hämtning ──────────────────────────────────────────────────

export function usePaymentBlockStatus(customerId: string, version: number) {
  const [status, setStatus] = useState<PaymentBlockStatus>({ blocked: false })
  useEffect(() => {
    let alive = true
    PaymentBlockService.getStatusSafe(customerId).then((s) => {
      if (alive) setStatus(s)
    })
    return () => {
      alive = false
    }
  }, [customerId, version])
  return status
}

function sinceText(iso: string | null | undefined): string {
  return iso ? swedishDay(iso) : ''
}

// ─── Röd rad under sidhuvudet ───────────────────────────────────────────

export function PaymentBlockStrip({
  customerId,
  version,
  basePath,
  onOpenBilling,
}: {
  customerId: string
  version: number
  basePath: string
  onOpenBilling: () => void
}) {
  const status = usePaymentBlockStatus(customerId, version)
  if (!status.blocked) return null
  const via = status.via_parent && status.customer_id
  return (
    <div role="alert" className="mt-4 px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="flex items-center gap-1.5 font-semibold text-red-300">
        <Icon name="allman.las" size={16} />
        Betalningsspärr
      </span>
      <span className="text-slate-300">
        {status.source === 'manual' ? 'Manuell' : 'Automatisk'}
        {status.since ? ` sedan ${sinceText(status.since)}` : ''}
        {paymentBlockSummary(status) ? `. ${paymentBlockSummary(status)}` : ''}
      </span>
      {via ? (
        <Link to={`${basePath}/${status.customer_id}?tab=fakturering`} className="text-red-300 hover:text-red-200 underline">
          Öppna huvudkontoret
        </Link>
      ) : (
        <button type="button" onClick={onOpenBilling} className="text-red-300 hover:text-red-200 underline">
          Visa i Fakturering
        </button>
      )}
    </div>
  )
}

// ─── Sektionen i fliken Fakturering ─────────────────────────────────────

interface OpenInvoice {
  id: string
  invoice_number: string | null
  fortnox_document_number: string | null
  due_date: string | null
  status: string
  balance_due: number | null
  total_amount: number | null
  rot_rut_fortnox_amount: number | null
  rot_rut_claim_status: string | null
  payment_block_exempt: boolean | null
}

function customerDebt(inv: OpenInvoice): number {
  const balance = Number(inv.balance_due ?? inv.total_amount ?? 0)
  const tax = Number(inv.rot_rut_fortnox_amount ?? 0)
  const pending = tax > 0 && inv.rot_rut_claim_status !== 'rejected' ? tax : 0
  return Math.max(0, Math.round((balance - pending) * 100) / 100)
}

const ACTION_LABEL: Record<PaymentBlockHistoryRow['action'], string> = {
  set: 'Spärr satt',
  lift: 'Spärr hävd',
  pause: 'Automatiken pausad',
  exempt: 'Faktura undantagen',
  unexempt: 'Undantag borttaget',
}

type DialogKind = 'set' | 'lift' | 'pause' | { exemptInvoice: OpenInvoice }

export default function PaymentBlockSection({
  customerId,
  customerName,
  version,
  onChanged,
  basePath,
}: {
  customerId: string
  customerName: string
  version: number
  onChanged: () => void
  basePath: string
}) {
  const { profile } = useAuth()
  const canEdit = !!profile && (profile.role === 'admin' || profile.role === 'koordinator' || !!profile.is_admin || !!profile.can_approve_invoices)
  const status = usePaymentBlockStatus(customerId, version)
  const [fields, setFields] = useState<CustomerPaymentBlockFields | null>(null)
  const [history, setHistory] = useState<PaymentBlockHistoryRow[]>([])
  const [invoices, setInvoices] = useState<OpenInvoice[]>([])
  const [settings, setSettings] = useState<PaymentBlockSettings | null>(null)
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)
  const today = swedishDay(new Date())

  const load = useCallback(async () => {
    try {
      const [f, h, s, inv] = await Promise.all([
        PaymentBlockService.getCustomerFields(customerId),
        PaymentBlockService.getHistory([customerId]),
        PaymentBlockService.getSettings().catch(() => null),
        supabase
          .from('invoices')
          .select('id, invoice_number, fortnox_document_number, due_date, status, balance_due, total_amount, rot_rut_fortnox_amount, rot_rut_claim_status, payment_block_exempt')
          .eq('customer_id', customerId)
          .not('fortnox_document_number', 'is', null)
          .eq('is_historical', false)
          .in('status', ['booked', 'sent', 'overdue'])
          .order('due_date', { ascending: true })
          .range(0, 499),
      ])
      setFields(f)
      setHistory(h)
      setSettings(s)
      setInvoices(((inv.data ?? []) as OpenInvoice[]).filter((i) => customerDebt(i) > 0))
    } catch (err) {
      console.error('Betalningsspärr:', err)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load, version])

  const invoiceNumberById = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of invoices) m.set(i.id, i.invoice_number ?? i.fortnox_document_number ?? '')
    for (const i of status.invoices ?? []) m.set(i.id, i.invoice_number ?? i.fortnox_document_number ?? '')
    return m
  }, [invoices, status.invoices])

  const ownBlock = !!fields?.payment_block_active
  const viaParent = status.blocked && status.via_parent
  const pausedUntil = fields?.payment_block_paused_until && fields.payment_block_paused_until >= today ? fields.payment_block_paused_until : null
  const pauseDays = settings?.default_pause_days ?? 14

  const openDialog = (kind: DialogKind) => {
    setReason('')
    if (kind === 'lift') setDate(fields?.payment_block_source === 'auto' ? addDaysIso(today, pauseDays) : '')
    else if (kind === 'pause') setDate(addDaysIso(today, pauseDays))
    else setDate('')
    setDialog(kind)
  }

  const submit = async () => {
    if (!dialog) return
    if (!reason.trim()) {
      toast.error('Skriv en kommentar')
      return
    }
    const needsDate = dialog === 'pause' || (dialog === 'lift' && fields?.payment_block_source === 'auto')
    if (needsDate && (!date || date < today)) {
      toast.error('Välj ett datum från och med i dag')
      return
    }
    setSaving(true)
    try {
      if (dialog === 'set') {
        await PaymentBlockService.setManual(customerId, reason.trim())
        toast.success('Manuell spärr satt')
      } else if (dialog === 'lift') {
        await PaymentBlockService.lift(customerId, reason.trim(), date || null)
        toast.success(date ? `Spärren hävd, automatiken pausad till ${date}` : 'Spärren hävd')
      } else if (dialog === 'pause') {
        await PaymentBlockService.pause(customerId, reason.trim(), date)
        toast.success(`Automatiken pausad till ${date}`)
      } else {
        const inv = dialog.exemptInvoice
        await PaymentBlockService.setInvoiceExempt(inv.id, !inv.payment_block_exempt, reason.trim())
        toast.success(inv.payment_block_exempt ? 'Undantaget borttaget' : 'Fakturan undantagen från spärren')
      }
      setDialog(null)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const dialogTitle = !dialog
    ? ''
    : dialog === 'set'
      ? 'Sätt manuell spärr'
      : dialog === 'lift'
        ? 'Häv spärren'
        : dialog === 'pause'
          ? 'Pausa automatiken'
          : dialog.exemptInvoice.payment_block_exempt
            ? 'Ta bort undantaget'
            : 'Undanta fakturan från spärren'

  return (
    <section className="mb-6">
      <h2 className="text-xs uppercase tracking-wide text-slate-500 mb-3">Betalningsspärr</h2>

      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${status.blocked ? 'bg-red-400' : 'bg-[#20c58f]'}`} aria-hidden />
            <span className={status.blocked ? 'text-red-300' : 'text-slate-300'}>
              {status.blocked
                ? `${status.source === 'manual' ? 'Manuell spärr' : 'Automatisk spärr'}${status.since ? ` sedan ${sinceText(status.since)}` : ''}`
                : 'Ingen spärr'}
            </span>
          </span>
          {pausedUntil && <span className="text-slate-400">Automatiken pausad till {pausedUntil}</span>}
          {settings && !settings.enabled && <span className="text-amber-300">Spärren är avstängd i inställningarna</span>}
        </div>

        {status.blocked && paymentBlockSummary(status) && <p className="text-slate-400">{paymentBlockSummary(status)}.</p>}

        {viaParent && status.customer_id && (
          <p className="text-slate-400">
            Spärren sitter på huvudkontoret och gäller alla enheter.{' '}
            <Link to={`${basePath}/${status.customer_id}?tab=fakturering`} className="text-[#20c58f] hover:underline">
              Hantera den hos {status.customer_name ?? 'huvudkontoret'}
            </Link>
          </p>
        )}

        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            {!ownBlock && (
              <Button size="sm" variant="danger" onClick={() => openDialog('set')}>
                Sätt manuell spärr
              </Button>
            )}
            {ownBlock && (
              <Button size="sm" variant="secondary" onClick={() => openDialog('lift')}>
                Häv spärren
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => openDialog('pause')}>
              Pausa automatiken
            </Button>
          </div>
        )}

        {settings && (
          <p className="text-xs text-slate-500">
            Automatiken spärrar när förfallen skuld på portalens fakturor överstiger {formatBlockAmount(settings.min_amount)} och
            är äldre än {settings.days_after_due} dagar efter förfallodagen. Fakturor som bara skickas direkt från Fortnox räknas inte.
          </p>
        )}
      </div>

      {invoices.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs text-slate-500 mb-2">Obetalda portalfakturor</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 pr-3 font-normal">Faktura</th>
                  <th className="py-1 pr-3 font-normal">Förfallodag</th>
                  <th className="py-1 pr-3 font-normal text-right">Kvar (kundens del)</th>
                  <th className="py-1 pr-3 font-normal">Spärren</th>
                  {canEdit && <th className="py-1 font-normal" />}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const overdue = !!inv.due_date && inv.due_date < today
                  return (
                    <tr key={inv.id} className="border-t border-slate-800">
                      <td className="py-1.5 pr-3 text-slate-300">
                        {inv.invoice_number ?? '-'}
                        {inv.fortnox_document_number && <span className="text-slate-500"> · Fortnox {inv.fortnox_document_number}</span>}
                      </td>
                      <td className={`py-1.5 pr-3 ${overdue ? 'text-red-300' : 'text-slate-400'}`}>{inv.due_date ?? '-'}</td>
                      <td className="py-1.5 pr-3 text-right text-slate-300">{formatBlockAmount(customerDebt(inv))}</td>
                      <td className="py-1.5 pr-3 text-slate-400">{inv.payment_block_exempt ? 'Undantagen' : 'Räknas'}</td>
                      {canEdit && (
                        <td className="py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => openDialog({ exemptInvoice: inv })}
                            className="text-xs text-slate-400 hover:text-white underline"
                          >
                            {inv.payment_block_exempt ? 'Ta bort undantag' : 'Undanta'}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-xs text-slate-500 mb-2">Historik</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen historik.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 text-slate-300">
                  <span>{ACTION_LABEL[h.action]}</span>
                  <span className="text-xs text-slate-500">
                    {swedishDay(h.created_at)} {new Date(h.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' })}
                    {' · '}
                    {h.source === 'auto' ? 'automatiskt' : 'manuellt'}
                    {h.created_by_name ? ` · ${h.created_by_name}` : ''}
                  </span>
                </div>
                {(h.reason || h.amount != null || h.paused_until || h.invoice_ids.length > 0) && (
                  <p className="text-xs text-slate-400">
                    {[
                      h.reason,
                      h.amount != null ? formatBlockAmount(h.amount) : null,
                      h.paused_until ? `pausad till ${h.paused_until}` : null,
                      h.invoice_ids.length > 0
                        ? h.invoice_ids.map((id) => invoiceNumberById.get(id) || 'faktura').join(', ')
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        isOpen={!!dialog}
        onClose={() => !saving && setDialog(null)}
        title={dialogTitle}
        subtitle={customerName}
        size="sm"
        footer={
          <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-slate-700/50">
            <Button variant="secondary" size="sm" onClick={() => setDialog(null)} disabled={saving}>
              Avbryt
            </Button>
            <Button variant={dialog === 'set' ? 'danger' : 'primary'} size="sm" onClick={submit} loading={saving} disabled={saving}>
              Spara
            </Button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          {dialog === 'set' && (
            <p className="text-sm text-slate-400">
              Kunden kan inte bokas förrän spärren hävs här. En manuell spärr hävs aldrig av automatiken.
            </p>
          )}
          {dialog === 'lift' && fields?.payment_block_source === 'auto' && (
            <p className="text-sm text-slate-400">
              Spärren sattes automatiskt. Automatiken pausas till valt datum så att kunden inte spärras igen direkt.
            </p>
          )}
          {dialog === 'pause' && (
            <p className="text-sm text-slate-400">
              Automatiken spärrar inte kunden till och med valt datum. En aktiv automatisk spärr hävs, en manuell ligger kvar.
            </p>
          )}
          {dialog && typeof dialog === 'object' && (
            <p className="text-sm text-slate-400">
              {dialog.exemptInvoice.invoice_number ?? 'Fakturan'}: {formatBlockAmount(customerDebt(dialog.exemptInvoice))}.{' '}
              {dialog.exemptInvoice.payment_block_exempt
                ? 'Fakturan räknas i spärren igen.'
                : 'Fakturan räknas inte i spärren. Nya förfallna fakturor räknas som vanligt.'}
            </p>
          )}
          {(dialog === 'pause' || dialog === 'lift') && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {dialog === 'pause' ? 'Pausa till och med' : 'Pausa automatiken till och med'}
                {dialog === 'lift' && fields?.payment_block_source !== 'auto' ? ' (valfritt)' : ''}
              </label>
              <input
                type="date"
                value={date}
                min={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Kommentar (krävs, syns bara internt)</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
              placeholder="Till exempel: kunden har lovat betala fredag"
            />
          </div>
        </div>
      </Modal>
    </section>
  )
}
