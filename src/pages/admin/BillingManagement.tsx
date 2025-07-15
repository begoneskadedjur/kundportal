// 📁 src/pages/admin/BillingManagement.tsx - UPPDATERAD MED FIXES
import React, { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, FileText, Eye, Check, X, Clock, Search, User, Building2, MapPin, Calendar, DollarSign, Phone, Mail, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
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
  rapport?: string
  // 🆕 FÖRETAG-SPECIFIKA FÄLT
  markning_faktura?: string
  kontaktperson?: string
  e_post_faktura?: string
  e_post_kontaktperson?: string
  telefon_kontaktperson?: string
  bestallare?: string
  org_nr?: string
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

// 🔍 Modal för ärendedetaljer - UPPDATERAD
const CaseDetailsModal: React.FC<CaseDetailsModalProps> = ({ case_, isOpen, onClose }) => {
  const [showDescription, setShowDescription] = useState(false)
  const [showReport, setShowReport] = useState(false)

  if (!isOpen || !case_) return null

  const formatAddress = (address: any) => {
    if (!address) return 'Ingen adress angiven'
    
    if (typeof address === 'string') {
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
    
    if (typeof address === 'object') {
      if (address.formatted_address) {
        return address.formatted_address
      }
      
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
      <div className="bg-slate-900 border border-slate-700 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
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

          <div className="grid md:grid-cols-2 gap-6">
            {/* Ärendeinfo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-400" />
                Ärendeinfo
              </h3>
              
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Slutfört:</span>
                  <span className="text-white">{new Date(case_.completed_date).toLocaleDateString('sv-SE')}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-slate-400">Skadedjur:</span>
                  <span className="text-white">{case_.skadedjur || 'Ej specificerat'}</span>
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

            {/* Tekniker */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-green-400" />
                Tekniker
              </h3>
              
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Namn:</span>
                  <span className="text-white">{case_.primary_assignee_name}</span>
                </div>
                
                {case_.primary_assignee_email && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Email:</span>
                    <span className="text-white">{case_.primary_assignee_email}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Kunduppgifter - UPPDATERAD FÖR FÖRETAG */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {case_.type === 'private' ? (
                  <User className="w-5 h-5 text-purple-400" />
                ) : (
                  <Building2 className="w-5 h-5 text-blue-400" />
                )}
                {case_.type === 'private' ? 'Kunduppgifter' : 'Företagsuppgifter'}
              </h3>
              
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                {case_.type === 'business' ? (
                  // 🆕 FÖRETAG - Visa företagsnamn och alla relevanta fält
                  <>
                    {case_.title && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Företag:</span>
                        <span className="text-white font-medium">{case_.title}</span>
                      </div>
                    )}
                    
                    {case_.org_nr && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Org.nr:</span>
                        <span className="text-white">{case_.org_nr}</span>
                      </div>
                    )}
                    
                    {case_.kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontaktperson:</span>
                        <span className="text-white">{case_.kontaktperson}</span>
                      </div>
                    )}
                    
                    {case_.telefon_kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Telefon:</span>
                        <span className="text-white">{case_.telefon_kontaktperson}</span>
                      </div>
                    )}
                    
                    {case_.e_post_kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Email:</span>
                        <span className="text-white">{case_.e_post_kontaktperson}</span>
                      </div>
                    )}
                    
                    {case_.bestallare && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Beställare:</span>
                        <span className="text-white">{case_.bestallare}</span>
                      </div>
                    )}
                  </>
                ) : (
                  // Privatperson - ursprunglig logik
                  <>
                    {case_.kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontaktperson:</span>
                        <span className="text-white">{case_.kontaktperson}</span>
                      </div>
                    )}
                    
                    {case_.telefon_kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Telefon:</span>
                        <span className="text-white">{case_.telefon_kontaktperson}</span>
                      </div>
                    )}
                    
                    {case_.e_post_kontaktperson && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Email:</span>
                        <span className="text-white">{case_.e_post_kontaktperson}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 🆕 FAKTURERINGSINFORMATION - Endast för företag */}
            {case_.type === 'business' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Faktureringsinformation
                </h3>
                
                <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                  {case_.e_post_faktura && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Faktura email:</span>
                      <span className="text-white">{case_.e_post_faktura}</span>
                    </div>
                  )}
                  
                  {case_.markning_faktura && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fakturamärkning:</span>
                      <span className="text-white">{case_.markning_faktura}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Adress */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-400" />
                Adress
              </h3>
              
              <div className="bg-slate-800/50 rounded-lg p-4">
                <p className="text-white">{formatAddress(case_.adress)}</p>
              </div>
            </div>

            {/* Beskrivning - KLICKBAR */}
            {case_.description && (
              <div className="md:col-span-2 space-y-4">
                <button
                  onClick={() => setShowDescription(!showDescription)}
                  className="flex items-center gap-2 text-lg font-semibold text-white hover:text-blue-400 transition-colors"
                >
                  <FileText className="w-5 h-5 text-blue-400" />
                  Beskrivning
                  {showDescription ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {showDescription && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {case_.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tekniker-rapport - KLICKBAR */}
            {case_.rapport && (
              <div className="md:col-span-2 space-y-4">
                <button
                  onClick={() => setShowReport(!showReport)}
                  className="flex items-center gap-2 text-lg font-semibold text-white hover:text-green-400 transition-colors"
                >
                  <FileText className="w-5 h-5 text-green-400" />
                  Tekniker-rapport
                  {showReport ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {showReport && (
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {case_.rapport}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// 🎯 Huvudkomponent
const BillingManagement: React.FC = () => {
  const navigate = useNavigate()
  
  // State
  const [cases, setCases] = useState<BillingCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  const [selectedCase, setSelectedCase] = useState<BillingCase | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Filters & Sorting
  const [statusFilter, setStatusFilter] = useState<BillingStatus>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState<SortField>('completed_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const isProcessing = (caseId: string) => processingIds.has(caseId)

  useEffect(() => {
    fetchBillingCases()
  }, [])

  // 📊 Hämta faktureringslista
  const fetchBillingCases = async () => {
    try {
      setLoading(true)
      setError(null)

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
            markning_faktura, kontaktperson, e_post_faktura,
            e_post_kontaktperson, telefon_kontaktperson,
            bestallare, org_nr, billing_status, billing_updated_at
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

  // 🔄 Uppdatera faktureringsstatus - UPPDATERAD MED SENT→PENDING
  const updateBillingStatus = async (caseId: string, type: 'private' | 'business', status: BillingStatus) => {
    if (status === 'all') return
    
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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(case_ => case_.billing_status === statusFilter)
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(case_ =>
        (case_.case_number?.toLowerCase().includes(term)) ||
        (case_.title?.toLowerCase().includes(term)) ||
        (case_.primary_assignee_name?.toLowerCase().includes(term)) ||
        (case_.kontaktperson?.toLowerCase().includes(term)) ||
        (case_.skadedjur?.toLowerCase().includes(term)) ||
        (case_.org_nr?.toLowerCase().includes(term))
      )
    }

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

  // 🎯 DISPLAYNAME FUNCTION - FIXAD FÖR FÖRETAG
  const getDisplayName = (case_: BillingCase) => {
    if (case_.type === 'business') {
      // För företag: Visa företagsnamn (title) istället för kontaktperson
      return case_.title || case_.kontaktperson || `BE-${case_.id.slice(0, 8)}`
    } else {
      // För privatpersoner: Visa kontaktperson som vanligt
      return case_.kontaktperson || case_.title || `BE-${case_.id.slice(0, 8)}`
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
              <h1 className="text-2xl font-bold text-white">Fakturering</h1>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner />
        </div>
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
              <h1 className="text-2xl font-bold text-white">Fakturering</h1>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="p-6">
            <div className="text-center">
              <X className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Fel vid laddning</h3>
              <p className="text-slate-400 mb-4">{error}</p>
              <Button onClick={fetchBillingCases}>
                Försök igen
              </Button>
            </div>
          </Card>
        </div>
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
                <p className="text-sm text-slate-400">
                  Hantera fakturering för avslutade ärenden • {cases.length} totala ärenden
                </p>
              </div>
            </div>
            
            <Button 
              onClick={fetchBillingCases}
              className="flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Uppdatera
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Väntar på fakturering</p>
                <p className="text-2xl font-bold text-yellow-400">{summary.pending.count}</p>
                <p className="text-xs text-slate-500">{formatCurrency(summary.pending.total)}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Faktura skickad</p>
                <p className="text-2xl font-bold text-blue-400">{summary.sent.count}</p>
                <p className="text-xs text-slate-500">{formatCurrency(summary.sent.total)}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-400" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Faktura betald</p>
                <p className="text-2xl font-bold text-green-400">{summary.paid.count}</p>
                <p className="text-xs text-slate-500">{formatCurrency(summary.paid.total)}</p>
              </div>
              <Check className="w-8 h-8 text-green-400" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Ska ej faktureras</p>
                <p className="text-2xl font-bold text-slate-400">{summary.skip.count}</p>
                <p className="text-xs text-slate-500">{formatCurrency(summary.skip.total)}</p>
              </div>
              <X className="w-8 h-8 text-slate-400" />
            </div>
          </Card>
        </div>

        {/* Filters och Controls */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all' as BillingStatus, label: `Alla (${cases.length})`, count: cases.length },
                { key: 'pending' as BillingStatus, label: `Väntar (${summary.pending.count})`, count: summary.pending.count },
                { key: 'sent' as BillingStatus, label: `Skickad (${summary.sent.count})`, count: summary.sent.count },
                { key: 'paid' as BillingStatus, label: `Betald (${summary.paid.count})`, count: summary.paid.count },
                { key: 'skip' as BillingStatus, label: `Ej faktura (${summary.skip.count})`, count: summary.skip.count }
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === key
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Sök efter ärende, tekniker, kund..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-80"
              />
            </div>
          </div>
        </Card>

        {/* Faktureringslista */}
        <Card>
          <div className="p-6 border-b border-slate-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Faktureringslista
              </h2>
              <p className="text-sm text-slate-400">
                {filteredAndSortedCases.length} ärenden visas
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">
                    <button 
                      onClick={() => handleSort('completed_date')}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Datum
                      {sortField === 'completed_date' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Ärende</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">
                    <button 
                      onClick={() => handleSort('primary_assignee_name')}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Tekniker
                      {sortField === 'primary_assignee_name' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Kund</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-slate-300">
                    <button 
                      onClick={() => handleSort('pris')}
                      className="flex items-center gap-1 hover:text-white ml-auto"
                    >
                      Att fakturera
                      {sortField === 'pris' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-300">
                    <button 
                      onClick={() => handleSort('billing_status')}
                      className="flex items-center gap-1 hover:text-white"
                    >
                      Status
                      {sortField === 'billing_status' && (
                        sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-slate-300">Åtgärder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAndSortedCases.map((case_) => (
                  <tr key={case_.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-300">
                        {new Date(case_.completed_date).toLocaleDateString('sv-SE')}
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          case_.type === 'private' ? 'bg-purple-500' : 'bg-blue-500'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {case_.case_number || case_.title || `BE-${case_.id.slice(0, 8)}`}
                          </div>
                          <div className="text-xs text-slate-400">
                            {case_.skadedjur} • {case_.type === 'private' ? 'Privatperson' : 'Företag'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-300">
                        {case_.primary_assignee_name}
                      </div>
                      {case_.primary_assignee_email && (
                        <div className="text-xs text-slate-400">
                          {case_.primary_assignee_email}
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="text-sm text-slate-300">
                        {getDisplayName(case_)}
                      </div>
                      {case_.type === 'business' && case_.org_nr && (
                        <div className="text-xs text-slate-400">
                          Org.nr: {case_.org_nr}
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 px-4 text-right">
                      <div className="text-sm font-medium text-white">
                        {formatCurrency(case_.type === 'private' ? case_.pris : case_.pris * 1.25)}
                      </div>
                      {case_.type === 'business' && (
                        <div className="text-xs text-slate-400">
                          {formatCurrency(case_.pris)} + moms
                        </div>
                      )}
                    </td>
                    
                    <td className="py-4 px-4 text-center">
                      {getBillingStatusBadge(case_.billing_status)}
                    </td>
                    
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {/* 🆕 UPPDATERAD LOGIC - TILLÅTER SENT→PENDING */}
                        {case_.billing_status === 'pending' && (
                          <button
                            onClick={() => updateBillingStatus(case_.id, case_.type, 'sent')}
                            disabled={isProcessing(case_.id)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Markera som skickad"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        )}
                        
                        {/* 🆕 SENT STATUS - KAN FLYTTA TILLBAKA TILL PENDING */}
                        {case_.billing_status === 'sent' && (
                          <button
                            onClick={() => updateBillingStatus(case_.id, case_.type, 'pending')}
                            disabled={isProcessing(case_.id)}
                            className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Flytta tillbaka till väntande"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        
                        {(case_.billing_status === 'pending' || case_.billing_status === 'sent') && (
                          <>
                            <button
                              onClick={() => updateBillingStatus(case_.id, case_.type, 'paid')}
                              disabled={isProcessing(case_.id)}
                              className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Markera som betald"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            
                            <button
                              onClick={() => updateBillingStatus(case_.id, case_.type, 'skip')}
                              disabled={isProcessing(case_.id)}
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
                            disabled={isProcessing(case_.id)}
                            className="p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Återställ till väntande"
                          >
                            <RotateCcw className="w-4 h-4" />
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
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedCases.length === 0 && (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">Inga ärenden hittades</h3>
              <p className="text-slate-400">
                {searchTerm ? 'Prova att ändra sökfilter eller rensa söktermen.' : 'Det finns inga ärenden med den valda statusen.'}
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Case Details Modal */}
      <CaseDetailsModal
        case_={selectedCase}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedCase(null)
        }}
      />
    </div>
  )
}

export default BillingManagement