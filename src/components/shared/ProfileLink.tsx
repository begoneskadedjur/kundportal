// src/components/shared/ProfileLink.tsx
// "Mitt konto"-länk till /profile (profil + byt lösenord) för
// sidofältens nedre sektion och mobilmenyerna.

import { Link } from 'react-router-dom'
import { UserCircle } from 'lucide-react'

interface ProfileLinkProps {
  collapsed?: boolean
  variant?: 'sidebar' | 'mobile'
  onNavigate?: () => void
}

export function ProfileLink({ collapsed = false, variant = 'sidebar', onNavigate }: ProfileLinkProps) {
  if (variant === 'mobile') {
    return (
      <Link
        to="/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
      >
        <UserCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium">Mitt konto</span>
      </Link>
    )
  }

  return (
    <Link
      to="/profile"
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors
        focus-visible:ring-2 focus-visible:ring-teal-400 outline-none
        ${collapsed ? 'justify-center' : ''}
      `}
      title={collapsed ? 'Mitt konto' : undefined}
    >
      <UserCircle className="w-4 h-4 flex-shrink-0" />
      {!collapsed && <span className="text-sm">Mitt konto</span>}
    </Link>
  )
}
