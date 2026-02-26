import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { X, User, Mail, Shield, MapPin, Loader2, Send, Building2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

interface UserModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organizationId: string
  organizationName: string
  existingUser?: {
    id: string
    user_id: string
    role_type: string
    email?: string
    name?: string
    site_ids?: string[]
  } | null
}

interface Site {
  id: string
  site_name: string
  region: string
}

const ROLES = [
  {
    value: 'verksamhetschef',
    label: 'Verksamhetschef',
    icon: Building2,
    colorBg: 'bg-purple-500/10',
    colorBorder: 'border-purple-500/50',
    colorRing: 'ring-purple-500/30',
    colorBorderDefault: 'border-purple-500/20',
    colorIcon: 'text-purple-400',
    colorLabel: 'text-purple-300',
    desc: 'Full översikt över hela organisationen. Ser alla enheter, kan hantera användare och inställningar.',
    portalDesc: 'Ser alla enheter och all data i organisationsportalen.',
    needsSites: false
  },
  {
    value: 'regionchef',
    label: 'Regionchef',
    icon: MapPin,
    colorBg: 'bg-blue-500/10',
    colorBorder: 'border-blue-500/50',
    colorRing: 'ring-blue-500/30',
    colorBorderDefault: 'border-blue-500/20',
    colorIcon: 'text-blue-400',
    colorLabel: 'text-blue-300',
    desc: 'Ansvarar för utvalda enheter inom sin region. Kan bjuda in platsansvariga.',
    portalDesc: 'Ser enbart sina tilldelade enheter i portalen.',
    needsSites: true
  },
  {
    value: 'platsansvarig',
    label: 'Platsansvarig',
    icon: User,
    colorBg: 'bg-green-500/10',
    colorBorder: 'border-green-500/50',
    colorRing: 'ring-green-500/30',
    colorBorderDefault: 'border-green-500/20',
    colorIcon: 'text-green-400',
    colorLabel: 'text-green-300',
    desc: 'Ansvarar för specifika enheter. Kan begära service och se rapporter.',
    portalDesc: 'Ser enbart sin tilldelade enhet i portalen.',
    needsSites: true
  }
] as const

export default function UserModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  organizationName,
  existingUser
}: UserModalProps) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [roleType, setRoleType] = useState<string>('platsansvarig')
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loadingSites, setLoadingSites] = useState(false)
  const [sendInviteEmail, setSendInviteEmail] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchSites()
      if (existingUser) {
        setEmail(existingUser.email || '')
        setFullName(existingUser.name || '')
        setRoleType(existingUser.role_type)
        setSelectedSites(existingUser.site_ids || [])
      } else {
        setEmail('')
        setFullName('')
        setRoleType('platsansvarig')
        setSelectedSites([])
        setSendInviteEmail(true)
      }
    }
  }, [isOpen, existingUser])

  const fetchSites = async () => {
    setLoadingSites(true)
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !orgData) {
        throw new Error('Kunde inte hämta organisation')
      }

      const { data: sitesData, error: sitesError } = await supabase
        .from('customers')
        .select('id, site_name, company_name, region')
        .eq('organization_id', orgData.organization_id)
        .eq('site_type', 'enhet')
        .eq('is_multisite', true)
        .order('site_name')

      if (sitesError) throw sitesError

      setSites((sitesData || []).map(site => ({
        id: site.id,
        site_name: site.site_name || site.company_name,
        region: site.region || 'Okänd region'
      })))
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Kunde inte hämta enheter')
    } finally {
      setLoadingSites(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !fullName || !roleType) {
      toast.error('Vänligen fyll i alla obligatoriska fält')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Vänligen ange en giltig e-postadress')
      return
    }

    const currentRole = ROLES.find(r => r.value === roleType)
    if (currentRole?.needsSites && selectedSites.length === 0) {
      toast.error(`Vänligen välj minst en enhet för ${currentRole.label.toLowerCase()}`)
      return
    }

    setLoading(true)
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !orgData) {
        throw new Error('Kunde inte hämta organisation')
      }

      if (existingUser) {
        const { error: updateError } = await supabase
          .from('multisite_user_roles')
          .update({
            role_type: roleType,
            site_ids: (roleType === 'platsansvarig' || roleType === 'regionchef') ? selectedSites : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)

        if (updateError) throw updateError

        if (fullName !== existingUser.name) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ display_name: fullName })
            .eq('user_id', existingUser.user_id)

          if (profileError) {
            console.error('Error updating profile:', profileError)
            toast.error(`Kunde inte uppdatera användarnamn: ${profileError.message}`)
            return
          }
        }

        toast.success('Användare uppdaterad')
      } else {
        const userId = crypto.randomUUID()
        const response = await fetch('/api/create-multisite-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: orgData.organization_id,
            sendEmail: sendInviteEmail,
            users: [{
              id: userId,
              email,
              name: fullName,
              phone: ''
            }],
            roleAssignments: [{
              userId: userId,
              role: roleType,
              siteIds: (roleType === 'platsansvarig' || roleType === 'regionchef') ? selectedSites : undefined
            }]
          })
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Kunde inte skapa användare')
        }

        // Kolla om det finns enskilda fel i resultatet
        const failedUsers = result.results?.filter((r: any) => !r.success) || []
        if (failedUsers.length > 0) {
          throw new Error(failedUsers[0].error || 'Kunde inte skapa användare')
        }

        toast.success(sendInviteEmail ? 'Användare skapad och inbjudan skickad' : 'Användare skapad (ingen inbjudan skickad)')
      }

      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error saving user:', error)
      toast.error(error.message || 'Kunde inte spara användare')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedRole = ROLES.find(r => r.value === roleType)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                {existingUser ? 'Redigera användare' : 'Lägg till användare'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Organisation: {organizationName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* E-post & Namn */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                E-postadress *
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@foretag.se"
                disabled={!!existingUser}
                required
              />
              {existingUser && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Kan inte ändras för befintliga användare
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Fullständigt namn *
              </label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="För- och efternamn"
                required
              />
            </div>
          </div>

          {/* Roll-val med visuella kort */}
          <div>
            <label className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Roll i organisationen *
            </label>
            <div className="space-y-2">
              {ROLES.map(role => {
                const Icon = role.icon
                const isSelected = roleType === role.value
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => {
                      setRoleType(role.value)
                      if (role.value === 'verksamhetschef') setSelectedSites([])
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? `${role.colorBg} ${role.colorBorder} ring-1 ${role.colorRing}`
                        : 'bg-slate-800/20 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${role.colorIcon}`} />
                      <span className={`text-sm font-medium ${isSelected ? role.colorLabel : 'text-white'}`}>
                        {role.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 ml-6">{role.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Enheter (för platsansvarig och regionchef) */}
          {selectedRole?.needsSites && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <label className="text-xs font-medium text-slate-400 mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Välj enheter *
              </label>
              {loadingSites ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-[#20c58f]" />
                </div>
              ) : sites.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-slate-700/50 rounded-lg">
                  {sites.map(site => (
                    <label
                      key={site.id}
                      className="flex items-center px-3 py-2 hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={site.id}
                        checked={selectedSites.includes(site.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSites([...selectedSites, site.id])
                          } else {
                            setSelectedSites(selectedSites.filter(id => id !== site.id))
                          }
                        }}
                        className="mr-3 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                      />
                      <div>
                        <p className="text-sm text-white font-medium">{site.site_name}</p>
                        <p className="text-xs text-slate-400">{site.region}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4 text-center border border-slate-700/50 rounded-lg">
                  Inga enheter tillgängliga
                </p>
              )}
              {selectedSites.length > 0 && (
                <p className="text-xs text-[#20c58f] mt-1.5">
                  {selectedSites.length} enhet(er) valda
                </p>
              )}
            </div>
          )}

          {/* Preview: Vad användaren kommer se i portalen */}
          {(roleType === 'verksamhetschef' || selectedSites.length > 0) && (
            <div className="p-3 bg-[#20c58f]/10 border border-[#20c58f]/20 rounded-xl">
              <h4 className="text-xs font-medium text-[#20c58f] mb-1.5 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" />
                Denna användare kommer se i portalen:
              </h4>
              <div className="text-xs text-slate-300">
                {roleType === 'verksamhetschef' ? (
                  <p>Alla {sites.length} enheter i {organizationName} — full översikt med alla rapporter, ärenden och statistik.</p>
                ) : (
                  <div>
                    <p className="mb-1">{selectedRole?.portalDesc}</p>
                    <ul className="space-y-0.5 ml-3">
                      {selectedSites.map(siteId => {
                        const site = sites.find(s => s.id === siteId)
                        return site ? (
                          <li key={siteId} className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-[#20c58f]" />
                            {site.site_name} <span className="text-slate-500">({site.region})</span>
                          </li>
                        ) : null
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* E-post-inbjudan toggle (bara för nya användare) */}
          {!existingUser && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendInviteEmail}
                  onChange={(e) => setSendInviteEmail(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Skicka inbjudan via e-post</p>
                    <p className="text-xs text-slate-400">
                      {sendInviteEmail
                        ? 'Användaren får ett mail med inloggningsuppgifter'
                        : 'Konto skapas utan att skicka e-post (du kan bjuda in senare)'}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-700/50 flex justify-end gap-3">
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Avbryt
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            variant="primary"
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {existingUser ? 'Uppdatera' : (sendInviteEmail ? 'Lägg till och bjud in' : 'Lägg till användare')}
          </Button>
        </div>
      </div>
    </div>
  )
}
