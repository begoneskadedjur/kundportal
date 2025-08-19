import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { X, User, Mail, Shield, MapPin, Loader2 } from 'lucide-react'
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

  useEffect(() => {
    if (isOpen) {
      fetchSites()
      if (existingUser) {
        setEmail(existingUser.email || '')
        setFullName(existingUser.name || '')
        setRoleType(existingUser.role_type)
        setSelectedSites(existingUser.site_ids || [])
      } else {
        // Reset form for new user
        setEmail('')
        setFullName('')
        setRoleType('platsansvarig')
        setSelectedSites([])
      }
    }
  }, [isOpen, existingUser])

  const fetchSites = async () => {
    setLoadingSites(true)
    try {
      // Hämta organisation för att få organization_id
      const { data: orgData, error: orgError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !orgData) {
        throw new Error('Kunde inte hämta organisation')
      }

      // Hämta sites för organisationen
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

    // Validera e-postadress
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Vänligen ange en giltig e-postadress')
      return
    }

    // För platsansvarig och regionchef måste minst en enhet väljas
    if ((roleType === 'platsansvarig' || roleType === 'regionchef') && selectedSites.length === 0) {
      toast.error(`Vänligen välj minst en enhet för ${roleType === 'regionchef' ? 'regionchef' : 'platsansvarig'}`)
      return
    }

    setLoading(true)
    try {
      // Hämta organisation_id från huvudkontoret
      const { data: orgData, error: orgError } = await supabase
        .from('customers')
        .select('organization_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !orgData) {
        throw new Error('Kunde inte hämta organisation')
      }

      if (existingUser) {
        // Uppdatera befintlig användare
        const { error: updateError } = await supabase
          .from('multisite_user_roles')
          .update({
            role_type: roleType,
            site_ids: (roleType === 'platsansvarig' || roleType === 'regionchef') ? selectedSites : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)

        if (updateError) throw updateError

        // Uppdatera profil om namn ändrats
        if (fullName !== existingUser.name) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ display_name: fullName })
            .eq('id', existingUser.user_id)

          if (profileError) {
            console.error('Error updating profile:', profileError)
          }
        }

        toast.success('Användare uppdaterad')
      } else {
        // Skapa ny användare genom API
        const userId = crypto.randomUUID()
        const response = await fetch('/api/create-multisite-users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            organizationId: orgData.organization_id,
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

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Kunde inte skapa användare')
        }

        toast.success('Användare skapad och inbjudan skickad')
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              {existingUser ? 'Redigera användare' : 'Lägg till användare'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Organisation: {organizationName}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* E-post */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Mail className="w-4 h-4 inline mr-2" />
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
              <p className="text-xs text-slate-500 mt-1">
                E-postadressen kan inte ändras för befintliga användare
              </p>
            )}
          </div>

          {/* Namn */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <User className="w-4 h-4 inline mr-2" />
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

          {/* Roll */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              <Shield className="w-4 h-4 inline mr-2" />
              Roll *
            </label>
            <select
              value={roleType}
              onChange={(e) => {
                setRoleType(e.target.value)
                // Rensa valda enheter om rollen inte är platsansvarig
                if (e.target.value !== 'platsansvarig') {
                  setSelectedSites([])
                }
              }}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="verksamhetschef">Verksamhetschef</option>
              <option value="regionchef">Regionchef</option>
              <option value="platsansvarig">Platsansvarig</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">
              {roleType === 'verksamhetschef' && 'Har full översikt över hela organisationen'}
              {roleType === 'regionchef' && 'Ansvarar för utvalda enheter inom sin region'}
              {roleType === 'platsansvarig' && 'Ansvarar för specifika enheter'}
            </p>
          </div>

          {/* Enheter (för platsansvarig och regionchef) */}
          {(roleType === 'platsansvarig' || roleType === 'regionchef') && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Välj enheter *
              </label>
              {loadingSites ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : sites.length > 0 ? (
                <div className="max-h-48 overflow-y-auto border border-slate-700 rounded-lg">
                  {sites.map(site => (
                    <label
                      key={site.id}
                      className="flex items-center p-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
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
                        className="mr-3 rounded border-slate-600 bg-slate-700 text-purple-500 focus:ring-purple-500"
                      />
                      <div>
                        <p className="text-white font-medium">{site.site_name}</p>
                        <p className="text-xs text-slate-400">{site.region}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4 text-center border border-slate-700 rounded-lg">
                  Inga enheter tillgängliga
                </p>
              )}
              {selectedSites.length > 0 && (
                <p className="text-xs text-purple-400 mt-2">
                  {selectedSites.length} enhet(er) valda
                </p>
              )}
            </div>
          )}

          {/* Åtgärdsknappar */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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
              variant="primary"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {existingUser ? 'Uppdatera' : 'Lägg till och bjud in'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}