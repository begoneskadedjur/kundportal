import React, { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { OrganizationSite } from '../../../types/multisite'
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Mail,
  Phone,
  User,
  Building,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  X
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import toast from 'react-hot-toast'

interface SiteManagementPanelProps {
  organizationId: string
  onUpdate: () => void
}

export default function SiteManagementPanel({
  organizationId,
  onUpdate
}: SiteManagementPanelProps) {
  const [sites, setSites] = useState<OrganizationSite[]>([])
  const [loading, setLoading] = useState(true)
  const [editingSite, setEditingSite] = useState<OrganizationSite | null>(null)
  const [showAddSite, setShowAddSite] = useState(false)
  const [formData, setFormData] = useState({
    site_name: '',
    site_code: '',
    address: '',
    region: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    site_manager_email: '',
    is_primary: false
  })

  useEffect(() => {
    fetchSites()
  }, [organizationId])

  const fetchSites = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('organization_sites')
        .select('*')
        .eq('organization_id', organizationId)
        .order('site_name')

      if (error) throw error
      setSites(data || [])
    } catch (error) {
      console.error('Error fetching sites:', error)
      toast.error('Kunde inte hämta anläggningar')
    } finally {
      setLoading(false)
    }
  }

  const handleAddSite = async () => {
    if (!formData.site_name.trim()) {
      toast.error('Anläggningsnamn är obligatoriskt')
      return
    }

    setLoading(true)
    try {
      // Om detta är den första anläggningen, gör den till primär
      const isPrimary = sites.length === 0 || formData.is_primary

      // Om den nya anläggningen ska vara primär, ta bort primär från andra
      if (isPrimary && sites.some(s => s.is_primary)) {
        await supabase
          .from('organization_sites')
          .update({ is_primary: false })
          .eq('organization_id', organizationId)
      }

      const { error } = await supabase
        .from('organization_sites')
        .insert({
          organization_id: organizationId,
          site_name: formData.site_name.trim(),
          site_code: formData.site_code.trim() || null,
          address: formData.address.trim() || null,
          region: formData.region.trim() || null,
          contact_person: formData.contact_person.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          site_manager_email: formData.site_manager_email.trim() || null,
          is_primary: isPrimary,
          is_active: true
        })

      if (error) throw error

      toast.success('Anläggning tillagd')
      setShowAddSite(false)
      resetForm()
      fetchSites()
      onUpdate()
    } catch (error: any) {
      console.error('Error adding site:', error)
      if (error.code === '23505') {
        toast.error('En anläggning med denna kod finns redan')
      } else {
        toast.error('Kunde inte lägga till anläggning')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSite = async () => {
    if (!editingSite || !formData.site_name.trim()) {
      toast.error('Anläggningsnamn är obligatoriskt')
      return
    }

    setLoading(true)
    try {
      // Om denna anläggning ska vara primär, ta bort primär från andra
      if (formData.is_primary && !editingSite.is_primary) {
        await supabase
          .from('organization_sites')
          .update({ is_primary: false })
          .eq('organization_id', organizationId)
      }

      const { error } = await supabase
        .from('organization_sites')
        .update({
          site_name: formData.site_name.trim(),
          site_code: formData.site_code.trim() || null,
          address: formData.address.trim() || null,
          region: formData.region.trim() || null,
          contact_person: formData.contact_person.trim() || null,
          contact_email: formData.contact_email.trim() || null,
          contact_phone: formData.contact_phone.trim() || null,
          site_manager_email: formData.site_manager_email.trim() || null,
          is_primary: formData.is_primary,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingSite.id)

      if (error) throw error

      toast.success('Anläggning uppdaterad')
      setEditingSite(null)
      resetForm()
      fetchSites()
      onUpdate()
    } catch (error: any) {
      console.error('Error updating site:', error)
      if (error.code === '23505') {
        toast.error('En anläggning med denna kod finns redan')
      } else {
        toast.error('Kunde inte uppdatera anläggning')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSite = async (site: OrganizationSite) => {
    if (!confirm(`Är du säker på att du vill ta bort ${site.site_name}?`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('organization_sites')
        .delete()
        .eq('id', site.id)

      if (error) throw error

      toast.success('Anläggning borttagen')
      fetchSites()
      onUpdate()
    } catch (error) {
      console.error('Error deleting site:', error)
      toast.error('Kunde inte ta bort anläggning')
    }
  }

  const handleToggleActive = async (site: OrganizationSite) => {
    try {
      const { error } = await supabase
        .from('organization_sites')
        .update({ is_active: !site.is_active })
        .eq('id', site.id)

      if (error) throw error

      toast.success(`Anläggning ${site.is_active ? 'inaktiverad' : 'aktiverad'}`)
      fetchSites()
    } catch (error) {
      console.error('Error toggling site:', error)
      toast.error('Kunde inte uppdatera anläggning')
    }
  }

  const startEdit = (site: OrganizationSite) => {
    setEditingSite(site)
    setFormData({
      site_name: site.site_name,
      site_code: site.site_code || '',
      address: site.address || '',
      region: site.region || '',
      contact_person: site.contact_person || '',
      contact_email: site.contact_email || '',
      contact_phone: site.contact_phone || '',
      site_manager_email: site.site_manager_email || '',
      is_primary: site.is_primary
    })
  }

  const resetForm = () => {
    setFormData({
      site_name: '',
      site_code: '',
      address: '',
      region: '',
      contact_person: '',
      contact_email: '',
      contact_phone: '',
      site_manager_email: '',
      is_primary: false
    })
  }

  if (loading && sites.length === 0) {
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
          <MapPin className="w-5 h-5 text-purple-400" />
          Anläggningar ({sites.length})
        </h3>
        <Button
          onClick={() => setShowAddSite(true)}
          variant="primary"
          size="sm"
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Lägg till anläggning
        </Button>
      </div>

      {/* Sites Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sites.map(site => (
          <div
            key={site.id}
            className={`bg-slate-800/50 rounded-lg p-4 ${
              !site.is_active ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  site.is_primary 
                    ? 'bg-purple-500/20 text-purple-400' 
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-white flex items-center gap-2">
                    {site.site_name}
                    {site.is_primary && (
                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                        Primär
                      </span>
                    )}
                  </div>
                  {site.site_code && (
                    <div className="text-sm text-slate-400">
                      Kod: {site.site_code}
                    </div>
                  )}
                  {site.region && (
                    <div className="text-sm text-slate-500 mt-1">
                      Region: {site.region}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleActive(site)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    site.is_active 
                      ? 'hover:bg-slate-700 text-slate-400' 
                      : 'hover:bg-green-500/20 text-green-400'
                  }`}
                  title={site.is_active ? 'Inaktivera' : 'Aktivera'}
                >
                  {site.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => startEdit(site)}
                  className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Redigera"
                >
                  <Edit2 className="w-4 h-4 text-blue-400" />
                </button>
                <button
                  onClick={() => handleDeleteSite(site)}
                  className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                  title="Ta bort"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-1 text-sm">
              {site.address && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Building className="w-3 h-3" />
                  <span className="truncate">{site.address}</span>
                </div>
              )}
              {site.contact_person && (
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-3 h-3" />
                  <span>{site.contact_person}</span>
                </div>
              )}
              {site.contact_email && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{site.contact_email}</span>
                </div>
              )}
              {site.contact_phone && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Phone className="w-3 h-3" />
                  <span>{site.contact_phone}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {sites.length === 0 && (
          <div className="col-span-2 text-center py-8">
            <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Inga anläggningar tillagda ännu</p>
          </div>
        )}
      </div>

      {/* Add/Edit Site Modal */}
      {(showAddSite || editingSite) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {editingSite ? 'Redigera anläggning' : 'Lägg till anläggning'}
              </h3>
              <button
                onClick={() => {
                  setShowAddSite(false)
                  setEditingSite(null)
                  resetForm()
                }}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Anläggningsnamn *
                  </label>
                  <Input
                    type="text"
                    value={formData.site_name}
                    onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                    placeholder="t.ex. Stockholm City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Anläggningskod
                  </label>
                  <Input
                    type="text"
                    value={formData.site_code}
                    onChange={(e) => setFormData({ ...formData, site_code: e.target.value })}
                    placeholder="t.ex. STO-001"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Adress
                </label>
                <Input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Gatuadress, Postnummer Ort"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Region
                  </label>
                  <Input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    placeholder="t.ex. Stockholm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kontaktperson
                  </label>
                  <Input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="För- och efternamn"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kontakt e-post
                  </label>
                  <Input
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="kontakt@anlaggning.se"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Kontakt telefon
                  </label>
                  <Input
                    type="tel"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+46 70 123 45 67"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Platsansvarig e-post
                </label>
                <Input
                  type="email"
                  value={formData.site_manager_email}
                  onChange={(e) => setFormData({ ...formData, site_manager_email: e.target.value })}
                  placeholder="platsansvarig@anlaggning.se"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_primary"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500 focus:ring-purple-500"
                />
                <label htmlFor="is_primary" className="text-sm text-slate-300">
                  Sätt som primär anläggning
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowAddSite(false)
                  setEditingSite(null)
                  resetForm()
                }}
                variant="secondary"
                size="sm"
              >
                Avbryt
              </Button>
              <Button
                onClick={editingSite ? handleUpdateSite : handleAddSite}
                variant="primary"
                size="sm"
                disabled={loading}
                className="flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sparar...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingSite ? 'Uppdatera' : 'Lägg till'}
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