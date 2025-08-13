import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { OrganizationSite } from '../../types/multisite'
import { Building2, MapPin, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface SiteSelectorProps {
  organizationId: string | null
  value: string | null
  onChange: (siteId: string | null) => void
  disabled?: boolean
  required?: boolean
  className?: string
  showRegion?: boolean
  placeholder?: string
}

export default function SiteSelector({
  organizationId,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  showRegion = true,
  placeholder = 'Välj anläggning...'
}: SiteSelectorProps) {
  const [sites, setSites] = useState<OrganizationSite[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (organizationId) {
      fetchSites()
    } else {
      setSites([])
    }
  }, [organizationId])

  const fetchSites = async () => {
    if (!organizationId) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('site_type', 'enhet')
        .eq('is_active', true)
        .order('region', { ascending: true })
        .order('site_name', { ascending: true })

      if (error) throw error
      
      // Map customer data to OrganizationSite structure
      const sites = (data || []).map(customer => ({
        id: customer.id,
        organization_id: customer.organization_id,
        site_name: customer.site_name || customer.company_name,
        site_code: customer.site_code,
        address: customer.contact_address,
        region: customer.region,
        contact_person: customer.contact_person,
        contact_email: customer.contact_email,
        contact_phone: customer.contact_phone,
        customer_id: customer.id,
        is_primary: false,
        is_active: customer.is_active,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }))
      
      setSites(sites)
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Kunde inte hämta anläggningar')
    } finally {
      setLoading(false)
    }
  }

  const filteredSites = sites.filter(site => {
    const search = searchTerm.toLowerCase()
    return (
      site.site_name.toLowerCase().includes(search) ||
      site.site_code?.toLowerCase().includes(search) ||
      site.address?.toLowerCase().includes(search) ||
      site.region?.toLowerCase().includes(search)
    )
  })

  // Group sites by region
  const sitesByRegion = filteredSites.reduce((acc, site) => {
    const region = site.region || 'Övriga'
    if (!acc[region]) {
      acc[region] = []
    }
    acc[region].push(site)
    return acc
  }, {} as Record<string, OrganizationSite[]>)

  const selectedSite = sites.find(s => s.id === value)

  if (!organizationId) {
    return null
  }

  if (loading) {
    return (
      <div className={`w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 ${className}`}>
        Laddar anläggningar...
      </div>
    )
  }

  if (sites.length === 0) {
    return (
      <div className={`w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-500 ${className}`}>
        Inga anläggningar hittades
      </div>
    )
  }

  // If only one site, auto-select it
  if (sites.length === 1 && !value) {
    onChange(sites[0].id)
    return (
      <div className={`w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white ${className}`}>
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          <span>{sites[0].site_name}</span>
          {sites[0].site_code && (
            <span className="text-slate-500">({sites[0].site_code})</span>
          )}
        </div>
      </div>
    )
  }

  // Custom dropdown for better control
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2 bg-slate-800/50 border rounded-lg text-left flex items-center justify-between transition-colors ${
          disabled 
            ? 'border-slate-700 text-slate-500 cursor-not-allowed' 
            : 'border-slate-700 text-white hover:border-purple-500 focus:outline-none focus:border-purple-500'
        }`}
      >
        {selectedSite ? (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span>{selectedSite.site_name}</span>
            {selectedSite.site_code && (
              <span className="text-slate-500">({selectedSite.site_code})</span>
            )}
          </div>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {/* Search field for many sites */}
          {sites.length > 5 && (
            <div className="p-2 border-b border-slate-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Sök anläggning..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-md text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div className="max-h-60 overflow-y-auto">
            {Object.entries(sitesByRegion).map(([region, regionSites]) => (
              <div key={region}>
                {showRegion && Object.keys(sitesByRegion).length > 1 && (
                  <div className="px-3 py-1 bg-slate-700/30 text-xs font-semibold text-slate-400 sticky top-0">
                    {region}
                  </div>
                )}
                {regionSites.map(site => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      onChange(site.id)
                      setIsOpen(false)
                      setSearchTerm('')
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-slate-700/50 transition-colors flex items-start gap-2 ${
                      value === site.id ? 'bg-purple-500/20 text-purple-300' : 'text-white'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{site.site_name}</span>
                        {site.site_code && (
                          <span className="text-sm text-slate-500">({site.site_code})</span>
                        )}
                        {site.is_primary && (
                          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                            Primär
                          </span>
                        )}
                      </div>
                      {site.address && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-400">{site.address}</span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {filteredSites.length === 0 && (
              <div className="px-3 py-4 text-center text-slate-500">
                Inga anläggningar matchar sökningen
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}