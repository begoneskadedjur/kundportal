// src/utils/paymentBlockWarning.ts
// Gul varning (inget stopp) för betalningsspärren i följeärenden, återbesök
// och återkommande scheman (3.128.0). Fel vid uppslag ger ingen varning.

import toast from 'react-hot-toast'
import {
  PaymentBlockService,
  paymentBlockSummary,
  type PaymentBlockStatus,
} from '../services/paymentBlockService'

export async function paymentBlockStatusFor(opts: {
  customerId?: string | null
  identity?: string | null
}): Promise<PaymentBlockStatus> {
  if (opts.customerId) return PaymentBlockService.getStatusSafe(opts.customerId)
  if (opts.identity) return PaymentBlockService.getStatusByIdentitySafe(opts.identity)
  return { blocked: false }
}

/** Visar en varning om kunden är spärrad och returnerar statusen */
export async function warnIfPaymentBlocked(opts: {
  customerId?: string | null
  identity?: string | null
  /** T.ex. "Följeärendet skapas ändå." */
  context?: string
}): Promise<PaymentBlockStatus> {
  const status = await paymentBlockStatusFor(opts)
  if (status.blocked) {
    const summary = paymentBlockSummary(status)
    toast(
      `Obs: kunden har betalningsspärr.${summary ? ` ${summary}.` : ''}${opts.context ? ` ${opts.context}` : ''}`,
      {
        duration: 8000,
        style: { background: '#451a03', color: '#fde68a', border: '1px solid rgba(245, 158, 11, 0.5)' },
      }
    )
  }
  return status
}
