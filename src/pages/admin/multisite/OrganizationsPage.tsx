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
  ChevronDown,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
  UserPlus,
  Shield,
  UserCheck,
  Key
} from 'lucide-react'
import Input from '../../../components/ui/Input'
import OrganizationEditModal from '../../../components/admin/multisite/OrganizationEditModal'
import UserModal from '../../../components/admin/multisite/UserModal'
import { useAuth } from '../../../contexts/AuthContext'

interface Organization {
  id: string
  name: string
  organization_number: string
  organization_id?: string
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

interface OrganizationUser {
  id: string
  user_id: string
  organization_id: string
  role_type: string
  is_active: boolean
  created_at: string
  email?: string
  name?: string
  phone?: string
  site_ids?: string[]
}

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])
  const [organizationUsers, setOrganizationUsers] = useState<Record<string, OrganizationUser[]>>({})
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<OrganizationUser | null>(null)

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
      // Hämta organisationer (huvudkontor från customers)
      const { data: orgs, error: orgsError } = await supabase
        .from('customers')
        .select('*')
        .eq('site_type', 'huvudkontor')
        .eq('is_multisite', true)
        .order('created_at', { ascending: false })

      if (orgsError) throw orgsError

      // Hämta statistik för varje organisation
      if (orgs && orgs.length > 0) {
        const orgsWithStats = await Promise.all(orgs.map(async (org) => {
          // Hämta antal sites (enheter från customers)
          const { count: sitesCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.organization_id)
            .eq('site_type', 'enhet')
            .eq('is_multisite', true)
            .eq('is_active', true)

          // Hämta antal användare
          const { count: usersCount } = await supabase
            .from('multisite_user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.organization_id)

          return {
            id: org.id,
            name: org.company_name,
            organization_number: org.organization_number || '',
            billing_address: org.billing_address || org.contact_address || '',
            billing_email: org.billing_email || org.contact_email || '',
            billing_method: 'consolidated' as const,
            is_active: org.is_active !== false,
            created_at: org.created_at,
            updated_at: org.updated_at,
            organization_id: org.organization_id,
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
      // Först måste vi hämta organization_id från huvudkontoret
      const { data: huvudkontor, error: hkError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', org.id)
        .eq('site_type', 'huvudkontor')
        .single()

      if (hkError || !huvudkontor) {
        throw new Error('Kunde inte hitta organisation')
      }

      const organizationId = huvudkontor.organization_id

      // 1. Ta bort alla enheter först (de har parent_customer_id som pekar på huvudkontoret)
      const { error: sitesError } = await supabase
        .from('customers')
        .delete()
        .eq('organization_id', organizationId)
        .eq('site_type', 'enhet')

      if (sitesError) {
        console.error('Error deleting sites:', sitesError)
        throw new Error('Kunde inte ta bort enheter')
      }

      // 2. Ta bort alla användare/roller
      const { error: rolesError } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('organization_id', organizationId)

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

  const handleToggleActive = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('customers')
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

  const fetchOrganizationUsers = async (orgId: string, organizationId: string) => {
    try {
      // Hämta användare från den nya viewen som kombinerar all data
      const { data: users, error } = await supabase
        .from('multisite_users_complete')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Formatera användardata
      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        user_id: user.user_id,
        organization_id: user.organization_id,
        role_type: user.role_type,
        site_ids: user.site_ids,
        is_active: user.is_active,
        created_at: user.created_at,
        email: user.email || 'Okänd email',
        name: user.display_name || 'Okänt namn',
        phone: user.phone || null,
        last_sign_in_at: user.last_sign_in_at
      }))

      setOrganizationUsers(prev => ({
        ...prev,
        [orgId]: formattedUsers
      }))
    } catch (error) {
      console.error('Error fetching organization users:', error)
      toast.error('Kunde inte hämta användare')
    }
  }

  const handleToggleExpand = async (org: Organization) => {
    if (expandedOrgId === org.id) {
      setExpandedOrgId(null)
    } else {
      setExpandedOrgId(org.id)
      // Hämta användare om vi inte redan har dem
      if (!organizationUsers[org.id] && org.organization_id) {
        await fetchOrganizationUsers(org.id, org.organization_id)
      }
    }
  }

  const handleAddUser = (org: Organization) => {
    setSelectedOrg(org)
    setEditingUser(null)
    setShowUserModal(true)
  }

  const handleEditUser = (org: Organization, user: OrganizationUser) => {
    setSelectedOrg(org)
    setEditingUser(user)
    setShowUserModal(true)
  }

  const handleDeleteUser = async (orgId: string, userId: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna användare?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('id', userId)

      if (error) throw error

      toast.success('Användare borttagen')
      
      // Uppdatera lokal state
      setOrganizationUsers(prev => ({
        ...prev,
        [orgId]: prev[orgId].filter(u => u.id !== userId)
      }))
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Kunde inte ta bort användare')
    }
  }

  const handleResetPassword = async (email: string, userName: string) => {
    if (!confirm(`Vill du skicka lösenordsåterställning till ${userName}?`)) {
      return
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error

      toast.success(`Lösenordsåterställning skickad till ${email}`)
    } catch (error) {
      console.error('Error sending password reset:', error)
      toast.error('Kunde inte skicka lösenordsåterställning')
    }
  }

  const getRoleName = (roleType: string) => {
    const roleNames: Record<string, string> = {
      'verksamhetschef': 'Verksamhetschef',
      'quality_manager': 'Verksamhetschef',
      'regionchef': 'Regionchef',
      'regional_manager': 'Regionchef',
      'platsansvarig': 'Platsansvarig',
      'site_manager': 'Platsansvarig'
    }
    return roleNames[roleType] || roleType
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
                className={`${!org.is_active ? 'opacity-60' : ''}`}
              >
                {/* Klickbar header-sektion */}
                <div 
                  className="p-6 hover:bg-slate-800/50 transition-colors cursor-pointer"
                  onClick={() => handleToggleExpand(org)}
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

                  <div className="flex items-center gap-2">
                    {/* Expand/Collapse ikon */}
                    <div className="p-2 text-slate-400">
                      {expandedOrgId === org.id ? (
                        <ChevronDown className="w-5 h-5" />
                      ) : (
                        <ChevronRight className="w-5 h-5" />
                      )}
                    </div>
                    
                    {/* Åtgärdsknappar */}
                    <div onClick={(e) => e.stopPropagation()} className="flex gap-1">
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
                    </div>
                  </div>
                </div>
                </div>

                {/* Expanderad användarsektion */}
                {expandedOrgId === org.id && (
                  <div className="border-t border-slate-700 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-400" />
                        Användare
                      </h4>
                      <Button
                        onClick={() => handleAddUser(org)}
                        variant="primary"
                        size="sm"
                        className="flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        Lägg till användare
                      </Button>
                    </div>

                    {/* Användarlista */}
                    {organizationUsers[org.id] ? (
                      organizationUsers[org.id].length > 0 ? (
                        <div className="space-y-3">
                          {organizationUsers[org.id].map(user => (
                            <div
                              key={user.id}
                              className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-500/20 rounded-lg">
                                  <UserCheck className="w-4 h-4 text-purple-400" />
                                </div>
                                <div>
                                  <p className="text-white font-medium">{user.name}</p>
                                  <p className="text-sm text-slate-400">{user.email}</p>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  <Shield className="w-4 h-4 text-blue-400" />
                                  <span className="text-sm text-blue-400">
                                    {getRoleName(user.role_type)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleResetPassword(user.email, user.name)}
                                  className="p-2 hover:bg-purple-500/20 rounded-lg transition-colors"
                                  title="Skicka lösenordsåterställning"
                                >
                                  <Key className="w-4 h-4 text-purple-400" />
                                </button>
                                <button
                                  onClick={() => handleEditUser(org, user)}
                                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                  title="Redigera"
                                >
                                  <Edit2 className="w-4 h-4 text-slate-400" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(org.id, user.id)}
                                  className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                  title="Ta bort"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                          <p className="text-slate-400">Inga användare registrerade</p>
                          <p className="text-sm text-slate-500 mt-1">
                            Klicka på "Lägg till användare" för att bjuda in användare
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
                        <p className="text-slate-400 mt-2">Laddar användare...</p>
                      </div>
                    )}

                    {/* Visa/Hantera-knapp */}
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <Button
                        onClick={() => handleViewDetails(org.id)}
                        variant="outline"
                        className="w-full flex items-center justify-center gap-2"
                      >
                        Visa fullständig organisationshantering
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
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

      {/* User Modal */}
      {showUserModal && selectedOrg && (
        <UserModal
          isOpen={showUserModal}
          onClose={() => {
            setShowUserModal(false)
            setEditingUser(null)
          }}
          onSuccess={() => {
            setShowUserModal(false)
            setEditingUser(null)
            if (selectedOrg.organization_id) {
              fetchOrganizationUsers(selectedOrg.id, selectedOrg.organization_id)
            }
          }}
          organizationId={selectedOrg.id}
          organizationName={selectedOrg.name}
          existingUser={editingUser}
        />
      )}
    </div>
  )
}