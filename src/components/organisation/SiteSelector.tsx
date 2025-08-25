// src/components/organisation/SiteSelector.tsx - Site selection component for multisite statistics
import React, { useState, useEffect } from 'react'
import { MapPin, ChevronDown, Check, Building, Users, Filter } from 'lucide-react'
import { OrganizationSite } from '../../types/multisite'
import Card from '../ui/Card'

interface SiteSelectorProps {
  sites: OrganizationSite[]
  selectedSiteIds: string[]
  onSelectionChange: (siteIds: string[]) => void
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  organizationName: string
  disabled?: boolean
}

interface RegionGroup {
  region: string
  sites: OrganizationSite[]
}

const SiteSelector: React.FC<SiteSelectorProps> = ({
  sites,
  selectedSiteIds,
  onSelectionChange,
  userRoleType,
  organizationName,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [regionGroups, setRegionGroups] = useState<RegionGroup[]>([])

  // Group sites by region
  useEffect(() => {
    const grouped = sites.reduce((acc, site) => {
      const region = site.region || 'Övriga'
      if (!acc[region]) {
        acc[region] = []
      }
      acc[region].push(site)
      return acc
    }, {} as Record<string, OrganizationSite[]>)

    const groups = Object.entries(grouped)
      .map(([region, regionSites]) => ({ region, sites: regionSites }))
      .sort((a, b) => {
        // Prioritera 'Övriga' sist
        if (a.region === 'Övriga') return 1
        if (b.region === 'Övriga') return -1
        return a.region.localeCompare(b.region)
      })

    setRegionGroups(groups)
  }, [sites])

  const handleSiteToggle = (siteId: string) => {
    if (disabled) return
    
    if (selectedSiteIds.includes('all')) {
      // Om 'all' är valt, ersätt med bara denna site
      onSelectionChange([siteId])
    } else if (selectedSiteIds.includes(siteId)) {
      // Ta bort denna site från urval
      const newSelection = selectedSiteIds.filter(id => id !== siteId)
      // Om ingen site är vald, välj 'all'
      if (newSelection.length === 0) {
        onSelectionChange(['all'])
      } else {
        onSelectionChange(newSelection)
      }
    } else {
      // Lägg till denna site till urval
      onSelectionChange([...selectedSiteIds.filter(id => id !== 'all'), siteId])
    }
  }

  const handleSelectAll = () => {
    if (disabled) return
    onSelectionChange(['all'])
    setIsOpen(false)
  }

  const handleRegionToggle = (region: string) => {
    if (disabled) return
    
    const regionSiteIds = regionGroups.find(g => g.region === region)?.sites.map(s => s.id) || []
    const allRegionSitesSelected = regionSiteIds.every(id => selectedSiteIds.includes(id))
    
    if (allRegionSitesSelected) {
      // Ta bort alla sites i regionen
      const newSelection = selectedSiteIds.filter(id => !regionSiteIds.includes(id))
      if (newSelection.length === 0) {
        onSelectionChange(['all'])
      } else {
        onSelectionChange(newSelection)
      }
    } else {
      // Lägg till alla sites i regionen
      const newSelection = [...new Set([...selectedSiteIds.filter(id => id !== 'all'), ...regionSiteIds])]
      onSelectionChange(newSelection)
    }
  }

  const getSelectionText = () => {
    if (selectedSiteIds.includes('all')) {
      switch (userRoleType) {
        case 'verksamhetschef': return 'Alla enheter'
        case 'regionchef': return 'Alla enheter i regionen'
        case 'platsansvarig': return 'Min enhet'
        default: return 'Alla enheter'
      }
    }
    
    if (selectedSiteIds.length === 1) {
      const site = sites.find(s => s.id === selectedSiteIds[0])
      return site ? site.site_name : 'Okänd enhet'
    }
    
    return `${selectedSiteIds.length} enheter valda`
  }

  const getSelectionCount = () => {
    if (selectedSiteIds.includes('all')) {
      return sites.length
    }
    return selectedSiteIds.length
  }

  // Om platsansvarig med bara en site, visa inte väljaren
  if (userRoleType === 'platsansvarig' && sites.length <= 1) {
    return null
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <div className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <label className="text-slate-300 font-medium">Enhetsval:</label>
          </div>
          
          <div className="flex-1 relative">
            <button
              onClick={() => !disabled && setIsOpen(!isOpen)}
              disabled={disabled}
              className={`
                w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white 
                focus:outline-none focus:ring-2 focus:ring-purple-500 text-left
                flex items-center justify-between
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-600 transition-colors'}
              `}
            >
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-400" />
                <span>{getSelectionText()}</span>
                <span className="text-slate-400 text-sm">({getSelectionCount()})</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 border border-slate-600 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                {/* Select All Option */}
                <button
                  onClick={handleSelectAll}
                  className="w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors flex items-center gap-3 border-b border-slate-600"
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedSiteIds.includes('all') 
                      ? 'bg-purple-500 border-purple-500' 
                      : 'border-slate-500'
                  }`}>
                    {selectedSiteIds.includes('all') && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <Users className="w-4 h-4 text-purple-400" />
                  <div>
                    <div className="text-white font-medium">
                      {userRoleType === 'verksamhetschef' && 'Alla enheter'}
                      {userRoleType === 'regionchef' && 'Alla enheter i regionen'}
                      {userRoleType === 'platsansvarig' && 'Min enhet'}
                    </div>
                    <div className="text-slate-400 text-sm">
                      {sites.length} {sites.length === 1 ? 'enhet' : 'enheter'}
                    </div>
                  </div>
                </button>

                {/* Region Groups */}
                {regionGroups.map((group) => (
                  <div key={group.region}>
                    {/* Region Header (if more than one region) */}
                    {regionGroups.length > 1 && (
                      <div className="px-4 py-2 bg-slate-800 border-b border-slate-600">
                        <button
                          onClick={() => handleRegionToggle(group.region)}
                          className="flex items-center gap-3 text-slate-300 hover:text-white transition-colors w-full text-left"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            group.sites.every(site => selectedSiteIds.includes(site.id))
                              ? 'bg-blue-500 border-blue-500' 
                              : group.sites.some(site => selectedSiteIds.includes(site.id))
                              ? 'bg-blue-500/50 border-blue-500'
                              : 'border-slate-500'
                          }`}>
                            {group.sites.every(site => selectedSiteIds.includes(site.id)) && 
                              <Check className="w-3 h-3 text-white" />
                            }
                          </div>
                          <Filter className="w-4 h-4 text-blue-400" />
                          <span className="font-medium">{group.region}</span>
                          <span className="text-slate-400 text-sm">({group.sites.length})</span>
                        </button>
                      </div>
                    )}

                    {/* Sites in Region */}
                    {group.sites.map((site) => (
                      <button
                        key={site.id}
                        onClick={() => handleSiteToggle(site.id)}
                        className="w-full px-6 py-3 text-left hover:bg-slate-600 transition-colors flex items-center gap-3"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedSiteIds.includes(site.id) || selectedSiteIds.includes('all')
                            ? 'bg-emerald-500 border-emerald-500' 
                            : 'border-slate-500'
                        }`}>
                          {(selectedSiteIds.includes(site.id) || selectedSiteIds.includes('all')) && 
                            <Check className="w-3 h-3 text-white" />
                          }
                        </div>
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <div className="flex-1">
                          <div className="text-white">{site.site_name}</div>
                          {site.address && (
                            <div className="text-slate-400 text-sm">{site.address}</div>
                          )}
                        </div>
                        {site.customer_id && (
                          <div className="text-emerald-400 text-xs">Länkad</div>
                        )}
                      </button>
                    ))}
                  </div>
                ))}

                {/* Footer Info */}
                <div className="px-4 py-2 bg-slate-800 text-slate-400 text-xs border-t border-slate-600">
                  {selectedSiteIds.includes('all') 
                    ? `Analyserar alla ${sites.length} enheter`
                    : `${selectedSiteIds.length} av ${sites.length} enheter valda`
                  }
                </div>
              </div>
            )}
          </div>

          {/* Clear Selection Button (if not all selected) */}
          {!selectedSiteIds.includes('all') && selectedSiteIds.length > 0 && (
            <button
              onClick={() => onSelectionChange(['all'])}
              disabled={disabled}
              className="px-3 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              title="Återställ till alla enheter"
            >
              Rensa
            </button>
          )}
        </div>

        {/* Selection Summary */}
        {!selectedSiteIds.includes('all') && selectedSiteIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700">
            <div className="text-sm text-slate-400 mb-2">Valda enheter:</div>
            <div className="flex flex-wrap gap-2">
              {selectedSiteIds.map((siteId) => {
                const site = sites.find(s => s.id === siteId)
                if (!site) return null
                return (
                  <span
                    key={siteId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-full border border-purple-500/30"
                  >
                    {site.site_name}
                    <button
                      onClick={() => handleSiteToggle(siteId)}
                      className="ml-1 hover:text-purple-100 transition-colors"
                      title="Ta bort från urval"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </Card>
  )
}

export default SiteSelector