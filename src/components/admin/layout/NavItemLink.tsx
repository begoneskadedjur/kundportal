// src/components/admin/layout/NavItemLink.tsx
// Länk för en menypost i adminportalens sidomeny. Poster med externalUrl
// (t.ex. Upphandlingar, som bor på upphandling.begone.se) öppnas i ny flik
// med en liten ikon; övriga är vanliga router-länkar.

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { NavItem } from './adminNavConfig'

interface Props {
  item: NavItem
  className: string
  onClick?: () => void
  children: ReactNode
}

export function NavItemLink({ item, className, onClick, children }: Props) {
  if (item.externalUrl) {
    return (
      <a href={item.externalUrl} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className} title={`${item.label} öppnas i ny flik`}>
        {children}
        <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" aria-hidden="true" />
      </a>
    )
  }
  return (
    <Link to={item.path} onClick={onClick} className={className}>
      {children}
    </Link>
  )
}
