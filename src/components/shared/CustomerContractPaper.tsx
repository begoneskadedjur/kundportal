// src/components/shared/CustomerContractPaper.tsx
// Avtalet som kunden ser det. Ritas ur contract_customer_view() i databasen,
// som bara returnerar det kunden får se (aldrig kostnader eller marginal).
// Samma komponent i kundportalen och i avtalskartans "Visa som kund", så
// vyerna kan aldrig glida isär: det admin ser i kundläget är kundens data.

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface CustomerContractView {
  id: string
  name: string
  contract_type: string | null
  owner: string | null
  status: string
  signed_at: string | null
  start_date: string | null
  end_date: string | null
  notice_period_months: number | null
  renewal_mode: string | null
  option_until: string | null
  diary_number: string | null
  invoice_reference: string | null
  price_list: string | null
  covers_all_sites: boolean | null
  scope: Array<{ unit_id: string; name: string; address: string | null; active_from: string | null; reference: string | null }>
  prices: Array<{ name: string; code: string | null; price: number | string; unit: string | null }>
  followup: Array<{
    unit_id: string
    name: string
    service_mode: 'inspection' | 'on_demand'
    frequency: string | null
    visits_per_year: number | null
    done_this_year: number
    next_visit_at: string | null
  }>
  contract_year_start: string
  premium: { annual_value: number | string | null; billing_frequency: string | null; billing_anchor_month: number | null; next_invoice: string | null }
  agreement_text: string | null
  account_manager: string | null
}

const FREQ: Record<string, string> = { monthly: 'månadsvis', quarterly: 'kvartalsvis', semi_annual: 'halvårsvis', annual: 'årsvis', custom: 'anpassad' }
const BILLING: Record<string, string> = { monthly: 'månadsvis', quarterly: 'kvartalsvis', semi_annual: 'halvårsvis', annual: 'årsvis', yearly: 'årsvis', on_demand: 'vid avrop' }
const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

const kr = (v: number | string | null | undefined) => (v == null ? '–' : `${Math.round(Number(v)).toLocaleString('sv-SE').replace(/,/g, ' ')} kr`)
const dateSv = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '–')

export async function fetchCustomerContractView(contractId: string): Promise<CustomerContractView | null> {
  const { data, error } = await supabase.rpc('contract_customer_view', { p_contract_id: contractId })
  if (error) {
    console.warn('[contract_customer_view]', error.message)
    return null
  }
  return (data as CustomerContractView | null) ?? null
}

export async function fetchMyContractViews(customerId?: string | null): Promise<CustomerContractView[]> {
  const { data, error } = await supabase.rpc('my_contract_views', { p_customer_id: customerId ?? null })
  if (error) {
    console.warn('[my_contract_views]', error.message)
    return []
  }
  return ((data ?? []) as CustomerContractView[]).filter(Boolean)
}

const INK = { primary: '#262e38', secondary: '#5d6672', muted: '#8a9099', rule: '#d9d3c2', pos: '#157a5b' }

function Para({ no, title, right, children }: { no: string; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: INK.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: INK.primary }}>
          {no} · {title}
        </h4>
        {right != null && <span className="ml-auto font-sans text-[10.5px] tabular-nums" style={{ color: INK.muted }}>{right}</span>}
      </div>
      {children}
    </div>
  )
}

function Row({ no, label, sub, value, tone }: { no: string; label: string; sub?: string; value: React.ReactNode; tone?: 'pos' | 'muted' }) {
  return (
    <div className="flex items-baseline gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={{ borderColor: INK.rule }}>
      <span className="font-sans text-[10.5px] w-7 tabular-nums shrink-0" style={{ color: INK.muted }}>{no}</span>
      <span className="font-semibold truncate" style={{ color: INK.primary }}>
        {label}
        {sub && <span className="font-normal font-sans text-[11.5px] ml-1.5" style={{ color: INK.secondary }}>{sub}</span>}
      </span>
      <span className="flex-1 border-b border-dotted translate-y-[-3px] min-w-3" style={{ borderColor: INK.rule }} />
      <span className="font-sans text-[12px] tabular-nums whitespace-nowrap shrink-0" style={{ color: tone === 'pos' ? INK.pos : tone === 'muted' ? INK.muted : INK.secondary }}>
        {value}
      </span>
    </div>
  )
}

/** Pappret ur kundens projektion. `embedded` = utan egen ram (inuti admin-pappret). */
export function CustomerContractPaperView({ view, embedded = false }: { view: CustomerContractView; embedded?: boolean }) {
  const prem = view.premium
  const yearLabel = `${view.contract_year_start.slice(0, 4)}/${String(Number(view.contract_year_start.slice(0, 4)) + 1).slice(2)}`
  const refs = view.scope.filter((u) => u.reference)
  const commonRef = refs.length > 0 ? refs.map((u) => u.reference).sort().reduce<{ v: string; n: number } | null>((best, r) => {
    const n = refs.filter((x) => x.reference === r).length
    return !best || n > best.n ? { v: r as string, n } : best
  }, null) : null
  const body = (
    <div className="font-serif" style={{ color: INK.primary }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-[9.5px] font-sans font-bold uppercase tracking-[0.16em]" style={{ color: INK.muted }}>
          {view.contract_type ?? 'Avtal'} · {view.status}
        </div>
        <div className="ml-auto font-sans text-[10.5px] tabular-nums" style={{ color: INK.muted }}>
          {view.start_date ? dateSv(view.start_date) : ''}{view.end_date ? ` till ${dateSv(view.end_date)}` : ' · tills vidare'}
        </div>
      </div>
      <h3 className="text-[19px] font-bold leading-tight mt-0.5" style={{ color: INK.primary }}>{view.name}</h3>
      <div className="font-sans text-[11.5px] mt-0.5" style={{ color: INK.secondary }}>
        {view.owner}
        {view.diary_number ? ` · ${view.diary_number}` : ''}
        {view.account_manager ? ` · kundansvarig ${view.account_manager}` : ''}
      </div>
      {prem.annual_value != null && (
        <div className="mt-2 flex items-baseline gap-2 border-y py-2" style={{ borderColor: INK.rule }}>
          <span className="text-[22px] font-bold tabular-nums">{kr(prem.annual_value)}</span>
          <span className="font-sans text-[11.5px]" style={{ color: INK.secondary }}>
            /år{prem.billing_frequency ? ` · faktureras ${BILLING[prem.billing_frequency] ?? prem.billing_frequency}` : ''}
            {prem.next_invoice ? ` · nästa faktura ${dateSv(prem.next_invoice)}` : ''}
          </span>
        </div>
      )}
      {view.agreement_text && (
        <p className="mt-2 text-[12.5px] whitespace-pre-line" style={{ color: INK.secondary }}>{view.agreement_text}</p>
      )}

      <Para no="§ 1" title="Omfattning" right={view.covers_all_sites ? 'hela verksamheten' : `${view.scope.length} enhet${view.scope.length === 1 ? '' : 'er'}`}>
        {view.covers_all_sites && <Row no="1.1" label="Hela verksamheten" value="samtliga nuvarande och framtida enheter" />}
        {view.scope.map((u, i) => (
          <Row key={u.unit_id} no={`1.${i + 1}`} label={u.name} sub={u.address ?? undefined} value={u.active_from ? `gäller fr. ${dateSv(u.active_from)}` : ''} />
        ))}
        {!view.covers_all_sites && view.scope.length === 0 && <Row no="1.1" label={view.owner ?? 'Er anläggning'} value="avtalet gäller anläggningen" />}
      </Para>

      {view.prices.length > 0 && (
        <Para no="§ 2" title="Priser för beställning utöver avtalet" right={view.price_list ?? undefined}>
          {view.prices.map((p, i) => (
            <Row key={`${p.code ?? p.name}-${i}`} no="" label={p.name} value={Number(p.price) === 0 ? 'ingår' : `${kr(p.price)}${p.unit ? ` / ${p.unit}` : ''}`} tone={Number(p.price) === 0 ? 'pos' : undefined} />
          ))}
          <div className="font-sans text-[10.5px] pt-1" style={{ color: INK.muted }}>Övriga tjänster offereras. Priser exklusive moms.</div>
        </Para>
      )}

      <Para no="§ 3" title="Kontroller och besök" right={`avtalsår ${yearLabel}`}>
        {view.followup.map((u, i) => {
          const plan = u.visits_per_year
          const rhythm = u.service_mode === 'on_demand' ? 'vid behov' : u.frequency ? FREQ[u.frequency] ?? u.frequency : plan ? `${plan} besök per år` : 'enligt överenskommelse'
          return (
            <Row
              key={u.unit_id}
              no={`3.${i + 1}`}
              label={u.name}
              sub={rhythm}
              value={
                u.service_mode === 'on_demand'
                  ? 'kontakta oss vid behov'
                  : `${plan ? `${u.done_this_year} av ${plan} gjorda · ` : ''}${u.next_visit_at ? `nästa ${dateSv(u.next_visit_at)}` : 'nästa besök planeras'}`
              }
              tone={u.next_visit_at ? 'pos' : 'muted'}
            />
          )
        })}
      </Para>

      {prem.annual_value != null && (
        <Para no="§ 4" title="Premie och fakturering" right={prem.billing_anchor_month ? `faktureras i ${MONTHS[prem.billing_anchor_month - 1]}` : undefined}>
          <Row no="4.1" label="Årspremie" value={<b style={{ color: INK.primary }}>{kr(prem.annual_value)}/år</b>} />
          <Row no="4.2" label="Faktureras" value={`${prem.billing_frequency ? BILLING[prem.billing_frequency] ?? prem.billing_frequency : ''}${prem.next_invoice ? ` · nästa ${dateSv(prem.next_invoice)}` : ''}`} />
        </Para>
      )}

      {(view.invoice_reference || refs.length > 0) && (
        <Para no="§ 5" title="Referenser">
          {view.invoice_reference && <Row no="5.1" label="Er referens på fakturan" value={view.invoice_reference} />}
          {commonRef && <Row no={view.invoice_reference ? '5.2' : '5.1'} label={`${commonRef.n} enhet${commonRef.n === 1 ? '' : 'er'}`} value={commonRef.v} />}
          {refs.filter((u) => u.reference !== commonRef?.v).map((u) => (
            <Row key={u.unit_id} no="" label={u.name} value={u.reference ?? ''} />
          ))}
        </Para>
      )}

      <Para no={view.invoice_reference || refs.length > 0 ? '§ 6' : '§ 5'} title="Löptid">
        <Row no="" label="Avtalstid" value={`${dateSv(view.start_date)}${view.end_date ? ` till ${dateSv(view.end_date)}` : ' · tills vidare'}`} />
        {view.notice_period_months != null && <Row no="" label="Uppsägningstid" value={`${view.notice_period_months} månader`} />}
        {view.option_until && <Row no="" label="Förlängning" value={`option, längst till ${dateSv(view.option_until)}`} />}
        {view.signed_at && <Row no="" label="Signerat" value={dateSv(view.signed_at)} />}
      </Para>
    </div>
  )
  if (embedded) return body
  return (
    <div className="rounded-sm shadow-lg px-6 py-5" style={{ background: '#f6f3ea' }}>
      {body}
    </div>
  )
}

/** Hämtar och ritar ett avtal ur kundens projektion */
export default function CustomerContractPaper({ contractId, embedded = false }: { contractId: string; embedded?: boolean }) {
  const [view, setView] = useState<CustomerContractView | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCustomerContractView(contractId).then((v) => {
      if (cancelled) return
      setView(v)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [contractId])
  if (loading) return <div className="font-sans text-[12px] py-4" style={{ color: INK.muted }}>Hämtar kundens vy…</div>
  if (!view) return <div className="font-sans text-[12px] py-4" style={{ color: INK.muted }}>Kunden kan inte se det här avtalet.</div>
  return <CustomerContractPaperView view={view} embedded={embedded} />
}
