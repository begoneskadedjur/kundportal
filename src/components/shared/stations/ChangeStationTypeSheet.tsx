// src/components/shared/stations/ChangeStationTypeSheet.tsx
// Byt stationstyp på en befintlig station (skissen "Efter: byt stationstyp").
// Från → till med typrutor, rutnät med aktiva typer (nuvarande nedtonad),
// produktval för vald typ, serienummer när typen kräver det, tre
// informationsrader och primärknappen "Byt till X".
//
// Två lägen:
// - layout="inline": ersätter innehållet i en befintlig modal (stationsmodalen
//   i kontrollrundan) med egen rubrik och tillbakapil.
// - ChangeStationTypeModal: egen modal via Modal.tsx (utrustningsvyn).
//
// Själva bytet görs av StationTypeService.changeStationType (RPC
// change_station_type). Typlistan filtreras inte på ute/inne, precis som
// EquipmentPlacementForm och IndoorStationForm (alla aktiva typer).

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import StationTypeTile from './StationTypeTile'
import {
  StationTypeService,
  type ChangeStationTypeResult,
  type StationKind,
} from '../../../services/stationTypeService'
import { AddonStationBillingService } from '../../../services/addonStationBillingService'
import { useAddonPaidLock } from '../../../hooks/useAddonRemovalGuard'
import { AddonPaidLockNotice } from '../equipment/AddonRemovalNotice'
import type { StationType } from '../../../types/stationTypes'
import type { StationTypeArticle } from '../../../types/addonStations'

export interface ChangeStationTypeStation {
  id: string
  kind: StationKind
  /** Nuvarande typ (station_types.id). null = bara textkod, ingen typ vald. */
  typeId: string | null
  /** Nuvarande typens namn, färg och ikon (för från-rutan) */
  typeName?: string | null
  typeColor?: string | null
  typeIcon?: string | null
  is_addon?: boolean | null
  addon_billing_model?: string | null
  addon_contract_mode?: string | null
  article_id?: string | null
  serial_number?: string | null
  /** Rubrikens undertext, t.ex. "Station 2" */
  label?: string | null
}

/** Det teknikern valde, så att anroparen kan uppdatera sitt lokala state */
export interface ChangeStationTypeChoice {
  /** Vald produkt, null = ingen produkt skickades */
  article: StationTypeArticle | null
  /** Serienumret som skickades, null = oförändrat */
  serialNumber: string | null
}

export interface ChangeStationTypeSheetProps {
  station: ChangeStationTypeStation
  /** Pågående kontrollsession, loggas med bytet */
  sessionId?: string | null
  /** Typerna om anroparen redan har dem. Annars hämtas aktiva typer. */
  stationTypes?: StationType[]
  /** Efter lyckat byte. newType är den valda typens fulla rad, choice det som valdes i formuläret. */
  onChanged: (result: ChangeStationTypeResult, newType: StationType, choice: ChangeStationTypeChoice) => void
  /** Tillbaka/avbryt */
  onCancel: () => void
  /** inline = egen rubrik med tillbakapil (inuti en modal). modal = utan rubrik (Modal.tsx bär den). */
  layout?: 'inline' | 'modal'
}

function unitShort(unit: string | null | undefined): string {
  if (!unit) return ''
  if (unit === 'gram') return 'g'
  if (unit === 'procent') return '%'
  return unit
}

function typeNote(t: StationType): string {
  if (!t.measurement_label) return 'Bara tillsyn'
  const u = unitShort(t.measurement_unit)
  return u ? `${t.measurement_label} (${u})` : t.measurement_label
}

export default function ChangeStationTypeSheet({
  station,
  sessionId,
  stationTypes,
  onChanged,
  onCancel,
  layout = 'inline',
}: ChangeStationTypeSheetProps) {
  const [types, setTypes] = useState<StationType[]>(stationTypes ?? [])
  const [loadingTypes, setLoadingTypes] = useState(!stationTypes)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [articles, setArticles] = useState<StationTypeArticle[]>([])
  const [articlesLoading, setArticlesLoading] = useState(false)
  const [articleId, setArticleId] = useState<string | null>(null)
  const [serial, setSerial] = useState(station.serial_number ?? '')
  const [saving, setSaving] = useState(false)

  // Förskottsbetald tilläggsstation: typen får inte bytas
  const paidLock = useAddonPaidLock({
    id: station.id,
    indoor: station.kind === 'indoor',
    is_addon: station.is_addon,
    addon_billing_model: station.addon_billing_model,
    addon_contract_mode: station.addon_contract_mode,
  })

  useEffect(() => {
    if (stationTypes) {
      setTypes(stationTypes)
      setLoadingTypes(false)
      return
    }
    let cancelled = false
    setLoadingTypes(true)
    StationTypeService.getActiveStationTypes()
      .then((t) => { if (!cancelled) setTypes(t) })
      .catch(() => { if (!cancelled) toast.error('Kunde inte hämta stationstyperna') })
      .finally(() => { if (!cancelled) setLoadingTypes(false) })
    return () => { cancelled = true }
  }, [stationTypes])

  const current = useMemo(
    () => types.find((t) => t.id === station.typeId) ?? null,
    [types, station.typeId]
  )
  const currentName = current?.name ?? station.typeName ?? 'Okänd typ'
  const selected = useMemo(() => types.find((t) => t.id === selectedId) ?? null, [types, selectedId])

  // Produkterna för vald typ. Förval: nuvarande produkt om den är tillåten,
  // annars typens standardprodukt, annars den första.
  useEffect(() => {
    setArticles([])
    setArticleId(null)
    if (!selectedId) return
    let cancelled = false
    setArticlesLoading(true)
    AddonStationBillingService.getStationTypeArticles(selectedId)
      .then((list) => {
        if (cancelled) return
        setArticles(list)
        const keep = list.find((a) => a.articleId === station.article_id)
        const pick = keep ?? list.find((a) => a.isDefault) ?? list[0] ?? null
        setArticleId(pick?.articleId ?? null)
      })
      .finally(() => { if (!cancelled) setArticlesLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, station.article_id])

  // Bara utomhusstationer har serienummer (indoor_stations saknar kolumnen)
  const needsSerial = station.kind === 'outdoor' && !!selected?.requires_serial_number
  const serialMissing = needsSerial && !serial.trim()
  const canSubmit = !!selected && !saving && !paidLock.locked && !serialMissing && !articlesLoading

  const handleSubmit = async () => {
    if (!selected || !canSubmit) return
    setSaving(true)
    try {
      const res = await StationTypeService.changeStationType({
        stationId: station.id,
        kind: station.kind,
        newTypeId: selected.id,
        articleId: articles.length > 0 ? articleId : null,
        serialNumber: needsSerial ? serial.trim() : null,
        sessionId: sessionId ?? null,
      })
      if (!res.success || !res.data) {
        toast.error(res.error || 'Kunde inte byta stationstyp')
        return
      }
      onChanged(res.data, selected, {
        article: articles.length > 0 ? articles.find((a) => a.articleId === articleId) ?? null : null,
        serialNumber: needsSerial ? serial.trim() : null,
      })
    } catch (err) {
      console.error('Byte av stationstyp misslyckades:', err)
      toast.error('Kunde inte byta stationstyp')
    } finally {
      setSaving(false)
    }
  }

  const priceLine = (() => {
    if (station.is_addon !== true || !selected) return null
    if (station.addon_billing_model === 'per_year' || station.addon_billing_model === 'per_month') {
      return `Tilläggsstationen är inte fakturerad än. Årspriset för ${selected.name} gäller och kontoret får en notis.`
    }
    return `Tilläggsstationen faktureras per kontroll. Priset för ${selected.name} gäller och kontoret får en notis.`
  })()

  const body = (
    <div className="space-y-5">
      {/* Från → till */}
      <div className="flex items-center justify-center gap-3.5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
        <div className="flex flex-col items-center gap-1.5 w-[110px]">
          <StationTypeTile
            size={56}
            color={current?.color ?? station.typeColor}
            icon={current?.icon ?? station.typeIcon}
          />
          <span className="text-xs text-slate-400 text-center">{currentName}</span>
        </div>
        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="#20c58f" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
        <div className="flex flex-col items-center gap-1.5 w-[110px]">
          {selected ? (
            <StationTypeTile size={56} color={selected.color} icon={selected.icon} />
          ) : (
            <span className="w-14 h-14 rounded-[14px] border-[1.5px] border-dashed border-slate-600" aria-hidden="true" />
          )}
          <span className="text-xs text-slate-200 text-center">{selected ? selected.name : 'Välj ny typ'}</span>
        </div>
      </div>

      <AddonPaidLockNotice paidThrough={paidLock.paidThrough} />

      {/* Typerna */}
      {loadingTypes ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-[#20c58f] animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Ny stationstyp">
          {types.map((t) => {
            const isCurrent = t.id === station.typeId
            const isSelected = t.id === selectedId
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isCurrent || paidLock.locked}
                onClick={() => setSelectedId(t.id)}
                className={`min-h-[76px] rounded-2xl border-[1.5px] flex items-center gap-2.5 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed ${
                  isSelected
                    ? 'border-[#20c58f] bg-[#20c58f]/10'
                    : 'border-slate-800 bg-slate-800/60 enabled:hover:border-slate-700'
                } ${isCurrent ? 'opacity-45' : paidLock.locked ? 'opacity-60' : ''}`}
              >
                <StationTypeTile size={40} color={t.color} icon={t.icon} />
                <span className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[13px] font-semibold text-slate-200 leading-tight">{t.name}</span>
                  <span className="text-[11px] text-slate-400 leading-tight">{isCurrent ? 'Nuvarande typ' : typeNote(t)}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Produkt för vald typ */}
      {selected && (articlesLoading || articles.length > 0) && (
        <div className="space-y-2">
          <span className="block text-[13px] font-medium text-slate-300">Produkt</span>
          {articlesLoading ? (
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {articles.map((a) => {
                const on = a.articleId === articleId
                return (
                  <button
                    key={a.articleId}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setArticleId(a.articleId)}
                    className={`h-11 px-4 rounded-xl border-[1.5px] text-[13px] text-slate-200 transition-colors ${
                      on ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                    }`}
                  >
                    {a.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Serienummer när typen kräver det */}
      {needsSerial && (
        <div className="space-y-2">
          <label htmlFor={`serie-${station.id}`} className="block text-[13px] font-medium text-slate-300">
            Serienummer (krävs för {selected!.name.toLowerCase()})
          </label>
          <input
            id={`serie-${station.id}`}
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="Skriv eller skanna"
            autoComplete="off"
            className="w-full h-12 px-3 rounded-xl bg-slate-800 border border-slate-700 text-[#fff] text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
          />
        </div>
      )}

      {/* Vad som händer */}
      {selected && (
        <div className="space-y-2.5 text-xs leading-relaxed text-slate-400">
          <p className="flex gap-2.5">
            <Icon name="station.historik" size={16} className="flex-shrink-0 mt-px" />
            <span>Tidigare kontroller står kvar som {currentName}.</span>
          </p>
          {priceLine && (
            <p className="flex gap-2.5 text-violet-300">
              <Icon name="allman.plus" size={16} className="flex-shrink-0 mt-px" />
              <span>{priceLine}</span>
            </p>
          )}
          {station.kind === 'indoor' && (
            <p className="flex gap-2.5">
              <Icon name="allman.lista" size={16} className="flex-shrink-0 mt-px" />
              <span>
                Stationen får ett nytt nummer i serien för {selected.name}
                {selected.prefix ? ` (${selected.prefix}-)` : ''}.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )

  const footer = (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={!canSubmit}
      className={`w-full h-[52px] rounded-2xl text-[15px] font-bold flex items-center justify-center gap-2 transition-colors ${
        selected && !paidLock.locked
          ? 'bg-[#20c58f] hover:bg-[#1bb07f] text-[#04140d] disabled:opacity-60'
          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
      }`}
    >
      {saving ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Icon name="station.byttyp" size={20} />}
      {selected ? `Byt till ${selected.name}` : 'Välj en typ'}
    </button>
  )

  if (layout === 'modal') {
    return (
      <div className="flex flex-col">
        <div className="p-4">{body}</div>
        <div className="sticky bottom-0 bg-slate-900 px-4 py-2.5 border-t border-slate-700/50">{footer}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-2 px-3 py-3 pl-2 border-b border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Tillbaka till kontrollen"
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-300 hover:text-[#fff] hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold text-[#fff] leading-tight">Byt stationstyp</h2>
          {station.label && <p className="text-xs text-slate-400 truncate">{station.label}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{body}</div>
      <div className="border-t border-slate-800 px-4 pt-3 pb-4">{footer}</div>
    </div>
  )
}

export interface ChangeStationTypeModalProps extends Omit<ChangeStationTypeSheetProps, 'layout'> {
  isOpen: boolean
}

/** Byt typ som egen modal (utrustningsvyn). Följer modalstandarden, inget Card. */
export function ChangeStationTypeModal({ isOpen, ...props }: ChangeStationTypeModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={props.onCancel}
      title="Byt stationstyp"
      subtitle={props.station.label ?? undefined}
      size="md"
    >
      <ChangeStationTypeSheet {...props} layout="modal" />
    </Modal>
  )
}
