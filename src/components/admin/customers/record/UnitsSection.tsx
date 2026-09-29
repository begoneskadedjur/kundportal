// src/components/admin/customers/record/UnitsSection.tsx
// Enheter-fliken: listar familjens enheter med adress, kundnummer (eller "via HK"),
// antal avtal, antal ärenden och årsvärde. Klick på namnet navigerar till
// enhetens egen record-sida. Den enhet som just visas markeras med grön kant.
//
// Här skapas, redigeras och avaktiveras enheter (SiteModal). Enheter raderas
// aldrig: avaktivering sätter is_active=false så avtal, ärenden och historik
// finns kvar. Fortnox-numret per enhet visas med statuspunkt bara när enheten
// är ett eget bolag (eget org.nr skilt från huvudkontorets); annars "via HK".

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Loader2, MapPin, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../../lib/supabase'
import SiteModal from '../../multisite/SiteModal'
import ConfirmModal from '../../../ui/ConfirmModal'
import { FortnoxStatusDot } from '../FortnoxNumberField'
import { unitFortnoxState } from '../../../../shared/fortnoxCustomerNumbers'
import {
  contractAnnualValue,
  customerRowName,
  formatKr,
  isEndedContract,
  type RecordContract,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'

interface Props {
  root: RecordCustomer
  units: RecordCustomer[]
  contracts: RecordContract[]
  caseCounts: Record<string, number>
  /** T.ex. "/admin/befintliga-kunder" — record-sidan för en enhet blir `${basePath}/<id>` */
  basePath: string
  /** Id för raden som visas just nu (markeras i listan) */
  currentCustomerId: string
  /** Omhämtning efter att en enhet skapats, ändrats eller avaktiverats */
  onChanged?: () => void | Promise<void>
}

function toExistingSite(unit: RecordCustomer) {
  return {
    id: unit.id,
    site_name: unit.site_name ?? '',
    site_code: unit.site_code ?? '',
    region: unit.region ?? '',
    organization_number: unit.organization_number ?? undefined,
    contact_person: unit.contact_person ?? undefined,
    contact_email: unit.contact_email ?? '',
    contact_phone: unit.contact_phone ?? undefined,
    contact_address: unit.contact_address ?? undefined,
    billing_email: unit.billing_email ?? undefined,
    billing_address: unit.billing_address ?? undefined,
    billing_reference: unit.billing_reference ?? undefined,
    customer_number: unit.customer_number ?? null,
    customer_group_id: unit.customer_group_id ?? null,
  }
}

const actionBtn =
  'text-xs text-slate-400 underline decoration-dotted underline-offset-2 hover:text-white transition-colors disabled:opacity-40'

export default function UnitsSection({ root, units, contracts, caseCounts, basePath, currentCustomerId, onChanged }: Props) {
  const navigate = useNavigate()
  const [siteModal, setSiteModal] = useState<{ site: ReturnType<typeof toExistingSite> | null } | null>(null)
  const [confirmUnit, setConfirmUnit] = useState<RecordCustomer | null>(null)
  const [busy, setBusy] = useState(false)

  const canManage = !!onChanged
  const family: RecordCustomer[] = [root, ...units]

  // "Lägg till enhet": uppgradera HK till multisite först om det behövs,
  // annars skriver SiteModal organization_id = null och enheten tappas av
  // organisationsvyerna (samma mönster som Avtalskartan).
  const openAddUnit = async () => {
    if (!root.organization_id) {
      setBusy(true)
      try {
        const { error } = await supabase
          .from('customers')
          .update({ is_multisite: true, site_type: 'huvudkontor', organization_id: crypto.randomUUID() })
          .eq('id', root.id)
        if (error) throw new Error(error.message)
        await onChanged?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Kunde inte förbereda organisationen')
        setBusy(false)
        return
      }
      setBusy(false)
    }
    setSiteModal({ site: null })
  }

  const setActive = async (unit: RecordCustomer, active: boolean) => {
    setBusy(true)
    try {
      const { error } = await supabase.from('customers').update({ is_active: active }).eq('id', unit.id)
      if (error) throw new Error(error.message)
      toast.success(active ? `${customerRowName(unit)} är aktiv igen` : `${customerRowName(unit)} är avaktiverad`)
      setConfirmUnit(null)
      await onChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte ändra enheten')
    } finally {
      setBusy(false)
    }
  }

  const confirmActiveContracts = confirmUnit
    ? contracts.filter((c) => c.customer_id === confirmUnit.id && !isEndedContract(c)).length
    : 0

  return (
    <div>
      {canManage && (
        <div className="mb-3 flex items-center gap-3">
          <p className="text-xs text-slate-500">
            Enheter skapas och ändras här. Användarkonton och regioner hanteras under Användarkonton kund.
          </p>
          <button
            type="button"
            onClick={openAddUnit}
            disabled={busy}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1ba876] text-[#fff] text-xs font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Lägg till enhet
          </button>
        </div>
      )}

      {units.length === 0 ? (
        <p className="text-sm text-slate-500">Inga enheter ännu. Kunden är en enskild kundrad.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {units.map((unit) => {
            const unitContracts = contracts.filter((c) => c.customer_id === unit.id)
            const activeContracts = unitContracts.filter((c) => !isEndedContract(c))
            const annual = activeContracts.reduce((sum, c) => sum + contractAnnualValue(c), 0)
            const cases = caseCounts[unit.id] ?? 0
            const isCurrent = unit.id === currentCustomerId
            const inactive = unit.is_active === false
            const fortnox = unitFortnoxState(unit, root.organization_number, family)

            return (
              <li
                key={unit.id}
                className={`flex items-center gap-3 px-3 py-2.5 group hover:bg-slate-900/60 transition-colors ${
                  isCurrent ? 'border-l-2 border-[#20c58f] bg-slate-900/40' : 'border-l-2 border-transparent'
                } ${inactive ? 'opacity-60' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/${unit.id}`)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-slate-100 truncate group-hover:underline decoration-dotted underline-offset-2">
                      {customerRowName(unit)}
                    </span>
                    {isCurrent && <span className="text-[10px] uppercase tracking-wide text-[#20c58f] shrink-0">Visas nu</span>}
                    {inactive && <span className="text-[10px] uppercase tracking-wide text-slate-500 shrink-0">Avaktiverad</span>}
                  </div>
                  {unit.contact_address && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 min-w-0">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{unit.contact_address}</span>
                    </div>
                  )}
                </button>

                <div className="flex items-baseline gap-4 text-xs text-slate-400 shrink-0">
                  {fortnox ? (
                    <span
                      className="flex items-center gap-1.5 self-center"
                      title={
                        fortnox.number == null
                          ? 'Eget bolag utan Fortnox-kundnummer'
                          : fortnox.sharedWith
                            ? `Delar nummer med ${fortnox.sharedWith}`
                            : fortnox.verified
                              ? 'Verifierad mot Fortnox'
                              : 'Kundnummer ej verifierat mot Fortnox'
                      }
                    >
                      <FortnoxStatusDot state={fortnox.number == null ? 'missing' : fortnox.verified ? 'verified' : 'unverified'} />
                      {fortnox.number != null ? (
                        <span className="font-mono">#{fortnox.number}</span>
                      ) : (
                        <span className="text-red-400">saknar nr</span>
                      )}
                    </span>
                  ) : unit.customer_number != null ? (
                    <span className="font-mono">#{unit.customer_number}</span>
                  ) : (
                    <span className="text-slate-500">
                      via HK{root.customer_number != null && <span className="font-mono"> #{root.customer_number}</span>}
                    </span>
                  )}
                  <span className="tabular-nums">{unitContracts.length} avtal</span>
                  <span className="tabular-nums">{cases} ärenden</span>
                  <span className="tabular-nums text-slate-200 w-24 text-right">
                    {annual > 0 ? `${formatKr(annual)}/år` : '–'}
                  </span>
                </div>

                {canManage && (
                  <div className="flex items-center gap-3 shrink-0">
                    <button type="button" onClick={() => setSiteModal({ site: toExistingSite(unit) })} disabled={busy} className={actionBtn}>
                      Redigera
                    </button>
                    {inactive ? (
                      <button type="button" onClick={() => setActive(unit, true)} disabled={busy} className={actionBtn}>
                        Återaktivera
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmUnit(unit)}
                        disabled={busy}
                        className="text-xs text-slate-400 underline decoration-dotted underline-offset-2 hover:text-red-400 transition-colors disabled:opacity-40"
                      >
                        Avaktivera
                      </button>
                    )}
                  </div>
                )}

                <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </li>
            )
          })}
        </ul>
      )}

      {siteModal && (
        <SiteModal
          isOpen
          onClose={() => setSiteModal(null)}
          onSuccess={() => {
            setSiteModal(null)
            void onChanged?.()
          }}
          organizationId={root.organization_id ?? ''}
          organizationName={root.company_name}
          parentCustomerId={root.id}
          existingSite={siteModal.site}
        />
      )}

      <ConfirmModal
        isOpen={!!confirmUnit}
        onClose={() => setConfirmUnit(null)}
        onConfirm={() => confirmUnit && setActive(confirmUnit, false)}
        title="Avaktivera enhet"
        message={
          confirmUnit
            ? `${customerRowName(confirmUnit)} avaktiveras men raderas inte. Avtal, ärenden, utrustning och historik finns kvar och enheten kan återaktiveras.${
                confirmActiveContracts > 0
                  ? ` Enheten har ${confirmActiveContracts} aktiva avtal, säg upp dem separat om de ska upphöra.`
                  : ''
              }`
            : ''
        }
        confirmLabel="Avaktivera"
        variant="danger"
        loading={busy}
      />
    </div>
  )
}
