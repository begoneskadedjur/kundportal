import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { 
  MultisiteOrganization, 
  OrganizationSite,
  MultisiteUserRole 
} from '../../../types/multisite'
import {
  Building2,
  MapPin,
  Users,
  Plus,
  Trash2,
  Search,
  Filter,
  Mail,
  Phone,
  Receipt,
  AlertCircle,
  CheckCircle,
  XCircle,
  X
} from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import MultisiteRegistrationWizard from '../../../components/admin/multisite/MultisiteRegistrationWizard'
import toast from 'react-hot-toast'

export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState<MultisiteOrganization[]>([])
  const [sites, setSites] = useState<Record<string, OrganizationSite[]>>({})
  const [users, setUsers] = useState<Record<string, MultisiteUserRole[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<MultisiteOrganization | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Fetch organizations
      const { data: orgs, error: orgsError } = await supabase
        .from('multisite_organizations')
        .select('*')
        .order('name')

      if (orgsError) throw orgsError

      setOrganizations(orgs || [])

      // Fetch sites for each organization
      if (orgs && orgs.length > 0) {
        const sitesData: Record<string, OrganizationSite[]> = {}
        const usersData: Record<string, MultisiteUserRole[]> = {}

        for (const org of orgs) {
          // Fetch sites
          const { data: orgSites, error: sitesError } = await supabase
            .from('organization_sites')
            .select('*')
            .eq('organization_id', org.id)
            .order('site_name')

          if (!sitesError && orgSites) {
            sitesData[org.id] = orgSites
          }

          // Fetch users
          const { data: orgUsers, error: usersError } = await supabase
            .from('multisite_user_roles')
            .select('*')
            .eq('organization_id', org.id)

          if (!usersError && orgUsers) {
            usersData[org.id] = orgUsers
          }
        }

        setSites(sitesData)
        setUsers(usersData)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Kunde inte hämta organisationer')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOrganization = async (org: MultisiteOrganization) => {
    if (!confirm(`Är du säker på att du vill ta bort ${org.name}? Detta kommer även ta bort alla sites och användare.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('multisite_organizations')
        .delete()
        .eq('id', org.id)

      if (error) throw error

      toast.success('Organisation borttagen')
      fetchOrganizations()
    } catch (error) {
      console.error('Error deleting organization:', error)
      toast.error('Kunde inte ta bort organisation')
    }
  }

  const handleToggleActive = async (org: MultisiteOrganization) => {
    try {
      const { error } = await supabase
        .from('multisite_organizations')
        .update({ is_active: !org.is_active })
        .eq('id', org.id)

      if (error) throw error

      toast.success(`Organisation ${org.is_active ? 'inaktiverad' : 'aktiverad'}`)
      fetchOrganizations()
    } catch (error) {
      console.error('Error toggling organization:', error)
      toast.error('Kunde inte uppdatera organisation')
    }
  }

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.organization_number?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Multisite-organisationer"
          description="Hantera organisationer med flera anläggningar"
          icon={Building2}
        />

        {/* Action Bar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Sök organisation..."
                className="pl-10"
              />
            </div>
          </div>
          <Button
            onClick={() => setWizardOpen(true)}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ny organisation
          </Button>
        </div>

        {/* Organizations Grid */}
        {filteredOrganizations.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Inga organisationer hittades
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm ? 'Prova att ändra din sökning' : 'Kom igång genom att skapa din första multisite-organisation'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setWizardOpen(true)}
                variant="primary"
                className="mx-auto flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Skapa första organisationen
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOrganizations.map(org => {
              const orgSites = sites[org.id] || []
              const orgUsers = users[org.id] || []
              
              return (
                <Card key={org.id} className="overflow-hidden">
                  {/* Organization Header */}
                  <div className="p-6 border-b border-slate-700">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          org.is_active ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          <Building2 className={`w-5 h-5 ${
                            org.is_active ? 'text-green-400' : 'text-red-400'
                          }`} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {org.name}
                          </h3>
                          {org.organization_number && (
                            <p className="text-sm text-slate-400">
                              Org.nr: {org.organization_number}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(org)}
                          className={`p-2 rounded-lg transition-colors ${
                            org.is_active 
                              ? 'hover:bg-slate-700 text-slate-400' 
                              : 'hover:bg-green-500/20 text-green-400'
                          }`}
                          title={org.is_active ? 'Inaktivera' : 'Aktivera'}
                        >
                          {org.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        {/* Redigera-knapp temporärt borttagen tills redigeringsfunktionalitet implementeras */}
                        <button
                          onClick={() => handleDeleteOrganization(org)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Ta bort"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-2 text-sm">
                      {org.primary_contact_email && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Mail className="w-4 h-4" />
                          <span>{org.primary_contact_email}</span>
                        </div>
                      )}
                      {org.primary_contact_phone && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Phone className="w-4 h-4" />
                          <span>{org.primary_contact_phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-400">
                        <Receipt className="w-4 h-4" />
                        <span>
                          Fakturering: {org.billing_type === 'consolidated' ? 'Konsoliderad' : 'Per anläggning'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-6 grid grid-cols-2 gap-4">
                    {/* Sites */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-slate-300">Anläggningar</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {orgSites.length}
                      </div>
                      {orgSites.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {orgSites.slice(0, 3).map(site => (
                            <div key={site.id} className="text-xs text-slate-500 truncate">
                              • {site.site_name}
                            </div>
                          ))}
                          {orgSites.length > 3 && (
                            <div className="text-xs text-slate-500">
                              +{orgSites.length - 3} till...
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Users */}
                    <div className="bg-slate-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Users className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-medium text-slate-300">Användare</span>
                      </div>
                      <div className="text-2xl font-bold text-white">
                        {orgUsers.length}
                      </div>
                      {orgUsers.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-slate-500">
                            {orgUsers.filter(u => u.role_type === 'verksamhetschef').length} Verksamhetschef
                          </div>
                          <div className="text-xs text-slate-500">
                            {orgUsers.filter(u => u.role_type === 'regionchef').length} Regionchef
                          </div>
                          <div className="text-xs text-slate-500">
                            {orgUsers.filter(u => u.role_type === 'platsansvarig').length} Platsansvarig
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Registration Wizard - Conditionally rendered */}
      {wizardOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Registrera Multisite-organisation</h2>
              <button
                onClick={() => setWizardOpen(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <MultisiteRegistrationWizard
                onSuccess={() => {
                  setWizardOpen(false)
                  fetchOrganizations()
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}