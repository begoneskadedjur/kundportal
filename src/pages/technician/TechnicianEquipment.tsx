// src/pages/technician/TechnicianEquipment.tsx - Teknikersida för utrustningsplacering
// Mobil-först design: Karta visas direkt med alla teknikerns placeringar
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import {
  EquipmentPlacementWithRelations,
  EquipmentType,
  requiresSerialNumber,
  getEquipmentTypeLabel,
  getEquipmentStatusLabel,
  EQUIPMENT_TYPE_CONFIG,
  EQUIPMENT_STATUS_CONFIG
} from '../../types/database'
import { EquipmentService } from '../../services/equipmentService'
import {
  EquipmentMap,
  EquipmentPlacementForm,
  EquipmentList,
  EquipmentFormData
} from '../../components/shared/equipment'
import {
  MapPin,
  Plus,
  List,
  Map as MapIcon,
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
  Search,
  LogOut,
  ChevronDown,
  ChevronUp,
  Calendar,
  Edit,
  Trash2,
  ExternalLink,
  Image as ImageIcon,
  MessageSquare
} from 'lucide-react'
import { openInMapsApp, formatCoordinates } from '../../utils/equipmentMapUtils'
import { IndoorEquipmentView } from '../../components/shared/indoor'

type ViewMode = 'map' | 'list'
type EquipmentMode = 'outdoor' | 'indoor'

interface Customer {
  id: string
  company_name: string
}

// Extrahera unika kunder från utrustningslistan
interface CustomerWithCount extends Customer {
  count: number
}

export default function TechnicianEquipment() {
  const { user, profile, signOut } = useAuth()
  const chipContainerRef = useRef<HTMLDivElement>(null)
  const [expandedEquipmentId, setExpandedEquipmentId] = useState<string | null>(null)

  // State
  const [equipmentMode, setEquipmentMode] = useState<EquipmentMode>('outdoor') // Utomhus / Inomhus
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [allEquipment, setAllEquipment] = useState<EquipmentPlacementWithRelations[]>([]) // Alla teknikerns placeringar
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('') // '' = visa alla
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEquipment, setEditingEquipment] = useState<EquipmentPlacementWithRelations | null>(null)
  const [previewPosition, setPreviewPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lightboxImage, setLightboxImage] = useState<string | null>(null) // För fullskärmsvisning av bild
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string
    equipment: EquipmentPlacementWithRelations
  } | null>(null)
  const [deleteType, setDeleteType] = useState<'removed' | 'missing' | 'damaged' | 'permanent'>('removed')

  // Snabb-lägg-till state
  const [quickAddPosition, setQuickAddPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [quickAddType, setQuickAddType] = useState<EquipmentType>('mechanical_trap')
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false)

  // Bottom-sheet för kundval (FAB utan vald kund)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')

  // Hämta tekniker-ID från profil
  const technicianId = profile?.technician_id || ''

  // Extrahera unika kunder från utrustningen (med antal)
  const customersFromEquipment = useMemo<CustomerWithCount[]>(() => {
    const customerMap = new Map<string, CustomerWithCount>()

    allEquipment.forEach(eq => {
      const customer = eq.customer as { id: string; company_name: string; contact_address?: string } | undefined
      if (customer?.id && customer?.company_name) {
        const existing = customerMap.get(customer.id)
        if (existing) {
          existing.count++
        } else {
          customerMap.set(customer.id, {
            id: customer.id,
            company_name: customer.company_name,
            count: 1
          })
        }
      }
    })

    // Sortera efter antal (mest först)
    return Array.from(customerMap.values()).sort((a, b) => b.count - a.count)
  }, [allEquipment])

  // Filtrera utrustning baserat på vald kund
  const filteredEquipment = useMemo(() => {
    if (!selectedCustomerId) return allEquipment
    return allEquipment.filter(eq => eq.customer_id === selectedCustomerId)
  }, [allEquipment, selectedCustomerId])

  // Filtrera kunder baserat på sökfråga (för bottom-sheet)
  const filteredCustomersForPicker = useMemo(() => {
    if (!customerSearchQuery.trim()) {
      return {
        yourCustomers: customersFromEquipment,
        otherCustomers: customers.filter(c => !customersFromEquipment.find(e => e.id === c.id))
      }
    }
    const query = customerSearchQuery.toLowerCase()
    return {
      yourCustomers: customersFromEquipment.filter(c =>
        c.company_name.toLowerCase().includes(query)
      ),
      otherCustomers: customers
        .filter(c => !customersFromEquipment.find(e => e.id === c.id))
        .filter(c => c.company_name.toLowerCase().includes(query))
    }
  }, [customerSearchQuery, customersFromEquipment, customers])

  // Hämta alla teknikerns placeringar vid mount
  useEffect(() => {
    const fetchAllEquipment = async () => {
      if (!technicianId) {
        setLoading(false)
        return
      }

      try {
        console.log('Hämtar all utrustning för tekniker:', technicianId)
        const data = await EquipmentService.getEquipmentByTechnician(technicianId)
        setAllEquipment(data)
      } catch (error) {
        console.error('Fel vid hämtning av utrustning:', error)
        toast.error('Kunde inte hämta utrustning')
      } finally {
        setLoading(false)
      }
    }

    fetchAllEquipment()
  }, [technicianId])

  // Hämta alla kunder för bottom-sheet (FAB utan vald kund)
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
  const refreshEquipment = useCallback(async () => {
    if (!technicianId) return

    setLoading(true)
    try {
      const data = await EquipmentService.getEquipmentByTechnician(technicianId)
      setAllEquipment(data)
    } catch (error) {
      console.error('Fel vid uppdatering av utrustning:', error)
    } finally {
      setLoading(false)
    }
  }, [technicianId])

  // Hantera klick på FAB-knapp
  const handleFabClick = () => {
    if (selectedCustomerId) {
      // Om kund är vald, öppna formuläret direkt
      setEditingEquipment(null)
      setPreviewPosition(null)
      setIsFormOpen(true)
    } else {
      // Om ingen kund är vald, visa kundväljaren
      setShowCustomerPicker(true)
    }
  }

  // Hantera kundval från bottom-sheet
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId)
    setShowCustomerPicker(false)
    // Öppna formuläret direkt efter kundval
    setTimeout(() => {
      setEditingEquipment(null)
      setPreviewPosition(null)
      setIsFormOpen(true)
    }, 100)
  }

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
    setDeleteType('removed') // Default till markera som borttagen
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
        // Uppdatera status (removed, missing, eller damaged)
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
      await refreshEquipment()
    } catch (error) {
      console.error('Fel vid borttagning:', error)
      toast.error('Kunde inte uppdatera utrustning')
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

  // Beräkna karthöjd dynamiskt (70% på mobil, 500px på desktop)
  const getMapHeight = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'calc(70vh - 120px)' // 70% minus header/filter
    }
    return '500px'
  }

  // Hitta vald kunds namn
  const selectedCustomerName = selectedCustomerId
    ? customersFromEquipment.find(c => c.id === selectedCustomerId)?.company_name ||
      customers.find(c => c.id === selectedCustomerId)?.company_name
    : null

  return (
    <div className="min-h-screen bg-slate-950 pb-24 md:pb-8">
      {/* Kompakt header för mobil */}
      <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-sm border-b border-slate-800">
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
                <h1 className="text-lg font-semibold text-white">Utrustning</h1>
                <p className="text-xs text-slate-400 hidden sm:block">
                  {filteredEquipment.length} placeringar
                  {selectedCustomerName && ` hos ${selectedCustomerName}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Vyväljare - kompakt */}
              <div className="flex bg-slate-800 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('map')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'map'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Kartvy"
                >
                  <MapIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'list'
                      ? 'bg-emerald-500 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Listvy"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Uppdateringsknapp */}
              <button
                onClick={refreshEquipment}
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

        {/* Horisontell chip-filter för kunder */}
        {equipmentMode === 'outdoor' && customersFromEquipment.length > 0 && (
          <div className="border-t border-slate-800/50">
            <div
              ref={chipContainerRef}
              className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* "Alla" chip */}
              <button
                onClick={() => setSelectedCustomerId('')}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                  !selectedCustomerId
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Alla ({allEquipment.length})
              </button>

              {/* Kund-chips */}
              {customersFromEquipment.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                    selectedCustomerId === customer.id
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {customer.company_name} ({customer.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Horisontell chip-filter för kunder - inomhus (alla avtalskunder) */}
        {equipmentMode === 'indoor' && customers.length > 0 && (
          <div className="border-t border-slate-800/50">
            <div
              className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {/* "Välj kund" chip - ingen kund vald */}
              {!selectedCustomerId && (
                <button
                  className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap min-h-[44px] flex items-center gap-2"
                >
                  <Building className="w-4 h-4" />
                  Välj kund för att börja
                </button>
              )}

              {/* Kund-chips */}
              {customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap min-h-[44px] ${
                    selectedCustomerId === customer.id
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {customer.company_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Huvudinnehåll */}
      <div className="max-w-7xl mx-auto">
        {/* Inomhus-vy */}
        {equipmentMode === 'indoor' ? (
          <IndoorEquipmentView
            customerId={selectedCustomerId || null}
            customerName={selectedCustomerName || undefined}
          />
        ) : (
          <>
            {/* Laddar */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                  <p className="text-slate-400">Laddar utrustning...</p>
                </div>
              </div>
            ) : (
              <>
                {/* Karta - visas alltid som primär vy */}
                {viewMode === 'map' && (
              <div className="md:p-4">
                <div className="md:rounded-xl md:border md:border-slate-700/50 overflow-hidden">
                  <EquipmentMap
                    equipment={filteredEquipment}
                    previewPosition={previewPosition}
                    onEditEquipment={handleEditEquipment}
                    onDeleteEquipment={handleDeleteEquipment}
                    onMapClick={handleMapClick}
                    height={getMapHeight()}
                  />
                </div>

                {/* Statistik under kartan - kompakt mobil-design */}
                {filteredEquipment.length > 0 && (
                  <div className="flex gap-2 mt-3 px-4 md:px-0 md:gap-3 md:mt-4">
                    {Object.entries(EQUIPMENT_TYPE_CONFIG).map(([type, config]) => {
                      const count = filteredEquipment.filter(e => e.equipment_type === type).length
                      const Icon = type === 'mechanical_trap' ? Crosshair :
                                   type === 'concrete_station' ? Box : Target
                      return (
                        <div
                          key={type}
                          className="flex-1 bg-slate-800/60 rounded-lg border border-slate-700/50 p-2 md:p-3 flex items-center gap-2 md:gap-3 min-w-0"
                        >
                          <div
                            className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: config.color }}
                          >
                            <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg md:text-xl font-bold text-white leading-none">{count}</p>
                            <p className="text-[10px] md:text-xs text-slate-400 truncate leading-tight mt-0.5">{config.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Utrustningstabell - visas när en kund är vald */}
                {selectedCustomerId && filteredEquipment.length > 0 && (
                  <div className="mt-4 px-4 md:px-0">
                    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                      {/* Tabellhuvud */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        <div className="col-span-1">Foto</div>
                        <div className="col-span-3">Typ</div>
                        <div className="col-span-2">Serienr</div>
                        <div className="col-span-2">Koordinater</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Åtgärder</div>
                      </div>

                      {/* Tabellrader */}
                      <div className="divide-y divide-slate-700/50">
                        {filteredEquipment.map((item) => {
                          const typeConfig = EQUIPMENT_TYPE_CONFIG[item.equipment_type]
                          const statusConfig = EQUIPMENT_STATUS_CONFIG[item.status]
                          const isExpanded = expandedEquipmentId === item.id
                          const Icon = item.equipment_type === 'mechanical_trap' ? Crosshair :
                                       item.equipment_type === 'concrete_station' ? Box : Target

                          return (
                            <div key={item.id}>
                              {/* Huvudrad */}
                              <div
                                className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-pointer items-center"
                                onClick={() => setExpandedEquipmentId(isExpanded ? null : item.id)}
                              >
                                {/* Foto - endast desktop */}
                                <div className="hidden md:flex col-span-1 items-center justify-center">
                                  {item.photo_url ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setLightboxImage(item.photo_url!)
                                      }}
                                      className="w-10 h-10 rounded-lg overflow-hidden border border-slate-600 hover:border-blue-400 transition-colors"
                                      title="Visa bild i fullskärm"
                                    >
                                      <img
                                        src={item.photo_url}
                                        alt="Utrustningsfoto"
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                      <ImageIcon className="w-4 h-4 text-slate-600" />
                                    </div>
                                  )}
                                </div>

                                {/* Typ - mobil & desktop */}
                                <div className="col-span-12 md:col-span-3 flex items-center gap-3">
                                  {/* Fotominiatyr på mobil */}
                                  {item.photo_url && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setLightboxImage(item.photo_url!)
                                      }}
                                      className="md:hidden w-10 h-10 rounded-lg overflow-hidden border border-slate-600 flex-shrink-0"
                                    >
                                      <img
                                        src={item.photo_url}
                                        alt="Utrustningsfoto"
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                  )}
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: typeConfig.color, opacity: item.status === 'removed' ? 0.5 : 1 }}
                                  >
                                    <Icon className="w-4 h-4 text-white" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-white font-medium truncate">{typeConfig.label}</p>
                                    <p className="text-xs text-slate-500 md:hidden">
                                      {item.serial_number || 'Inget serienr'}
                                    </p>
                                  </div>
                                  {/* Expand-ikon på mobil */}
                                  <div className="md:hidden ml-auto">
                                    {isExpanded ? (
                                      <ChevronUp className="w-5 h-5 text-slate-500" />
                                    ) : (
                                      <ChevronDown className="w-5 h-5 text-slate-500" />
                                    )}
                                  </div>
                                </div>

                                {/* Serienr - endast desktop */}
                                <div className="hidden md:block col-span-2">
                                  <p className="text-slate-300 font-mono text-sm">
                                    {item.serial_number || '-'}
                                  </p>
                                </div>

                                {/* Koordinater - endast desktop */}
                                <div className="hidden md:block col-span-2">
                                  <p className="text-slate-400 text-sm font-mono">
                                    {formatCoordinates(item.latitude, item.longitude)}
                                  </p>
                                </div>

                                {/* Status - endast desktop */}
                                <div className="hidden md:block col-span-2">
                                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                                    {getEquipmentStatusLabel(item.status)}
                                  </span>
                                </div>

                                {/* Åtgärder - endast desktop */}
                                <div className="hidden md:flex col-span-2 gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      openInMapsApp(item.latitude, item.longitude)
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                    title="Öppna i karta"
                                  >
                                    <ExternalLink className="w-4 h-4 text-blue-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleEditEquipment(item)
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                    title="Redigera"
                                  >
                                    <Edit className="w-4 h-4 text-amber-400" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDeleteEquipment(item)
                                    }}
                                    className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                                    title="Ta bort"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                </div>
                              </div>

                              {/* Expanderad info - mobil */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="md:hidden overflow-hidden"
                                  >
                                    <div className="px-4 pb-4 space-y-3 bg-slate-800/20">
                                      {/* Status */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-400">Status</span>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.borderColor} border`}>
                                          {getEquipmentStatusLabel(item.status)}
                                        </span>
                                      </div>

                                      {/* Serienummer */}
                                      {item.serial_number && (
                                        <div className="flex items-center justify-between">
                                          <span className="text-sm text-slate-400">Serienummer</span>
                                          <span className="text-sm text-white font-mono">{item.serial_number}</span>
                                        </div>
                                      )}

                                      {/* Koordinater */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-400">Position</span>
                                        <span className="text-sm text-slate-300 font-mono">
                                          {formatCoordinates(item.latitude, item.longitude)}
                                        </span>
                                      </div>

                                      {/* Datum */}
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-slate-400">Placerad</span>
                                        <span className="text-sm text-slate-300">
                                          {new Date(item.placed_at).toLocaleDateString('sv-SE')}
                                        </span>
                                      </div>

                                      {/* Kommentar */}
                                      {item.comment && (
                                        <div>
                                          <span className="text-sm text-slate-400">Kommentar</span>
                                          <p className="text-sm text-slate-300 mt-1">{item.comment}</p>
                                        </div>
                                      )}

                                      {/* Foto - större bild på mobil */}
                                      {item.photo_url && (
                                        <div>
                                          <span className="text-sm text-slate-400 mb-2 block">Foto</span>
                                          <button
                                            onClick={() => setLightboxImage(item.photo_url!)}
                                            className="relative w-full max-w-[200px] aspect-square rounded-xl overflow-hidden border border-slate-600 hover:border-blue-400 transition-colors"
                                          >
                                            <img
                                              src={item.photo_url}
                                              alt="Utrustningsfoto"
                                              className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                              <ImageIcon className="w-8 h-8 text-white" />
                                            </div>
                                          </button>
                                        </div>
                                      )}

                                      {/* Åtgärder */}
                                      <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                                        <button
                                          onClick={() => openInMapsApp(item.latitude, item.longitude)}
                                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg text-blue-400 text-sm"
                                        >
                                          <ExternalLink className="w-4 h-4" />
                                          Visa i karta
                                        </button>
                                        <button
                                          onClick={() => handleEditEquipment(item)}
                                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-500/10 rounded-lg text-amber-400 text-sm"
                                        >
                                          <Edit className="w-4 h-4" />
                                          Redigera
                                        </button>
                                        <button
                                          onClick={() => handleDeleteEquipment(item)}
                                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 rounded-lg text-red-400 text-sm"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                          Ta bort
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Lista */}
            {viewMode === 'list' && (
              <div className="p-4">
                <EquipmentList
                  equipment={filteredEquipment}
                  onEditEquipment={handleEditEquipment}
                  onDeleteEquipment={handleDeleteEquipment}
                />
              </div>
            )}

            {/* Tom state - endast om inga placeringar finns */}
            {allEquipment.length === 0 && (
              <div className="text-center py-16 px-4">
                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-xl font-semibold text-slate-300 mb-2">
                  Inga placeringar än
                </h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                  Du har inte placerat någon utrustning än. Tryck på + knappen för att lägga till din första.
                </p>
              </div>
            )}
          </>
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
                    customers={customers}
                    onCustomerChange={setSelectedCustomerId}
                    showCustomerPicker={!editingEquipment} // Visa kundväljare endast för nya placeringar
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

        {/* Bottom-sheet för kundval (när FAB klickas utan vald kund) */}
        <AnimatePresence>
          {showCustomerPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
              onClick={() => {
                setShowCustomerPicker(false)
                setCustomerSearchQuery('')
              }}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2">
                  <div className="w-12 h-1 rounded-full bg-slate-700" />
                </div>

                {/* Header med sökfält */}
                <div className="px-6 pb-4 border-b border-slate-800">
                  <h3 className="text-xl font-semibold text-white mb-1">Välj kund</h3>
                  <p className="text-sm text-slate-400 mb-3">
                    Sök eller välj vilken kund du vill placera utrustning hos
                  </p>

                  {/* Sökfält */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="w-5 h-5 text-slate-500" />
                    </div>
                    <input
                      type="text"
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      placeholder="Sök kund..."
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    {customerSearchQuery && (
                      <button
                        onClick={() => setCustomerSearchQuery('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <X className="w-5 h-5 text-slate-500 hover:text-white" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Kundlista */}
                <div className="overflow-y-auto flex-1 p-4">
                  <div className="space-y-2">
                    {/* Kunder från utrustningen först (med antal) */}
                    {filteredCustomersForPicker.yourCustomers.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-2 mb-2">
                          Dina kunder
                        </p>
                        {filteredCustomersForPicker.yourCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              handleCustomerSelect(customer.id)
                              setCustomerSearchQuery('')
                            }}
                            className="w-full p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors text-left flex items-center justify-between min-h-[60px]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                <Building className="w-5 h-5 text-emerald-400" />
                              </div>
                              <span className="font-medium text-white">{customer.company_name}</span>
                            </div>
                            <span className="text-sm text-slate-400">{customer.count} st</span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Övriga kunder */}
                    {filteredCustomersForPicker.otherCustomers.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-2 mt-4 mb-2">
                          Alla kunder
                        </p>
                        {filteredCustomersForPicker.otherCustomers.map((customer) => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              handleCustomerSelect(customer.id)
                              setCustomerSearchQuery('')
                            }}
                            className="w-full p-4 rounded-xl bg-slate-800/30 hover:bg-slate-800 transition-colors text-left flex items-center gap-3 min-h-[60px]"
                          >
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                              <Building className="w-5 h-5 text-slate-400" />
                            </div>
                            <span className="font-medium text-slate-300">{customer.company_name}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Inga resultat */}
                    {filteredCustomersForPicker.yourCustomers.length === 0 &&
                     filteredCustomersForPicker.otherCustomers.length === 0 && (
                      <div className="text-center py-8">
                        <Building className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">
                          Inga kunder matchar "{customerSearchQuery}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cancel button */}
                <div className="p-4 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setShowCustomerPicker(false)
                      setCustomerSearchQuery('')
                    }}
                    className="w-full p-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors min-h-[52px]"
                  >
                    Avbryt
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
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-emerald-500 shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-600 transition-colors"
          style={{ touchAction: 'none' }}
        >
          <Plus className="w-8 h-8 text-white" />
        </motion.button>
      )}
    </div>
  )
}
