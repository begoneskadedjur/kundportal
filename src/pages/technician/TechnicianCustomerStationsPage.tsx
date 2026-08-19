// src/pages/technician/TechnicianCustomerStationsPage.tsx
// Kunddetaljvy som egen routad sida: /technician/equipment/customer/:customerId
// Ersätter modal-över-modal-mönstret så att bakåtknappen fungerar och
// länkar kan delas (?tab=outdoor|indoor|schedule styr startfliken).
// Innehållet renderas av CustomerStationsModal i page-läge.

import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Building2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CustomerStationsModal } from '../../components/technician/CustomerStationsModal'
import { CustomerStationSummary } from '../../services/equipmentService'

export default function TechnicianCustomerStationsPage() {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [customer, setCustomer] = useState<CustomerStationSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const tabParam = searchParams.get('tab')
  const initialView =
    tabParam === 'indoor' || tabParam === 'schedule' ? tabParam : 'outdoor'

  useEffect(() => {
    if (!customerId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name, contact_address, organization_number, organization_id, parent_customer_id, is_multisite, site_type, site_name, contract_start_date, contract_end_date')
        .eq('id', customerId)
        .single()

      if (cancelled) return
      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      // Stationsräknare och hälsa beräknas inuti innehållskomponenten från
      // kundens faktiska stationer — summaryn behöver bara identitetsfälten
      setCustomer({
        customer_id: data.id,
        customer_name: data.company_name,
        customer_address: data.contact_address,
        organization_number: data.organization_number,
        outdoor_count: 0,
        indoor_count: 0,
        health_status: 'excellent',
        latest_inspection_date: null,
        latest_inspector_name: null,
        organization_id: data.organization_id,
        parent_customer_id: data.parent_customer_id,
        is_multisite: data.is_multisite || false,
        site_type: data.site_type,
        site_name: data.site_name,
        contract_start_date: data.contract_start_date,
        contract_end_date: data.contract_end_date
      })
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [customerId])

  const goBack = () => navigate('/technician/equipment')

  return (
    <div className="text-white flex flex-col pb-24 md:pb-8">
      <div className="flex-grow max-w-4xl mx-auto w-full p-4">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Utrustning
        </button>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
          </div>
        ) : notFound ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-500" />
            </div>
            <h2 className="text-lg font-medium text-white mb-2">Kunden hittades inte</h2>
            <p className="text-slate-400 text-sm mb-4">Kontrollera länken eller gå tillbaka till kundlistan.</p>
            <button
              onClick={goBack}
              className="px-4 py-2 bg-[#20c58f] hover:bg-[#1ab07f] text-[#fff] font-medium rounded-lg transition-colors"
            >
              Till kundlistan
            </button>
          </div>
        ) : (
          <CustomerStationsModal
            variant="page"
            customer={customer}
            isOpen={true}
            onClose={goBack}
            initialView={initialView}
            onAddStation={(cid) => navigate(`/technician/equipment?customer=${cid}`)}
          />
        )}
      </div>
    </div>
  )
}
