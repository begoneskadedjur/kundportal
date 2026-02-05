// src/pages/admin/invoicing/index.tsx
// Kompakt faktureringssida optimerad för stora volymer

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt,
  Users,
  Building2,
  ArrowLeft,
  TrendingUp
} from 'lucide-react'
import PrivateBusinessInvoicing from './PrivateBusinessInvoicing'
import ContractInvoicing from './ContractInvoicing'

type InvoicingTab = 'private-business' | 'contracts'

export default function InvoicingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<InvoicingTab>('private-business')

  const tabs = [
    {
      id: 'private-business' as InvoicingTab,
      label: 'Privat & Företag',
      icon: Users
    },
    {
      id: 'contracts' as InvoicingTab,
      label: 'Avtalskunder',
      icon: Building2
    }
  ]

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Kompakt Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 flex items-center justify-between">
            {/* Vänster: Tillbaka + Titel */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Tillbaka"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <h1 className="text-lg font-semibold text-white">Fakturering</h1>
              </div>
            </div>

            {/* Höger: Snabbåtgärder */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin/economics')}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Ekonomi</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fliknavigering - kompakt */}
      <div className="bg-slate-800/50 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-3 text-sm font-medium
                    border-b-2 transition-colors
                    ${isActive
                      ? 'text-emerald-400 border-emerald-400 bg-slate-800/50'
                      : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700/30'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab Content - ingen extra padding */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {activeTab === 'private-business' && <PrivateBusinessInvoicing />}
        {activeTab === 'contracts' && <ContractInvoicing />}
      </div>
    </div>
  )
}
