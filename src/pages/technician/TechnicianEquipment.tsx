// src/pages/technician/TechnicianEquipment.tsx - Teknikersida för utrustningsplacering
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  requiresSerialNumber,
  getEquipmentTypeLabel,
  EQUIPMENT_TYPE_CONFIG
} from '../../types/database'
import { EquipmentService } from '../../services/equipmentService'
import {
  EquipmentMap,
  EquipmentPlacementForm,
  EquipmentList,
  EquipmentFormData
} from '../../components/shared/equipment'
import { PageHeader } from '../../components/shared'
import Card from '../../components/ui/Card'
import {
  MapPin,
  Plus,
  List,
  Map as MapIcon,
  Loader2,
  RefreshCw,
  Building,
  X,
  FileDown,
  AlertCircle,
  Crosshair,
  Box,
  Target,
  Check
} from 'lucide-react'

type ViewMode = 'map' | 'list'

interface Customer {
  id: string
  company_name: string
}

export default function TechnicianEquipment() {
  const { user, profile } = useAuth()

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [equipment, setEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEquipment, setLoadingEquipment] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    equipment: EquipmentPlacementWithRelations
  } | null>(null)
  const [deleteType, setDeleteType] = useState<'mark' | 'permanent'>('mark')

  // Snabb-lägg-till state
  const [quickAddPosition, setQuickAddPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [quickAddType, setQuickAddType] = useState<EquipmentType>('mechanical_trap')
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  // Hämta tekniker-ID från profil
  const technicianId = profile?.technician_id || ''

  // Hämta kunder vid mount
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customerList = await EquipmentService.getCustomersForDropdown()
        setCustomers(customerList)
      } catch (error) {
        console.error('Fel vid hämtning av kunder:', error)
        toast.error('Kunde inte hämta kundlista')
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [])

  // Hämta utrustning när kund väljs
  useEffect(() => {
    const fetchEquipment = async () => {
      if (!selectedCustomerId) {
        setEquipment([])
        return
      }

      setLoadingEquipment(true)
      try {
        const data = await EquipmentService.getEquipmentByCustomer(selectedCustomerId)
        setEquipment(data)
      } catch (error) {
        console.error('Fel vid hämtning av utrustning:', error)
        toast.error('Kunde inte hämta utrustning')
      } finally {
        setLoadingEquipment(false)
      }
    }

    fetchEquipment()
  }, [selectedCustomerId])

  // Uppdatera utrustning
  const refreshEquipment = useCallback(async () => {
    if (!selectedCustomerId) return

    setLoadingEquipment(true)
    try {
      const data = await EquipmentService.getEquipmentByCustomer(selectedCustomerId)
      setEquipment(data)
    } catch (error) {
      console.error('Fel vid uppdatering av utrustning:', error)
    } finally {
      setLoadingEquipment(false)
    }
  }, [selectedCustomerId])

  // Hantera ny placering
  const handleFormSubmit = async (formData: EquipmentFormData) => {
    if (!selectedCustomerId || !technicianId) {
      toast.error('Välj en kund först')
      return
    }

    setIsSubmitting(true)
    try {
      if (editingEquipment) {
        // Uppdatera befintlig
        const result = await EquipmentService.updateEquipment(editingEquipment.id, {
          equipment_type: formData.equipment_type,
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: formData.status
        })

        if (!result.success) {
          throw new Error(result.error)
        }

        // Ladda upp foto om nytt
        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            editingEquipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        toast.success('Utrustning uppdaterad')
      } else {
        // Skapa ny
        const result = await EquipmentService.createEquipment({
          customer_id: selectedCustomerId,
          placed_by_technician_id: technicianId,
          equipment_type: formData.equipment_type,
          serial_number: formData.serial_number || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          comment: formData.comment || null,
          status: 'active'
        })

        if (!result.success || !result.equipment) {
          throw new Error(result.error)
        }

        // Ladda upp foto om valt
        if (formData.photo) {
          const photoResult = await EquipmentService.uploadEquipmentPhoto(
            result.equipment.id,
            formData.photo
          )
          if (!photoResult.success) {
            console.error('Foto kunde inte laddas upp:', photoResult.error)
          }
        }

        toast.success('Utrustning placerad!')
      }

      // Stäng formulär och uppdatera lista
      setIsFormOpen(false)
      setEditingEquipment(null)
      setPreviewPosition(null)
      await refreshEquipment()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara utrustning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera borttagning
  const handleDeleteEquipment = async (equipment: EquipmentPlacementWithRelations) => {
    setDeleteConfirm({ id: equipment.id, equipment })
    setDeleteType('mark') // Default till markera som borttagen
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      if (deleteType === 'permanent') {
        // Permanent radering
        const result = await EquipmentService.deleteEquipment(deleteConfirm.id)
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Utrustning permanent raderad')
      } else {
        // Markera som borttagen
        const result = await EquipmentService.updateEquipmentStatus(
          deleteConfirm.id,
          'removed',
          technicianId
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Utrustning markerad som borttagen')
      }

      setDeleteConfirm(null)
      await refreshEquipment()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte ta bort utrustning')
    }
  }

  // Hantera redigering
  const handleEditEquipment = (equipment: EquipmentPlacementWithRelations) => {
    setEditingEquipment(equipment)
    setPreviewPosition({ lat: equipment.latitude, lng: equipment.longitude })
    setIsFormOpen(true)
  }

  // Hantera GPS-fångst
  const handleLocationCapture = (lat: number, lng: number) => {
    setPreviewPosition({ lat, lng })
  }

  // Hantera klick på karta för snabb-lägg-till
  const handleMapClick = (lat: number, lng: number) => {
    if (selectedCustomerId) {
      setQuickAddPosition({ lat, lng })
      setPreviewPosition({ lat, lng })
    }
  }

  // Snabb-lägg-till - spara direkt med vald typ
  const handleQuickAdd = async () => {
    if (!quickAddPosition || !selectedCustomerId || !technicianId) return

    setQuickAddSubmitting(true)
    try {
      const result = await EquipmentService.createEquipment({
        customer_id: selectedCustomerId,
        placed_by_technician_id: technicianId,
        equipment_type: quickAddType,
        serial_number: null,
        latitude: quickAddPosition.lat,
        longitude: quickAddPosition.lng,
        comment: null,
        status: 'active'
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success('Utrustning placerad!')
      setQuickAddPosition(null)
      setPreviewPosition(null)
      await refreshEquipment()
    } catch (error) {
      console.error('Fel vid snabb-placering:', error)
      toast.error('Kunde inte placera utrustning')
    } finally {
      setQuickAddSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader
          title="Utrustningsplacering"
          backPath="/technician/dashboard"
        />

        <div className="space-y-6">
          {/* Header description */}
          <div className="flex items-center justify-between">
            <p className="text-slate-400">
              Placera och hantera fällor och stationer hos kunder
            </p>

          {/* Uppdateringsknapp */}
          {selectedCustomerId && (
            <button
              onClick={refreshEquipment}
              disabled={loadingEquipment}
              className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loadingEquipment ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Kundval */}
        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <Building className="w-4 h-4 inline mr-2" />
            Välj kund
          </label>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 py-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Laddar kunder...
            </div>
          ) : (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Välj kund --</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.company_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Innehåll när kund är vald */}
        {selectedCustomerId && (
          <>
            {/* Verktygsrad */}
            <div className="flex items-center justify-between gap-4">
              {/* Vyväljare */}
              <div className="flex bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('map')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'map'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Karta
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List className="w-4 h-4" />
                  Lista
                </button>
              </div>

              {/* Ny placering-knapp */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setEditingEquipment(null)
                  setPreviewPosition(null)
                  setIsFormOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 rounded-lg text-white font-medium hover:bg-emerald-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Ny placering
              </motion.button>
            </div>

            {/* Laddar */}
            {loadingEquipment ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Karta */}
                {viewMode === 'map' && (
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                    <EquipmentMap
                      equipment={equipment}
                      previewPosition={previewPosition}
                      onEditEquipment={handleEditEquipment}
                      onDeleteEquipment={handleDeleteEquipment}
                      onMapClick={handleMapClick}
                      height="500px"
                    />
                  </div>
                )}

                {/* Lista */}
                {viewMode === 'list' && (
                  <EquipmentList
                    equipment={equipment}
                    onEditEquipment={handleEditEquipment}
                    onDeleteEquipment={handleDeleteEquipment}
                  />
                )}
              </>
            )}
          </>
        )}

        {/* Tomt tillstånd */}
        {!selectedCustomerId && !loading && (
          <div className="text-center py-16 bg-slate-800/30 rounded-xl border border-slate-700/50">
            <Building className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              Välj en kund för att börja
            </h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Välj en kontraktskund från listan ovan för att se och hantera deras utrustningsplaceringar.
            </p>
          </div>
        )}

        {/* Formulär-modal */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => {
                setIsFormOpen(false)
                setEditingEquipment(null)
                setPreviewPosition(null)
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-700">
                  <h2 className="text-xl font-semibold text-white">
                    {editingEquipment ? 'Redigera utrustning' : 'Ny utrustningsplacering'}
                  </h2>
                  <button
                    onClick={() => {
                      setIsFormOpen(false)
                      setEditingEquipment(null)
                      setPreviewPosition(null)
                    }}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Formulär */}
                <div className="p-6">
                  <EquipmentPlacementForm
                    customerId={selectedCustomerId}
                    technicianId={technicianId}
                    existingEquipment={editingEquipment}
                    onSubmit={handleFormSubmit}
                    onCancel={() => {
                      setIsFormOpen(false)
                      setEditingEquipment(null)
                      setPreviewPosition(null)
                    }}
                    onLocationCapture={handleLocationCapture}
                    isSubmitting={isSubmitting}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bekräftelse-dialog för borttagning */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setDeleteConfirm(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      Ta bort utrustning
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {deleteConfirm.equipment.serial_number
                        ? `Serienr: ${deleteConfirm.equipment.serial_number}`
                        : getEquipmentTypeLabel(deleteConfirm.equipment.equipment_type)}
                    </p>
                  </div>
                </div>

                {/* Val mellan markera/radera */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => setDeleteType('mark')}
                    className={`w-full p-4 rounded-xl border text-left transition-all min-h-[80px] ${
                      deleteType === 'mark'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'mark' ? 'border-amber-500' : 'border-slate-600'
                      }`}>
                        {deleteType === 'mark' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">Markera som borttagen</p>
                        <p className="text-sm text-slate-400">
                          Behålls i historiken men visas som inaktiv
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setDeleteType('permanent')}
                    className={`w-full p-4 rounded-xl border text-left transition-all min-h-[80px] ${
                      deleteType === 'permanent'
                        ? 'border-red-500 bg-red-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        deleteType === 'permanent' ? 'border-red-500' : 'border-slate-600'
                      }`}>
                        {deleteType === 'permanent' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">Radera permanent</p>
                        <p className="text-sm text-slate-400">
                          Tas bort helt och kan inte återställas
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-4 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors min-h-[52px]"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={confirmDelete}
                    className={`flex-1 px-4 py-4 rounded-xl text-white font-medium transition-colors min-h-[52px] ${
                      deleteType === 'permanent'
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-amber-500 hover:bg-amber-600'
                    }`}
                  >
                    {deleteType === 'permanent' ? 'Radera permanent' : 'Markera borttagen'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snabb-lägg-till dialog */}
        <AnimatePresence>
          {quickAddPosition && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
              onClick={() => {
                setQuickAddPosition(null)
                setPreviewPosition(null)
              }}
            >
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">
                    Snabb-placering
                  </h3>
                  <button
                    onClick={() => {
                      setQuickAddPosition(null)
                      setPreviewPosition(null)
                    }}
                    className="p-2 rounded-lg hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Koordinater */}
                <p className="text-sm text-slate-400 mb-4">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {quickAddPosition.lat.toFixed(6)}, {quickAddPosition.lng.toFixed(6)}
                </p>

                {/* Välj utrustningstyp */}
                <label className="block text-sm font-medium text-slate-300 mb-3">
                  Välj utrustningstyp
                </label>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  {(Object.entries(EQUIPMENT_TYPE_CONFIG) as [EquipmentType, typeof EQUIPMENT_TYPE_CONFIG[EquipmentType]][]).map(
                    ([type, config]) => {
                      const isSelected = quickAddType === type
                      const Icon = type === 'mechanical_trap' ? Crosshair :
                                   type === 'concrete_station' ? Box : Target

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setQuickAddType(type)}
                          className={`p-4 rounded-xl border-2 transition-all min-h-[90px] ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                            style={{ backgroundColor: config.color }}
                          >
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <p className={`text-xs font-medium ${isSelected ? 'text-blue-400' : 'text-slate-300'}`}>
                            {config.label}
                          </p>
                        </button>
                      )
                    }
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Öppna fullständigt formulär istället
                      setIsFormOpen(true)
                      setQuickAddPosition(null)
                    }}
                    className="flex-1 px-4 py-4 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors min-h-[52px]"
                  >
                    Fler detaljer
                  </button>
                  <button
                    onClick={handleQuickAdd}
                    disabled={quickAddSubmitting}
                    className="flex-1 px-4 py-4 bg-emerald-500 rounded-xl text-white font-medium hover:bg-emerald-600 transition-colors min-h-[52px] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {quickAddSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Sparar...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Placera
                      </>
                    )}
                  </button>
                </div>

                {/* Visa varning för mekaniska fällor utan serienummer */}
                {quickAddType === 'mechanical_trap' && (
                  <p className="mt-4 text-xs text-amber-400 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      Mekaniska fällor kräver normalt serienummer.
                      Klicka "Fler detaljer" för att ange serienummer.
                    </span>
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
