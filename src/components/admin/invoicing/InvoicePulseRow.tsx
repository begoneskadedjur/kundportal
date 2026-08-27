// src/components/admin/invoicing/InvoicePulseRow.tsx
// Nyckeltalsrad direkt under fakturans statusstepper. EN yta med hårfina
// avdelare (inte separata kort), fast slotordning:
// Belopp · Ekonomisignal · Förfall/Villkor · Kunden · Kontext.
// Datat kommer från useInvoicePulse (src/hooks) — allt är read-only.

import type { ReactNode } from 'react'
import type { InvoiceWithItems } from '../../../types/invoice'
import { formatInvoiceAmount } from '../../../types/invoice'
import type { CaseBillingItem } from '../../../types/caseBilling'
import type { CaseContext } from '../../../hooks/useCaseContext'
import {
  MARGIN_BAD_BELOW,
  MARGIN_WARN_BELOW,
  PRE_SEND_STATUSES,
  SENT_LIKE_STATUSES,
  daysBetween,
  localDateKey,
  type InvoicePulse,
  type PayDot,
  type PriceListCheck,
} from '../../../hooks/useInvoicePulse'

const formatPercentSv = (v: number): string =>
  `${new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)} %`

// Datum + klockslag i svenskt format (ÅÅÅÅ-MM-DD HH:MM) för nästa besök
const formatSwedishDate = (timestamp: string): string => {
  const d = new Date(timestamp)
  if (Number.isNaN(d.getTime())) return '–'
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0
  return hasTime ? `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : date
}

const DOT_CLASS: Record<PayDot['tone'], string> = {
  ok: 'bg-[#20c58f]',
  late: 'bg-amber-400',
  due: 'bg-red-400',
  open: 'border border-slate-600',
}

function PulseCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex-1 min-w-0 px-4 py-2.5 border-l border-slate-700/50 first:border-l-0">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5 truncate">{label}</div>
      {children}
    </div>
  )
}

interface InvoicePulseRowProps {
  invoice: InvoiceWithItems
  pulse: InvoicePulse
  /** Ärendets billing-rader (intern kalkyl) — redan hämtade av modalen */
  caseBillingItems: CaseBillingItem[]
  caseContext: CaseContext | null
  /** Prisavstämning mot kundens avtalsprislista (adhoc) — null = ej tillämpligt */
  priceCheck?: PriceListCheck | null
}

export default function InvoicePulseRow({ invoice, pulse, caseBillingItems, caseContext, priceCheck }: InvoicePulseRowProps) {
  const invoiceType = invoice.invoice_type as string
  const isContract = invoiceType === 'contract'
  const todayKey = localDateKey()

  // --- b) Ekonomisignal: marginal (case-fakturor) eller premieavstämning (contract)
  //
  // Bara artiklar som är KOPPLADE till en av fakturans tjänsterader räknas in.
  // Ett ärende med flera besök har artiklar från alla besök på samma case_id;
  // tas de med blir besök 1:s marginal belastad med besök 2:s inköp.
  // Är ingen artikel kopplad går marginalen inte att räkna → "–", aldrig 100 %.
  const articleItems = caseBillingItems.filter(i => i.item_type === 'article')
  const serviceItemIds = new Set(
    caseBillingItems.filter(i => i.item_type === 'service').map(i => i.id)
  )
  const assignedArticles = articleItems.filter(
    i => i.mapped_service_id && serviceItemIds.has(i.mapped_service_id)
  )
  const articleCost = assignedArticles.reduce((s, i) => s + Number(i.total_price || 0), 0)
  const subtotal = Number(invoice.subtotal || 0)
  const marginPercent =
    !isContract && assignedArticles.length > 0 && subtotal > 0
      ? ((subtotal - articleCost) / subtotal) * 100
      : null
  const marginClass =
    marginPercent == null
      ? 'text-slate-100'
      : marginPercent < MARGIN_BAD_BELOW
        ? 'text-red-400'
        : marginPercent <= MARGIN_WARN_BELOW
          ? 'text-amber-400'
          : 'text-[#20c58f]'

  // --- c) Förfall/villkor
  const sentLike = SENT_LIKE_STATUSES.includes(invoice.status)
  const showDue = sentLike && !!invoice.due_date
  const daysLeft = invoice.due_date ? daysBetween(invoice.due_date, todayKey) : 0
  const isPaid = invoice.status === 'paid'
  const dueTone: 'neutral' | 'warn' | 'bad' | 'good' = isPaid
    ? 'good'
    : daysLeft < 0
      ? 'bad'
      : daysLeft <= 7
        ? 'warn'
        : 'neutral'
  const dueValueClass =
    dueTone === 'good'
      ? 'text-[#20c58f]'
      : dueTone === 'bad'
        ? 'text-red-400'
        : dueTone === 'warn'
          ? 'text-amber-400'
          : 'text-slate-100'
  const dueBarClass = dueTone === 'bad' ? 'bg-red-400' : dueTone === 'warn' ? 'bg-amber-400' : 'bg-slate-500'
  // Depletionsstapel: andel av villkorstiden som förflutit (skickad → förfall)
  let dueFraction = 0
  if (showDue && !isPaid) {
    const start = Date.parse(invoice.sent_at ?? invoice.booked_at ?? invoice.created_at)
    const end = Date.parse(invoice.due_date as string)
    dueFraction = end > start ? Math.min(1, Math.max(0, (Date.now() - start) / (end - start))) : 1
  }
  const dueValue = isPaid
    ? 'Betald'
    : daysLeft < 0
      ? `${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'dag' : 'dagar'} sen`
      : daysLeft === 0
        ? 'idag'
        : `om ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'}`

  // --- d) Kunden
  const hasCustomerData = pulse.outstandingTotal != null
  const overdueAmount = pulse.overdueTotal ?? 0

  // --- e) Kontext
  const isPartialOrAdhoc = invoiceType === 'partial' || invoiceType === 'adhoc'
  const hasOngoingRevisit = isPartialOrAdhoc && caseContext?.status === 'Återbesök'

  return (
    <div className="flex-shrink-0 flex border-b border-slate-700 bg-slate-800/30 overflow-x-auto">
      {/* a) Att fakturera */}
      <PulseCell label="Att fakturera">
        <div className="text-lg font-bold text-white tabular-nums leading-tight">
          {formatInvoiceAmount(Number(invoice.total_amount || 0))}
        </div>
        <div className="text-[11px] text-slate-500 tabular-nums truncate">
          {formatInvoiceAmount(subtotal)} exkl. moms
        </div>
      </PulseCell>

      {/* b) Ekonomisignal */}
      {isContract ? (
        <PulseCell label="Premie">
          {pulse.loading || pulse.annualValue == null ? (
            <div className="text-sm font-bold text-slate-100 tabular-nums">–</div>
          ) : pulse.premiumMismatch ? (
            <>
              <div className="text-sm font-bold text-red-400 tabular-nums">≠ avtalets</div>
              <div className="text-[11px] text-red-400/80 tabular-nums truncate">
                nu {formatInvoiceAmount(pulse.annualValue)}
              </div>
            </>
          ) : (
            <>
              <div className="text-sm font-bold text-[#20c58f] tabular-nums">= avtalets ✓</div>
              <div className="text-[11px] text-slate-500 tabular-nums truncate">
                {formatInvoiceAmount(pulse.annualValue)}
              </div>
            </>
          )}
        </PulseCell>
      ) : priceCheck?.mode === 'agreement' ? (
        /* Priset stämmer mot kundens avtalsprislista — marginalen visas men larmar inte */
        <PulseCell label="Pris">
          <div className="text-sm font-bold text-[#20c58f] tabular-nums">Enligt avtal ✓</div>
          <div className="text-[11px] text-slate-500 tabular-nums truncate">
            {marginPercent != null
              ? `marginal ${formatPercentSv(marginPercent)} · avtalat pris`
              : 'avtalat pris'}
          </div>
        </PulseCell>
      ) : priceCheck?.mode === 'deviation' ? (
        <PulseCell label="Pris">
          <div className="text-sm font-bold text-red-400 tabular-nums">
            Avviker {formatInvoiceAmount(priceCheck.diffTotal)}
          </div>
          <div className="text-[11px] text-red-400/80 truncate">mot avtalsprislistan</div>
        </PulseCell>
      ) : (
        <PulseCell label="Marginal">
          {marginPercent == null ? (
            <div className="text-sm font-bold text-slate-100 tabular-nums">–</div>
          ) : (
            <>
              <div className={`text-sm font-bold tabular-nums ${marginClass}`}>
                {formatPercentSv(marginPercent)}
              </div>
              <div className="text-[11px] text-slate-500 tabular-nums truncate">
                kostnad {formatInvoiceAmount(articleCost)}
              </div>
            </>
          )}
        </PulseCell>
      )}

      {/* c) Förfall / betalvillkor */}
      {showDue ? (
        <PulseCell label={isPaid ? 'Förföll' : 'Förfaller'}>
          <div className={`text-sm font-bold tabular-nums ${dueValueClass}`}>{dueValue}</div>
          <div className="text-[11px] text-slate-500 tabular-nums truncate">
            {invoice.due_date}
            {pulse.termsDays != null && <> · {pulse.termsDays} dgr villkor</>}
          </div>
          {!isPaid && (
            <div className="mt-1 h-[3px] rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${dueBarClass}`}
                style={{ width: `${Math.round(dueFraction * 100)}%` }}
              />
            </div>
          )}
        </PulseCell>
      ) : (
        <PulseCell label="Betalvillkor">
          <div className="text-sm font-bold text-slate-100 tabular-nums">
            {pulse.termsDays != null ? `${pulse.termsDays} dagar` : '–'}
          </div>
          {pulse.termsDeviation && invoice.due_date ? (
            <div className="text-[11px] text-amber-400 tabular-nums truncate">
              avviker från villkor · förfall {invoice.due_date}
            </div>
          ) : !PRE_SEND_STATUSES.includes(invoice.status) && invoice.due_date ? (
            /* Skickad till Fortnox (t.ex. utkast) — förfallodatumet är satt */
            <div className="text-[11px] text-slate-500 tabular-nums truncate">förfall {invoice.due_date}</div>
          ) : (
            /* Före sändning: preliminärt datum — villkoret räknas från sändningen */
            <div className="text-[11px] text-slate-500 truncate">förfall sätts vid sändning</div>
          )}
        </PulseCell>
      )}

      {/* d) Kunden */}
      <PulseCell label="Kunden">
        {pulse.loading || !hasCustomerData ? (
          <div className="text-sm font-bold text-slate-100 tabular-nums">–</div>
        ) : (
          <>
            <div className={`text-sm font-bold tabular-nums ${overdueAmount > 0 ? 'text-red-400' : 'text-slate-100'}`}>
              {formatInvoiceAmount(overdueAmount)} förfallet
            </div>
            {pulse.payDots.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {pulse.payDots.map(d => (
                  <span key={d.key} title={d.title} className={`w-[7px] h-[7px] rounded-full ${DOT_CLASS[d.tone]}`} />
                ))}
              </div>
            )}
            {pulse.avgPayDiffDays != null && (
              <div className="text-[11px] text-slate-500 tabular-nums truncate mt-0.5">
                snitt {Math.abs(pulse.avgPayDiffDays)} dgr {pulse.avgPayDiffDays <= 0 ? 'före' : 'efter'} förfall
              </div>
            )}
            {pulse.upsellYearTotal != null && pulse.upsellYearCount != null && (
              <div className="text-[11px] text-slate-500 tabular-nums truncate mt-0.5">
                merförsäljning i år: {formatInvoiceAmount(pulse.upsellYearTotal)} (
                {pulse.upsellYearCount} {pulse.upsellYearCount === 1 ? 'faktura' : 'fakturor'})
              </div>
            )}
          </>
        )}
      </PulseCell>

      {/* e) Kontext: nästa besök / Fortnox-läge / kundnummer-koll */}
      {hasOngoingRevisit ? (
        <PulseCell label="Nästa besök">
          <div className="text-sm font-bold text-slate-100 tabular-nums">
            {caseContext?.startDate ? formatSwedishDate(caseContext.startDate) : '–'}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            återbesök bokat{caseContext?.primaryAssigneeName ? ` · ${caseContext.primaryAssigneeName}` : ''}
          </div>
        </PulseCell>
      ) : invoice.fortnox_document_number ? (
        <PulseCell label="Fortnox">
          <div className="text-sm font-bold text-slate-100 tabular-nums">Nr {invoice.fortnox_document_number}</div>
          <div className="text-[11px] text-slate-500 tabular-nums truncate">
            {pulse.fortnoxCustomerNumber != null ? `kundnr ${pulse.fortnoxCustomerNumber}` : '–'}
          </div>
        </PulseCell>
      ) : (
        <PulseCell label="Fortnox">
          {pulse.loading || pulse.fortnoxLookupFailed || !invoice.customer_id ? (
            <div className="text-sm font-bold text-slate-100 tabular-nums">–</div>
          ) : pulse.fortnoxCustomerNumber != null ? (
            <div className="text-sm font-bold text-[#20c58f] tabular-nums">
              Kundnr {pulse.fortnoxCustomerNumber} ✓
            </div>
          ) : (
            <>
              <div className="text-sm font-bold text-red-400">Kundnr saknas</div>
              <div className="text-[11px] text-red-400/80 truncate">komplettera kundkortet</div>
            </>
          )}
        </PulseCell>
      )}
    </div>
  )
}
