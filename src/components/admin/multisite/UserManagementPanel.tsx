import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { MultisiteUserRole, MultisiteUserRoleType } from '../../../types/multisite'
import {
  Users,
  Edit2,
  Trash2,
  Mail,
  UserPlus,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Loader2,
  Shield,
  MapPin,
  Building
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import toast from 'react-hot-toast'

interface UserManagementPanelProps {
  organizationId: string
  organizationName: string
  onUpdate: () => void
}

interface UserWithProfile extends MultisiteUserRole {
  profile?: {
    email?: string
    name?: string
    last_login?: string
  }
  invitation_status?: 'pending' | 'accepted' | 'expired'
}

export default function UserManagementPanel({
  organizationId,
  organizationName,
  onUpdate
}: UserManagementPanelProps) {
  const [users, setUsers] = useState<UserWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'platsansvarig' as MultisiteUserRoleType
  })
  const [selectedTab, setSelectedTab] = useState<'users' | 'invitations'>('users')

  useEffect(() => {
    fetchUsers()
  }, [organizationId])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      // Hämta användare med roller
      const { data: userRoles, error: rolesError } = await supabase
        .from('multisite_user_roles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at')

      if (rolesError) throw rolesError

      // Hämta profiler för användarna
      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map(ur => ur.user_id)
        
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, email')
          .in('user_id', userIds)

        if (profilesError) throw profilesError

        // Hämta användardetaljer från backend API
        let usersMetadata: any[] = []
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            const response = await fetch('/api/multisite-users', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                action: 'getUsersInfo',
                userIds,
                organizationId
              })
            })

            if (response.ok) {
              const data = await response.json()
              usersMetadata = data.users || []
            }
          }
        } catch (error) {
          console.log('Could not fetch users metadata:', error)
        }

        // Kombinera data
        const usersWithProfiles = await Promise.all(userRoles.map(async (userRole) => {
          const profile = profiles?.find(p => p.user_id === userRole.user_id)
          const userMeta = usersMetadata.find(u => u.user_id === userRole.user_id)

          // Hämta inbjudningsstatus (ignorera fel)
          let invitationStatus: 'pending' | 'accepted' | 'expired' = 'accepted'
          try {
            const { data: invitation } = await supabase
              .from('multisite_user_invitations')
              .select('accepted_at, expires_at')
              .eq('organization_id', organizationId)
              .eq('email', profile?.email || userMeta?.email || '')
              .single()

            if (invitation) {
              if (invitation.accepted_at) {
                invitationStatus = 'accepted'
              } else if (new Date(invitation.expires_at) < new Date()) {
                invitationStatus = 'expired'
              } else {
                invitationStatus = 'pending'
              }
            }
          } catch (err) {
            // Ignorera fel från invitation query
            console.log('Could not fetch invitation status')
          }

          return {
            ...userRole,
            profile: {
              email: profile?.email || userMeta?.email,
              name: userMeta?.name || 'Okänd användare',
              last_login: userMeta?.last_sign_in_at
            },
            invitation_status: invitationStatus
          }
        }))

        setUsers(usersWithProfiles)
      } else {
        setUsers([])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('Kunde inte hämta användare')
    } finally {
      setLoading(false)
    }
  }

  const handleSendInvitation = async (user: UserWithProfile) => {
    if (!user.profile?.email) {
      toast.error('Användaren saknar e-postadress')
      return
    }

    setSendingInvite(user.id)
    try {
      const response = await fetch('/api/send-multisite-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          organizationName,
          email: user.profile.email,
          name: user.profile.name || 'Användare',
          role: user.role_type
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte skicka inbjudan')
      }

      toast.success('Inbjudan skickad')
      fetchUsers()
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      toast.error(error.message || 'Kunde inte skicka inbjudan')
    } finally {
      setSendingInvite(null)
    }
  }

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.name) {
      toast.error('Alla fält är obligatoriska')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/send-multisite-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          organizationName,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Kunde inte lägga till användare')
      }

      toast.success('Användare tillagd och inbjudan skickad')
      setShowAddUser(false)
      setNewUser({ email: '', name: '', role: 'platsansvarig' })
      fetchUsers()
      onUpdate()
    } catch (error: any) {
      console.error('Error adding user:', error)
      toast.error(error.message || 'Kunde inte lägga till användare')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user: UserWithProfile) => {
    if (!confirm(`Är du säker på att du vill ta bort ${user.profile?.name || 'denna användare'}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('multisite_user_roles')
        .delete()
        .eq('id', user.id)

      if (error) throw error

      toast.success('Användare borttagen')
      fetchUsers()
      onUpdate()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Kunde inte ta bort användare')
    }
  }

  const getRoleLabel = (role: MultisiteUserRoleType) => {
    switch (role) {
      case 'verksamhetschef':
        return 'Verksamhetschef'
      case 'regionchef':
        return 'Regionchef'
      case 'platsansvarig':
        return 'Platsansvarig'
      default:
        return role
    }
  }

  const getRoleIcon = (role: MultisiteUserRoleType) => {
    switch (role) {
      case 'verksamhetschef':
        return <Building className="w-4 h-4" />
      case 'regionchef':
        return <MapPin className="w-4 h-4" />
      case 'platsansvarig':
        return <Shield className="w-4 h-4" />
      default:
        return <Users className="w-4 h-4" />
    }
  }

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            Aktiv
          </span>
        )
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
            <AlertCircle className="w-3 h-3" />
            Inbjuden
          </span>
        )
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2 py-1 bg-red-500/20 text-red-400 rounded-full text-xs">
            <XCircle className="w-3 h-3" />
            Utgången
          </span>
        )
      default:
        return null
    }
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Användare ({users.length})
        </h3>
        <Button
          onClick={() => setShowAddUser(true)}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Lägg till användare
        </Button>
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {users.map(user => (
          <div
            key={user.id}
            className="bg-slate-800/50 rounded-lg p-4 flex items-center justify-between"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                user.role_type === 'verksamhetschef' 
                  ? 'bg-purple-500/20 text-purple-400'
                  : user.role_type === 'regionchef'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-green-500/20 text-green-400'
              }`}>
                {getRoleIcon(user.role_type)}
              </div>
              <div>
                <div className="font-medium text-white">
                  {user.profile?.name || 'Okänd användare'}
                </div>
                <div className="text-sm text-slate-400">
                  {user.profile?.email || 'Ingen e-post'}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-slate-500">
                    {getRoleLabel(user.role_type)}
                  </span>
                  {getStatusBadge(user.invitation_status)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSendInvitation(user)}
                disabled={sendingInvite === user.id}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                title="Skicka inbjudan"
              >
                {sendingInvite === user.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : (
                  <Send className="w-4 h-4 text-blue-400" />
                )}
              </button>
              <button
                onClick={() => handleDeleteUser(user)}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Ta bort användare"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
        ))}

        {users.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Inga användare tillagda ännu</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                Lägg till användare
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Namn *
                </label>
                <Input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="För- och efternamn"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  E-postadress *
                </label>
                <Input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="användare@foretag.se"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Roll *
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as MultisiteUserRoleType })}
                  className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="verksamhetschef">Verksamhetschef</option>
                  <option value="regionchef">Regionchef</option>
                  <option value="platsansvarig">Platsansvarig</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowAddUser(false)
                  setNewUser({ email: '', name: '', role: 'platsansvarig' })
                }}
                variant="secondary"
                size="sm"
              >
                Avbryt
              </Button>
              <Button
                onClick={handleAddUser}
                variant="primary"
                size="sm"
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Lägger till...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Lägg till och skicka inbjudan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}