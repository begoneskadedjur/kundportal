// src/pages/admin/EgenkontrollPage.tsx
// Tab-wrapper för /admin/egenkontroll: Rapport (RonderingPage) + Inställningar (frågebyggaren).

import { useState } from 'react'
import { ClipboardCheck, Settings } from 'lucide-react'
import RonderingPage from './RonderingPage'
import EgenkontrollSettingsPage from './EgenkontrollSettingsPage'

type Tab = 'rapport' | 'installningar'

export default function EgenkontrollPage() {
  const [tab, setTab] = useState<Tab>('rapport')

  const tabs: { id: Tab; label: string; icon: typeof ClipboardCheck }[] = [
    { id: 'rapport', label: 'Rapport', icon: ClipboardCheck },
    { id: 'installningar', label: 'Inställningar', icon: Settings },
  ]

  return (
    <div>
      {/* Fliknavigering */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="flex gap-1 border-b border-slate-700">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors min-h-[44px] ${
                  active
                    ? 'text-[#20c58f] border-[#20c58f] bg-slate-800/50'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'rapport' && <RonderingPage />}
      {tab === 'installningar' && (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <EgenkontrollSettingsPage />
        </div>
      )}
    </div>
  )
}
