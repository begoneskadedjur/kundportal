// src/components/admin/customers/AdminCasesList.tsx - Kompakt ärendelista för admin-vy
import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import CompactCasesList from '../../organisation/CompactCasesList'
import CustomerCaseDetailsModal from '../../organisation/CustomerCaseDetailsModal'
import LoadingSpinner from '../../shared/LoadingSpinner'

interface AdminCasesListProps {
  customerId: string
  organizationId?: string
}

const AdminCasesList: React.FC<AdminCasesListProps> = ({ customerId, organizationId }) => {
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<any | null>(null)

  useEffect(() => {
    fetchAllCases()
  }, [customerId])

  const fetchAllCases = async () => {
    try {
      setLoading(true)
      
      // Hämta ALLA ärenden för denna enhet oavsett status
      const { data: casesData, error } = await supabase
        .from('cases')
        .select(`
          id, 
          case_number,
          title, 
          status, 
          priority,
          created_at,
          updated_at,
          scheduled_start,
          primary_technician_name,
          pest_level,
          problem_rating,
          assessment_date,
          price,
          customers!inner(company_name, site_name, region)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(20) // Begränsa till senaste 20 ärenden
      
      if (error) throw error
      setCases(casesData || [])
    } catch (error) {
      console.error('Error fetching cases:', error)
      setCases([])
    } finally {
      setLoading(false)
    }
  }

  const handleCaseClick = (caseData: any) => {
    setSelectedCase(caseData)
  }

  const handleCloseModal = () => {
    setSelectedCase(null)
  }

  if (loading) {
    return <LoadingSpinner text="Laddar ärenden..." />
  }

  if (cases.length === 0) {
    return (
      <div className="text-center py-6 text-slate-400">
        <div className="mb-2">📋</div>
        <div className="text-sm">Inga ärenden för denna enhet</div>
        <div className="text-xs text-slate-500 mt-1">Ärenden visas här när de skapas</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-300">
            Visar {cases.length} ärenden (alla status)
          </div>
        </div>
        
        <CompactCasesList
          cases={cases}
          onCaseClick={handleCaseClick}
          loading={loading}
          userRole="verksamhetschef" // Admin har verksamhetschef-behörighet
          showPDFExport={false} // Inaktivera PDF för admin-vy
          className="max-h-96 overflow-y-auto"
        />
      </div>

      {/* Case Details Modal */}
      {selectedCase && (
        <CustomerCaseDetailsModal
          caseData={selectedCase}
          isOpen={!!selectedCase}
          onClose={handleCloseModal}
          userRole="verksamhetschef"
        />
      )}
    </>
  )
}

export default AdminCasesList