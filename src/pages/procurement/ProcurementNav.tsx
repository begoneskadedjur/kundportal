// src/pages/procurement/ProcurementNav.tsx
// Navigeringens delar för upphandlingsportalen, gemensamma för det fristående
// skalet och adminportalens reserv: huvudraden med fem poster, sidrubrik med
// undertabbar, bottenraden på mobil, temaknapp och kontomeny.
// Strukturen ligger i procurementTabs.ts.

import { useEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Icon } from '../../components/icons/Icon'
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext'
import { useProcurementBadge } from '../../hooks/useProcurementBadge'
import { procurementPath } from '../../lib/procurementPortal'
import { PROCUREMENT_NAV, isSectionLanding, isTabActive, sectionForPath, useRelativePath } from './procurementTabs'

/** Olästa annonser som en siffra i nedtonad text, aldrig ett piller */
function UnreadCount() {
  const unread = useProcurementBadge()
  if (unread <= 0) return null
  return <span className="ml-1 text-[11px] tabular-nums text-amber-400" aria-label={`${unread} olästa`}>{unread}</span>
}

/** Huvudraden: fem poster som understrukna tabbar med ikon (dator) */
export function MainNav({ className = '' }: { className?: string }) {
  const rel = useRelativePath()
  const current = sectionForPath(rel)
  return (
    <nav className={`flex items-stretch gap-1 ${className}`} aria-label="Huvudmeny">
      {PROCUREMENT_NAV.map((s) => {
        const active = s.key === current.key
        return (
          <Link
            key={s.key}
            to={procurementPath(s.sub)}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 px-2.5 h-14 text-[14px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon name={s.icon} size={20} className={active ? 'text-[#20c58f]' : ''} />
            {s.label}
            {s.key === 'annonser' && <UnreadCount />}
          </Link>
        )
      })}
    </nav>
  )
}

/** Bottenraden på mobil: fem ikoner med korta etiketter, 56 px plus säkerhetsmarginal */
export function BottomNav() {
  const rel = useRelativePath()
  const current = sectionForPath(rel)
  const unread = useProcurementBadge()
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Huvudmeny"
    >
      <div className="grid grid-cols-5 h-14">
        {PROCUREMENT_NAV.map((s) => {
          const active = s.key === current.key
          return (
            <Link
              key={s.key}
              to={procurementPath(s.sub)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${active ? 'text-[#20c58f]' : 'text-slate-400'}`}
            >
              <Icon name={s.icon} size={20} />
              <span className="leading-none">{s.short}</span>
              {s.key === 'annonser' && unread > 0 && <span className="absolute top-2 left-[calc(50%+8px)] w-2 h-2 rounded-full bg-amber-400" aria-label={`${unread} olästa`} />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** Sidrubrik med en rad förklaring och undertabbar, bara på postens listvyer */
export function SectionHeader() {
  const rel = useRelativePath()
  const section = sectionForPath(rel)
  if (!isSectionLanding(section, rel)) return null
  return (
    <div className="mb-6">
      <h1 className="text-[20px] font-semibold text-slate-100">{section.label}</h1>
      <p className="mt-0.5 text-[13px] text-slate-500">{section.lead}</p>
      {section.tabs && (
        <nav className="mt-4 flex gap-5 border-b border-slate-800 overflow-x-auto" aria-label={section.label}>
          {section.tabs.map((t) => {
            const active = isTabActive(t, rel)
            return (
              <NavLink
                key={t.sub}
                to={procurementPath(t.sub)}
                end={t.end}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px pb-2.5 pt-1 text-[14px] whitespace-nowrap border-b-2 transition-colors ${
                  active ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </NavLink>
            )
          })}
        </nav>
      )}
    </div>
  )
}

const THEME_NEXT: Record<ThemePreference, ThemePreference> = { dark: 'light', light: 'system', system: 'dark' }
const THEME_LABEL: Record<ThemePreference, string> = { dark: 'Mörkt tema', light: 'Ljust tema', system: 'Följer systemet' }

/** Temaknapp: mörkt, ljust och system i tur och ordning */
export function ThemeButton() {
  const { preference, setTheme } = useTheme()
  const next = THEME_NEXT[preference]
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
      aria-label={`Byt tema, nu ${THEME_LABEL[preference].toLowerCase()}`}
      title={`${THEME_LABEL[preference]}. Klicka för ${THEME_LABEL[next].toLowerCase()}.`}
    >
      <Icon name="allman.tema" size={20} />
    </button>
  )
}

/** Kontomenyn: Mitt konto, Inställningar och Logga ut */
export function AccountMenu({ name, onSignOut }: { name: string; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const rel = useRelativePath()

  useEffect(() => setOpen(false), [rel])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const item = 'w-full min-h-[44px] flex items-center gap-2.5 px-3 text-[13px] text-slate-300 hover:bg-slate-800/60 hover:text-slate-100 transition-colors'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${open ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'}`}
        aria-label="Konto och inställningar"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Konto"
      >
        <Icon name="rapport.person" size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-slate-800 bg-slate-900 shadow-xl z-50 py-1" role="menu">
          <div className="px-3 py-2 text-[12px] text-slate-500 truncate">{name}</div>
          <Link to={procurementPath('/mitt-konto')} className={item} role="menuitem">
            <Icon name="rapport.person" size={16} />
            Mitt konto
          </Link>
          <Link to={procurementPath('/installningar')} className={item} role="menuitem">
            <Icon name="allman.filter" size={16} />
            Inställningar
          </Link>
          {onSignOut && (
            <>
              <div className="my-1 border-t border-slate-800" />
              <button type="button" onClick={onSignOut} className={item} role="menuitem">
                <Icon name="allman.logga-ut" size={16} />
                Logga ut
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
