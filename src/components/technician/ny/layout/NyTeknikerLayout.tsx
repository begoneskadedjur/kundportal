// src/components/technician/ny/layout/NyTeknikerLayout.tsx
// Layouten för nya arbetsvyn. Renderas BARA när useNyArbetsvy().aktiv är sann
// (profiles.ny_arbetsvy och teknikervyn), se TechnicianLayout.tsx. Alla andra får
// den gamla layouten oförändrad.
//
// Telefon: sidhuvud med rubrik, sök, tillbud, notiser och Visa mig hur, samt
// bottenmeny Idag, Karta, Skapa, Ärenden, Mer.
// Dator: sidomeny med grupperna Min dag, Hos kunden, Sälja och Hjälp, och ett
// sidhuvud med sök, Skapa, tillbud, notiser, tema och rollväxlare.

import { useCallback, useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from '../../../icons/Icon'
import { GlobalSearch } from '../../../shared/search/GlobalSearch'
import { openGlobalSearch } from '../../../shared/search/globalSearchEvents'
import { ViewSwitcher } from '../../../shared/ViewSwitcher'
import { ThemeToggle } from '../../../shared/ThemeToggle'
import { BugReportModal } from '../../../shared/BugReportModal'
import { ChangelogModal } from '../../../shared/ChangelogModal'
import { useChangelogBadge } from '../../../../hooks/useChangelogBadge'
import { useAuth } from '../../../../contexts/AuthContext'
import { getTicketStats } from '../../../../services/communicationService'
import { NY_NAV_GRUPPER, rubrikFor, arAktiv, type NyNavLank } from './nyNavConfig'
import { NySidhuvudProvider, useSidhuvudInfo } from './NySidhuvud'
import { SkapaArk } from './SkapaArk'

interface Props {
  userName: string
  onSignOut: () => void
}

const IKONKNAPP = 'w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] relative'

function useTicketAntal(): number {
  const { profile } = useAuth()
  const [antal, setAntal] = useState(0)
  const location = useLocation()
  useEffect(() => {
    if (!profile?.id) return
    getTicketStats(profile.id).then(s => setAntal(s.open)).catch(() => {})
    // Läs om vid sidbyte, så räknaren följer med när teknikern svarat
  }, [profile?.id, location.pathname])
  return antal
}

function Raknare({ antal, liten = false }: { antal: number; liten?: boolean }) {
  if (antal <= 0) return null
  return (
    <span className={`absolute ${liten ? 'top-1.5 right-1.5 w-4 h-4 text-[9px]' : 'top-1 right-1 w-5 h-5 text-[10px]'} bg-red-500 rounded-full text-[#fff] font-bold flex items-center justify-center`}>
      {antal > 9 ? '9+' : antal}
    </span>
  )
}

function NotisKnapp({ antal }: { antal: number }) {
  return (
    <Link to="/technician/tickets" className={IKONKNAPP} aria-label={antal > 0 ? `Notiser, ${antal} olästa` : 'Notiser'}>
      <Icon name="upphandling.notis" size={24} />
      <Raknare antal={antal} liten />
    </Link>
  )
}

function TillbudKnapp() {
  return (
    <Link
      to="/technician/tillbud-avvikelser"
      className="w-11 h-11 flex items-center justify-center rounded-xl text-amber-600/80 hover:text-amber-500 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
      aria-label="Rapportera tillbud, avvikelse eller olycka"
      title="Tillbud, avvikelse eller olycka"
    >
      <Icon name="rapport.avvikelse" size={24} />
    </Link>
  )
}

// ─── Sidomeny (dator) ───

function SidoLank({ lank, current, ticketAntal, indrag = false }: { lank: NyNavLank; current: string; ticketAntal: number; indrag?: boolean }) {
  const aktiv = arAktiv(lank.path, current)
  const antal = lank.badge === 'tickets' ? ticketAntal : 0
  return (
    <Link
      to={lank.path}
      aria-current={aktiv ? 'page' : undefined}
      className={`flex items-center gap-3 ${indrag ? 'pl-10 pr-3 py-2 text-[13px]' : 'px-3 py-2.5 text-sm'} rounded-xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
        aktiv ? 'bg-[#20c58f]/10 text-[#20c58f]' : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
      }`}
    >
      {!indrag && <Icon name={lank.ikon} size={20} className="flex-shrink-0" />}
      <span className="flex-1 min-w-0 truncate">{lank.label}</span>
      {antal > 0 && <span className="font-mono text-xs text-red-400">{antal > 9 ? '9+' : antal}</span>}
    </Link>
  )
}

function NySidomeny({ current, userName, onSignOut, ticketAntal }: { current: string; userName: string; onSignOut: () => void; ticketAntal: number }) {
  const [visaBugg, setVisaBugg] = useState(false)
  const [visaNyheter, setVisaNyheter] = useState(false)
  const { hasUnseen, markSeen } = useChangelogBadge()

  const knapp = 'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'

  return (
    <>
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col bg-slate-900 border-r border-slate-700/60 z-40">
        <div className="h-14 px-4 flex items-center gap-3 border-b border-slate-700/60">
          <div className="w-9 h-9 rounded-xl bg-[#20c58f] flex items-center justify-center flex-shrink-0">
            <span className="text-[#04281c] text-sm font-bold">{userName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-xs text-slate-500">Tekniker</p>
          </div>
        </div>

        <nav aria-label="Huvudmeny" className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {NY_NAV_GRUPPER.map(g => (
            <div key={g.label}>
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.label}</p>
              <div className="space-y-0.5">
                {g.lankar.map(l => l.under ? (
                  <div key={l.label}>
                    <p className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-300">
                      <Icon name={l.ikon} size={20} className="flex-shrink-0 text-slate-400" />
                      {l.label}
                    </p>
                    {l.under.map(u => <SidoLank key={u.path} lank={u} current={current} ticketAntal={ticketAntal} indrag />)}
                  </div>
                ) : (
                  <SidoLank key={l.path} lank={l} current={current} ticketAntal={ticketAntal} />
                ))}
                {g.label === 'Hjälp' && (
                  <>
                    <button type="button" className={knapp} onClick={() => { markSeen(); setVisaNyheter(true) }}>
                      <Icon name="upphandling.annons" size={20} className="flex-shrink-0" />
                      <span className="flex-1 text-left">Uppdateringar</span>
                      {hasUnseen && <span className="w-2 h-2 rounded-full bg-[#20c58f]" aria-label="Nya uppdateringar" />}
                    </button>
                    <SidoLank lank={{ label: 'Mitt konto', path: '/technician/mitt-konto', ikon: 'rapport.person' }} current={current} ticketAntal={0} />
                  </>
                )}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700/60 space-y-0.5">
          <button type="button" className={knapp} onClick={() => setVisaBugg(true)}>
            <Icon name="falt.bugg" size={20} className="flex-shrink-0" />
            Rapportera bugg
          </button>
          <button type="button" className={`${knapp} hover:!text-red-400`} onClick={onSignOut}>
            <Icon name="allman.logga-ut" size={20} className="flex-shrink-0" />
            Logga ut
          </button>
        </div>
      </aside>
      <BugReportModal isOpen={visaBugg} onClose={() => setVisaBugg(false)} />
      <ChangelogModal isOpen={visaNyheter} onClose={() => setVisaNyheter(false)} />
    </>
  )
}

// ─── Bottenmeny (telefon) ───

interface BottenLank { label: string; path: string; ikon: IconName }

const BOTTEN_VANSTER: BottenLank[] = [
  { label: 'Idag', path: '/technician/dashboard', ikon: 'falt.idag' },
  { label: 'Karta', path: '/technician/karta', ikon: 'falt.karta' },
]
const BOTTEN_HOGER: BottenLank[] = [
  { label: 'Ärenden', path: '/technician/cases', ikon: 'arende.arende' },
]
const BOTTEN_HUVUD = ['/technician/dashboard', '/technician/karta', '/technician/cases']

function Bottenmeny({ current, onSkapa }: { current: string; onSkapa: () => void }) {
  const lank = (l: BottenLank) => {
    const aktiv = arAktiv(l.path, current)
    return (
      <Link
        key={l.path}
        to={l.path}
        aria-current={aktiv ? 'page' : undefined}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] rounded-xl ${aktiv ? 'text-[#20c58f]' : 'text-slate-400'}`}
      >
        <Icon name={l.ikon} size={24} />
        {l.label}
      </Link>
    )
  }
  const merAktiv = !BOTTEN_HUVUD.some(p => arAktiv(p, current))
  return (
    <nav aria-label="Huvudmeny" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900 border-t border-slate-700/60 pb-[env(safe-area-inset-bottom)]">
      <div className="h-16 px-1 flex items-stretch">
        {BOTTEN_VANSTER.map(lank)}
        <button
          type="button"
          onClick={onSkapa}
          data-genomgang="skapa"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-medium text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] rounded-xl"
        >
          <span aria-hidden="true" className="w-10 h-10 -mt-1 rounded-2xl bg-[#20c58f] text-[#04281c] flex items-center justify-center shadow-lg shadow-[#20c58f]/20">
            <Icon name="allman.plus" size={24} />
          </span>
          Skapa
        </button>
        {BOTTEN_HOGER.map(lank)}
        <Link
          to="/technician/mer"
          aria-current={merAktiv ? 'page' : undefined}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[11px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] rounded-xl ${merAktiv ? 'text-[#20c58f]' : 'text-slate-400'}`}
        >
          <Icon name="allman.meny" size={24} />
          Mer
        </Link>
      </div>
    </nav>
  )
}

// ─── Sidhuvud ───

function Sidhuvud({ current, ticketAntal, onSkapa }: { current: string; ticketAntal: number; onSkapa: () => void }) {
  const { underrubrik, underrubrikLank, onVisaMig } = useSidhuvudInfo()
  const rubrik = rubrikFor(current)

  const visaMigKnapp = onVisaMig && (
    <button type="button" onClick={onVisaMig} data-genomgang="visamig" className={IKONKNAPP} aria-label="Visa mig hur sidan fungerar" title="Visa mig hur">
      <Icon name="falt.visamig" size={24} />
    </button>
  )

  return (
    <>
      {/* Telefon */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 h-16 pt-[env(safe-area-inset-top)] box-content bg-slate-900 border-b border-slate-700/60 flex items-center justify-between pl-4 pr-1">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white leading-tight truncate">{rubrik}</h1>
          {underrubrik && (underrubrikLank ? (
            <Link to={underrubrikLank} className="flex items-center gap-1 min-h-[24px] text-[13px] text-slate-400 hover:text-white truncate focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded">
              <span className="truncate underline decoration-slate-600 underline-offset-2">{underrubrik}</span>
              <Icon name="allman.chevron" size={16} className="flex-shrink-0 text-slate-500" />
            </Link>
          ) : <p className="text-[13px] text-slate-400 truncate">{underrubrik}</p>)}
        </div>
        <div className="flex items-center">
          <button type="button" onClick={openGlobalSearch} className={IKONKNAPP} aria-label="Sök kund, adress eller ärende">
            <Icon name="allman.sok" size={24} />
          </button>
          <TillbudKnapp />
          <NotisKnapp antal={ticketAntal} />
          {visaMigKnapp}
        </div>
      </header>

      {/* Dator */}
      <header className="hidden lg:flex fixed top-0 right-0 left-64 z-30 h-14 bg-slate-900/90 backdrop-blur-sm border-b border-slate-700/60 items-center gap-4 px-6">
        <div className="min-w-0 w-56">
          <h1 className="text-base font-semibold text-white truncate">{rubrik}</h1>
          {underrubrik && (underrubrikLank ? (
            <Link to={underrubrikLank} className="block text-xs text-slate-400 hover:text-white truncate underline decoration-slate-600 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded">{underrubrik}</Link>
          ) : <p className="text-xs text-slate-400 truncate">{underrubrik}</p>)}
        </div>
        <button
          type="button"
          onClick={openGlobalSearch}
          className="flex-1 max-w-md mx-auto flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          aria-label="Sök kund, adress eller ärende"
        >
          <Icon name="allman.sok" size={16} />
          <span className="text-sm">Sök kund, adress eller ärende</span>
          <kbd className="ml-auto text-[10px] font-mono text-slate-500">Ctrl+K</kbd>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSkapa}
            data-genomgang="skapa"
            className="h-10 px-4 mr-2 flex items-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-sm font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
          >
            <Icon name="allman.plus" size={20} />
            Skapa
          </button>
          {visaMigKnapp}
          <TillbudKnapp />
          <NotisKnapp antal={ticketAntal} />
          <ThemeToggle />
          <ViewSwitcher currentView="technician" variant="header" />
        </div>
      </header>
    </>
  )
}

function Innehall({ userName, onSignOut }: Props) {
  const location = useLocation()
  const current = location.pathname
  const ticketAntal = useTicketAntal()
  const [skapaOppen, setSkapaOppen] = useState(false)
  const oppnaSkapa = useCallback(() => setSkapaOppen(true), [])
  const stangSkapa = useCallback(() => setSkapaOppen(false), [])

  // Stäng arket vid sidbyte
  useEffect(() => { setSkapaOppen(false) }, [current])

  return (
    <div className="min-h-screen bg-slate-950">
      <NySidomeny current={current} userName={userName} onSignOut={onSignOut} ticketAntal={ticketAntal} />
      <Sidhuvud current={current} ticketAntal={ticketAntal} onSkapa={oppnaSkapa} />
      <GlobalSearch portal="technician" />

      <main className="min-h-screen pt-[calc(4rem+env(safe-area-inset-top))] pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pt-14 lg:pb-0 lg:pl-64">
        <Outlet />
      </main>

      <Bottenmeny current={current} onSkapa={oppnaSkapa} />
      <SkapaArk oppen={skapaOppen} onClose={stangSkapa} />
    </div>
  )
}

export default function NyTeknikerLayout(props: Props) {
  return (
    <NySidhuvudProvider>
      <Innehall {...props} />
    </NySidhuvudProvider>
  )
}
