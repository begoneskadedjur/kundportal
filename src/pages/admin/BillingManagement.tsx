// 📁 src/pages/admin/BillingManagement.tsx - KOMPLETT FAKTURERINGSSIDA
import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, FileText, Eye, Check, X, Clock, Search, User, Building2, MapPin, Calendar, DollarSign, Phone, Mail } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../utils/formatters'

// Moderna komponenter
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// 🎯 Interfaces
interface BillingCase {
  id: string
  case_number?: string
  title?: string
  type: 'private' | 'business'
  pris: number
  completed_date: string
  primary_assignee_name: string
  primary_assignee_email?: string
  skadedjur: string
  adress?: any
  description?: string
  rapport?: string  // 🆕 Lägg till rapport-fält
  kontaktperson?: string
  telefon_kontaktperson?: string
  e_post_kontaktperson?: string
  org_nr?: string
  bestallare?: string
  billing_status: 'pending' | 'sent' | 'paid' | 'skip'
  billing_updated_at?: string
}

type BillingStatus = 'all' | 'pending' | 'sent' | 'paid' | 'skip'
type SortField = 'completed_date' | 'pris' | 'primary_assignee_name' | 'billing_status'
type SortDirection = 'asc' | 'desc'

interface CaseDetailsModalProps {
  case_: BillingCase | null
  isOpen: boolean
  onClose: () => void
}

// 🔍 Modal för ärendedetaljer
const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  if (!isOpen || !case_) return null

  const formatAddress = (address: any) => {
    if (!address) return 'Ingen adress angiven'
    
    // Om det är en sträng, returnera direkt
    if (typeof address === 'string') {
      // Om strängen ser ut som JSON, försök parsa den
      if (address.startsWith('{') && address.includes('formatted_address')) {
        try {
          const parsed = JSON.parse(address)
          return parsed.formatted_address || 'Ingen adress angiven'
        } catch (e) {
          return address
        }
      }
      return address
    }
    
    // Om det är ett objekt
    if (typeof address === 'object') {
      // Kolla efter formatted_address direkt
      if (address.formatted_address) {
        return address.formatted_address
      }
      
      // Kolla efter nested struktur
      if (address.location && typeof address === 'object' && address.formatted_address) {
        return address.formatted_address
      }
      
      // Fallback till manuell formatering
      const parts = []
      if (address.street) parts.push(address.street)
      if (address.city) parts.push(address.city)
      if (address.postalCode || address.postal_code) parts.push(address.postalCode || address.postal_code)
      if (address.country) parts.push(address.country)
      
      return parts.length > 0 ? parts.join(', ') : 'Ingen adress angiven'
    }
    
    return 'Ingen adress angiven'
  }

  const calculateTotal = (price: number, isPrivate: boolean) => {
    if (isPrivate) {
      return price // Ingen moms för privatpersoner
    } else {
      return price * 1.25 // 25% moms för företag
    }
  }

  const getBillingStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'Väntar på fakturering', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
      case 'sent':
        return { label: 'Faktura skickad', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
      case 'paid':
        return { label: 'Faktura betald', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
      case 'skip':
        return { label: 'Ska ej faktureras', color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' }
      default:
        return { label: 'Okänd status', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
    }
  }

  const statusInfo = getBillingStatusInfo(case_.billing_status)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
            }`}>
              {case_.type === 'private' ? (
                <User className="w-5 h-5 text-purple-500" />
              ) : (
                <Building2 className="w-5 h-5 text-blue-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {case_.case_number || case_.title || `Ärende ${case_.id.slice(0, 8)}`}
              </h2>
              <p className="text-sm text-slate-400">
                {case_.type === 'private' ? 'Privatperson' : 'Företag'} • {formatCurrency(case_.pris)} 
                {case_.type === 'business' && ' + moms'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Innehåll */}
        <div className="p-6 space-y-6">
          {/* Faktureringsstatus */}
          <div className={`p-4 rounded-lg border ${statusInfo.bg} ${statusInfo.border}`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-300 mb-1">Faktureringsstatus</h3>
                <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
                {case_.billing_updated_at && (
                  <p className="text-xs text-slate-400 mt-1">
                    Uppdaterad: {new Date(case_.billing_updated_at).toLocaleDateString('sv-SE')}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Summa att fakturera</p>
                <p className="text-xl font-bold text-green-400">
                  {formatCurrency(calculateTotal(case_.pris, case_.type === 'private'))}
                </p>
                {case_.type === 'business' && (
                  <p className="text-xs text-slate-400">
                    {formatCurrency(case_.pris)} + {formatCurrency(case_.pris * 0.25)} moms
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Grundläggande info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Ärendeinfo
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Slutfört:</span>
                  <span className="text-white">
                    {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Skadedjur:</span>
                  <span className="text-white">{case_.skadedjur || 'Ej angivet'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Arbetskostnad:</span>
                  <span className="text-white">{formatCurrency(case_.pris)}</span>
                </div>
                {case_.type === 'business' && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Moms (25%):</span>
                    <span className="text-white">{formatCurrency(case_.pris * 0.25)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4" />
                Tekniker
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Namn:</span>
                  <span className="text-white">{case_.primary_assignee_name || 'Ej tilldelad'}</span>
                </div>
                {case_.primary_assignee_email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white">{case_.primary_assignee_email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kundinfo */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              {case_.type === 'private' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              Kunduppgifter
            </h3>
            <div className="grid grid-cols-1 gap-4 text-sm">
              {case_.kontaktperson && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Kontaktperson:</span>
                  <span className="text-white">{case_.kontaktperson}</span>
                </div>
              )}
              {case_.telefon_kontaktperson && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Telefon:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{case_.telefon_kontaktperson}</span>
                    <a
                      href={`tel:${case_.telefon_kontaktperson}`}
                      className="p-1 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded transition-colors"
                      title="Ring kund"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
              {case_.e_post_kontaktperson && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white">{case_.e_post_kontaktperson}</span>
                    <a
                      href={`mailto:${case_.e_post_kontaktperson}`}
                      className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
                      title="Skicka email"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}
              {case_.org_nr && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Org.nr:</span>
                  <span className="text-white">{case_.org_nr}</span>
                </div>
              )}
              {case_.bestallare && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Beställare:</span>
                  <span className="text-white">{case_.bestallare}</span>
                </div>
              )}
            </div>
          </div>

          {/* Adress */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Adress
            </h3>
            <p className="text-sm text-white bg-slate-800/50 p-3 rounded-lg">
              {formatAddress(case_.adress)}
            </p>
          </div>

          {/* Beskrivning */}
          {case_.description && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Beskrivning</h3>
              <p className="text-sm text-white bg-slate-800/50 p-3 rounded-lg">
                {case_.description}
              </p>
            </div>
          )}

          {/* Rapport */}
          {case_.rapport && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-300">Tekniker-rapport</h3>
              <div className="text-sm text-white bg-slate-800/50 p-3 rounded-lg">
                <div className="whitespace-pre-wrap">{case_.rapport}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const BillingManagement: React.FC = () => {
  const navigate = useNavigate()
  
  // State
  const [cases, setCases] = useState<BillingCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filtering & sorting
  const [statusFilter, setStatusFilter] = useState<BillingStatus>('pending')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('completed_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  // Modal
  const [selectedCase, setSelectedCase] = useState<BillingCase | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Processing state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchBillingCases()
  }, [])

  // 🔄 Hämta alla avslutade ärenden
  const fetchBillingCases = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔄 Fetching billing cases...')
      
      // Hämta alla avslutade ärenden från båda tabellerna
      const [privateResult, businessResult] = await Promise.all([
        supabase
          .from('private_cases')
          .select(`
            id, case_number, title, pris, completed_date,
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, rapport,
            kontaktperson, telefon_kontaktperson, e_post_kontaktperson,
            billing_status, billing_updated_at
          `)
          .eq('status', 'Avslutat')
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('completed_date', { ascending: false }),
        
        supabase
          .from('business_cases')
          .select(`
            id, case_number, title, pris, completed_date,
            primary_assignee_name, primary_assignee_email,
            skadedjur, adress, description, rapport,
            kontaktperson, telefon_kontaktperson, e_post_kontaktperson,
            org_nr, bestallare, billing_status, billing_updated_at
          `)
          .eq('status', 'Avslutat')
          .not('completed_date', 'is', null)
          .not('pris', 'is', null)
          .order('completed_date', { ascending: false })
      ])

      if (privateResult.error) throw new Error(`Private cases: ${privateResult.error.message}`)
      if (businessResult.error) throw new Error(`Business cases: ${businessResult.error.message}`)

      const allCases: BillingCase[] = [
        ...(privateResult.data || []).map(case_ => ({
          ...case_,
          type: 'private' as const,
          billing_status: case_.billing_status || 'pending'
        })),
        ...(businessResult.data || []).map(case_ => ({
          ...case_,
          type: 'business' as const,
          billing_status: case_.billing_status || 'pending'
        }))
      ]

      setCases(allCases)
      console.log(`📊 Loaded ${allCases.length} billing cases`)
      
    } catch (err) {
      console.error('❌ fetchBillingCases error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid hämtning av faktureringslista')
    } finally {
      setLoading(false)
    }
  }

  // 🔄 Uppdatera faktureringsstatus
  const updateBillingStatus = async (caseId: string, type: 'private' | 'business', status: BillingStatus) => {
    if (status === 'all') return // 'all' är bara för filtrering
    
    try {
      setProcessingIds(prev => new Set(prev).add(caseId))
      
      const table = type === 'private' ? 'private_cases' : 'business_cases'
      
      const { error } = await supabase
        .from(table)
        .update({
          billing_status: status,
          billing_updated_at: new Date().toISOString()
        })
        .eq('id', caseId)

      if (error) throw error

      // Uppdatera local state
      setCases(prev => prev.map(case_ => 
        case_.id === caseId 
          ? { ...case_, billing_status: status, billing_updated_at: new Date().toISOString() }
          : case_
      ))

      console.log(`✅ Updated case ${caseId} to status: ${status}`)
      
    } catch (err) {
      console.error('❌ updateBillingStatus error:', err)
      setError(err instanceof Error ? err.message : 'Fel vid uppdatering av faktureringsstatus')
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(caseId)
        return newSet
      })
    }
  }

  // 📊 Filtrerad och sorterad data
  const filteredAndSortedCases = useMemo(() => {
    let filtered = cases

    // Filtrera efter status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.billing_status === statusFilter)
    }

    // Filtrera efter sökterm
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(case_ =>
        (case_.case_number?.toLowerCase().includes(term)) ||
        (case_.primary_assignee_name?.toLowerCase().includes(term)) ||
        (case_.kontaktperson?.toLowerCase().includes(term)) ||
        (case_.skadedjur?.toLowerCase().includes(term)) ||
        (case_.org_nr?.toLowerCase().includes(term))
      )
    }

    // Sortera
    filtered.sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortField) {
        case 'completed_date':
          aValue = new Date(a.completed_date).getTime()
          bValue = new Date(b.completed_date).getTime()
          break
        case 'pris':
          aValue = a.pris
          bValue = b.pris
          break
        case 'primary_assignee_name':
          aValue = a.primary_assignee_name || ''
          bValue = b.primary_assignee_name || ''
          break
        case 'billing_status':
          aValue = a.billing_status
          bValue = b.billing_status
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    })

    return filtered
  }, [cases, statusFilter, searchTerm, sortField, sortDirection])

  // Beräkna sammanfattning
  const summary = useMemo(() => {
    const pending = cases.filter(c => c.billing_status === 'pending')
    const sent = cases.filter(c => c.billing_status === 'sent')
    const paid = cases.filter(c => c.billing_status === 'paid')
    const skip = cases.filter(c => c.billing_status === 'skip')

    const calculateTotal = (caseList: BillingCase[]) => {
      return caseList.reduce((sum, case_) => {
        const total = case_.type === 'private' ? case_.pris : case_.pris * 1.25
        return sum + total
      }, 0)
    }

    return {
      pending: { count: pending.length, total: calculateTotal(pending) },
      sent: { count: sent.length, total: calculateTotal(sent) },
      paid: { count: paid.length, total: calculateTotal(paid) },
      skip: { count: skip.length, total: calculateTotal(skip) }
    }
  }, [cases])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleCaseClick = (case_: BillingCase) => {
    setSelectedCase(case_)
    setIsModalOpen(true)
  }

  const getBillingStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Väntar
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FileText className="w-3 h-3 mr-1" />
            Skickad
          </span>
        )
      case 'paid':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <Check className="w-3 h-3 mr-1" />
            Betald
          </span>
        )
      case 'skip':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
            <X className="w-3 h-3 mr-1" />
            Ej faktura
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Okänd
          </span>
        )
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Fakturering</h1>
                <p className="text-slate-400 text-sm">Laddar faktureringslista...</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <div className="p-8 flex items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          </Card>
        </main>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Fakturering</h1>
                <p className="text-slate-400 text-sm">Fel vid laddning</p>
              </div>
            </div>
          </div>
        </header>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="bg-red-500/10 border-red-500/20">
            <div className="p-8 text-center text-red-400">
              <p className="mb-4">Fel vid laddning: {error}</p>
              <Button onClick={fetchBillingCases}>
                Försök igen
              </Button>
            </div>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Fakturering</h1>
                <p className="text-slate-400 text-sm">
                  Hantera fakturering för avslutade ärenden
                  <span className="ml-2 text-green-400">• {cases.length} totala ärenden</span>
                </p>
              </div>
            </div>
            <Button onClick={fetchBillingCases} className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Uppdatera
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          
          {/* Sammanfattning */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Väntar på fakturering</p>
                  <p className="text-2xl font-bold text-yellow-400">{summary.pending.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(summary.pending.total)}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Faktura skickad</p>
                  <p className="text-2xl font-bold text-blue-400">{summary.sent.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(summary.sent.total)}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Faktura betald</p>
                  <p className="text-2xl font-bold text-green-400">{summary.paid.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(summary.paid.total)}</p>
                </div>
                <Check className="w-8 h-8 text-green-500" />
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Ska ej faktureras</p>
                  <p className="text-2xl font-bold text-gray-400">{summary.skip.count}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(summary.skip.total)}</p>
                </div>
                <X className="w-8 h-8 text-gray-500" />
              </div>
            </Card>
          </div>

          {/* Filter och sök */}
          <Card>
            <div className="p-6">
              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                
                {/* Status filter */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'pending', label: 'Väntar', count: summary.pending.count },
                    { key: 'sent', label: 'Skickad', count: summary.sent.count },
                    { key: 'all', label: 'Alla', count: cases.length },
                    { key: 'paid', label: 'Betald', count: summary.paid.count },
                    { key: 'skip', label: 'Ej faktura', count: summary.skip.count }
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setStatusFilter(filter.key as BillingStatus)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        statusFilter === filter.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>

                {/* Sök */}
                <div className="relative w-full lg:w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Sök efter ärende, tekniker, kund..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Faktureringslista */}
          <Card>
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold text-white">Faktureringslista</h2>
              </div>
              <p className="text-sm text-slate-400">{filteredAndSortedCases.length} ärenden visas</p>
            </div>
            
            <div className="p-6">
              {filteredAndSortedCases.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">
                          <button
                            onClick={() => handleSort('completed_date')}
                            className="flex items-center gap-2 hover:text-white transition-colors"
                          >
                            Datum
                            {sortField === 'completed_date' && (
                              sortDirection === 'asc' ? '↑' : '↓'
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Ärende</th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">
                          <button
                            onClick={() => handleSort('primary_assignee_name')}
                            className="flex items-center gap-2 hover:text-white transition-colors"
                          >
                            Tekniker
                            {sortField === 'primary_assignee_name' && (
                              sortDirection === 'asc' ? '↑' : '↓'
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">Kund</th>
                        <th className="text-right py-3 px-4 text-slate-300 font-medium">
                          <button
                            onClick={() => handleSort('pris')}
                            className="flex items-center gap-2 hover:text-white transition-colors ml-auto"
                          >
                            Att fakturera
                            {sortField === 'pris' && (
                              sortDirection === 'asc' ? '↑' : '↓'
                            )}
                          </button>
                        </th>
                        <th className="text-left py-3 px-4 text-slate-300 font-medium">
                          <button
                            onClick={() => handleSort('billing_status')}
                            className="flex items-center gap-2 hover:text-white transition-colors"
                          >
                            Status
                            {sortField === 'billing_status' && (
                              sortDirection === 'asc' ? '↑' : '↓'
                            )}
                          </button>
                        </th>
                        <th className="text-center py-3 px-4 text-slate-300 font-medium">Åtgärder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAndSortedCases.map((case_) => {
                        const isProcessing = processingIds.has(case_.id)
                        const totalAmount = case_.type === 'private' ? case_.pris : case_.pris * 1.25
                        
                        return (
                          <tr 
                            key={case_.id} 
                            className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                          >
                            <td className="py-4 px-4 text-sm text-slate-300">
                              {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  case_.type === 'private' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                                }`}>
                                  {case_.type === 'private' ? (
                                    <User className="w-4 h-4 text-purple-500" />
                                  ) : (
                                    <Building2 className="w-4 h-4 text-blue-500" />
                                  )}
                                </div>
                                <div>
                                  <button
                                    onClick={() => handleCaseClick(case_)}
                                    className="text-white hover:text-blue-400 transition-colors font-medium"
                                  >
                                    {case_.case_number || case_.title || `BE-${case_.id.slice(0, 4)}`}
                                  </button>
                                  <p className="text-xs text-slate-400">
                                    {case_.skadedjur} • {case_.type === 'private' ? 'Privatperson' : 'Företag'}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-300">
                              {case_.primary_assignee_name || 'Ej tilldelad'}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-300">
                              <div>
                                <p className="text-white">{case_.kontaktperson || case_.bestallare || 'Okänd'}</p>
                                {case_.org_nr && (
                                  <p className="text-xs text-slate-400">Org.nr: {case_.org_nr}</p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <div>
                                <p className="text-white font-semibold">{formatCurrency(totalAmount)}</p>
                                {case_.type === 'business' && (
                                  <p className="text-xs text-slate-400">
                                    {formatCurrency(case_.pris)} + moms
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {getBillingStatusBadge(case_.billing_status)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-1">
                                {case_.billing_status === 'pending' && (
                                  <button
                                    onClick={() => updateBillingStatus(case_.id, case_.type, 'sent')}
                                    disabled={isProcessing}
                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    title="Markera som skickad"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                )}
                                
                                {(case_.billing_status === 'pending' || case_.billing_status === 'sent') && (
                                  <>
                                    <button
                                      onClick={() => updateBillingStatus(case_.id, case_.type, 'paid')}
                                      disabled={isProcessing}
                                      className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50"
                                      title="Markera som betald"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    
                                    <button
                                      onClick={() => updateBillingStatus(case_.id, case_.type, 'skip')}
                                      disabled={isProcessing}
                                      className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-500/10 rounded-lg transition-colors disabled:opacity-50"
                                      title="Markera som ska ej faktureras"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                
                                {(case_.billing_status === 'paid' || case_.billing_status === 'skip') && (
                                  <button
                                    onClick={() => updateBillingStatus(case_.id, case_.type, 'pending')}
                                    disabled={isProcessing}
                                    className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50"
                                    title="Återställ till väntande"
                                  >
                                    <Clock className="w-4 h-4" />
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleCaseClick(case_)}
                                  className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-500/10 rounded-lg transition-colors"
                                  title="Visa detaljer"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Inga ärenden matchar de valda filtren</p>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="mt-2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Visa alla ärenden
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </main>

      {/* Case Details Modal */}
      <CaseDetailsModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  )
}

export default BillingManagement