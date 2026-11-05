// src/pages/admin/invoicing/index.tsx
// Kompakt faktureringssida optimerad för stora volymer

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, TrendingUp } from 'lucide-react'
import PrivateBusinessInvoicing from './PrivateBusinessInvoicing'
import AdhocQueue from '../../../components/admin/invoicing/queue/AdhocQueue'
import ContractSchedule from '../../../components/admin/invoicing/queue/ContractSchedule'
import { ModeSwitch } from '../../../components/admin/invoicing/queue/QueueParts'

type InvoicingTab = 'private-business' | 'contracts' | 'adhoc'

export default function InvoicingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<InvoicingTab>('private-business')
  // Avtalskunder: Att hantera (faktureringsschemat) eller Arkiv
  const [contractMode, setContractMode] = useState<'hantera' | 'arkiv'>('hantera')
  // Merförsäljning avtal: Att hantera eller Arkiv
  const [adhocMode, setAdhocMode] = useState<'hantera' | 'arkiv'>('hantera')

  const tabs: { id: InvoicingTab; label: string }[] = [
    { id: 'private-business', label: 'Privat & Företag' },
    { id: 'contracts', label: 'Avtalskunder' },
    { id: 'adhoc', label: 'Merförsäljning Avtal' }
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

      {/* Fliknavigering – understrukna tabbar utan ikoner */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-slate-700 mb-4">
      <div className="flex gap-6">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                px-0.5 py-3 text-sm font-semibold -mb-px
                border-b-2 transition-colors min-h-[44px]
                ${isActive
                  ? 'text-[#20c58f] border-[#20c58f]'
                  : 'text-slate-400 border-transparent hover:text-white'
                }
              `}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
        {activeTab === 'contracts' && (
          <div className="mb-2">
            <ModeSwitch mode={contractMode} onChange={setContractMode} />
          </div>
        )}
        {activeTab === 'adhoc' && (
          <div className="mb-2">
            <ModeSwitch mode={adhocMode} onChange={setAdhocMode} />
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'private-business' && <PrivateBusinessInvoicing invoiceType="private-business" />}
        {activeTab === 'contracts' && contractMode === 'hantera' && (
          <ContractSchedule onShowArchive={() => setContractMode('arkiv')} />
        )}
        {activeTab === 'contracts' && contractMode === 'arkiv' && (
          <PrivateBusinessInvoicing invoiceType="contract" defaultShowArchive />
        )}
        {activeTab === 'adhoc' && adhocMode === 'hantera' && (
          <AdhocQueue onShowArchive={() => setAdhocMode('arkiv')} />
        )}
        {activeTab === 'adhoc' && adhocMode === 'arkiv' && (
          <PrivateBusinessInvoicing invoiceType="adhoc" defaultShowArchive />
        )}
      </div>
    </div>
  )
}
