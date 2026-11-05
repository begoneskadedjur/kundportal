// src/components/admin/invoicing/queue/EarlySendDialog.tsx
// Varningen innan en avtalsfaktura skickas till Fortnox för tidigt (3.122.0):
// en månadsfaktura mer än 10 dagar före sin period, en års-, halvårs- eller
// kvartalsfaktura mer än 60 dagar före periodstart. Regeln i
// src/shared/invoiceSchedule.ts (earlySendCheck). Används både i
// fakturamodalen (en faktura) och i Skicka godkända till Fortnox (flera).

import Modal from '../../../ui/Modal'
import { Icon } from '../../../icons/Icon'

export interface EarlySendItem {
  id: string
  customerName: string
  invoiceNumber: string | null
  /** Dagen fakturan ska skickas */
  waitUntil: string
  periodStart: string | null
  daysEarly: number
  monthly: boolean
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']
const monthName = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const dagar = (n: number) => `${n} ${n === 1 ? 'dag' : 'dagar'}`

export default function EarlySendDialog({
  items,
  today,
  onWait,
  onSendAnyway,
}: {
  /** Tom lista = stängd */
  items: EarlySendItem[]
  today: string
  onWait: () => void
  onSendAnyway: () => void
}) {
  if (items.length === 0) return null
  const one = items.length === 1 ? items[0] : null
  const waitUntil = items.reduce((min, i) => (i.waitUntil < min ? i.waitUntil : min), items[0].waitUntil)
  const anyMonthly = items.some((i) => i.monthly)
  const anyOther = items.some((i) => !i.monthly)

  const title = one
    ? one.monthly && one.periodStart
      ? `Fakturan gäller ${monthName(one.periodStart)}`
      : `Perioden börjar ${one.periodStart ?? ''}`
    : `${items.length} fakturor skickas för tidigt`

  return (
    <Modal
      isOpen
      onClose={onWait}
      size="md"
      zIndex={120}
      title={
        <span className="flex items-center gap-2">
          <Icon name="rapport.avvikelse" size={24} className="text-orange-400 flex-shrink-0" />
          <span className="truncate">{title}</span>
        </span>
      }
      footer={
        <div className="flex flex-wrap justify-end gap-2 px-4 py-2.5">
          <button
            type="button"
            onClick={onWait}
            autoFocus
            className="min-h-[44px] px-4 rounded-lg border border-slate-700 bg-slate-800 text-sm text-white hover:bg-slate-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            Vänta till {waitUntil}
          </button>
          <button
            type="button"
            onClick={onSendAnyway}
            className="min-h-[44px] px-4 rounded-lg border border-orange-500/50 bg-orange-500/15 text-sm font-semibold text-orange-300 hover:bg-orange-500/25 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            Skicka ändå
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-3">
        {anyMonthly && (
          <p className="text-sm text-slate-300">
            Månadsfakturor skickas den 1:a i den månad de gäller. Skickar du nu har kunden flera obetalda månadsfakturor samtidigt, och det kan se ut som dubbelfakturering.
          </p>
        )}
        {anyOther && (
          <p className="text-sm text-slate-300">
            Års-, halvårs- och kvartalsfakturor skickas 40 dagar före periodstart. Skickas fakturan mer än 60 dagar före får kunden den långt innan perioden, och intäkten hamnar i fel månad.
          </p>
        )}
        {one ? (
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 p-3 bg-slate-800/30 border border-slate-700 rounded-xl text-sm">
            <dt className="text-slate-400">Kund</dt>
            <dd className="text-white truncate">{one.customerName}</dd>
            <dt className="text-slate-400">Faktura</dt>
            <dd className="text-white font-mono">{one.invoiceNumber ?? '-'}</dd>
            <dt className="text-slate-400">Ska skickas</dt>
            <dd className="text-white font-mono">{one.waitUntil}</dd>
            <dt className="text-slate-400">Idag</dt>
            <dd className="text-white"><span className="font-mono">{today}</span>, {dagar(one.daysEarly)} före {one.monthly ? 'perioden' : 'periodstart'}</dd>
          </dl>
        ) : (
          <ul className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl divide-y divide-slate-700/50 max-h-[40vh] overflow-y-auto">
            {items.map((i) => (
              <li key={i.id} className="py-1.5 first:pt-0 last:pb-0 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-white">
                  {i.customerName}
                  <span className="text-slate-500 font-mono text-xs"> · {i.invoiceNumber ?? '-'}</span>
                </span>
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  ska skickas <span className="font-mono text-slate-200">{i.waitUntil}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {!one && (
          <p className="text-xs text-slate-500">
            Skicka ändå tar alla godkända fakturor. Vill du skicka bara de som är i tid, avmarkera de för tidiga och försök igen.
          </p>
        )}
      </div>
    </Modal>
  )
}
