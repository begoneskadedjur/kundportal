// src/components/admin/procurement/BidCalculator.tsx
// Anbudskalkylen (planens verktyg 1 och vy 4): volymer in, kostnad ut,
// golvpris vid minmarginal, målpris vid målmarginal, vinnande band mot kända
// anbud och förväntat täckningsbidrag vid olika priser. All räkning sker i
// ProcurementCalcService (som räknar marginal via marginEngine). Här finns
// bara indata, presentation och sparade versioner.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Button from '../../ui/Button'
import {
  DEFAULT_CALC_INPUT,
  ProcurementCalcService,
  probabilityAtPrice,
  type CalcInput,
  type CalcResult,
} from '../../../services/procurementCalcService'
import { ProcurementService, type AwardWithRelations, type NoticeWithRelations } from '../../../services/procurementService'
import type { PricingSettings } from '../../../types/pricingSettings'
import { DEFAULT_PRICING_SETTINGS } from '../../../types/pricingSettings'
import { CRITERIA_TYPE_LABEL, type ProcurementBid, type ProcurementCriteriaType } from '../../../types/procurement'
import { EmptyState, LinkButton, PulseRow } from './ui'
import { SERIES_COLORS, fmtDateTime, fmtKr, fmtKrShort, fmtNum, fmtPct, tableCls } from './uiFormat'
import { Label, NumberField, SubHeading, selectCls } from './detail/fields'
import { errMsg } from './detail/helpers'

interface Props {
  notice: NoticeWithRelations
  buyerAwards: AwardWithRelations[]
  bids: ProcurementBid[]
  settings: PricingSettings | null
  onSaved: () => void
}

/** Det som sparas i procurement_bids.calc */
export interface SavedCalc {
  input: CalcInput
  result: {
    visitsPerYear: number
    labourHours: number
    labourCost: number
    consumableCost: number
    annualCost: number
    durableCost: number
    annualCostWithDurable: number
    floorPrice: number
    targetPrice: number
    baseProbability: number
    expectedBids: number
    labourWarning: string | null
    best: string | null
    scenarios: Array<{
      label: string
      price: number
      contributionPerYear: number
      contributionContract: number
      probability: number
      expectedContribution: number
      belowFloor: boolean
    }>
  }
  settings: { min_margin_percent: number; target_margin_percent: number; max_payback_years: number | null }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Startvärden: senaste sparade kalkyl, annars upphandlingens volymer och köparens historik */
function initialInput(notice: NoticeWithRelations, buyerAwards: AwardWithRelations[], bids: ProcurementBid[]): CalcInput {
  const current = bids.find((b) => b.is_current) ?? bids[0]
  const saved = (current?.calc as Partial<SavedCalc> | undefined)?.input
  if (saved && typeof saved === 'object') return { ...DEFAULT_CALC_INPUT, ...saved }

  const fromNotice = ProcurementCalcService.inputFromNotice(notice)
  const band = ProcurementCalcService.bandFromAwards(buyerAwards)
  const buyerBids = median(buyerAwards.map((a) => Number(a.bids_received)).filter((n) => n > 0))
  const otherFromHistory = buyerBids != null ? Math.max(1, Math.round(buyerBids) - 1) : null
  return {
    ...DEFAULT_CALC_INPUT,
    ...fromNotice,
    expectedOtherBids: fromNotice.expectedOtherBids ?? otherFromHistory,
    bandLow: band.low != null ? Math.round(band.low) : null,
    bandHigh: band.high != null ? Math.round(band.high) : null,
  }
}

function toSaved(input: CalcInput, r: CalcResult): SavedCalc {
  return {
    input,
    result: {
      visitsPerYear: r.visitsPerYear,
      labourHours: r.labourHours,
      labourCost: r.labourCost,
      consumableCost: r.consumableCost,
      annualCost: r.annualCost,
      durableCost: r.durableCost,
      annualCostWithDurable: r.annualCostWithDurable,
      floorPrice: r.floorPrice,
      targetPrice: r.targetPrice,
      baseProbability: r.baseProbability,
      expectedBids: r.expectedBids,
      labourWarning: r.labourWarning,
      best: r.best?.label ?? null,
      scenarios: r.scenarios.map((s) => ({
        label: s.label,
        price: s.price,
        contributionPerYear: s.contributionPerYear,
        contributionContract: s.contributionContract,
        probability: s.probability,
        expectedContribution: s.expectedContribution,
        belowFloor: s.belowFloor,
      })),
    },
    settings: {
      min_margin_percent: r.settings.min_margin_percent,
      target_margin_percent: r.settings.target_margin_percent,
      max_payback_years: r.settings.max_payback_years ?? null,
    },
  }
}

export default function BidCalculator({ notice, buyerAwards, bids, settings, onSaved }: Props) {
  const [input, setInput] = useState<CalcInput>(() => initialInput(notice, buyerAwards, bids))
  const [own, setOwn] = useState<{ wins: number; decided: number }>({ wins: 0, decided: 0 })
  const [saving, setSaving] = useState(false)
  const [label, setLabel] = useState('')
  const [touched, setTouched] = useState(false)

  // Köparens tilldelningar och sparade kalkyler kan komma efter första
  // renderingen. Fyll på startvärdena så länge användaren inte börjat ändra.
  useEffect(() => {
    if (!touched) setInput(initialInput(notice, buyerAwards, bids))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerAwards, bids])

  useEffect(() => {
    ProcurementService.ownOutcomeStats()
      .then(setOwn)
      .catch(() => undefined)
  }, [])

  const band = useMemo(() => ProcurementCalcService.bandFromAwards(buyerAwards), [buyerAwards])

  const marginSettings = useMemo(
    () => ({
      min_margin_percent: settings?.min_margin_percent ?? DEFAULT_PRICING_SETTINGS.min_margin_percent,
      target_margin_percent: settings?.target_margin_percent ?? DEFAULT_PRICING_SETTINGS.target_margin_percent,
      max_payback_years: settings?.max_payback_years ?? DEFAULT_PRICING_SETTINGS.max_payback_years,
    }),
    [settings]
  )

  const fullInput = useMemo<CalcInput>(() => ({ ...input, ownWins: own.wins, ownBids: own.decided }), [input, own])
  const result = useMemo(() => ProcurementCalcService.calculate(fullInput, marginSettings), [fullInput, marginSettings])

  const set = <K extends keyof CalcInput>(key: K, value: CalcInput[K]) => {
    setTouched(true)
    setInput((prev) => ({ ...prev, [key]: value }))
  }
  const num = (key: keyof CalcInput, fallback = 0) => (n: number | null) => set(key, (n ?? fallback) as never)

  const years = Math.max(1, input.contractYears || 1)

  // Kurva: förväntat TB över avtalet vid olika årspriser
  const curve = useMemo(() => {
    const lo = Math.max(1, Math.min(result.floorPrice * 0.8, input.bandLow ?? Infinity))
    const hi = Math.max(result.targetPrice * 1.4, input.bandHigh ?? 0, input.plannedPrice ?? 0)
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return []
    const steps = 24
    return Array.from({ length: steps + 1 }, (_, i) => {
      const price = lo + ((hi - lo) * i) / steps
      const contract = (price - result.annualCost) * years - result.durableCost
      const p = probabilityAtPrice(price, result.baseProbability, fullInput, result.targetPrice)
      return { price: Math.round(price), expected: Math.round(p * Math.max(0, contract)) }
    })
  }, [result, input.bandLow, input.bandHigh, input.plannedPrice, years, fullInput])

  const save = async () => {
    setSaving(true)
    try {
      const planned = input.plannedPrice && input.plannedPrice > 0 ? input.plannedPrice : null
      const chosen = planned != null ? result.scenarios.find((s) => s.label === 'Vårt pris') ?? null : result.best
      await ProcurementService.saveBid(notice.id, {
        label: label.trim() || null,
        calc: toSaved(input, result) as unknown as Record<string, unknown>,
        volumes: {
          objects: input.objects,
          visits_per_object_per_year: input.visitsPerObjectPerYear,
          visits_per_year: result.visitsPerYear,
          callouts_per_year: input.calloutsPerYear,
          durable_units: input.durableUnits,
        },
        contract_years: input.contractYears,
        annual_cost: Math.round(result.annualCost),
        floor_price: Math.round(result.floorPrice),
        target_price: Math.round(result.targetPrice),
        submitted_price: planned,
        win_probability: chosen ? Math.round(chosen.probability * 1000) / 1000 : null,
        expected_contribution: chosen ? Math.round(chosen.expectedContribution) : null,
      })
      toast.success('Kalkylen sparad')
      setLabel('')
      setTouched(false)
      onSaved()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara kalkylen'))
    } finally {
      setSaving(false)
    }
  }

  const loadVersion = (b: ProcurementBid) => {
    const saved = (b.calc as Partial<SavedCalc>)?.input
    if (!saved) {
      toast.error('Versionen saknar indata')
      return
    }
    setTouched(true)
    setInput({ ...DEFAULT_CALC_INPUT, ...saved })
    toast.success('Versionen laddad')
  }

  const minPct = marginSettings.min_margin_percent
  const tgtPct = marginSettings.target_margin_percent

  return (
    <div className="p-4 space-y-5">
      <div>
        <SubHeading>Indata</SubHeading>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberField label="Objekt" value={input.objects} onChange={num('objects')} />
          <NumberField label="Besök per objekt och år" value={input.visitsPerObjectPerYear} onChange={num('visitsPerObjectPerYear')} />
          <NumberField label="Timmar per besök" value={input.hoursPerVisit} onChange={num('hoursPerVisit')} suffix="h" />
          <NumberField label="Restid per besök" value={input.travelHoursPerVisit} onChange={num('travelHoursPerVisit')} suffix="h" />
          <NumberField label="Utryckningar per år" value={input.calloutsPerYear} onChange={num('calloutsPerYear')} />
          <NumberField label="Timmar per utryckning" value={input.hoursPerCallout} onChange={num('hoursPerCallout')} suffix="h" />
          <NumberField label="Förbrukning per besök" value={input.consumablesPerVisit} onChange={num('consumablesPerVisit')} suffix="kr" />
          <NumberField label="Timpris (intern kostnad)" value={input.hourlyCost} onChange={num('hourlyCost', DEFAULT_CALC_INPUT.hourlyCost)} suffix="kr" />
          <NumberField label="Varaktiga enheter" value={input.durableUnits} onChange={num('durableUnits')} suffix="st" />
          <NumberField label="Styckkostnad per enhet" value={input.durableUnitCost} onChange={num('durableUnitCost')} suffix="kr" />
          <NumberField label="Avtalstid inkl. förlängningar" value={input.contractYears} onChange={num('contractYears', 1)} suffix="år" />
          <NumberField
            label="Andra anbud (förväntat)"
            value={input.expectedOtherBids}
            onChange={(n) => set('expectedOtherBids', n)}
            placeholder="median 2"
          />
          <div>
            <Label>Kriterietyp</Label>
            <select className={selectCls} value={input.criteriaType ?? ''} onChange={(e) => set('criteriaType', e.target.value || null)} aria-label="Kriterietyp">
              <option value="">Okänd</option>
              {(Object.keys(CRITERIA_TYPE_LABEL) as ProcurementCriteriaType[]).map((t) => (
                <option key={t} value={t}>{CRITERIA_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <NumberField label="Prisband låg (per år)" value={input.bandLow} onChange={(n) => set('bandLow', n)} suffix="kr" />
          <NumberField label="Prisband hög (per år)" value={input.bandHigh} onChange={(n) => set('bandHigh', n)} suffix="kr" />
          <NumberField label="Vårt pris (per år)" value={input.plannedPrice} onChange={(n) => set('plannedPrice', n)} suffix="kr" />
        </div>
        <p className="text-[11px] text-slate-600 mt-2">
          Priser är årspris exkl. moms.{' '}
          {band.samples > 0
            ? `Prisbandet är förifyllt ur ${band.samples} kända anbudspriser hos köparen, omräknade per år.`
            : 'Köparen har inga kända anbudspriser; ramtak räknas inte som vinnande pris.'}{' '}
          {own.decided >= 5 ? `Sannolikheten vägs mot egen historik (${own.wins} vunna av ${own.decided}).` : ''}
        </p>
      </div>

      <PulseRow
        stats={[
          {
            label: 'Kostnad per år',
            value: fmtKrShort(result.annualCost),
            hint: `arbetstid ${fmtKrShort(result.labourCost)}, förbrukning ${fmtKrShort(result.consumableCost)}`,
          },
          {
            label: 'Utrustning',
            value: fmtKrShort(result.durableCost),
            hint: result.durableCost > 0 ? `${fmtKrShort(result.durableCost / years)} per år över avtalet` : 'ingen varaktig utrustning',
          },
          { label: 'Golvpris', value: fmtKrShort(result.floorPrice), hint: `per år vid ${fmtNum(minPct)} % marginal`, tone: 'warn' },
          { label: 'Målpris', value: fmtKrShort(result.targetPrice), hint: `per år vid ${fmtNum(tgtPct)} % marginal`, tone: 'good' },
          { label: 'Sannolikhet, bas', value: fmtPct(result.baseProbability), hint: `${fmtNum(result.expectedBids)} anbud väntas totalt` },
        ]}
      />

      <div className="text-[12px] text-slate-500 tabular-nums">
        {fmtNum(result.visitsPerYear, 1)} besök per år, {fmtNum(result.labourHours, 1)} timmar arbetstid per år.
      </div>

      {result.labourWarning && (
        <div className="flex items-center gap-2 text-[12px] text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {result.labourWarning}. Marginalen blir missvisande tills arbetstiden är rimlig.
        </div>
      )}

      <div>
        <SubHeading>Scenarier</SubHeading>
        <div className="overflow-x-auto -mx-4">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Scenario</th>
                <th className={tableCls.thRight}>Pris per år</th>
                <th className={tableCls.thRight}>Marginal</th>
                <th className={tableCls.thRight}>TB per år</th>
                <th className={tableCls.thRight}>TB över avtalet</th>
                <th className={tableCls.thRight}>Sannolikhet</th>
                <th className={tableCls.thRight}>Förväntat TB</th>
              </tr>
            </thead>
            <tbody>
              {result.scenarios.map((s) => {
                const isBest = result.best === s
                const margin = s.price > 0 ? s.contributionPerYear / s.price : null
                const rowTone = s.belowFloor ? 'text-red-400' : isBest ? 'text-[#20c58f]' : ''
                return (
                  <tr key={`${s.label}-${s.price}`} className={`${tableCls.tr} ${isBest ? 'bg-[#20c58f]/5' : ''}`}>
                    <td className={`${tableCls.td} ${rowTone} whitespace-nowrap`}>
                      {s.label}
                      {isBest && <span className="ml-2 text-[10.5px] text-[#20c58f]">bäst förväntat</span>}
                      {s.belowFloor && <span className="ml-2 text-[10.5px] text-red-400">under golvet</span>}
                    </td>
                    <td className={`${tableCls.tdRight} ${rowTone}`}>{fmtKr(s.price)}</td>
                    <td className={`${tableCls.tdRight} ${rowTone}`}>{fmtPct(margin, 1)}</td>
                    <td className={`${tableCls.tdRight} ${rowTone}`}>{fmtKr(s.contributionPerYear)}</td>
                    <td className={`${tableCls.tdRight} ${rowTone}`}>{fmtKr(s.contributionContract)}</td>
                    <td className={`${tableCls.tdRight} ${rowTone}`}>{fmtPct(s.probability)}</td>
                    <td className={`${tableCls.tdRight} ${rowTone} font-medium`}>{fmtKr(s.expectedContribution)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-slate-600 mt-1.5">
          Marginal är löpande marginal per år. TB över avtalet är efter utrustningen. Förväntat TB är sannolikhet gånger TB över avtalet. Sannolikheten är en grov bas och
          flyttas av prisbandet; den är inte en prognos.
        </p>
      </div>

      {curve.length > 0 && (
        <div>
          <SubHeading>Förväntat TB över avtalet mot årspris</SubHeading>
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="price"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  tickFormatter={(v: number) => fmtKrShort(v)}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                />
                <YAxis tickFormatter={(v: number) => fmtKrShort(v)} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                <Tooltip
                  formatter={(v: number) => [fmtKr(v), 'Förväntat TB']}
                  labelFormatter={(v: number) => `Årspris ${fmtKr(v)}`}
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#cbd5e1' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <ReferenceLine x={Math.round(result.floorPrice)} stroke="#f87171" strokeDasharray="3 3" label={{ value: 'Golv', fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                <ReferenceLine x={Math.round(result.targetPrice)} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Mål', fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                {input.plannedPrice ? (
                  <ReferenceLine x={Math.round(input.plannedPrice)} stroke={SERIES_COLORS[1]} label={{ value: 'Vårt pris', fill: '#94a3b8', fontSize: 10, position: 'top' }} />
                ) : null}
                <Line type="monotone" dataKey="expected" stroke={SERIES_COLORS[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-end gap-2 pt-2 border-t border-slate-800">
        <div className="flex-1">
          <Label>Namn på versionen (valfritt)</Label>
          <input
            className="w-full px-2.5 py-1.5 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="T.ex. Första utkast, efter frågesvar"
          />
        </div>
        <Button size="sm" onClick={() => void save()} loading={saving}>
          Spara kalkyl
        </Button>
      </div>

      <div>
        <SubHeading>Sparade versioner</SubHeading>
        {bids.length === 0 ? (
          <EmptyState title="Ingen kalkyl sparad ännu" />
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Sparad</th>
                  <th className={tableCls.th}>Namn</th>
                  <th className={tableCls.thRight}>Golv</th>
                  <th className={tableCls.thRight}>Mål</th>
                  <th className={tableCls.thRight}>Lämnat pris</th>
                  <th className={tableCls.thRight}>Förv. TB</th>
                  <th className={tableCls.thRight} />
                </tr>
              </thead>
              <tbody>
                {bids.map((b) => (
                  <tr key={b.id} className={tableCls.tr}>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      {fmtDateTime(b.created_at)}
                      {b.is_current && <span className="ml-2 text-[10.5px] text-[#20c58f]">aktuell</span>}
                    </td>
                    <td className={tableCls.td}>{b.label ?? '–'}</td>
                    <td className={tableCls.tdRight}>{fmtKr(b.floor_price)}</td>
                    <td className={tableCls.tdRight}>{fmtKr(b.target_price)}</td>
                    <td className={tableCls.tdRight}>{fmtKr(b.submitted_price)}</td>
                    <td className={tableCls.tdRight}>{fmtKr(b.expected_contribution)}</td>
                    <td className={tableCls.tdRight}>
                      <LinkButton onClick={() => loadVersion(b)}>Ladda</LinkButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
