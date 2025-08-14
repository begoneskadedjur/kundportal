import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
  X,
  ArrowLeft,
  Edit2,
  Settings,
  ChevronRight
} from 'lucide-react'
import { PageHeader } from '../../../components/shared'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import MultisiteRegistrationWizard from '../../../components/admin/multisite/MultisiteRegistrationWizard'
import OrganizationEditModal from '../../../components/admin/multisite/OrganizationEditModal'
import UserManagementPanel from '../../../components/admin/multisite/UserManagementPanel'
import SiteManagementPanel from '../../../components/admin/multisite/SiteManagementPanel'
import toast from 'react-hot-toast'

export default function OrganizationManagement() {
  const navigate = useNavigate()
  const location = useLocation()
  const [organizations, setOrganizations] = useState<MultisiteOrganization[]>([])
  const [sites, setSites] = useState<Record<string, OrganizationSite[]>>({})
  const [users, setUsers] = useState<Record<string, MultisiteUserRole[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<MultisiteOrganization | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editingOrg, setEditingOrg] = useState<MultisiteOrganization | null>(null)
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  // Handle navigation from organizations list
  useEffect(() => {
    if (location.state?.selectedOrgId) {
      setExpandedOrg(location.state.selectedOrgId)
      // Clear the state to prevent it from persisting
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Fetch organizations (huvudkontor customers)
      const { data: huvudkontorData, error: orgsError } = await supabase
        .from('customers')
        .select('*')
        .eq('site_type', 'huvudkontor')
        .eq('is_multisite', true)
        .order('company_name')

      if (orgsError) throw orgsError

      // Map customers to organization structure
      const orgs = (huvudkontorData || []).map(customer => ({
        id: customer.id, // Använd customer.id som huvudidentifierare
        organization_id: customer.organization_id, // Behåll organization_id separat
        name: customer.company_name,
        organization_number: customer.organization_number,
        billing_type: 'consolidated' as const,
        primary_contact_email: customer.contact_email,
        primary_contact_phone: customer.contact_phone,
        billing_address: customer.billing_address,
        is_active: customer.is_active,
        created_at: customer.created_at,
        updated_at: customer.updated_at
      }))

      setOrganizations(orgs)

      // Fetch sites for each organization
      if (orgs && orgs.length > 0) {
        const sitesData: Record<string, OrganizationSite[]> = {}
        const usersData: Record<string, MultisiteUserRole[]> = {}

        for (const org of orgs) {
          // Fetch sites (enhet customers)
          const { data: enhetData, error: sitesError } = await supabase
            .from('customers')
            .select('*')
            .eq('organization_id', org.organization_id) // Använd organization_id
            .eq('site_type', 'enhet')
            .eq('is_multisite', true) // Säkerställ multisite
            .order('site_name')

          if (!sitesError && enhetData) {
            // Map customers to site structure
            const orgSites = enhetData.map(customer => ({
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
            sitesData[org.id] = orgSites
          }

          // Fetch users
          const { data: orgUsers, error: usersError } = await supabase
            .from('multisite_user_roles')
            .select('*')
            .eq('organization_id', org.organization_id) // Använd organization_id

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
      // Vi måste ta bort i rätt ordning pga foreign key constraints
      
      // 1. Först ta bort alla enheter (de har parent_customer_id som pekar på huvudkontoret)
      const { error: sitesError } = await supabase
        .from('customers')
        .delete()
        .eq('organization_id', org.organization_id)
        .eq('site_type', 'enhet')

      if (sitesError) {
        console.error('Error deleting sites:', sitesError)
        throw new Error('Kunde inte ta bort enheter')
      }

      // 2. Ta bort alla användare/roller
      const { error: rolesError } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('organization_id', org.organization_id)

      if (rolesError) {
        console.error('Error deleting user roles:', rolesError)
        // Fortsätt ändå, detta är inte kritiskt
      }

      // 3. Nu kan vi ta bort huvudkontoret
      const { error: deleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', org.id)
        .eq('site_type', 'huvudkontor')

      if (deleteError) throw deleteError

      toast.success('Organisation och alla relaterade data borttagna')
      fetchOrganizations()
    } catch (error) {
      console.error('Error deleting organization:', error)
      toast.error('Kunde inte ta bort organisation')
    }
  }

  const handleToggleActive = async (org: MultisiteOrganization) => {
    try {
      // Update all customers for this organization
      const { error } = await supabase
        .from('customers')
        .update({ is_active: !org.is_active })
        .eq('organization_id', org.id)

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
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/admin/dashboard')}
              variant="secondary"
              size="sm"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Tillbaka
            </Button>
            <div className="w-px h-8 bg-slate-700" />
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
                          onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Visa detaljer"
                        >
                          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${
                            expandedOrg === org.id ? 'rotate-90' : ''
                          }`} />
                        </button>
                        <button
                          onClick={() => setEditingOrg(org)}
                          className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
                          title="Redigera organisation"
                        >
                          <Edit2 className="w-4 h-4 text-blue-400" />
                        </button>
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

                  {/* Expanded Details Panel */}
                  {expandedOrg === org.id && (
                    <div className="border-t border-slate-700 bg-slate-950/50">
                      <div className="p-6">
                        {/* Tab Navigation */}
                        <div className="flex gap-4 mb-6 border-b border-slate-700">
                          <button
                            onClick={() => setSelectedOrg(org)}
                            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                              selectedOrg?.id === org.id 
                                ? 'text-purple-400' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Användare
                            {selectedOrg?.id === org.id && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
                            )}
                          </button>
                          <button
                            onClick={() => setSelectedOrg(null)}
                            className={`pb-3 px-1 text-sm font-medium transition-colors relative ${
                              selectedOrg?.id !== org.id 
                                ? 'text-purple-400' 
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Anläggningar
                            {selectedOrg?.id !== org.id && (
                              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-400" />
                            )}
                          </button>
                        </div>

                        {/* Tab Content */}
                        {selectedOrg?.id === org.id ? (
                          <UserManagementPanel
                            organizationId={org.id}
                            organizationName={org.name}
                            onUpdate={fetchOrganizations}
                          />
                        ) : (
                          <SiteManagementPanel
                            organizationId={org.id}
                            onUpdate={fetchOrganizations}
                          />
                        )}
                      </div>
                    </div>
                  )}
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

      {/* Edit Organization Modal */}
      {editingOrg && (
        <OrganizationEditModal
          organization={editingOrg}
          onClose={() => setEditingOrg(null)}
          onSuccess={() => {
            fetchOrganizations()
            setEditingOrg(null)
          }}
        />
      )}
    </div>
  )
}