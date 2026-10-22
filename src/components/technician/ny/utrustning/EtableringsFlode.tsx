// src/components/technician/ny/utrustning/EtableringsFlode.tsx
//
// Alla lager i etableringsflödet för nya arbetsvyn: wizarden (Kund, Typ,
// Placera), placeringsformuläret utomhus med klart-läget för batch,
// faktureringssammanfattningen vid Färdig med etablering, frågan om
// återkommande kontroller och schemawizarden.
//
// Logiken ligger i useEtableringsflode (kopia av TechnicianEquipment.tsx, se
// källhänvisningarna där). Den här filen är bara utseendet. Sammanfattningens
// innehåll och spärrar motsvarar TechnicianEquipment.tsx:1287-1432 rad för rad:
// redigerbart pris och antal på tilläggsraden, arbetstid för tilläggen
// (AddonLabourStep), totalen exkl. moms, 0 kr-varningen och rabattvarningen
// när priset är under listpriset.

import { AnimatePresence, motion } from 'framer-motion'
import { Icon } from '../../../icons/Icon'
import { AddStationWizard } from '../../AddStationWizard'
import AddonLabourStep from '../../AddonLabourStep'
import { RecurringScheduleWizardWithContract as RecurringScheduleWizard } from '../../RecurringScheduleWizardWithContract'
import { EquipmentPlacementForm } from '../../../shared/equipment/EquipmentPlacementForm'
import type { CustomerStationSummary } from '../../../../services/equipmentService'
import type { Etableringsflode } from './useEtableringsflode'
import { KNAPP_PRIMAR, KNAPP_SEKUNDAR, KNAPP_TYST } from './utrustningUi'

interface Props {
  flode: Etableringsflode
  allCustomers: CustomerStationSummary[]
  /** Efter att inomhusplaceringen i wizarden stängts */
  onIndoorFinished: () => void
  onTypeChanged: () => void
}

export function EtableringsFlode({ flode: f, allCustomers, onIndoorFinished, onTypeChanged }: Props) {
  const schemaKund = allCustomers.find(c => c.customer_id === f.schedulePromptCustomerId)

  return (
    <>
      {/* Wizard: Kund, Typ, Placera */}
      <AddStationWizard
        isOpen={f.isWizardOpen}
        onClose={f.closeWizard}
        onComplete={f.handleWizardComplete}
        technicianId={f.technicianId}
        preselectedCustomerId={f.wizardCustomerId}
        autoSelectIndoor={f.wizardAutoIndoor}
        onSwitchToOutdoor={f.handleSwitchToOutdoor}
        onFinishEstablishment={f.handleFinishEstablishmentFromIndoor}
        onIndoorFinished={() => {
          f.setWizardAutoIndoor(false)
          onIndoorFinished()
        }}
      />

      {/* Placeringsformuläret utomhus, ark från botten på telefon */}
      <AnimatePresence>
        {f.isFormOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label={f.showSuccessState ? 'Station placerad' : 'Placera station'}
              className="bg-slate-900 rounded-t-3xl md:rounded-2xl border border-slate-700 w-full max-w-lg max-h-[92dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}
            >
              {f.showSuccessState ? (
                <div className="p-6 flex flex-col items-center text-center">
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="w-16 h-16 bg-[#20c58f]/15 text-[#20c58f] rounded-full flex items-center justify-center mb-4"
                  >
                    <Icon name="station.klar" size={32} />
                  </motion.span>
                  <h3 className="text-lg font-semibold text-white">Stationen är placerad</h3>
                  <p className="text-[15px] text-slate-300 mt-0.5">{f.batchCustomerName}</p>
                  <p className="text-[13px] text-slate-400 mt-1 mb-6">
                    {f.batchCount} {f.batchCount === 1 ? 'station' : 'stationer'} placerade nu
                  </p>
                  <div className="w-full space-y-2.5">
                    <button type="button" onClick={f.handlePlaceAnother} className={`w-full ${KNAPP_PRIMAR}`}>
                      <Icon name="station.ute" size={20} />
                      Placera fler utomhus
                    </button>
                    <button type="button" onClick={f.handleGoIndoor} className={`w-full ${KNAPP_SEKUNDAR}`}>
                      <Icon name="station.inne" size={20} />
                      Placera inomhus
                    </button>
                    <button type="button" onClick={f.handleFinishBatch} className={`w-full ${KNAPP_TYST}`}>
                      <Icon name="allman.bock" size={20} />
                      Färdig med etablering
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-slate-700 bg-slate-900">
                    <span aria-hidden="true" className="md:hidden absolute left-1/2 -translate-x-1/2 top-1.5 w-10 h-1 rounded-full bg-slate-600" />
                    <div className="flex-1 min-w-0 pt-1">
                      <h2 className="text-lg font-semibold text-white truncate">
                        {f.editingEquipment ? 'Ändra station' : 'Placera station utomhus'}
                      </h2>
                      <p className="text-[13px] text-slate-400 truncate">
                        {f.batchCustomerName || 'Välj kund'}
                        {f.batchCount > 0 && !f.editingEquipment ? `, station ${f.batchCount + 1} nu` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={f.handleFinishBatch}
                      aria-label="Stäng och avsluta placeringen"
                      className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                    >
                      <Icon name="allman.stang" size={20} />
                    </button>
                  </div>
                  <div className="p-4">
                    <EquipmentPlacementForm
                      key={f.formResetKey}
                      customerId={f.wizardCustomerId || ''}
                      technicianId={f.technicianId}
                      existingEquipment={f.editingEquipment}
                      initialEquipmentType={f.lastEquipmentType || undefined}
                      autoShowMap={f.lastUsedMap}
                      initialPreparation={f.lastPreparation}
                      initialIsAddon={f.lastIsAddon}
                      initialAddonBillingModel={f.lastAddonModel}
                      initialArticleId={f.lastArticleId}
                      addonPrices={f.addonPrices}
                      addonPricesLoading={f.addonPricesLoading}
                      existingStations={f.customerExistingStations}
                      otherCustomerStations={f.otherCustomerStations}
                      inspections={[]}
                      onTypeChanged={onTypeChanged}
                      onSubmit={f.handleFormSubmit}
                      onCancel={f.handleFinishBatch}
                      onLocationCapture={f.handleLocationCapture}
                      isSubmitting={f.isSubmitting}
                      customers={f.customers}
                      onCustomerChange={(id) => f.setWizardCustomerId(id)}
                      showCustomerPicker={!f.editingEquipment && !f.wizardCustomerId}
                    />
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Faktureringssammanfattning vid Färdig med etablering */}
      <AnimatePresence>
        {f.establishmentSummary && (() => {
          const s = f.establishmentSummary
          const step = f.addonLabourStep
          // När avslutssteget visas räknas arbetstiden för tilläggen där
          // (teknikerns val), inte ur en eventuell gammal förslagsrad
          const labourInStep = step.visible && !!step.economics
          const listedItems = labourInStep ? s.serviceItems.filter(i => !i.isAddonLabour) : s.serviceItems
          const total = listedItems.reduce((sum, i) =>
            sum + (i.id === s.addonItemId ? s.priceDraft * s.quantityDraft : i.unitPrice * i.quantity), 0)
            + (labourInStep ? Math.round(step.economics?.labourNow ?? 0) : 0)
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-4"
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="etablering-summa-rubrik"
                className={`bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-700 w-full ${step.visible ? 'sm:max-w-lg' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#20c58f]/15 text-[#20c58f] flex items-center justify-center">
                    <Icon name="falt.pris" size={24} />
                  </span>
                  <div className="min-w-0">
                    <h3 id="etablering-summa-rubrik" className="text-lg font-semibold text-white">
                      Stäng ärendet och skicka till fakturering
                    </h3>
                    <p className="text-[15px] text-slate-400">{s.customerName}</p>
                  </div>
                </div>

                {s.addonCount > 0 && (
                  <p className="text-[13px] text-violet-300 mb-3 flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-violet-500" />
                    {s.addonCount} tilläggsstation{s.addonCount === 1 ? '' : 'er'} placerade i den här etableringen
                  </p>
                )}

                <div className="rounded-2xl border border-slate-700/60 divide-y divide-slate-700/60 mb-3 overflow-hidden">
                  {listedItems.map(item => {
                    const isEtablering = item.id === s.addonItemId
                    const qty = isEtablering ? s.quantityDraft : item.quantity
                    const price = isEtablering ? s.priceDraft : item.unitPrice
                    return (
                      <div key={item.id} className="px-3 py-3 space-y-2">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-[15px] text-white min-w-0">{item.name}</p>
                          <span className="text-[15px] font-semibold text-white tabular-nums flex-shrink-0">
                            {(price * qty).toLocaleString('sv-SE')} kr
                          </span>
                        </div>
                        {isEtablering ? (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block">
                              <span className="block text-[12px] text-slate-400 mb-1">Pris per station, kr</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                min={0}
                                value={s.priceDraft}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value)
                                  f.setEstablishmentSummary(prev => prev
                                    ? { ...prev, priceDraft: Number.isFinite(v) && v >= 0 ? v : 0 }
                                    : prev)
                                }}
                                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-[15px] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                              />
                            </label>
                            <label className="block">
                              <span className="block text-[12px] text-slate-400 mb-1">Antal</span>
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={s.quantityDraft}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value)
                                  f.setEstablishmentSummary(prev => prev
                                    ? { ...prev, quantityDraft: Number.isFinite(v) && v > 0 ? v : 1 }
                                    : prev)
                                }}
                                className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-[15px] text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                              />
                            </label>
                          </div>
                        ) : (
                          <p className="text-[13px] text-slate-400 tabular-nums">
                            {qty} st à {item.unitPrice.toLocaleString('sv-SE')} kr
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {listedItems.length === 0 && (
                    <p className="px-3 py-3 text-sm text-slate-400">Inga tjänsterader på ärendet.</p>
                  )}
                </div>

                {/* Arbetstid för att hantera tilläggen (nya per år/per månad) */}
                <AddonLabourStep step={step} className="mb-3" />
                {labourInStep && (step.economics?.labourNow ?? 0) > 0 && (
                  <div className="flex items-center justify-between px-1 mb-2 text-sm">
                    <span className="text-slate-300">Arbetstid för att hantera tilläggen</span>
                    <span className="text-white tabular-nums">
                      {Math.round(step.economics?.labourNow ?? 0).toLocaleString('sv-SE')} kr
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between px-1 pb-3 border-b border-slate-700/60 mb-3">
                  <span className="text-[15px] font-medium text-slate-300">Totalt exkl. moms</span>
                  <span className="text-lg font-semibold text-white tabular-nums">{total.toLocaleString('sv-SE')} kr</span>
                </div>

                {total <= 0 && (
                  <p className="flex items-start gap-2 text-[13px] text-amber-400 mb-3">
                    <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <span>
                      Totalen är 0 kr. Ärendet stängs utan att någon faktura skapas.
                      {s.addonCount > 0 ? ' Ange pris per station ovan, eller lägg tilläggsstationens tjänst i kundens avtalsprislista för automatiskt pris.' : ''}
                    </span>
                  </p>
                )}
                {s.listPrice > 0 && s.addonItemId && s.priceDraft < s.listPrice && (
                  <p className="flex items-start gap-2 text-[13px] text-amber-400 mb-3">
                    <span aria-hidden="true" className="mt-1.5 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <span>Priset är under listpriset ({s.listPrice.toLocaleString('sv-SE')} kr/st). Raden går till rabattgodkännande.</span>
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={f.cancelEstablishmentSummary}
                    disabled={f.finishingEstablishment}
                    className={`${KNAPP_SEKUNDAR} disabled:opacity-60`}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    onClick={f.confirmFinishEstablishment}
                    disabled={f.finishingEstablishment || step.loading}
                    className={`${KNAPP_PRIMAR} disabled:opacity-60`}
                  >
                    {f.finishingEstablishment && <Icon name="allman.laddar" size={20} className="animate-spin" />}
                    {total > 0 ? 'Stäng och fakturera' : 'Stäng ärendet'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Fråga om återkommande kontroller efter etableringen */}
      <AnimatePresence>
        {f.showSchedulePrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 sm:p-4"
            onClick={() => f.setShowSchedulePrompt(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="schema-fraga-rubrik"
              className="bg-slate-900 rounded-t-3xl sm:rounded-2xl border border-slate-700 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] w-full sm:max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <span className="w-11 h-11 rounded-xl bg-[#20c58f]/15 text-[#20c58f] flex items-center justify-center mb-3">
                <Icon name="kund.schema" size={24} />
              </span>
              <h3 id="schema-fraga-rubrik" className="text-white font-semibold text-lg mb-1">Återkommande kontroller</h3>
              <p className="text-slate-400 text-[15px] mb-5">
                {f.schedulePromptCustomerName} har inget schema. Vill du lägga upp kontrollerna nu? Du kan också göra det senare under kundens Schema.
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => f.setShowSchedulePrompt(false)} className={KNAPP_SEKUNDAR}>
                  Senare
                </button>
                <button
                  type="button"
                  onClick={() => {
                    f.setShowSchedulePrompt(false)
                    f.setShowScheduleWizard(true)
                  }}
                  className={KNAPP_PRIMAR}
                >
                  Lägg upp schema
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {f.showScheduleWizard && f.schedulePromptCustomerId && (
        <RecurringScheduleWizard
          isOpen={f.showScheduleWizard}
          onClose={f.closeScheduleWizard}
          onComplete={f.handleScheduleWizardComplete}
          customerId={f.schedulePromptCustomerId}
          customerName={f.schedulePromptCustomerName}
          technicianId={f.technicianId}
          batchUnits={f.batchScheduleUnits.length > 1 ? f.batchScheduleUnits : undefined}
          contractStartDate={schemaKund?.contract_start_date}
          contractEndDate={schemaKund?.contract_end_date}
        />
      )}
    </>
  )
}

export default EtableringsFlode
