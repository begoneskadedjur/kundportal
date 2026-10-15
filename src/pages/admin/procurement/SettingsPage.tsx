// src/pages/admin/procurement/SettingsPage.tsx
// Inställningar (planens avsnitt 9.9): bevakningsregler med förhandsvisning,
// signalkällor, källhälsa, dagligt sammandrag och notisen om
// bearbetningsfönstret på eller av för mig (sedan 3.65.0) och
// upphandlingsansvariga med länk till Användarkonton (Personal). Nås från
// kontomenyn sedan 3.63.0. Signalkällor och källhälsa finns bara här;
// anbudsbiblioteket ligger under Anbud.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon } from '../../../components/icons/Icon'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { ProcurementService, type ProcurementManagerProfile } from '../../../services/procurementService'
import type { ProcurementSourceHealth } from '../../../types/procurement'
import { EmptyState, Section } from '../../../components/admin/procurement/ui'
import { SourceHealthTable } from '../../../components/admin/procurement/market/shared'
import { WatchRulesSection } from '../../../components/admin/procurement/settings/WatchRulesSection'
import { SignalSourcesSection } from '../../../components/admin/procurement/settings/SignalSourcesSection'
import { MAIN_PORTAL_URL, isProcurementStandalone } from '../../../lib/procurementPortal'

interface ToggleProps {
  title: string
  hint: string
  read: () => Promise<boolean>
  write: (on: boolean) => Promise<void>
  onText: string
  offText: string
}

/** Av och på per person (procurement_user_settings) */
function SettingToggle({ title, hint, read, write, onText, offText }: ToggleProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    read()
      .then(setEnabled)
      .catch(() => {
        setEnabled(true)
        toast.error('Kunde inte läsa inställningen')
      })
  }, [read])

  const toggle = async () => {
    if (enabled == null) return
    const next = !enabled
    setSaving(true)
    try {
      await write(next)
      setEnabled(next)
      toast.success(next ? onText : offText)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara inställningen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[13px] text-slate-200">{title}</div>
        <div className="text-[11.5px] text-slate-500">{hint}</div>
      </div>
      {enabled == null ? (
        <LoadingSpinner />
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={title}
          disabled={saving}
          onClick={() => void toggle()}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${enabled ? 'bg-[#20c58f]' : 'bg-slate-700'}`}
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      )}
    </div>
  )
}

const readDigest = () => ProcurementService.getDigestEnabled()
const writeDigest = (on: boolean) => ProcurementService.setDigestEnabled(on)
const readWindow = () => ProcurementService.getWindowNotifyEnabled()
const writeWindow = (on: boolean) => ProcurementService.setWindowNotifyEnabled(on)

export default function SettingsPage() {
  const [health, setHealth] = useState<ProcurementSourceHealth[]>([])
  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [h, m] = await Promise.allSettled([ProcurementService.listSourceHealth(), ProcurementService.listManagers()])
    if (h.status === 'fulfilled') setHealth(h.value)
    else toast.error('Kunde inte hämta källhälsan')
    if (m.status === 'fulfilled') setManagers(m.value)
    else toast.error('Kunde inte hämta upphandlingsansvariga')
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-8">
      <Section title="Sammandrag och notiser för mig">
        <div className="divide-y divide-slate-800">
          <SettingToggle
            title="Dagligt sammandrag via e-post"
            hint="Vardagar 07:45: nya träffar, deadlines inom sju dagar, avtal in i bearbetningsfönstret, nya signaler och handlingar att begära."
            read={readDigest}
            write={writeDigest}
            onText="Du får det dagliga sammandraget"
            offText="Sammandraget är avstängt för dig"
          />
          <SettingToggle
            title="Notis när ett avtal går in i bearbetningsfönstret"
            hint="En notis per avtal när det är 18 månader kvar till avtalsslut, med länk till köparen. Gäller även avsnittet i sammandraget."
            read={readWindow}
            write={writeWindow}
            onText="Du får notisen om bearbetningsfönstret"
            offText="Notisen om bearbetningsfönstret är avstängd för dig"
          />
        </div>
      </Section>

      <WatchRulesSection />

      <SignalSourcesSection />

      <Section title="Källhälsa" hint="Varning när en källa varit tyst i över 24 timmar, notis till admin efter tre fel i rad.">
        {loading ? <div className="py-8 flex justify-center"><LoadingSpinner /></div> : <SourceHealthTable health={health} />}
      </Section>

      <Section
        title="Upphandlingsansvariga"
        hint="Får notiser vid träffar, påminnelser och sammandraget. Admin har alltid åtkomst."
        action={
          isProcurementStandalone() ? (
            <a href={`${MAIN_PORTAL_URL}/admin/anvandarkonton-personal`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#20c58f] hover:text-[#3ddba5]">
              Användarkonton (Personal) <Icon name="rapport.oppna" className="w-3 h-3" />
            </a>
          ) : (
            <Link to="/admin/anvandarkonton-personal" className="inline-flex items-center gap-1 text-xs font-medium text-[#20c58f] hover:text-[#3ddba5]">
              Användarkonton (Personal) <Icon name="rapport.oppna" className="w-3 h-3" />
            </Link>
          )
        }
      >
        {loading ? (
          <div className="py-8 flex justify-center"><LoadingSpinner /></div>
        ) : managers.length === 0 ? (
          <EmptyState title="Ingen är upphandlingsansvarig ännu" hint="Sätt flaggan Upphandlingsansvarig på personkortet under Användarkonton (Personal)." />
        ) : (
          <ul className="divide-y divide-slate-800">
            {managers.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[13px]">
                <span className="text-slate-200">{m.display_name || m.email}</span>
                <span className="text-[12px] text-slate-500">{m.email}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="px-4 py-2.5 border-t border-slate-800 text-[11.5px] text-slate-500">
          Flaggan Upphandlingsansvarig sätts per person under Användarkonton (Personal), på samma sätt som faktureringsansvar. Personen får då en notis
          och ett e-postmeddelande med länk hit, och Upphandlingar dyker upp i sidomenyn.
        </p>
      </Section>
    </div>
  )
}
