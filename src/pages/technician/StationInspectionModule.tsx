// src/pages/technician/StationInspectionModule.tsx
// TEST 1: Minimal version - INGEN import från indoor.ts

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Button from '../../components/ui/Button'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'

export default function StationInspectionModule() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [caseData, setCaseData] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      if (!caseId) {
        setError('Inget ärende-ID')
        setLoading(false)
        return
      }

      try {
        // Hämta ärendedata direkt från Supabase
        const { data, error: caseError } = await supabase
          .from('cases')
          .select('id, title, case_number, customer_id, customers(company_name)')
          .eq('id', caseId)
          .single()

        if (caseError) throw caseError
        setCaseData(data)
      } catch (err) {
        console.error('Error loading case:', err)
        setError('Kunde inte ladda ärende')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [caseId])

  // Visa console.log för att bekräfta att vi nått hit
  console.log('TEST 1: Minimal version laddad', { caseId, loading, error, caseData })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-400">{error}</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tillbaka
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">TEST 1: Minimal</h1>
            <p className="text-slate-400 text-sm">Ingen import från indoor.ts</p>
          </div>
        </div>

        {/* Ärende-info */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Ärendedata</h2>
          <pre className="text-slate-300 text-sm overflow-auto">
            {JSON.stringify(caseData, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
