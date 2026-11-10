// src/components/admin/invoicing/RotRutFakturaRuta.tsx
// ROT/RUT-rutan i fakturamodalen (3.127.0). Visas bara på fakturor med
// rot_rut_type. Samma avdrag som offerten (src/shared/rotRutOffert.ts), det
// begärda avdraget jämfört med Fortnox egen uträkning, kontroller och status
// för begäran hos Skatteverket (manuell markering, begäran görs i Fortnox).
// Ingen takvarning (beslut 2026-11-10). Personnumret visas maskerat.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { Icon } from '../../icons/Icon'
import type { InvoiceWithItems } from '../../../types/invoice'
import { formatInvoiceAmount } from '../../../types/invoice'
import { calculateRotRutSummary } from '../../../utils/rotRutConstants'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import {
  ROT_RUT_PROCENT, fakturaArRadmodell, fakturaAvdrag, fastighetKlar, fastighetKravs, fastighetText, giltigtPersonnummer,
  maskeratPersonnummer, type Avdrag,
} from '../../../shared/rotRutOffert'

type Status = 'requested' | 'paid_out' | 'rejected'

const STATUS_TEXT: Record<Status, string> = {
  requested: 'Begäran gjord',
  paid_out: 'Utbetald',
  rejected: 'Avvisad',
}

export default function RotRutFakturaRuta({ invoice, onChanged }: { invoice: InvoiceWithItems; onChanged: () => void }) {
  const [sparar, setSparar] = useState(false)
  const typ = (invoice.rot_rut_type === 'RUT' ? 'RUT' : 'ROT') as Avdrag
  const radmodell = fakturaArRadmodell(invoice.items)
  const { arbetskostnadInkl, avdrag: beraknat } = radmodell
    ? fakturaAvdrag(invoice.items, typ)
    : (() => {
        const s = calculateRotRutSummary(invoice.items)
        return { arbetskostnadInkl: Math.round(s.workCostInkl), avdrag: Math.round(s.totalDeduction) }
      })()
  const begart = invoice.rot_rut_asked_amount != null ? Number(invoice.rot_rut_asked_amount) : beraknat
  const fortnox = invoice.rot_rut_fortnox_amount != null ? Number(invoice.rot_rut_fortnox_amount) : null
  const totaltInkl = Math.round(Number(invoice.total_amount) || 0)
  const timmar = invoice.items
    .filter(i => i.rot_rut_type)
    .reduce((s, i) => s + Number(i.house_work_hours != null ? i.house_work_hours : i.quantity), 0)
  const brf = !!String(invoice.brf_org_number ?? '').trim()
  const fastighet = { brf, fastighetsbeteckning: invoice.fastighetsbeteckning, brfOrgNr: invoice.brf_org_number, lagenhetsnummer: invoice.apartment_number }

  // Fastighet bara för ROT, RUT har ingen (3.127.4)
  const visaFastighet = fastighetKravs(typ)
  const kontroller: Array<{ ok: boolean; text: string }> = [
    { ok: invoice.case_type === 'private' && giltigtPersonnummer(invoice.organization_number), text: 'Privatperson med giltigt personnummer' },
    ...(visaFastighet ? [{ ok: fastighetKlar(fastighet), text: brf ? 'Föreningens org.nr och lägenhetsnummer' : 'Fastighetsbeteckning med kolon' }] : []),
    { ok: arbetskostnadInkl > 0, text: 'Avdraget ligger på arbetskostnaden' },
    { ok: invoice.items.every(i => !i.rot_rut_type || i.rot_rut_type === typ), text: `Bara ${typ} på fakturan` },
  ]

  const status = (invoice.rot_rut_claim_status ?? null) as Status | null
  const statusText = status
    ? `${STATUS_TEXT[status]}${invoice.rot_rut_claim_date ? ` ${invoice.rot_rut_claim_date}` : ''}`
    : invoice.status === 'paid'
      ? 'Betald, begär utbetalning i Fortnox'
      : 'Väntar på betalning'
  const statusPunkt = status === 'paid_out' ? 'bg-[#20c58f]' : status === 'rejected' ? 'bg-red-400' : status === 'requested' ? 'bg-sky-400' : invoice.status === 'paid' ? 'bg-amber-400' : 'bg-slate-500'

  const markera = async (ny: Status | null) => {
    setSparar(true)
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ rot_rut_claim_status: ny, rot_rut_claim_date: ny ? toLocalISOStringWithOffset(new Date()).slice(0, 10) : null })
        .eq('id', invoice.id)
      if (error) throw new Error(error.message)
      toast.success(ny ? `Markerad: ${STATUS_TEXT[ny]}` : 'Markeringen borttagen')
      onChanged()
    } catch (err) {
      toast.error(`Kunde inte spara: ${err instanceof Error ? err.message : 'okänt fel'}`)
    } finally {
      setSparar(false)
    }
  }

  const rad = (etikett: string, varde: string, klass = 'text-white') => (
    <>
      <dt className="text-slate-400">{etikett}</dt>
      <dd className={`text-right tabular-nums ${klass}`}>{varde}</dd>
    </>
  )

  return (
    <div className="bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Icon name="allman.hus" className="w-4 h-4 text-[#20c58f]" />
        <h3 className="text-sm font-semibold text-[#20c58f]">{typ}-avdrag {ROT_RUT_PROCENT[typ]} %</h3>
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {rad('Personnummer', maskeratPersonnummer(invoice.organization_number) || 'saknas', invoice.organization_number ? 'text-white' : 'text-amber-400')}
        {visaFastighet && rad(brf ? 'Bostadsrätt' : 'Fastighetsbeteckning', fastighetText(fastighet) || 'saknas', fastighetKlar(fastighet) ? 'text-white' : 'text-amber-400')}
        {rad('Timmar (bara internt)', `${timmar.toLocaleString('sv-SE', { maximumFractionDigits: 2 })} h`)}
        {rad('Arbetskostnad inkl. moms', formatInvoiceAmount(arbetskostnadInkl))}
        {rad('Material och övrigt inkl. moms', formatInvoiceAmount(Math.max(0, totaltInkl - arbetskostnadInkl)))}
        {rad('Begärt avdrag', `-${formatInvoiceAmount(begart)}`, 'text-[#20c58f]')}
        {fortnox != null && rad('Fortnox avdrag', `-${formatInvoiceAmount(fortnox)}`, Math.abs(fortnox - begart) >= 1 ? 'text-amber-400' : 'text-white')}
        {rad('Att betala', formatInvoiceAmount(totaltInkl - begart), 'text-white font-semibold')}
      </dl>

      {fortnox != null && Math.abs(fortnox - begart) >= 1 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-400">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-[5px] shrink-0" />
          Fortnox räknade {formatInvoiceAmount(fortnox)}, portalen {formatInvoiceAmount(begart)}. Skillnad {formatInvoiceAmount(Math.abs(fortnox - begart))}. Kontrollera avdraget i Fortnox.
        </p>
      )}
      {invoice.rot_rut_error && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-[5px] shrink-0" />
          Avdraget kunde inte registreras i Fortnox: {invoice.rot_rut_error}. Komplettera det i Fortnox.
        </p>
      )}

      <ul className="space-y-1 text-xs">
        {kontroller.map(k => (
          <li key={k.text} className="flex items-start gap-1.5">
            <Icon name={k.ok ? 'allman.bock' : 'allman.saknas'} className={`w-3.5 h-3.5 shrink-0 mt-px ${k.ok ? 'text-[#20c58f]' : 'text-amber-400'}`} />
            <span className={k.ok ? 'text-slate-300' : 'text-white'}>{k.text}</span>
          </li>
        ))}
        <li className="flex items-start gap-1.5 text-slate-400">
          <Icon name="allman.info" className="w-3.5 h-3.5 shrink-0 mt-px" />
          Plats och datum för arbetet kontrolleras när fakturan skickas till Fortnox.
        </li>
      </ul>

      <div className="border-t border-[#20c58f]/20 pt-2 space-y-2">
        <p className="flex items-center gap-2 text-sm text-white">
          <span className={`w-2 h-2 rounded-full ${statusPunkt}`} />
          Begäran hos Skatteverket: {statusText}
        </p>
        {invoice.fortnox_document_number && (
          <div className="flex flex-wrap gap-2">
            {(['requested', 'paid_out', 'rejected'] as Status[]).filter(s => s !== status).map(s => (
              <button
                key={s}
                type="button"
                disabled={sparar}
                onClick={() => void markera(s)}
                className="px-2.5 py-1 text-xs rounded-md border border-slate-600 text-slate-200 hover:border-[#20c58f] hover:text-white disabled:opacity-50"
              >
                {s === 'requested' ? 'Markera begäran gjord' : s === 'paid_out' ? 'Markera utbetald' : 'Markera avvisad'}
              </button>
            ))}
            {status && (
              <button type="button" disabled={sparar} onClick={() => void markera(null)} className="px-2.5 py-1 text-xs text-slate-400 hover:text-white disabled:opacity-50">
                Ta bort markering
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-slate-400">Begäran om utbetalning görs i Fortnox när kunden har betalat, senast 31 januari året efter betalningen.</p>
      </div>
    </div>
  )
}

