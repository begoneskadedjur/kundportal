// src/pages/admin/invoicing/index.tsx
// Kompakt faktureringssida optimerad för stora volymer

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt,
  Users,
  Building2,
  TrendingUp,
  Plus
} from 'lucide-react'
import PrivateBusinessInvoicing from './PrivateBusinessInvoicing'
import ContractInvoicing from './ContractInvoicing'
import AdhocInvoicing from './AdhocInvoicing'
import BillingSummaryLedge from '../../../components/admin/invoicing/BillingSummaryLedge'

type InvoicingTab = 'private-business' | 'contracts' | 'adhoc'

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
    },
    {
      id: 'adhoc' as InvoicingTab,
      label: 'Merförsäljning Avtal',
      icon: Plus
    }
  ]

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-emerald-400" />
          <h1 className="text-xl sm:text-2xl font-bold text-white">Fakturering</h1>
        </div>
        <button
          onClick={() => navigate('/admin/ekonomi')}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors min-h-[44px]"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="hidden sm:inline">Ekonomi</span>
        </button>
      </div>

      {/* Fliknavigering */}
      <div className="flex gap-1 border-b border-slate-700 mb-4">
        {tabs.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium
                border-b-2 transition-colors min-h-[44px]
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

      {/* Billing summary ledge */}
      <BillingSummaryLedge />

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'private-business' && <PrivateBusinessInvoicing />}
        {activeTab === 'contracts' && <ContractInvoicing />}
        {activeTab === 'adhoc' && <AdhocInvoicing />}
      </div>
    </div>
  )
}
