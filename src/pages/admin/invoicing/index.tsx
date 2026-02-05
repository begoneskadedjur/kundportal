// src/pages/admin/invoicing/index.tsx
// Huvudsida för fakturering med flikar

import { useState } from 'react'
import { Receipt, Users, FileText, Building2 } from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import PrivateBusinessInvoicing from './PrivateBusinessInvoicing'
import ContractInvoicing from './ContractInvoicing'

type InvoicingTab = 'private-business' | 'contracts'

export default function InvoicingPage() {
  const [activeTab, setActiveTab] = useState<InvoicingTab>('private-business')

  const tabs = [
    {
      id: 'private-business' as InvoicingTab,
      label: 'Privat & Företag',
      icon: Users,
      description: 'Direktfakturering för enskilda ärenden'
    },
    {
      id: 'contracts' as InvoicingTab,
      label: 'Avtalskunder',
      icon: Building2,
      description: 'Batch-fakturering enligt frekvens'
    }
  ]

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <PageHeader
        title="Fakturering"
        subtitle="Hantera fakturering för alla kundtyper"
        icon={Receipt}
        iconColor="text-emerald-400"
        showBackButton={false}
      />

      {/* Flikar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden">
          {/* Tab navigation */}
          <div className="flex border-b border-slate-700">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 transition-colors ${
                    isActive
                      ? 'bg-slate-700/50 text-white border-b-2 border-emerald-500'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : ''}`} />
                  <div className="text-left">
                    <div className="font-medium">{tab.label}</div>
                    <div className="text-xs text-slate-500 hidden sm:block">
                      {tab.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'private-business' && <PrivateBusinessInvoicing />}
            {activeTab === 'contracts' && <ContractInvoicing />}
          </div>
        </div>
      </div>
    </div>
  )
}
