// src/pages/admin/CustomerRecordPage.tsx
// Kanonisk kundsida (etapp 1 av redesignen av Befintliga kunder).
// Själva innehållet (header, flikar, avtalskort) bor i CustomerRecordContent
// som delas med peek-panelen i listan. :id kan vara org-raden eller en enhetsrad.

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useCustomerRecord } from '../../hooks/useCustomerRecord'
import CustomerRecordContent from '../../components/admin/customers/record/CustomerRecordContent'

export default function CustomerRecordPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { data, loading, error } = useCustomerRecord(id)

  // Fungerar för /admin, /koordinator och /saljare — samma sidkomponent
  const basePath = `${location.pathname.split('/befintliga-kunder')[0]}/befintliga-kunder`

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
          <button
            onClick={() => navigate(basePath)}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#20c58f] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Tillbaka till kundlistan
          </button>
          <div className="flex items-center gap-3 text-slate-300">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium">Kunde inte hämta kunden</p>
              {error && <p className="text-xs text-slate-500 mt-0.5">{error}</p>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate(basePath)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#20c58f] transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Befintliga kunder
        </button>

        <CustomerRecordContent data={data} basePath={basePath} density="full" />
      </div>
    </div>
  )
}
