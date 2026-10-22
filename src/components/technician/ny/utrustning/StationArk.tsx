// src/components/technician/ny/utrustning/StationArk.tsx
// Arket som öppnas när teknikern trycker på en station i nya vyns kundsida.
// Rubrik med typens ruta (färg + produktens eller typens ikon, text alltid
// stationstypen), verktygsraden StationToolbar (Flytta, Byt typ, Historik,
// Hämta upp) och knapparna Ändra och Navigera.
//
// Spärrar, samma regler som kontrollrundan och gamla utrustningsvyn:
//  - Byt typ: avstängd när tilläggsstationen är betald framåt (useAddonPaidLock)
//  - Hämta upp: bara tilläggsstationer (avtalsstationer tas aldrig bort av
//    tekniker), andra klick krävs när stationen är betald framåt
//    (useAddonRemovalGuard + AddonRemovalNotice). Upphämtning = status Borttagen,
//    sedan syncAfterStationChange så § 5-rader, pro rata och etableringsraden följer med
//    (samma kedja som TechnicianEquipment.tsx:446-455 efter en ändring).

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import StationTypeTile from '../../../shared/stations/StationTypeTile'
import StationToolbar from '../../../shared/stations/StationToolbar'
import AddonRemovalNotice, { AddonPaidLockNotice } from '../../../shared/equipment/AddonRemovalNotice'
import { useAddonPaidLock, useAddonRemovalGuard } from '../../../../hooks/useAddonRemovalGuard'
import { EquipmentService } from '../../../../services/equipmentService'
import { IndoorStationService } from '../../../../services/indoorStationService'
import { AddonStationBillingService } from '../../../../services/addonStationBillingService'
import { getOutdoorInspectionsByStation } from '../../../../services/inspectionSessionService'
import { openInMapsApp } from '../../../../utils/equipmentMapUtils'
import { INSPECTION_STATUS_CONFIG, type InspectionStatus } from '../../../../types/indoor'
import type { EquipmentPlacementWithRelations } from '../../../../types/database'
import type { IndoorStationWithRelations } from '../../../../types/indoor'
import { StatusPunkt } from '../besokUi'
import type { Ton } from '../besokTyp'
import { IKONKNAPP, KNAPP_SEKUNDAR, datum, stationStatus, typInfo } from './utrustningUi'

export type ValdStation =
  | { typ: 'ute'; station: EquipmentPlacementWithRelations }
  | { typ: 'inne'; station: IndoorStationWithRelations }

interface Historik { id: string; nar: string; status: string; fynd: string | null; tekniker: string | null; matning: string | null }

const KONTROLL_TON: Partial<Record<InspectionStatus, Ton>> = {
  ok: 'gron', none: 'gron', low: 'gul', activity: 'gul', medium: 'gul', needs_service: 'gul', high: 'rod', replaced: 'bla',
}

interface Props {
  vald: ValdStation | null
  nummer: number | null
  planNamn?: string | null
  customerId: string
  technicianId: string
  technicianName: string | null
  onClose: () => void
  onFlytta: (v: ValdStation) => void
  onBytTyp: (v: ValdStation) => void
  onAndra: (v: ValdStation) => void
  /** Efter upphämtning, ladda om stationerna */
  onAndrad: () => void
}

export function StationArk(props: Props) {
  return (
    <AnimatePresence>
      {props.vald && <ArkInnehall key={props.vald.station.id} {...props} vald={props.vald} />}
    </AnimatePresence>
  )
}

function ArkInnehall({ vald, nummer, planNamn, customerId, technicianId, technicianName, onClose, onFlytta, onBytTyp, onAndra, onAndrad }: Props & { vald: ValdStation }) {
  const s = vald.station
  const inne = vald.typ === 'inne'
  const t = typInfo(s)
  const st = stationStatus(s.status)
  const aktiv = s.status !== 'removed'
  const arTillagg = s.is_addon === true
  const guardStation = { id: s.id, indoor: inne, is_addon: s.is_addon, addon_billing_model: s.addon_billing_model, addon_contract_mode: s.addon_contract_mode }
  const lock = useAddonPaidLock(guardStation)
  const guard = useAddonRemovalGuard(guardStation)

  const [visaHistorik, setVisaHistorik] = useState(false)
  const [historik, setHistorik] = useState<Historik[] | null>(null)
  const [bekraftaUpphamtning, setBekraftaUpphamtning] = useState(false)
  const [hamtar, setHamtar] = useState(false)

  // Historiken hämtas första gången den visas
  useEffect(() => {
    if (!visaHistorik || historik) return
    let avbruten = false
    const run = async () => {
      try {
        if (inne) {
          const rader = await IndoorStationService.getInspectionsByStation(s.id)
          if (!avbruten) setHistorik(rader.map(r => ({
            id: r.id, nar: r.inspected_at, status: r.status, fynd: r.findings, tekniker: r.technician?.name ?? null, matning: null,
          })))
        } else {
          const rader = await getOutdoorInspectionsByStation(s.id)
          if (!avbruten) setHistorik(rader.map(r => ({
            id: r.id, nar: r.inspected_at, status: r.status, fynd: r.findings, tekniker: r.technician?.name ?? null,
            matning: r.measurement_value != null ? `${String(r.measurement_value).replace('.', ',')} ${r.measurement_unit ?? ''}`.trim() : null,
          })))
        }
      } catch (e) {
        console.error('Kunde inte hämta stationens historik:', e)
        if (!avbruten) setHistorik([])
      }
    }
    void run()
    return () => { avbruten = true }
  }, [visaHistorik, historik, inne, s.id])

  const startaUpphamtning = () => {
    guard.confirm() // spänner spärren och hämtar betald-till för per år/per månad
    setBekraftaUpphamtning(true)
  }

  const hamtaUpp = async () => {
    if (!guard.confirm()) return
    setHamtar(true)
    try {
      if (inne) {
        // OBS: indoor_stations.status_updated_by har FK mot profiles(id),
        // inte technicians. Skicka aldrig technician_id här.
        await IndoorStationService.updateStationStatus(s.id, 'removed', undefined)
      } else {
        const res = await EquipmentService.updateEquipmentStatus(s.id, 'removed', technicianId)
        if (!res.success) throw new Error(res.error)
      }
      try {
        const missing = await AddonStationBillingService.syncAfterStationChange(
          customerId,
          s.addon_billing_model,
          technicianId || null,
          technicianName
        )
        const warning = AddonStationBillingService.priceMissingMessage(missing)
        if (warning) toast.error(warning, { duration: 8000 })
      } catch (syncErr) {
        console.error('Tilläggsraderna kunde inte synkas efter upphämtning:', syncErr)
        toast.error('Stationen är upphämtad men faktureringsraderna kunde inte uppdateras. Meddela kontoret.')
      }
      toast.success('Stationen är upphämtad')
      onAndrad()
      onClose()
    } catch (e) {
      console.error('Kunde inte hämta upp stationen:', e)
      toast.error('Kunde inte hämta upp stationen')
    } finally {
      setHamtar(false)
    }
  }

  const rubrik = nummer ? `Station ${nummer}` : (vald.typ === 'inne' && vald.station.station_number) || t.namn
  const placeradAv = s.technician?.name
  const inneStation = inne ? (s as IndoorStationWithRelations) : null
  const uteStation = !inne ? (s as EquipmentPlacementWithRelations) : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="station-ark-rubrik"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[88dvh] flex flex-col bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        <span aria-hidden="true" className="sm:hidden block mx-auto mt-2 w-10 h-1 rounded-full bg-slate-600" />
        <div className="flex items-center gap-3 border-b border-slate-800 py-3 pl-4 pr-2">
          <StationTypeTile size={44} color={t.farg} icon={t.ikon} addon={arTillagg && aktiv} title={t.namn} />
          <div className="flex-1 min-w-0">
            <h2 id="station-ark-rubrik" className="text-lg font-bold text-white truncate">{rubrik}</h2>
            <p className="text-[13px] text-slate-400 truncate">
              {t.namn}
              {arTillagg && <span className="text-violet-300">, tillägg utöver avtal</span>}
              {inne && planNamn ? `, ${planNamn}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Stäng" className={IKONKNAPP}>
            <Icon name="allman.stang" size={20} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-800 space-y-2">
          <StationToolbar
            move={{ visible: aktiv, onClick: () => onFlytta(vald) }}
            changeType={{
              visible: aktiv,
              onClick: () => onBytTyp(vald),
              disabled: lock.locked,
              disabledReason: lock.paidThrough ? `Betald till och med ${lock.paidThrough}` : undefined,
            }}
            history={{ onClick: () => setVisaHistorik(v => !v), active: visaHistorik }}
            pickUp={{ visible: aktiv && arTillagg, onClick: startaUpphamtning, active: bekraftaUpphamtning }}
          />
          <AddonPaidLockNotice paidThrough={lock.paidThrough} />
          {aktiv && !arTillagg && (
            <p className="text-[12px] text-slate-500">Avtalsstationer hämtas inte upp av tekniker. Kontakta kontoret om stationen ska bort.</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {bekraftaUpphamtning && (
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-3 space-y-3" role="group" aria-label="Hämta upp stationen">
              <p className="text-[15px] font-semibold text-white">Hämta upp {rubrik.toLowerCase()}?</p>
              <p className="text-[13px] text-slate-300">Stationen markeras som upphämtad och slutar faktureras. Historiken sparas.</p>
              <AddonRemovalNotice guard={guard} />
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { guard.reset(); setBekraftaUpphamtning(false) }} className={KNAPP_SEKUNDAR}>
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={hamtaUpp}
                  disabled={hamtar || guard.loading}
                  className="h-[52px] flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-[#fff] text-[15px] font-semibold disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  <Icon name={hamtar ? 'allman.laddar' : 'station.hamtaupp'} size={20} className={hamtar ? 'animate-spin' : ''} />
                  Hämta upp
                </button>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="mt-0.5"><StatusPunkt ton={st.ton}>{st.text}</StatusPunkt></dd>
            </div>
            <div>
              <dt className="text-slate-500">Placerad</dt>
              <dd className="mt-0.5 text-slate-200">{datum(s.placed_at)}{placeradAv ? `, ${placeradAv}` : ''}</dd>
            </div>
            {uteStation?.serial_number && (
              <div>
                <dt className="text-slate-500">Serienummer</dt>
                <dd className="mt-0.5 text-slate-200 font-mono">{uteStation.serial_number}</dd>
              </div>
            )}
            {inneStation?.station_number && (
              <div>
                <dt className="text-slate-500">Stationsnummer</dt>
                <dd className="mt-0.5 text-slate-200 font-mono">{inneStation.station_number}</dd>
              </div>
            )}
            {arTillagg && (
              <div>
                <dt className="text-slate-500">Debiteras</dt>
                <dd className="mt-0.5 text-slate-200">
                  {s.addon_billing_model === 'per_year' ? 'Per år' : s.addon_billing_model === 'per_month' ? 'Per månad' : 'Per kontroll'}
                </dd>
              </div>
            )}
            {inneStation?.latest_inspection && (
              <div>
                <dt className="text-slate-500">Senaste kontroll</dt>
                <dd className="mt-0.5 text-slate-200">{datum(inneStation.latest_inspection.inspected_at)}</dd>
              </div>
            )}
            {(inneStation?.location_description || s.comment) && (
              <div className="col-span-2">
                <dt className="text-slate-500">{inneStation?.location_description ? 'Plats' : 'Kommentar'}</dt>
                <dd className="mt-0.5 text-slate-200 whitespace-pre-line">
                  {inneStation?.location_description}
                  {inneStation?.location_description && s.comment ? '\n' : ''}
                  {s.comment}
                </dd>
              </div>
            )}
          </dl>

          {visaHistorik && (
            <section aria-label="Historik" className="space-y-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Icon name="station.historik" size={16} className="text-slate-400" />
                Senaste kontrollerna
              </h3>
              {historik === null ? (
                <p className="text-[13px] text-slate-400 flex items-center gap-2">
                  <Icon name="allman.laddar" size={16} className="animate-spin" />Hämtar historiken...
                </p>
              ) : historik.length === 0 ? (
                <p className="text-[13px] text-slate-400">Stationen har inte kontrollerats än.</p>
              ) : (
                <ol className="rounded-xl border border-slate-700/60 divide-y divide-slate-700/60">
                  {historik.map(h => {
                    const cfg = INSPECTION_STATUS_CONFIG[h.status as InspectionStatus]
                    return (
                      <li key={h.id} className="px-3 py-2.5 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <StatusPunkt ton={KONTROLL_TON[h.status as InspectionStatus] ?? 'gra'}>{cfg?.label ?? h.status}</StatusPunkt>
                          <span className="text-[12px] text-slate-400 tabular-nums">{datum(h.nar)}</span>
                        </div>
                        {(h.tekniker || h.matning) && (
                          <p className="text-[12px] text-slate-400">{[h.tekniker, h.matning].filter(Boolean).join(', ')}</p>
                        )}
                        {h.fynd && <p className="text-[13px] text-slate-300">{h.fynd}</p>}
                      </li>
                    )
                  })}
                </ol>
              )}
            </section>
          )}
        </div>

        <div className="border-t border-slate-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onAndra(vald)} className={KNAPP_SEKUNDAR}>
            <Icon name="rapport.penna" size={20} />
            Ändra uppgifter
          </button>
          {uteStation ? (
            <button type="button" onClick={() => openInMapsApp(uteStation.latitude, uteStation.longitude)} className={KNAPP_SEKUNDAR}>
              <Icon name="falt.navigera" size={20} />
              Navigera
            </button>
          ) : (
            <button type="button" onClick={onClose} className={KNAPP_SEKUNDAR}>Stäng</button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default StationArk
