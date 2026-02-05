// src/components/admin/settings/ArticlePriceListNav.tsx
// Navigationskomponent för att växla mellan Artiklar och Prislistor

import { Link, useLocation } from 'react-router-dom'
import { Package, FileText, Receipt } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: typeof Package
  description: string
}

const navItems: NavItem[] = [
  {
    href: '/admin/settings/articles',
    label: 'Artiklar',
    icon: Package,
    description: 'Produkter & tjänster'
  },
  {
    href: '/admin/settings/price-lists',
    label: 'Prislistor',
    icon: FileText,
    description: 'Kundpriser'
  },
  {
    href: '/admin/invoicing',
    label: 'Fakturering',
    icon: Receipt,
    description: 'Nytt faktureringssystem'
  }
]

export function ArticlePriceListNav() {
  const location = useLocation()

  return (
    <div className="flex items-center gap-2 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all flex-1 justify-center ${
              isActive
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="font-medium text-sm">{item.label}</span>
            <span className="hidden lg:inline text-xs text-slate-500">
              · {item.description}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
