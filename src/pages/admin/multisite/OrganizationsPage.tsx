import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { PageHeader } from '../../../components/shared'
import Button from '../../../components/ui/Button'
import Card from '../../../components/ui/Card'
import toast from 'react-hot-toast'
import { 
  Building2, 
  Users, 
  MapPin, 
  Edit2, 
  Trash2, 
  Plus,
  Search,
  Filter,
  ChevronRight,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import Input from '../../../components/ui/Input'
import OrganizationEditModal from '../../../components/admin/multisite/OrganizationEditModal'
import { useAuth } from '../../../contexts/AuthContext'

interface Organization {
  id: string
  name: string
  organization_number: string
  billing_address: string
  billing_email: string
  billing_method: 'consolidated' | 'per_site'
  is_active: boolean
  created_at: string
  updated_at: string
  sites_count?: number
  users_count?: number
  total_value?: number
}

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    fetchOrganizations()
  }, [])

  useEffect(() => {
    // Filtrera organisationer baserat på sökterm
    if (searchTerm) {
      const filtered = organizations.filter(org => 
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.organization_number.includes(searchTerm) ||
        org.billing_email.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredOrganizations(filtered)
    } else {
      setFilteredOrganizations(organizations)
    }
  }, [searchTerm, organizations])

  const fetchOrganizations = async () => {
    setLoading(true)
    try {
      // Hämta organisationer
      const { data: orgs, error: orgsError } = await supabase
        .from('multisite_organizations')
        .select('*')
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      // Hämta statistik för varje organisation
      if (orgs && orgs.length > 0) {
        const orgsWithStats = await Promise.all(orgs.map(async (org) => {
          // Hämta antal sites
          const { count: sitesCount } = await supabase
            .from('organization_sites')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('is_active', true)

          // Hämta antal användare
          const { count: usersCount } = await supabase
            .from('multisite_user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)

          return {
            ...org,
            sites_count: sitesCount || 0,
            users_count: usersCount || 0,
            total_value: org.total_contract_value || 0
          }
        }))

        setOrganizations(orgsWithStats)
        setFilteredOrganizations(orgsWithStats)
      } else {
        setOrganizations([])
        setFilteredOrganizations([])
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast.error('Kunde inte hämta organisationer')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteOrganization = async (org: Organization) => {
    if (!confirm(`Är du säker på att du vill ta bort ${org.name}? Detta kommer även ta bort alla anläggningar och användare.`)) {
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

  const handleToggleActive = async (org: Organization) => {
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

  const handleEditOrganization = (org: Organization) => {
    setSelectedOrg(org)
    setShowEditModal(true)
  }

  const handleViewDetails = (orgId: string) => {
    // Navigate to the management page with the organization details
    const basePath = profile?.role === 'admin' ? '/admin' : '/koordinator'
    navigate(`${basePath}/organisation/organizations-manage`, { state: { selectedOrgId: orgId } })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader 
          title="Multisite-organisationer" 
          description="Hantera organisationer med flera anläggningar"
        />

        {/* Actions Bar */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Sök organisation, org.nr eller e-post..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            onClick={() => navigate('/admin/organisation/register')}
            variant="primary"
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Ny Organisation
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt organisationer</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.length}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-purple-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt anläggningar</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.reduce((sum, org) => sum + (org.sites_count || 0), 0)}
                </p>
              </div>
              <MapPin className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Totalt användare</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organizations.reduce((sum, org) => sum + (org.users_count || 0), 0)}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Organizations List */}
        {filteredOrganizations.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {searchTerm ? 'Inga organisationer hittades' : 'Inga organisationer än'}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchTerm 
                ? 'Prova att justera din sökning' 
                : 'Börja med att registrera din första multisite-organisation'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => navigate('/admin/organisation/register')}
                variant="primary"
                className="flex items-center gap-2 mx-auto"
              >
                <Plus className="w-4 h-4" />
                Registrera Organisation
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredOrganizations.map((org) => (
              <Card 
                key={org.id} 
                className={`p-6 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                  !org.is_active ? 'opacity-60' : ''
                }`}
                onClick={() => handleViewDetails(org.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        org.is_active 
                          ? 'bg-purple-500/20 text-purple-400' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          {org.name}
                          {!org.is_active && (
                            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">
                              Inaktiv
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-slate-400">
                          Org.nr: {org.organization_number}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <MapPin className="w-4 h-4" />
                        <span>{org.sites_count || 0} anläggningar</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Users className="w-4 h-4" />
                        <span>{org.users_count || 0} användare</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <TrendingUp className="w-4 h-4" />
                        <span>
                          {org.billing_method === 'consolidated' 
                            ? 'Konsoliderad fakturering' 
                            : 'Per-site fakturering'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-4 h-4" />
                        <span>{org.billing_email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>Skapad {new Date(org.created_at).toLocaleDateString('sv-SE')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleToggleActive(org)}
                      className={`p-2 rounded-lg transition-colors ${
                        org.is_active 
                          ? 'hover:bg-slate-700 text-slate-400' 
                          : 'hover:bg-green-500/20 text-green-400'
                      }`}
                      title={org.is_active ? 'Inaktivera' : 'Aktivera'}
                    >
                      {org.is_active ? <XCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleEditOrganization(org)}
                      className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Redigera"
                    >
                      <Edit2 className="w-5 h-5 text-blue-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteOrganization(org)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Ta bort"
                    >
                      <Trash2 className="w-5 h-5 text-red-400" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-400 ml-2" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {showEditModal && selectedOrg && (
        <OrganizationEditModal
          organization={selectedOrg}
          onClose={() => {
            setShowEditModal(false)
            setSelectedOrg(null)
          }}
          onUpdate={() => {
            setShowEditModal(false)
            setSelectedOrg(null)
            fetchOrganizations()
          }}
        />
      )}
    </div>
  )
}