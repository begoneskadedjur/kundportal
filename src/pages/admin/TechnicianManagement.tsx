import { useState, useEffect } from 'react'
import {
  Plus, Search, User, UserCheck, Users, Key, Car
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'

import TechnicianCard from '../../components/admin/technicians/management/TechnicianCard'
import TechnicianAuthModal from '../../components/admin/technicians/management/TechnicianAuthModal'
import TechnicianModal from '../../components/admin/technicians/management/TechnicianModal'
import AbaxVehicleModal from '../../components/admin/technicians/management/AbaxVehicleModal'
import WorkScheduleModal from '../../components/admin/technicians/management/WorkScheduleModal'

import { technicianManagementService, type Technician, type TechnicianStats } from '../../services/technicianManagementService'

const STAFF_ROLES = [
  'Skadedjurstekniker',
  'Koordinator',
  'Admin'
] as const

export default function TechnicianManagement() {
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
  const [isAbaxModalOpen, setIsAbaxModalOpen] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Technician | undefined>()
  const [authTechnician, setAuthTechnician] = useState<Technician | undefined>()
  const [isWorkScheduleModalOpen, setIsWorkScheduleModalOpen] = useState(false)
  const [editingScheduleFor, setEditingScheduleFor] = useState<Technician | undefined>()

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
        technicianManagementService.getAllTechnicians(),
        technicianManagementService.getTechnicianStats()
      ])
      setTechnicians(techniciansData)
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching staff:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = technicians

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(tech =>
        tech.name.toLowerCase().includes(searchLower) ||
        tech.email.toLowerCase().includes(searchLower) ||
        tech.role.toLowerCase().includes(searchLower)
      )
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(tech => tech.role === roleFilter)
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(tech => {
        switch (statusFilter) {
          case 'active': return tech.is_active
          case 'inactive': return !tech.is_active
          case 'with_login': return tech.has_login
          case 'without_login': return !tech.has_login
          default: return true
        }
      })
    }

    setFilteredTechnicians(filtered)
  }

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

  const handleManageWorkSchedule = (technician: Technician) => {
    setEditingScheduleFor(technician)
    setIsWorkScheduleModalOpen(true)
  }

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    try {
      await technicianManagementService.toggleTechnicianStatus(id, isActive)
      await fetchTechnicians()
    } catch (error) {
      // Fel hanteras av service
    }
  }

  const handleDeleteTechnician = async (id: string) => {
    try {
      await technicianManagementService.deleteTechnician(id)
      await fetchTechnicians()
    } catch (error) {
      // Fel hanteras av service
    }
  }

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <LoadingSpinner />
            <p className="text-slate-400 mt-4">Laddar personal...</p>
          </div>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Totalt', value: stats.total, icon: Users, color: 'blue' },
    { label: 'Aktiva', value: stats.active, icon: UserCheck, color: 'green' },
    { label: 'Med Inloggning', value: stats.withLogin, icon: Key, color: 'purple' },
    { label: 'Utan Inloggning', value: stats.total - stats.withLogin, icon: User, color: 'orange' },
  ] as const

  const colorMap: Record<string, { icon: string; bg: string }> = {
    blue: { icon: 'text-blue-400', bg: 'bg-blue-500/20' },
    green: { icon: 'text-green-400', bg: 'bg-green-500/20' },
    purple: { icon: 'text-purple-400', bg: 'bg-purple-500/20' },
    orange: { icon: 'text-orange-400', bg: 'bg-orange-500/20' },
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#20c58f]/10">
            <Users className="w-6 h-6 text-[#20c58f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Användarkonton (Personal)</h1>
            <p className="text-sm text-slate-400">
              {filteredTechnicians.length} av {stats.total} personal visas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => setIsAbaxModalOpen(true)} className="flex items-center gap-2">
            <Car className="w-4 h-4" /> Fordons-ID
          </Button>
          <Button variant="primary" onClick={handleCreateTechnician} className="flex items-center gap-2">
            <Plus className="w-4 h-4" /> Lägg till
          </Button>
        </div>
      </div>

      {/* Stat-kort */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => {
          const c = colorMap[color]
          return (
            <div key={label} className="bg-slate-800/50 rounded-2xl border border-slate-700/40 p-5 hover:border-slate-600 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-300">{label}</p>
                  <p className="text-xl font-bold text-white font-mono mt-1">{value}</p>
                </div>
                <div className={`p-2 rounded-lg ${c.bg}`}>
                  <Icon className={`w-4 h-4 ${c.icon}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Alert: Personal utan inloggning */}
      {stats.total > stats.withLogin && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-white font-medium text-sm">
                  {stats.total - stats.withLogin} personer utan inloggning
                </h3>
                <p className="text-slate-400 text-xs">
                  Aktivera inloggning för de som ska kunna använda systemet.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setStatusFilter('without_login')}
            >
              Visa
            </Button>
          </div>
        </div>
      )}

      {/* Filter och Sök */}
      <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-4">
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
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          >
            <option value="all">Alla roller</option>
            {STAFF_ROLES.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-[#20c58f] focus:border-transparent"
          >
            <option value="all">Alla status</option>
            <option value="active">Aktiva</option>
            <option value="inactive">Inaktiva</option>
            <option value="with_login">Med inloggning</option>
            <option value="without_login">Utan inloggning</option>
          </select>

          <div className="flex items-center text-slate-400 text-xs">
            {filteredTechnicians.length} av {technicians.length} personer
          </div>
        </div>

        {/* Filter summary */}
        {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
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
      </div>

      {/* Personal-Grid */}
      {filteredTechnicians.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl py-12">
          <div className="text-center">
            <User className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">Ingen personal hittades</h3>
            <p className="text-slate-400 text-sm mb-4">
              {searchTerm || roleFilter !== 'all' || statusFilter !== 'all'
                ? 'Prova att ändra dina filter eller sökord.'
                : 'Lägg till din första person för att komma igång.'
              }
            </p>
            {!searchTerm && roleFilter === 'all' && statusFilter === 'all' && (
              <Button variant="primary" onClick={handleCreateTechnician}>
                <Plus className="w-4 h-4 mr-2" />
                Lägg till första person
              </Button>
            )}
          </div>
        </div>
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
              onManageWorkSchedule={handleManageWorkSchedule}
            />
          ))}
        </div>
      )}

      {/* Modaler */}
      <TechnicianModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={() => {
          fetchTechnicians()
          setShowEditModal(false)
        }}
        technician={editingTechnician}
        allTechnicians={technicians}
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

      <AbaxVehicleModal
        isOpen={isAbaxModalOpen}
        onClose={() => setIsAbaxModalOpen(false)}
      />

      {editingScheduleFor && (
        <WorkScheduleModal
          isOpen={isWorkScheduleModalOpen}
          onClose={() => setIsWorkScheduleModalOpen(false)}
          onSuccess={() => {
            setIsWorkScheduleModalOpen(false)
            fetchTechnicians()
          }}
          technician={editingScheduleFor}
        />
      )}
    </div>
  )
}
