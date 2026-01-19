// src/pages/technician/TechnicianEquipment.tsx
// Refaktorerad design: Kundlista som primär vy med 50/50 statistik+karta överst
import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  getEquipmentTypeLabel,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG
} from '../../types/database'
import { EquipmentService, CustomerStationSummary } from '../../services/equipmentService'
import {
  EquipmentMap,
  EquipmentPlacementForm,
  EquipmentFormData
} from '../../components/shared/equipment'
import {
  MapPin,
  Plus,
  Loader2,
  RefreshCw,
  Building,
  X,
  AlertCircle,
  Crosshair,
  Box,
  Target,
  Check,
  ChevronLeft,
  LogOut,
  Edit,
  Trash2,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react'
import { openInMapsApp, formatCoordinates } from '../../utils/equipmentMapUtils'
import { IndoorEquipmentView } from '../../components/shared/indoor'
import { CustomerStationsList } from '../../components/technician/CustomerStationsList'
import { CustomerStationsModal } from '../../components/technician/CustomerStationsModal'
import { CollapsibleMapSection } from '../../components/technician/CollapsibleMapSection'
import { AddStationWizard } from '../../components/technician/AddStationWizard'

type EquipmentMode = 'outdoor' | 'indoor'

interface Customer {
  id: string
  company_name: string
}

export default function TechnicianEquipment() {
  const { profile, signOut } = useAuth()

  // State
  const [equipmentMode, setEquipmentMode] = useState<EquipmentMode>('outdoor')
  const [allEquipment, setAllEquipment] = useState<EquipmentPlacementWithRelations[]>([])
  const [customerSummaries, setCustomerSummaries] = useState<CustomerStationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])

  // Modal för kundstationer
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<CustomerStationSummary | null>(null)

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardCustomerId, setWizardCustomerId] = useState<string | null>(null)

  // Borttagningsdialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    equipment: EquipmentPlacementWithRelations
  } | null>(null)
  const [deleteType, setDeleteType] = useState<'removed' | 'missing' | 'damaged' | 'permanent'>('removed')

  // Inomhus kundval
  const [selectedIndoorCustomerId, setSelectedIndoorCustomerId] = useState<string>('')

  // Hämta tekniker-ID från profil
  const technicianId = profile?.technician_id || ''

  // Beräkna statistik
  const stats = useMemo(() => {
    const outdoorEquipment = allEquipment.filter(e => e.latitude && e.longitude)
    const byStatus: Record<string, number> = {}
    outdoorEquipment.forEach(e => {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1
    })

    return {
      total: outdoorEquipment.length,
      outdoor: outdoorEquipment.length,
      indoor: 0, // Vi hanterar inomhus separat
      byStatus,
      customerCount: customerSummaries.length
    }
  }, [allEquipment, customerSummaries])

  // Hämta alla teknikerns placeringar vid mount
  useEffect(() => {
    const fetchData = async () => {
      if (!technicianId) {
        setLoading(false)
        return
      }

      try {
        console.log('Hämtar all utrustning för tekniker:', technicianId)
        const [equipmentData, summaries] = await Promise.all([
          EquipmentService.getEquipmentByTechnician(technicianId),
          EquipmentService.getCustomerStationSummaries(technicianId)
        ])
        setAllEquipment(equipmentData)
        setCustomerSummaries(summaries)
      } catch (error) {
        console.error('Fel vid hämtning av utrustning:', error)
        toast.error('Kunde inte hämta utrustning')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [technicianId])

  // Hämta alla kunder för wizard/formulär
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const customerList = await EquipmentService.getCustomersForDropdown()
        setCustomers(customerList)
      } catch (error) {
        console.error('Fel vid hämtning av kunder:', error)
      }
    }
    fetchCustomers()
  }, [])

  // Uppdatera utrustning
  const refreshData = useCallback(async () => {
    if (!technicianId) return

    setLoading(true)
    try {
      const [equipmentData, summaries] = await Promise.all([
        EquipmentService.getEquipmentByTechnician(technicianId),
        EquipmentService.getCustomerStationSummaries(technicianId)
      ])
      setAllEquipment(equipmentData)
      setCustomerSummaries(summaries)
    } catch (error) {
      console.error('Fel vid uppdatering av utrustning:', error)
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  // Hantera klick på FAB
  const handleFabClick = () => {
    setIsWizardOpen(true)
  }

  // Hantera wizard complete
  const handleWizardComplete = (customerId: string, type: 'outdoor' | 'indoor') => {
    if (type === 'outdoor') {
      setWizardCustomerId(customerId)
      setEditingEquipment(null)
      setPreviewPosition(null)
      setIsFormOpen(true)
    } else {
      // För inomhus, byt till inomhusläge och välj kunden
      setEquipmentMode('indoor')
      setSelectedIndoorCustomerId(customerId)
    }
  }

  // Hantera kundklick i listan
  const handleCustomerClick = (customer: CustomerStationSummary) => {
    setSelectedCustomerForModal(customer)
  }

  // Hantera stationsklick i modal
  const handleStationClick = (station: EquipmentPlacementWithRelations, type: 'outdoor' | 'indoor') => {
    if (type === 'outdoor') {
      // Öppna redigeringsformulär
      setEditingEquipment(station)
      setPreviewPosition({ lat: station.latitude, lng: station.longitude })
      setWizardCustomerId(station.customer_id)
      setIsFormOpen(true)
      setSelectedCustomerForModal(null)
    }
    // För inomhus hanteras det i IndoorEquipmentView
  }

  // Hantera "Lägg till station" från modal
  const handleAddStationFromModal = (customerId: string, type: 'outdoor' | 'indoor') => {
    setSelectedCustomerForModal(null)
    if (type === 'outdoor') {
      setWizardCustomerId(customerId)
      setEditingEquipment(null)
      setPreviewPosition(null)
      setIsFormOpen(true)
    } else {
      setEquipmentMode('indoor')
      setSelectedIndoorCustomerId(customerId)
    }
  }

  // Hantera ny placering
  const handleFormSubmit = async (formData: EquipmentFormData) => {
    const customerId = wizardCustomerId || formData.customer_id
    if (!customerId || !technicianId) {
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
          customer_id: customerId,
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
      setWizardCustomerId(null)
      await refreshData()
    } catch (error) {
      console.error('Fel vid sparande:', error)
      toast.error(error instanceof Error ? error.message : 'Kunde inte spara utrustning')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Hantera borttagning
  const handleDeleteEquipment = (equipment: EquipmentPlacementWithRelations) => {
    setDeleteConfirm({ id: equipment.id, equipment })
    setDeleteType('removed')
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      if (deleteType === 'permanent') {
        const result = await EquipmentService.deleteEquipment(deleteConfirm.id)
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success('Utrustning permanent raderad')
      } else {
        const statusLabels = {
          removed: 'borttagen',
          missing: 'försvunnen',
          damaged: 'skadad'
        }
        const result = await EquipmentService.updateEquipmentStatus(
          deleteConfirm.id,
          deleteType,
          technicianId
        )
        if (!result.success) {
          throw new Error(result.error)
        }
        toast.success(`Utrustning markerad som ${statusLabels[deleteType]}`)
      }

      setDeleteConfirm(null)
      await refreshData()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte uppdatera utrustning')
    }
  }

  // Hantera redigering
  const handleEditEquipment = (equipment: EquipmentPlacementWithRelations) => {
    setEditingEquipment(equipment)
    setPreviewPosition({ lat: equipment.latitude, lng: equipment.longitude })
    setWizardCustomerId(equipment.customer_id)
    setIsFormOpen(true)
  }

  // Hantera GPS-fångst
  const handleLocationCapture = (lat: number, lng: number) => {
    setPreviewPosition({ lat, lng })
  }

  // Hantera klick på karta för att öppna utrustning
  const handleEquipmentClick = (equipment: EquipmentPlacementWithRelations) => {
    // Öppna kundmodalen med denna kunds stationer
    const customerSummary = customerSummaries.find(c => c.customer_id === equipment.customer_id)
    if (customerSummary) {
      setSelectedCustomerForModal(customerSummary)
    }
  }

  // Hitta vald kunds namn för inomhus
  const selectedIndoorCustomerName = selectedIndoorCustomerId
    ? customers.find(c => c.id === selectedIndoorCustomerId)?.company_name
    : null

  return (
    <div className="min-h-screen bg-slate-950 pb-24 md:pb-8">
      {/* Kompakt header */}
      <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/technician/dashboard"
                className="p-2 -ml-2 rounded-lg hover:bg-slate-800 transition-colors"
                title="Tillbaka till dashboard"
              >
                <ChevronLeft className="w-5 h-5 text-slate-400" />
              </a>
              <div>
                <h1 className="text-lg font-semibold text-white">Stationer</h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  {stats.total} placeringar hos {stats.customerCount} kunder
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Uppdateringsknapp */}
              <button
                onClick={refreshData}
                disabled={loading}
                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Uppdatera"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              {/* Logga ut-knapp */}
              <button
                onClick={signOut}
                className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-colors"
                title="Logga ut"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Utomhus / Inomhus toggle */}
        <div className="border-t border-slate-800/50 px-4 py-3">
          <div className="flex bg-slate-800 rounded-lg p-1 max-w-xs">
            <button
              onClick={() => setEquipmentMode('outdoor')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                equipmentMode === 'outdoor'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-4 h-4" />
              Utomhus
            </button>
            <button
              onClick={() => setEquipmentMode('indoor')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                equipmentMode === 'indoor'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building className="w-4 h-4" />
              Inomhus
            </button>
          </div>
        </div>
      </div>

      {/* Huvudinnehåll */}
      <div className="max-w-7xl mx-auto">
        {/* Inomhus-vy */}
        {equipmentMode === 'indoor' ? (
          <div className="p-4">
            {/* Kundväljare för inomhus */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Välj kund
              </label>
              <select
                value={selectedIndoorCustomerId}
                onChange={(e) => setSelectedIndoorCustomerId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Välj kund --</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </option>
                ))}
              </select>
            </div>

            {selectedIndoorCustomerId ? (
              <IndoorEquipmentView
                customerId={selectedIndoorCustomerId}
                customerName={selectedIndoorCustomerName || undefined}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                  <Building className="w-8 h-8 text-slate-500" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">
                  Välj en kund
                </h3>
                <p className="text-slate-400 text-sm max-w-xs">
                  Välj en kund ovan för att se och hantera inomhusstationer
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Utomhus-vy */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Laddar utrustning...</p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {/* Kollapsbar kartsektion med statistik */}
                {allEquipment.length > 0 && (
                  <CollapsibleMapSection
                    equipment={allEquipment}
                    stats={stats}
                    onEquipmentClick={handleEquipmentClick}
                    defaultExpanded={true}
                  />
                )}

                {/* Kundlista */}
                <div>
                  <h2 className="text-lg font-semibold text-white mb-4">
                    Kunder med stationer
                  </h2>
                  <CustomerStationsList
                    customers={customerSummaries}
                    loading={loading}
                    onCustomerClick={handleCustomerClick}
                  />
                </div>

                {/* Tom state */}
                {allEquipment.length === 0 && customerSummaries.length === 0 && (
                  <div className="text-center py-16 px-4">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <MapPin className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-300 mb-2">
                      Inga stationer än
                    </h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-6">
                      Du har inte placerat några stationer än. Tryck på + knappen för att lägga till din första.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Kundstationsmodal */}
            <CustomerStationsModal
              customer={selectedCustomerForModal}
              isOpen={!!selectedCustomerForModal}
              onClose={() => setSelectedCustomerForModal(null)}
              onAddStation={handleAddStationFromModal}
              onStationClick={handleStationClick}
            />

            {/* Wizard för att lägga till station */}
            <AddStationWizard
              isOpen={isWizardOpen}
              onClose={() => setIsWizardOpen(false)}
              onComplete={handleWizardComplete}
              technicianId={technicianId}
            />

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
                    setWizardCustomerId(null)
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
                          setWizardCustomerId(null)
                        }}
                        className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                      >
                        <X className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>

                    {/* Formulär */}
                    <div className="p-6">
                      <EquipmentPlacementForm
                        customerId={wizardCustomerId || ''}
                        technicianId={technicianId}
                        existingEquipment={editingEquipment}
                        onSubmit={handleFormSubmit}
                        onCancel={() => {
                          setIsFormOpen(false)
                          setEditingEquipment(null)
                          setPreviewPosition(null)
                          setWizardCustomerId(null)
                        }}
                        onLocationCapture={handleLocationCapture}
                        isSubmitting={isSubmitting}
                        customers={customers}
                        onCustomerChange={(id) => setWizardCustomerId(id)}
                        showCustomerPicker={!editingEquipment && !wizardCustomerId}
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

                    {/* Val mellan statusar */}
                    <div className="space-y-2 mb-6">
                      {/* Borttagen */}
                      <button
                        onClick={() => setDeleteType('removed')}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          deleteType === 'removed'
                            ? 'border-slate-400 bg-slate-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            deleteType === 'removed' ? 'border-slate-400' : 'border-slate-600'
                          }`}>
                            {deleteType === 'removed' && (
                              <div className="w-2 h-2 rounded-full bg-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">Borttagen</p>
                            <p className="text-xs text-slate-400">Utrustning har plockats bort</p>
                          </div>
                        </div>
                      </button>

                      {/* Försvunnen */}
                      <button
                        onClick={() => setDeleteType('missing')}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          deleteType === 'missing'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            deleteType === 'missing' ? 'border-amber-500' : 'border-slate-600'
                          }`}>
                            {deleteType === 'missing' && (
                              <div className="w-2 h-2 rounded-full bg-amber-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">Försvunnen</p>
                            <p className="text-xs text-slate-400">Kunde inte hittas på platsen</p>
                          </div>
                        </div>
                      </button>

                      {/* Skadad */}
                      <button
                        onClick={() => setDeleteType('damaged')}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          deleteType === 'damaged'
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            deleteType === 'damaged' ? 'border-red-500' : 'border-slate-600'
                          }`}>
                            {deleteType === 'damaged' && (
                              <div className="w-2 h-2 rounded-full bg-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">Skadad & ur funktion</p>
                            <p className="text-xs text-slate-400">Trasig, behöver bytas</p>
                          </div>
                        </div>
                      </button>

                      {/* Separator */}
                      <div className="border-t border-slate-700 my-3" />

                      {/* Permanent radering */}
                      <button
                        onClick={() => setDeleteType('permanent')}
                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                          deleteType === 'permanent'
                            ? 'border-red-600 bg-red-600/10'
                            : 'border-slate-700 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            deleteType === 'permanent' ? 'border-red-600' : 'border-slate-600'
                          }`}>
                            {deleteType === 'permanent' && (
                              <div className="w-2 h-2 rounded-full bg-red-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-red-400 text-sm">Radera permanent</p>
                            <p className="text-xs text-slate-400">Tas bort helt, kan ej återställas</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="flex-1 px-4 py-3 border border-slate-700 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors"
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={confirmDelete}
                        className={`flex-1 px-4 py-3 rounded-xl text-white font-medium transition-colors ${
                          deleteType === 'permanent'
                            ? 'bg-red-600 hover:bg-red-700'
                            : deleteType === 'damaged'
                              ? 'bg-red-500 hover:bg-red-600'
                              : deleteType === 'missing'
                                ? 'bg-amber-500 hover:bg-amber-600'
                                : 'bg-slate-500 hover:bg-slate-600'
                        }`}
                      >
                        {deleteType === 'permanent' ? 'Radera' : 'Bekräfta'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lightbox för fullskärmsvisning av foto */}
            <AnimatePresence>
              {lightboxImage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
                  onClick={() => setLightboxImage(null)}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
                  >
                    <img
                      src={lightboxImage}
                      alt="Utrustningsfoto"
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                    <button
                      onClick={() => setLightboxImage(null)}
                      className="absolute top-4 right-4 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* FAB-knapp för ny placering - endast utomhus-vy */}
      {equipmentMode === 'outdoor' && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleFabClick}
          className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
          style={{ touchAction: 'none' }}
        >
          <Plus className="w-8 h-8 text-white" />
        </motion.button>
      )}
    </div>
  )
}
