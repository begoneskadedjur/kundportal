// src/pages/technician/TechnicianEquipment.tsx - Teknikersida för utrustningsplacering
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  requiresSerialNumber
} from '../../types/database'
import { EquipmentService } from '../../services/equipmentService'
import {
  EquipmentMap,
  EquipmentPlacementForm,
  EquipmentList,
  EquipmentFormData
} from '../../components/shared/equipment'
import TechnicianPortalLayout from '../../components/technician/TechnicianPortalLayout'
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
  AlertCircle
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

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
    setDeleteConfirm(equipment.id)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const result = await EquipmentService.updateEquipmentStatus(
        deleteConfirm,
        'removed',
        technicianId
      )

      if (!result.success) {
        throw new Error(result.error)
      }

      toast.success('Utrustning markerad som borttagen')
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

  return (
    <TechnicianPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <MapPin className="w-7 h-7 text-emerald-400" />
              Utrustningsplacering
            </h1>
            <p className="text-slate-400 mt-1">
              Placera och hantera fällor och stationer hos kunder
            </p>
          </div>

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
                      Markera som borttagen?
                    </h3>
                    <p className="text-slate-400 text-sm">
                      Utrustningen kommer att markeras som borttagen
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-3 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Avbryt
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-3 bg-red-500 rounded-lg text-white font-medium hover:bg-red-600 transition-colors"
                  >
                    Markera borttagen
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </TechnicianPortalLayout>
  )
}
