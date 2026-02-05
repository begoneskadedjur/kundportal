// src/pages/admin/invoicing/index.tsx
// Huvudsida för fakturering med flikar - Uppdaterad med förbättrad header

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Receipt,
  Users,
  Building2,
  ArrowLeft,
  CreditCard,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react'
import Button from '../../../components/ui/Button'
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
      {/* Hero Header Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-slate-900 to-teal-900/30" />

        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Header Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          {/* Top Row: Back button and actions */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Tillbaka
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/economics')}
                className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Ekonomi</span>
              </Button>
              <div className="w-px h-6 bg-slate-700" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {/* TODO: Export functionality */}}
                className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Exportera</span>
              </Button>
            </div>
          </div>

          {/* Main Header Content */}
          <div className="flex items-start gap-6">
            {/* Icon Container */}
            <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
              <Receipt className="w-8 h-8 text-emerald-400" />
            </div>

            {/* Title and Description */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">
                  Fakturering
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CreditCard className="w-3 h-3" />
                  Fakturahantering
                </span>
              </div>
              <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
                Hantera fakturering för alla kundtyper. Skapa direktfakturor för privat- och företagskunder
                eller generera batch-fakturor för avtalskunder baserat på avtalsfrekvens.
              </p>
            </div>
          </div>

          {/* Stats Row (Optional - adds visual interest) */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-white">--</div>
              <div className="text-xs text-slate-400">Väntande fakturor</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50">
              <div className="text-2xl font-bold text-emerald-400">--</div>
              <div className="text-xs text-slate-400">Skickade idag</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hidden sm:block">
              <div className="text-2xl font-bold text-teal-400">--</div>
              <div className="text-xs text-slate-400">Denna månad</div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-4 border border-slate-700/50 hidden sm:block">
              <div className="text-2xl font-bold text-yellow-400">--</div>
              <div className="text-xs text-slate-400">Förfallit</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-2 pb-8">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 overflow-hidden shadow-xl shadow-black/20">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-700/50 bg-slate-800/30">
            {tabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 flex items-center justify-center gap-3 px-6 py-4
                    transition-all duration-200 relative
                    ${isActive
                      ? 'text-white bg-slate-700/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/20'
                    }
                  `}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
                  )}

                  <div className={`
                    p-2 rounded-lg transition-colors
                    ${isActive ? 'bg-emerald-500/20' : 'bg-slate-700/30'}
                  `}>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  </div>

                  <div className="text-left">
                    <div className="font-medium">{tab.label}</div>
                    <div className={`text-xs hidden sm:block ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                      {tab.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'private-business' && <PrivateBusinessInvoicing />}
            {activeTab === 'contracts' && <ContractInvoicing />}
          </div>
        </div>
      </div>
    </div>
  )
}
