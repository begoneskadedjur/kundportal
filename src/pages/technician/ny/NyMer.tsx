// src/pages/technician/ny/NyMer.tsx
// Mer-sidan i nya arbetsvyn (telefonens bottenmeny). Samma innehåll som sidomenyn
// på datorn, plus tema och rollväxlare. Bara för nya arbetsvyn, se App.tsx.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../../components/icons/Icon'
import { ViewSwitcher } from '../../../components/shared/ViewSwitcher'
import { ThemeToggle } from '../../../components/shared/ThemeToggle'
import { BugReportModal } from '../../../components/shared/BugReportModal'
import { ChangelogModal } from '../../../components/shared/ChangelogModal'
import { useChangelogBadge } from '../../../hooks/useChangelogBadge'
import { useAuth } from '../../../contexts/AuthContext'
import { NY_NAV_GRUPPER, type NyNavLank } from '../../../components/technician/ny/layout/nyNavConfig'

const RAD = 'w-full flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] font-medium text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] text-left'

function Rad({ to, ikon, label, indrag = false }: { to: string; ikon: IconName; label: string; indrag?: boolean }) {
  return (
    <Link to={to} className={`${RAD} ${indrag ? 'pl-12' : ''}`}>
      {!indrag && <Icon name={ikon} size={24} className="text-slate-400 flex-shrink-0" />}
      <span className="flex-1">{label}</span>
      <Icon name="allman.chevron" size={16} className="text-slate-500" />
    </Link>
  )
}

export default function NyMer() {
  const { signOut } = useAuth()
  const { hasUnseen, markSeen } = useChangelogBadge()
  const [visaBugg, setVisaBugg] = useState(false)
  const [visaNyheter, setVisaNyheter] = useState(false)

  // Idag, Karta och Mina ärenden finns redan i bottenmenyn
  const iBotten = new Set(['/technician/dashboard', '/technician/karta', '/technician/cases'])

  const lankar = (l: NyNavLank) => l.under ? (
    <div key={l.label}>
      <p className="flex items-center gap-3 px-3 min-h-[44px] text-[15px] font-medium text-slate-300">
        <Icon name={l.ikon} size={24} className="text-slate-400" />
        {l.label}
      </p>
      {l.under.map(u => <Rad key={u.path} to={u.path} ikon={u.ikon} label={u.label} indrag />)}
    </div>
  ) : (
    <Rad key={l.path} to={l.path} ikon={l.ikon} label={l.label} />
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
      <ViewSwitcher currentView="technician" variant="mobile" />

      {NY_NAV_GRUPPER.map(g => {
        const synliga = g.lankar.filter(l => !iBotten.has(l.path))
        if (synliga.length === 0) return null
        return (
          <section key={g.label} aria-label={g.label}>
            <h2 className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h2>
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 p-1">
              {synliga.map(lankar)}
              {g.label === 'Hjälp' && (
                <button type="button" className={RAD} onClick={() => { markSeen(); setVisaNyheter(true) }}>
                  <Icon name="upphandling.annons" size={24} className="text-slate-400 flex-shrink-0" />
                  <span className="flex-1">Uppdateringar</span>
                  {hasUnseen && <span className="w-2 h-2 rounded-full bg-[#20c58f]" aria-label="Nya uppdateringar" />}
                </button>
              )}
            </div>
          </section>
        )
      })}

      <section aria-label="Konto">
        <h2 className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Konto</h2>
        <div className="rounded-2xl bg-slate-900 border border-slate-700/60 p-1">
          <Rad to="/technician/mitt-konto" ikon="rapport.person" label="Mitt konto" />
          <div className="px-1"><ThemeToggle variant="row" /></div>
          <button type="button" className={RAD} onClick={() => setVisaBugg(true)}>
            <Icon name="falt.bugg" size={24} className="text-slate-400 flex-shrink-0" />
            Rapportera bugg
          </button>
          <button type="button" className={`${RAD} !text-red-400`} onClick={() => signOut()}>
            <Icon name="allman.logga-ut" size={24} className="flex-shrink-0" />
            Logga ut
          </button>
        </div>
      </section>

      <BugReportModal isOpen={visaBugg} onClose={() => setVisaBugg(false)} />
      <ChangelogModal isOpen={visaNyheter} onClose={() => setVisaNyheter(false)} />
    </div>
  )
}
