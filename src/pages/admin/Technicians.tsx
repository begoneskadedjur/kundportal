// src/pages/admin/Technicians.tsx - Teknikerhantering (Fixad version utan externa dependencies)
import { useState, useEffect } from 'react'
import { 
  Plus, Search, Filter, User, Mail, Phone, MapPin, 
  Edit, Trash2, Power, UserCheck, Users, MoreVertical
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// Tekniker-typer
type Technician = {
  id: string
  name: string
  role: string
  email: string
  direct_phone: string | null
  office_phone: string | null
  address: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type TechnicianFormData = {
  name: string
  role: string
  email: string
  direct_phone: string
  office_phone: string
  address: string
}

// Tekniker-roller
const TECHNICIAN_ROLES = [
  'Skadedjurstekniker',
  'VD',
  'Marknad & Försäljningschef',
  'Regionchef Dalarna',
  'Koordinator/kundtjänst',
  'Annan'
] as const

// Tekniker Service (inbyggd för att undvika import-fel)
const technicianService = {
  async getAllTechnicians(): Promise<Technician[]> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('*')
        .order('name', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (error: any) {
      console.error('Error fetching technicians:', error)
      toast.error('Kunde inte hämta tekniker')
      throw error
    }
  },

  async createTechnician(technicianData: TechnicianFormData): Promise<Technician> {
    try {
      // Validera e-post format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(technicianData.email)) {
        throw new Error('Ogiltig e-postadress')
      }

      // Formatera telefonnummer
      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }

      const insertData = {
        name: technicianData.name.trim(),
        role: technicianData.role,
        email: technicianData.email.toLowerCase().trim(),
        direct_phone: formatPhone(technicianData.direct_phone),
        office_phone: formatPhone(technicianData.office_phone),
        address: technicianData.address.trim() || null,
        is_active: true
      }

      const { data, error } = await supabase
        .from('technicians')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('En tekniker med denna e-postadress finns redan')
        }
        throw error
      }
      
      toast.success('Tekniker skapad!')
      return data
    } catch (error: any) {
      console.error('Error creating technician:', error)
      toast.error(error.message || 'Kunde inte skapa tekniker')
      throw error
    }
  },

  async updateTechnician(id: string, updates: Partial<TechnicianFormData>): Promise<Technician> {
    try {
      const updateData: any = {}
      
      if (updates.name) updateData.name = updates.name.trim()
      if (updates.role) updateData.role = updates.role
      if (updates.email) updateData.email = updates.email.toLowerCase().trim()
      if (updates.address) updateData.address = updates.address.trim()
      
      // Formatera telefonnummer
      const formatPhone = (phone: string) => {
        if (!phone) return null
        return phone.replace(/[\s-]/g, '').replace(/^0/, '+46')
      }
      
      if (updates.direct_phone !== undefined) {
        updateData.direct_phone = formatPhone(updates.direct_phone)
      }
      if (updates.office_phone !== undefined) {
        updateData.office_phone = formatPhone(updates.office_phone)
      }

      const { data, error } = await supabase
        .from('technicians')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('En tekniker med denna e-postadress finns redan')
        }
        throw error
      }
      
      toast.success('Tekniker uppdaterad!')
      return data
    } catch (error: any) {
      console.error('Error updating technician:', error)
      toast.error(error.message || 'Kunde inte uppdatera tekniker')
      throw error
    }
  },

  async toggleTechnicianStatus(id: string, isActive: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('technicians')
        .update({ is_active: isActive })
        .eq('id', id)
      
      if (error) throw error
      
      toast.success(`Tekniker ${isActive ? 'aktiverad' : 'inaktiverad'}`)
    } catch (error: any) {
      console.error('Error toggling technician status:', error)
      toast.error('Kunde inte uppdatera tekniker-status')
      throw error
    }
  },

  async deleteTechnician(id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('technicians')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Tekniker borttagen')
    } catch (error: any) {
      console.error('Error deleting technician:', error)
      toast.error(error.message || 'Kunde inte ta bort tekniker')
      throw error
    }
  },

  async getTechnicianStats(): Promise<{
    total: number
    active: number
    byRole: Record<string, number>
  }> {
    try {
      const technicians = await this.getAllTechnicians()
      
      const stats = {
        total: technicians.length,
        active: technicians.filter(t => t.is_active).length,
        byRole: technicians.reduce((acc, technician) => {
          acc[technician.role] = (acc[technician.role] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
      
      return stats
    } catch (error) {
      return { total: 0, active: 0, byRole: {} }
    }
  },

  formatPhoneForDisplay(phone: string | null): string {
    if (!phone) return '-'
    
    // Konvertera från +46 format till 0 format för visning
    if (phone.startsWith('+46')) {
      const number = phone.slice(3)
      return `0${number.slice(0, 2)}-${number.slice(2, 5)} ${number.slice(5, 7)} ${number.slice(7)}`
    }
    
    return phone
  },

  formatPhoneForLink(phone: string | null): string | null {
    if (!phone) return null
    return phone // Behåll +46 format för tel: länkar
  }
}

// Modal för att skapa/redigera tekniker
function TechnicianModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  technician 
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  technician?: Technician
}) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<TechnicianFormData>({
    name: technician?.name || '',
    role: technician?.role || 'Skadedjurstekniker',
    email: technician?.email || '',
    direct_phone: technician?.direct_phone || '',
    office_phone: technician?.office_phone || '',
    address: technician?.address || ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (technician) {
        await technicianService.updateTechnician(technician.id, formData)
      } else {
        await technicianService.createTechnician(formData)
      }
      
      onSuccess()
      onClose()
    } catch (error) {
      // Fel hanteras av service
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
      <div className="glass w-full max-w-2xl bg-slate-900/95 backdrop-blur-lg border border-slate-600 rounded-xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-white">
            {technician ? 'Redigera tekniker' : 'Lägg till tekniker'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Namn *"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="För- och efternamn"
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Roll *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                {TECHNICIAN_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="E-post *"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="namn@begone.se"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Direkt telefon"
              name="direct_phone"
              value={formData.direct_phone}
              onChange={handleChange}
              placeholder="072-123 45 67"
            />

            <Input
              label="Växelnummer"
              name="office_phone"
              value={formData.office_phone}
              onChange={handleChange}
              placeholder="010-123 45 67"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Adress
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-green-500"
              placeholder="Fullständig adress"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !formData.name || !formData.email}
              className="flex-1"
            >
              {loading ? 'Sparar...' : technician ? 'Uppdatera' : 'Skapa'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Tekniker-kort komponent
function TechnicianCard({ 
  technician, 
  onEdit, 
  onToggleStatus, 
  onDelete 
}: {
  technician: Technician
  onEdit: (technician: Technician) => void
  onToggleStatus: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}) {
  const [showDropdown, setShowDropdown] = useState(false)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'VD': return 'bg-purple-500/20 text-purple-400'
      case 'Marknad & Försäljningschef': return 'bg-blue-500/20 text-blue-400'
      case 'Regionchef Dalarna': return 'bg-orange-500/20 text-orange-400'
      case 'Koordinator/kundtjänst': return 'bg-green-500/20 text-green-400'
      case 'Skadedjurstekniker': return 'bg-cyan-500/20 text-cyan-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  return (
    <Card className={`transition-all ${!technician.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-slate-300" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{technician.name}</h3>
            <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${getRoleColor(technician.role)}`}>
              {technician.role}
            </span>
          </div>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onEdit(technician)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Redigera
              </button>
              
              <button
                onClick={() => {
                  onToggleStatus(technician.id, !technician.is_active)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                {technician.is_active ? 'Inaktivera' : 'Aktivera'}
              </button>

              <div className="border-t border-slate-700 my-1"></div>

              <button
                onClick={() => {
                  onDelete(technician.id)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Ta bort
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-slate-400" />
          <a 
            href={`mailto:${technician.email}`}
            className="text-slate-300 hover:text-green-400 transition-colors"
          >
            {technician.email}
          </a>
        </div>

        {technician.direct_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-slate-400" />
            <a 
              href={`tel:${technicianService.formatPhoneForLink(technician.direct_phone)}`}
              className="text-slate-300 hover:text-green-400 transition-colors"
            >
              {technicianService.formatPhoneForDisplay(technician.direct_phone)}
            </a>
            <span className="text-slate-500 text-xs">Direkt</span>
          </div>
        )}

        {technician.office_phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-4 h-4 text-slate-400" />
            <a 
              href={`tel:${technicianService.formatPhoneForLink(technician.office_phone)}`}
              className="text-slate-300 hover:text-green-400 transition-colors"
            >
              {technicianService.formatPhoneForDisplay(technician.office_phone)}
            </a>
            <span className="text-slate-500 text-xs">Växel</span>
          </div>
        )}

        {technician.address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
            <span className="text-slate-300">{technician.address}</span>
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
        <span className={`text-xs font-medium ${technician.is_active ? 'text-green-400' : 'text-red-400'}`}>
          {technician.is_active ? 'Aktiv' : 'Inaktiv'}
        </span>
        <span className="text-xs text-slate-500">
          Skapad: {new Date(technician.created_at).toLocaleDateString('sv-SE')}
        </span>
      </div>
    </Card>
  )
}

export default function Technicians() {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [filteredTechnicians, setFilteredTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Technician | undefined>()
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    byRole: {} as Record<string, number>
  })

  useEffect(() => {
    fetchTechnicians()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [technicians, searchTerm, roleFilter, statusFilter])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      const [techniciansData, statsData] = await Promise.all([
        technicianService.getAllTechnicians(),
        technicianService.getTechnicianStats()
      ])
      
      setTechnicians(techniciansData)
      setStats(statsData)
    } catch (error) {
      // Fel hanteras av service
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = technicians

    // Textsökning
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(tech =>
        tech.name.toLowerCase().includes(searchLower) ||
        tech.email.toLowerCase().includes(searchLower) ||
        tech.role.toLowerCase().includes(searchLower)
      )
    }

    // Rollfilter
    if (roleFilter !== 'all') {
      filtered = filtered.filter(tech => tech.role === roleFilter)
    }

    // Statusfilter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tech =>
        statusFilter === 'active' ? tech.is_active : !tech.is_active
      )
    }

    setFilteredTechnicians(filtered)
  }

  const handleCreateTechnician = () => {
    setEditingTechnician(undefined)
    setShowModal(true)
  }

  const handleEditTechnician = (technician: Technician) => {
    setEditingTechnician(technician)
    setShowModal(true)
  }

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await technicianService.toggleTechnicianStatus(id, isActive)
      fetchTechnicians()
    } catch (error) {
      // Fel hanteras av service
    }
  }

  const handleDeleteTechnician = async (id: string) => {
    if (!window.confirm('Är du säker på att du vill ta bort denna tekniker?')) {
      return
    }

    try {
      await technicianService.deleteTechnician(id)
      fetchTechnicians()
    } catch (error) {
      // Fel hanteras av service
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Teknikerhantering</h1>
          <p className="text-slate-400 mt-1">
            Hantera alla tekniker och deras information
          </p>
        </div>
        <Button onClick={handleCreateTechnician} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Lägg till tekniker
        </Button>
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Totalt</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Aktiva</p>
              <p className="text-2xl font-bold text-white">{stats.active}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Skadedjurstekniker</p>
              <p className="text-2xl font-bold text-white">
                {stats.byRole['Skadedjurstekniker'] || 0}
              </p>
            </div>
            <User className="w-8 h-8 text-cyan-500" />
          </div>
        </Card>
      </div>

      {/* Filter och Sök */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Sök efter namn, e-post eller roll..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Alla roller</option>
            {TECHNICIAN_ROLES.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
          >
            <option value="all">Alla status</option>
            <option value="active">Aktiva</option>
            <option value="inactive">Inaktiva</option>
          </select>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-sm text-slate-400">
            Visar {filteredTechnicians.length} av {technicians.length} tekniker
          </p>
        </div>
      </Card>

      {/* Tekniker Grid */}
      {filteredTechnicians.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Inga tekniker hittades</h3>
            <p className="text-slate-400 mb-4">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Prova att ändra dina filter eller sökord.'
                : 'Lägg till din första tekniker för att komma igång.'
              }
            </p>
            {!searchTerm && roleFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={handleCreateTechnician}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till tekniker
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map(technician => (
            <TechnicianCard
              key={technician.id}
              technician={technician}
              onEdit={handleEditTechnician}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeleteTechnician}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <TechnicianModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchTechnicians}
        technician={editingTechnician}
      />
    </div>
  )
}