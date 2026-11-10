// src/components/shared/PaymentBlockNotice.tsx
// Röd ruta (stopp) eller gul ruta (varning) för betalningsspärren (3.128.0).
// Stopp: Skapa ärende, Boka in. Varning: följeärenden, återbesök, scheman.
// Hävning görs bara på kundkortet; rutan länkar dit.

import { Icon } from '../icons/Icon'
import {
  formatBlockAmount,
  paymentBlockSummary,
  type PaymentBlockStatus,
} from '../../services/paymentBlockService'

interface Props {
  status: PaymentBlockStatus
  variant: 'stop' | 'warn'
  /** T.ex. "/admin/befintliga-kunder" eller "/koordinator/befintliga-kunder"; utan bas visas ingen länk */
  customerBasePath?: string | null
  className?: string
}

export function customerRecordBasePath(pathname: string): string | null {
  if (pathname.startsWith('/admin')) return '/admin/befintliga-kunder'
  if (pathname.startsWith('/koordinator')) return '/koordinator/befintliga-kunder'
  return null
}

export default function PaymentBlockNotice({ status, variant, customerBasePath, className = '' }: Props) {
  if (!status.blocked) return null
  const stop = variant === 'stop'
  const invoices = (status.invoices ?? []).filter((i) => !i.exempt)
  const link = customerBasePath && status.customer_id
    ? `${customerBasePath}/${status.customer_id}?tab=fakturering`
    : null

  return (
    <div
      role={stop ? 'alert' : 'status'}
      className={`p-3 rounded-xl border ${
        stop ? 'bg-red-500/10 border-red-500/40' : 'bg-amber-500/10 border-amber-500/40'
      } ${className}`}
    >
      <div className={`flex items-center gap-1.5 text-sm font-semibold ${stop ? 'text-red-300' : 'text-amber-300'}`}>
        <Icon name="allman.las" size={16} />
        {stop ? 'Kunden har betalningsspärr' : 'Obs: kunden har betalningsspärr'}
      </div>
      <p className="mt-1 text-xs text-slate-300">
        {paymentBlockSummary(status) || 'Spärrad på grund av obetalda fakturor.'}
      </p>
      {invoices.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-400 tabular-nums">
          {invoices.slice(0, 5).map((inv) => (
            <li key={inv.id}>
              {inv.invoice_number ?? 'Faktura'}
              {inv.fortnox_document_number ? ` (Fortnox ${inv.fortnox_document_number})` : ''}
              {': '}
              {formatBlockAmount(inv.debt)}, förföll {inv.due_date} ({inv.days_overdue} dagar)
            </li>
          ))}
          {invoices.length > 5 && <li>och {invoices.length - 5} till</li>}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-400">
        {stop
          ? 'Nya ärenden kan inte bokas. Spärren hävs bara på kundkortet.'
          : 'Ärendet kan skapas, men stäm av med kunden om betalningen.'}
        {link && (
          <>
            {' '}
            <a href={link} target="_blank" rel="noreferrer" className={`underline ${stop ? 'text-red-300 hover:text-red-200' : 'text-amber-300 hover:text-amber-200'}`}>
              Öppna kundkortet
            </a>
          </>
        )}
      </p>
    </div>
  )
}
