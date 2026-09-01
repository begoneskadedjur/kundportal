// src/components/shared/ChangelogLink.tsx
// "Uppdateringar"-knapp för sidofältens nedre sektion och mobilmenyer.
// Öppnar ChangelogModal och släcker pricken som markerar osedda nyheter.
// Samma mönster som IntranetLink och ProfileLink.

import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import { ChangelogModal } from './ChangelogModal'
import { useChangelogBadge } from '../../hooks/useChangelogBadge'

interface ChangelogLinkProps {
  collapsed?: boolean
  variant?: 'sidebar' | 'mobile'
  /**
   * Stänger mobilmenyn. Anropas när modalen STÄNGS, inte när den öppnas -
   * mobilmenyn avmonteras när den stängs, och tar då modalen med sig.
   */
  onNavigate?: () => void
}

export function ChangelogLink({
  collapsed = false,
  variant = 'sidebar',
  onNavigate,
}: ChangelogLinkProps) {
  const { hasUnseen, markSeen } = useChangelogBadge()
  const [isOpen, setIsOpen] = useState(false)

  const open = () => {
    markSeen()
    setIsOpen(true)
  }

  const close = () => {
    setIsOpen(false)
    onNavigate?.()
  }

  const Dot = () => (
    <span className="ml-auto w-2 h-2 rounded-full bg-[#20c58f] flex-shrink-0" aria-hidden="true" />
  )

  return (
    <>
      {variant === 'mobile' ? (
        <button
          onClick={open}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
        >
          <Megaphone className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Uppdateringar</span>
          {hasUnseen && <Dot />}
        </button>
      ) : (
        <button
          onClick={open}
          className={`
            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors relative
            focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Uppdateringar' : undefined}
        >
          <Megaphone className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Uppdateringar</span>}
          {collapsed
            ? hasUnseen && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-[#20c58f]" />
              )
            : hasUnseen && <Dot />}
        </button>
      )}

      <ChangelogModal isOpen={isOpen} onClose={close} />
    </>
  )
}
