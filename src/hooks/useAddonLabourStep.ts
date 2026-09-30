// src/hooks/useAddonLabourStep.ts
// Teknikerns avslutssteg "Arbetstid för att hantera tilläggen": laddar
// underlaget (RPC addon_completion_summary), håller teknikerns val och
// sparar timmarna som FÖRSLAG (RPC set_addon_labour_proposal). Kontoret
// beslutar tilläggen i avtalskartan.
//
// Används av etableringens "Färdig med etablering" (TechnicianEquipment)
// och kontrollrundans avslut (StationInspectionModule). Vyn ritas av
// src/components/technician/AddonLabourStep.tsx. All matte går via
// src/shared/addonEconomics.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddonStationBillingService } from '../services/addonStationBillingService'
import { hasNewAddons } from '../types/addonStations'
import type { AddonCompletionSummary, AddonSummaryType } from '../types/addonStations'
import { formatHours, timelineForProposal } from '../shared/addonEconomics'
import type { AddonTimeline } from '../shared/addonEconomics'

export type AddonLabourVariant = 'new' | 'existing'

export interface AddonLabourStationLine {
  type: AddonSummaryType
  timeline: AddonTimeline
}

export interface AddonLabourEconomics {
  /** Avtalets år (nästa periodstart), för stapeln och "Nu, 9 av 12 månader" */
  yearTimeline: AddonTimeline
  /** En rad per stationstyp med nya stationer */
  stationLines: AddonLabourStationLine[]
  stationsNow: number
  /** Arbetstiden: bara ökningen mot i dag betalas nu, hela timantalet sedan */
  labourTimeline: AddonTimeline
  labourDelta: number
  labourNow: number
  invoiceNow: number
  /** Allt per år från nästa periodstart (alla stationer efter + timmarna) */
  annualTotal: number
  stationsBefore: number
  stationsNew: number
  stationsAfter: number
}

/** Första dagen i nästa månad, ÅÅÅÅ-MM-DD (per månad-stationer). */
function nextMonthStartIso(todayIso: string): string {
  const [y, m] = todayIso.slice(0, 10).split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

/** Tolkar fältet ("1,5" eller "1.5"). Null när det är tomt eller ogiltigt. */
export function parseHoursInput(v: string): number | null {
  const s = v.trim().replace(',', '.')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/** Beloppen i steget. Räknar enbart via timelineForProposal. */
export function computeAddonLabourEconomics(summary: AddonCompletionSummary, hours: number | null): AddonLabourEconomics | null {
  const startDate = summary.next_period_start
  if (!startDate) return null
  const fromDate = summary.today
  const rate = summary.hourly_price ?? 0
  const h = hours != null && hours >= 0 ? hours : 0
  const before = summary.labour_hours_before

  const yearTimeline = timelineForProposal({ fromDate, startDate, perUnitAnnual: 0, quantityNow: 0, unit: 'station' })

  const stationLines = summary.types
    .filter((t) => t.new > 0)
    .map((t) => ({
      type: t,
      timeline: timelineForProposal({
        fromDate,
        startDate: t.model === 'per_month' ? nextMonthStartIso(fromDate) : startDate,
        perUnitAnnual: t.annual_price ?? 0,
        quantityNow: t.new,
        unit: 'station' as const,
        model: t.model,
      }),
    }))
  const stationsNow = stationLines.reduce((s, l) => s + l.timeline.totalNow, 0)

  const labourDelta = Math.max(h - before, 0)
  const labourTimeline = timelineForProposal({
    fromDate,
    startDate,
    perUnitAnnual: rate,
    quantityNow: labourDelta,
    quantityAnnual: h,
    unit: 'timme',
  })
  const labourNow = labourTimeline.totalNow

  const stationsBefore = summary.types.reduce((s, t) => s + t.before, 0)
  const stationsNew = summary.types.reduce((s, t) => s + t.new, 0)
  const stationsAnnual = summary.types.reduce(
    (s, t) =>
      s +
      timelineForProposal({
        fromDate,
        startDate,
        perUnitAnnual: t.annual_price ?? 0,
        quantityNow: 0,
        quantityAnnual: t.before + t.new,
        unit: 'station',
      }).totalAnnual,
    0
  )

  return {
    yearTimeline,
    stationLines,
    stationsNow,
    labourTimeline,
    labourDelta,
    labourNow,
    invoiceNow: stationsNow + labourNow,
    annualTotal: stationsAnnual + labourTimeline.totalAnnual,
    stationsBefore,
    stationsNew,
    stationsAfter: stationsBefore + stationsNew,
  }
}

export interface AddonLabourSaveResult {
  saved: boolean
  /** Text att visa för teknikern när förslaget inte sparades */
  message?: string
}

export interface AddonLabourStepController {
  loading: boolean
  summary: AddonCompletionSummary | null
  /** Steget ska visas: nya tillägg per år/per månad, avtal och periodstart finns */
  visible: boolean
  variant: AddonLabourVariant
  /** Variant A: fältets text */
  hoursInput: string
  setHoursInput: (v: string) => void
  /** Variant B: Nej (timmarna i dag räcker) eller Ja (nytt totalt) */
  choice: 'no' | 'yes'
  setChoice: (c: 'no' | 'yes') => void
  yesInput: string
  setYesInput: (v: string) => void
  /** Valt timantal per år (nytt totalt), null = inget giltigt val */
  chosenHours: number | null
  /** Valideringsfel för aktuellt val, null = giltigt */
  error: string | null
  /** Visa felraden (sätts av validate) */
  showError: boolean
  economics: AddonLabourEconomics | null
  /** Kör före avslut: returnerar felet (och visar det i steget) eller null */
  validate: () => string | null
  /** Sparar valt timantal som förslag. Kastar aldrig. */
  save: () => Promise<AddonLabourSaveResult>
}

function validateHours(v: number | null, emptyMessage: string): string | null {
  if (v == null) return emptyMessage
  if (v < 0) return 'Timmarna kan inte vara negativa.'
  if (v > 1000) return 'Ange högst 1000 timmar per år.'
  if (v * 2 !== Math.floor(v * 2)) return 'Ange hela eller halva timmar, till exempel 1,5.'
  return null
}

/**
 * @param caseId   Ärendet (etableringsärendet eller kontrollärendet)
 * @param enabled  Ladda när dialogen öppnas. Valet ligger kvar när enabled blir false.
 * @param prepare  Körs före underlaget laddas, t.ex. syncAddonProrataLine med ärendets id
 */
export function useAddonLabourStep(params: {
  caseId: string | null | undefined
  enabled: boolean
  prepare?: () => Promise<unknown>
}): AddonLabourStepController {
  const { caseId, enabled } = params
  const prepareRef = useRef(params.prepare)
  useEffect(() => {
    prepareRef.current = params.prepare
  }, [params.prepare])

  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<AddonCompletionSummary | null>(null)
  const [hoursInput, setHoursInput] = useState('')
  const [choice, setChoice] = useState<'no' | 'yes'>('no')
  const [yesInput, setYesInput] = useState('')
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (!enabled || !caseId) return
    let cancelled = false
    setLoading(true)
    setSummary(null)
    setShowError(false)
    ;(async () => {
      try {
        if (prepareRef.current) {
          try {
            await prepareRef.current()
          } catch (err) {
            console.warn('[AddonLabourStep] Förberedelse misslyckades:', err)
          }
        }
        const s = await AddonStationBillingService.getCompletionSummary(caseId)
        if (cancelled) return
        setSummary(s)
        // Förifyll bara med ett sparat förslag, aldrig med en egen gissning
        const before = s?.labour_hours_before ?? 0
        const proposal = s?.proposal_hours ?? null
        setHoursInput(proposal != null ? String(proposal) : '')
        if (proposal != null && proposal > before) {
          setChoice('yes')
          setYesInput(String(proposal))
        } else {
          setChoice('no')
          setYesInput('')
        }
      } catch (err) {
        console.warn('[AddonLabourStep] Kunde inte hämta underlaget:', err)
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [caseId, enabled])

  const visible = !!summary && hasNewAddons(summary) && !!summary.next_period_start
  const variant: AddonLabourVariant =
    summary && (summary.labour_hours_before > 0 || summary.types.some((t) => t.before > 0)) ? 'existing' : 'new'

  const chosenHours = useMemo(() => {
    if (!summary) return null
    if (variant === 'new') return parseHoursInput(hoursInput)
    return choice === 'no' ? summary.labour_hours_before : parseHoursInput(yesInput)
  }, [summary, variant, hoursInput, choice, yesInput])

  const error = useMemo(() => {
    if (!visible || !summary) return null
    if (variant === 'new') {
      return validateHours(chosenHours, 'Ange arbetstiden i timmar per år. Skriv 0 om ingen extra tid behövs.')
    }
    if (choice === 'no') return null
    const e = validateHours(chosenHours, 'Ange det nya totala antalet timmar per år.')
    if (e) return e
    const before = summary.labour_hours_before
    if (chosenHours != null && chosenHours <= before) {
      return `Det nya totalet måste vara mer än ${formatHours(before)} ${before === 1 ? 'timme' : 'timmar'} per år. Välj Nej om tiden räcker.`
    }
    return null
  }, [visible, summary, variant, choice, chosenHours])

  const economics = useMemo(
    () => (summary && visible ? computeAddonLabourEconomics(summary, chosenHours) : null),
    [summary, visible, chosenHours]
  )

  const validate = useCallback(() => {
    setShowError(true)
    return error
  }, [error])

  const save = useCallback(async (): Promise<AddonLabourSaveResult> => {
    if (!visible || !summary || !caseId) return { saved: false }
    if (error || chosenHours == null) return { saved: false, message: error ?? 'Arbetstiden saknas.' }
    try {
      const res = await AddonStationBillingService.setLabourProposal(caseId, chosenHours)
      if (res.ok) return { saved: true }
      if (res.reason === 'already_billed') {
        return { saved: false, message: 'Arbetstiden för tilläggen är redan fakturerad på ärendet. Meddela kontoret om den behöver ändras.' }
      }
      return { saved: false, message: 'Arbetstiden kunde inte sparas som förslag. Meddela kontoret.' }
    } catch (err) {
      console.error('[AddonLabourStep] Kunde inte spara förslaget:', err)
      return { saved: false, message: 'Arbetstiden kunde inte sparas som förslag. Meddela kontoret.' }
    }
  }, [visible, summary, caseId, error, chosenHours])

  return {
    loading,
    summary,
    visible,
    variant,
    hoursInput,
    setHoursInput,
    choice,
    setChoice,
    yesInput,
    setYesInput,
    chosenHours,
    error,
    showError,
    economics,
    validate,
    save,
  }
}
