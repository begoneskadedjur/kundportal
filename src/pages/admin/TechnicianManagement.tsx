// src/pages/admin/TechnicianManagement.tsx - FULLSTÄNDIG VERSION MED ABAX-LISTA INTEGRERAD

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, User, UserCheck, Users, ArrowLeft, Key, AlertCircle, Car // ✅ NY IKON
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

// Importera våra modulära komponenter
import TechnicianCard from '../../components/admin/technicians/management/TechnicianCard'
import TechnicianAuthModal from '../../components/admin/technicians/management/TechnicianAuthModal'
import TechnicianModal from '../../components/admin/technicians/management/TechnicianModal'
import AbaxVehicleModal from '../../components/admin/technicians/management/AbaxVehicleModal' // ✅ NY IMPORT

// Importera våra services
import { technicianManagementService, type Technician, type TechnicianStats } from '../../services/technicianManagementService'

const STAFF_ROLES = [
  'Skadedjurstekniker',
  'Koordinator',
  'Admin'
] as const

export default function TechnicianManagement() {
  const navigate = useNavigate()
  
  // Data state
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [filteredTechnicians, setFilteredTechnicians] = useState<Technician[]>([])
  const [stats, setStats] = useState<TechnicianStats>({
    total: 0,
    active: 0,
    withLogin: 0,
    byRole: {}
  })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'with_login' | 'without_login'>('all')
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [isAbaxModalOpen, setIsAbaxModalOpen] = useState(false) // ✅ NYTT STATE FÖR ABAX-MODAL
  const [editingTechnician, setEditingTechnician] = useState<Technician | undefined>()
  const [authTechnician, setAuthTechnician] = useState<Technician | undefined>()

  // Ladda data när komponenten mountas
  useEffect(() => {
    fetchTechnicians()
  }, [])

  // Tillämpa filter när data eller filter ändras
  useEffect(() => {
    applyFilters()
  }, [technicians, searchTerm, roleFilter, statusFilter])

  /**
   * Hämta all personal och statistik
   */
  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      console.log('🔄 Fetching staff...')
      
      const [techniciansData, statsData] = await Promise.all([
        technicianManagementService.getAllTechnicians(),
        technicianManagementService.getTechnicianStats()
      ])
      
      setTechnicians(techniciansData)
      setStats(statsData)
      
      console.log(`✅ Loaded ${techniciansData.length} staff members`)
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Filtrera personal baserat på sök och filter
   */
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
      filtered = filtered.filter(tech => {
        switch (statusFilter) {
          case 'active':
            return tech.is_active
          case 'inactive':
            return !tech.is_active
          case 'with_login':
            return tech.has_login
          case 'without_login':
            return !tech.has_login
          default:
            return true
        }
      })
    }

    setFilteredTechnicians(filtered)
  }

  /**
   * Event handlers för personal-operationer
   */
  const handleCreateTechnician = () => {
    setEditingTechnician(undefined)
    setShowEditModal(true)
  }

  const handleEditTechnician = (technician: Technician) => {
    setEditingTechnician(technician)
    setShowEditModal(true)
  }

  const handleManageAuth = (technician: Technician) => {
    setAuthTechnician(technician)
    setShowAuthModal(true)
  }

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await technicianManagementService.toggleTechnicianStatus(id, isActive)
      await fetchTechnicians() // Reload data
    } catch (error) {
      // Fel hanteras av service
    }
  }

  const handleDeleteTechnician = async (id: string) => {
    try {
      await technicianManagementService.deleteTechnician(id)
      await fetchTechnicians() // Reload data
    } catch (error) {
      // Fel hanteras av service
    }
  }

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <header className="bg-slate-900/50 border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => navigate('/admin/dashboard')} 
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> 
                  Tillbaka
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Personalhantering</h1>
                  <p className="text-slate-400 text-sm">Hantera personal och deras inloggningar</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-400 mt-4">Laddar personal...</p>
          </div>
        </div>
      </div>
    )
  }

  /**
   * Main render
   */
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')} 
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> 
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Personalhantering</h1>
                <p className="text-slate-400 text-sm">
                  Hantera personal och deras inloggningar • {filteredTechnicians.length} av {stats.total} visas
                </p>
              </div>
            </div>
            {/* ✅ NY KNAPPGRUPP MED ABAX-KNAPP */}
            <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setIsAbaxModalOpen(true)} className="flex items-center gap-2">
                    <Car className="w-4 h-4" /> Visa Fordons-ID
                </Button>
                <Button onClick={handleCreateTechnician} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Lägg till Personal
                </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Statistik */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Totalt</p>
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <Users className="w-8 h-8 text-blue-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Aktiva</p>
                  <p className="text-2xl font-bold text-white">{stats.active}</p>
                </div>
                <UserCheck className="w-8 h-8 text-green-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Med Inloggning</p>
                  <p className="text-2xl font-bold text-white">{stats.withLogin}</p>
                </div>
                <Key className="w-8 h-8 text-purple-500" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Utan Inloggning</p>
                  <p className="text-2xl font-bold text-white">{stats.total - stats.withLogin}</p>
                </div>
                <User className="w-8 h-8 text-orange-500" />
              </div>
            </Card>
          </div>

          {/* Quick Actions för Auth */}
          {stats.total > stats.withLogin && (
            <Card className="border-blue-500/20 bg-blue-500/5 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="w-6 h-6 text-blue-400" />
                  <div>
                    <h3 className="text-white font-medium">
                      {stats.total - stats.withLogin} personer utan inloggning
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Aktivera inloggning för de som ska kunna använda systemet.
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setStatusFilter('without_login')}
                  className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                >
                  Visa personer utan inloggning
                </Button>
              </div>
            </Card>
          )}

          {/* Filter och Sök */}
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Sök efter namn, e-post eller roll..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="all">Alla roller</option>
                {STAFF_ROLES.map(role => (
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
                <option value="with_login">Med inloggning</option>
                <option value="without_login">Utan inloggning</option>
              </select>

              <div className="flex items-center text-slate-400 text-sm">
                <span>
                  {filteredTechnicians.length} av {technicians.length} personer
                </span>
              </div>
            </div>

            {/* Filter summary */}
            {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <div className="flex flex-wrap gap-2">
                  {searchTerm && (
                    <span className="inline-flex items-center px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                      Söker: "{searchTerm}"
                    </span>
                  )}
                  {roleFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                      Roll: {roleFilter}
                    </span>
                  )}
                  {statusFilter !== 'all' && (
                    <span className="inline-flex items-center px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                      Status: {statusFilter === 'with_login' ? 'Med inloggning' : statusFilter === 'without_login' ? 'Utan inloggning' : statusFilter === 'active' ? 'Aktiva' : 'Inaktiva'}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setRoleFilter('all')
                      setStatusFilter('all')
                    }}
                    className="text-slate-400 hover:text-white text-xs underline"
                  >
                    Rensa filter
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Personal-Grid */}
          {filteredTechnicians.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <User className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Ingen personal hittades</h3>
                <p className="text-slate-400 mb-4">
                  {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                    ? 'Prova att ändra dina filter eller sökord.'
                    : 'Lägg till din första person för att komma igång.'
                  }
                </p>
                {!searchTerm && roleFilter === 'all' && statusFilter === 'all' && (
                  <Button onClick={handleCreateTechnician}>
                    <Plus className="w-4 h-4 mr-2" />
                    Lägg till första person
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
                  onManageAuth={handleManageAuth}
                />
              ))}
            </div>
          )}

          {/* Data integritet info */}
          {technicians.length > 0 && (
            <Card className="p-4 bg-slate-800/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="text-slate-400 text-sm">
                  <p className="font-medium text-slate-300 mb-1">Systemintegration</p>
                  <p>
                    All personal är automatiskt integrerad med befintliga ärenden och analytics-system. 
                    Ändringar här påverkar dashboards och ärendehistorik.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Modaler */}
        <TechnicianModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            fetchTechnicians()
            setShowEditModal(false)
          }}
          technician={editingTechnician}
        />

        {authTechnician && (
          <TechnicianAuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => {
              fetchTechnicians()
              setShowAuthModal(false)
            }}
            technician={authTechnician}
          />
        )}

        {/* ✅ NY MODAL FÖR ABAX */}
        <AbaxVehicleModal
          isOpen={isAbaxModalOpen}
          onClose={() => setIsAbaxModalOpen(false)}
        />
      </main>
    </div>
  )
}