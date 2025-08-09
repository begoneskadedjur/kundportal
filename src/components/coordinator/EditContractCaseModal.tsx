// src/components/coordinator/EditContractCaseModal.tsx
// Modal för att redigera avtalsärenden med glass morphism design och lila accenter

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { X, User, Phone, Mail, MapPin, Calendar, AlertCircle, Save, Clock, FileText, Users, Crown, Star } from 'lucide-react'
import Button from '../ui/Button'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { PEST_TYPES } from '../../utils/clickupFieldMapper'
import TechnicianDropdown from '../admin/TechnicianDropdown'

interface EditContractCaseModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  caseData: any
  isCustomerView?: boolean
}

export default function EditContractCaseModal({
  isOpen,
  onClose,
  onSuccess,
  caseData,
  isCustomerView = false
}: EditContractCaseModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    // Grundläggande information
    title: '',
    description: '',
    status: 'requested',
    
    // Kontaktperson
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    alternative_contact_person: '',
    alternative_contact_phone: '',
    alternative_contact_email: '',
    
    // Adress och skadedjur
    address: '',
    pest_type: '',
    other_pest_type: '',
    
    // Schemaläggning
    scheduled_start: null as Date | null,
    scheduled_end: null as Date | null,
    
    // Tekniker (upp till 3)
    primary_technician_id: '',
    primary_technician_name: '',
    secondary_technician_id: '',
    secondary_technician_name: '',
    tertiary_technician_id: '',
    tertiary_technician_name: '',
    
    // Arbetsrapport och rekommendationer
    work_report: '',
    recommendations: '',
    
    // Tid, material och pris
    time_spent_minutes: 0,
    materials_used: '',
    material_cost: 0,
    price: 0
  })

  const [technicians, setTechnicians] = useState<any[]>([])

  useEffect(() => {
    if (caseData && isOpen) {
      setFormData({
        title: caseData.title || '',
        description: caseData.description || '',
        status: caseData.status || 'requested',
        contact_person: caseData.contact_person || caseData.kontaktperson || '',
        contact_phone: caseData.contact_phone || caseData.telefon_kontaktperson || '',
        contact_email: caseData.contact_email || caseData.email || '',
        alternative_contact_person: caseData.alternative_contact_person || '',
        alternative_contact_phone: caseData.alternative_contact_phone || '',
        alternative_contact_email: caseData.alternative_contact_email || '',
        address: caseData.address?.formatted_address || caseData.address || caseData.adress || '',
        pest_type: caseData.pest_type || caseData.skadedjur || '',
        other_pest_type: caseData.other_pest_type || caseData.annat_skadedjur || '',
        scheduled_start: caseData.scheduled_start ? new Date(caseData.scheduled_start) : null,
        scheduled_end: caseData.scheduled_end ? new Date(caseData.scheduled_end) : null,
        primary_technician_id: caseData.primary_technician_id || '',
        primary_technician_name: caseData.primary_technician_name || '',
        secondary_technician_id: caseData.secondary_technician_id || '',
        secondary_technician_name: caseData.secondary_technician_name || '',
        tertiary_technician_id: caseData.tertiary_technician_id || '',
        tertiary_technician_name: caseData.tertiary_technician_name || '',
        work_report: caseData.work_report || '',
        recommendations: caseData.recommendations || '',
        time_spent_minutes: caseData.time_spent_minutes || 0,
        materials_used: caseData.materials_used || '',
        material_cost: caseData.material_cost || 0,
        price: caseData.price || 0
      })
    }
  }, [caseData, isOpen])

  useEffect(() => {
    fetchTechnicians()
  }, [])

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setTechnicians(data || [])
    } catch (error) {
      console.error('Error fetching technicians:', error)
    }
  }

  const handleTechnicianChange = (role: 'primary' | 'secondary' | 'tertiary', technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId)
    
    setFormData(prev => ({
      ...prev,
      [`${role}_technician_id`]: technicianId,
      [`${role}_technician_name`]: technician?.name || ''
    }))
  }

  const handleSubmit = async () => {
    if (!caseData?.id) return

    setLoading(true)
    try {
      // Rensa tomma strängar för UUID och andra fält som ska vara NULL
      const cleanedFormData = {
        ...formData,
        // Konvertera tomma strängar till null för UUID-fält
        primary_technician_id: formData.primary_technician_id || null,
        secondary_technician_id: formData.secondary_technician_id || null,
        tertiary_technician_id: formData.tertiary_technician_id || null,
        // Konvertera tomma strängar till null för text-fält som kan vara null
        primary_technician_name: formData.primary_technician_name || null,
        secondary_technician_name: formData.secondary_technician_name || null,
        tertiary_technician_name: formData.tertiary_technician_name || null,
        other_pest_type: formData.other_pest_type || null,
        alternative_contact_person: formData.alternative_contact_person || null,
        alternative_contact_phone: formData.alternative_contact_phone || null,
        alternative_contact_email: formData.alternative_contact_email || null,
        work_report: formData.work_report || null,
        recommendations: formData.recommendations || null,
        materials_used: formData.materials_used || null,
        pest_type: formData.pest_type || null
      };

      const updateData: any = {
        ...cleanedFormData,
        scheduled_start: formData.scheduled_start?.toISOString() || null,
        scheduled_end: formData.scheduled_end?.toISOString() || null,
        updated_at: new Date().toISOString()
      }

      // Om det är kundvy, begränsa vad som kan uppdateras
      if (isCustomerView) {
        const allowedFields = [
          'contact_person', 'contact_phone', 'contact_email',
          'alternative_contact_person', 'alternative_contact_phone', 'alternative_contact_email',
          'description'
        ]
        
        const filteredData: any = {}
        allowedFields.forEach(field => {
          if (field in updateData) {
            filteredData[field] = updateData[field]
          }
        })
        
        const { error } = await supabase
          .from('cases')
          .update(filteredData)
          .eq('id', caseData.id)

        if (error) throw error
      } else {
        // Koordinator/tekniker kan uppdatera allt
        const { error } = await supabase
          .from('cases')
          .update(updateData)
          .eq('id', caseData.id)

        if (error) throw error
      }

      toast.success('Ärende uppdaterat!')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error updating case:', error)
      toast.error('Kunde inte uppdatera ärendet')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop med blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal med glass morphism */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl">
        {/* Glass morphism bakgrund */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-purple-500/5" />
        
        {/* Border glow effect */}
        <div className="absolute inset-0 rounded-2xl border border-purple-500/20" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col h-full max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Crown className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {isCustomerView ? 'Visa Serviceärende' : 'Redigera Avtalsärende'}
                </h2>
                <p className="text-sm text-purple-300">Premium kundsupport</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Body - scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Grundläggande information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Ärendeinformation
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Rubrik
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      disabled={isCustomerView}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      disabled={isCustomerView}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 [&>option]:bg-slate-900 [&>option]:text-white"
                    >
                      <option value="requested">Begärd</option>
                      <option value="scheduled">Schemalagd</option>
                      <option value="in_progress">Pågående</option>
                      <option value="completed">Avslutad</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Beskrivning
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={isCustomerView && formData.status !== 'requested'}
                    rows={3}
                    className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Kontaktpersoner */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Kontaktpersoner
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Primär kontaktperson */}
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-slate-400">Primär kontaktperson</p>
                    
                    <input
                      type="text"
                      placeholder="Namn"
                      value={formData.contact_person}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_person: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    
                    <input
                      type="email"
                      placeholder="E-post"
                      value={formData.contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                  </div>

                  {/* Alternativ kontaktperson */}
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-slate-400">Alternativ kontaktperson</p>
                    
                    <input
                      type="text"
                      placeholder="Namn"
                      value={formData.alternative_contact_person}
                      onChange={(e) => setFormData(prev => ({ ...prev, alternative_contact_person: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    
                    <input
                      type="tel"
                      placeholder="Telefon"
                      value={formData.alternative_contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, alternative_contact_phone: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                    
                    <input
                      type="email"
                      placeholder="E-post"
                      value={formData.alternative_contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, alternative_contact_email: e.target.value }))}
                      disabled={isCustomerView && formData.status !== 'requested'}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>

              {/* Plats och skadedjur */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Plats & Skadedjur
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Adress
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      disabled={isCustomerView}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Skadedjur
                    </label>
                    <select
                      value={formData.pest_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, pest_type: e.target.value }))}
                      disabled={isCustomerView}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 [&>option]:bg-slate-900 [&>option]:text-white"
                    >
                      <option value="">Välj skadedjur...</option>
                      {PEST_TYPES.map(pest => (
                        <option key={pest} value={pest}>{pest}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {formData.pest_type === 'Övrigt' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Beskriv skadedjur
                    </label>
                    <input
                      type="text"
                      value={formData.other_pest_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, other_pest_type: e.target.value }))}
                      disabled={isCustomerView}
                      className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                    />
                  </div>
                )}
              </div>

              {/* Schemaläggning - endast för koordinator/tekniker */}
              {!isCustomerView && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Schemaläggning
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Starttid
                      </label>
                      <DatePicker
                        selected={formData.scheduled_start}
                        onChange={(date) => setFormData(prev => ({ ...prev, scheduled_start: date }))}
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        locale="sv"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        placeholderText="Välj starttid..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Sluttid
                      </label>
                      <DatePicker
                        selected={formData.scheduled_end}
                        onChange={(date) => setFormData(prev => ({ ...prev, scheduled_end: date }))}
                        showTimeSelect
                        dateFormat="yyyy-MM-dd HH:mm"
                        timeFormat="HH:mm"
                        timeIntervals={15}
                        locale="sv"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        placeholderText="Välj sluttid..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tekniker - endast för koordinator */}
              {!isCustomerView && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Tekniker (upp till 3)
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <TechnicianDropdown
                        label="Primär tekniker"
                        value={formData.primary_technician_id}
                        onChange={(value) => handleTechnicianChange('primary', value)}
                        required
                      />
                    </div>

                    <div>
                      <TechnicianDropdown
                        label="Sekundär tekniker"
                        value={formData.secondary_technician_id}
                        onChange={(value) => handleTechnicianChange('secondary', value)}
                        placeholder="Välj sekundär tekniker..."
                      />
                    </div>

                    <div>
                      <TechnicianDropdown
                        label="Tertiär tekniker"
                        value={formData.tertiary_technician_id}
                        onChange={(value) => handleTechnicianChange('tertiary', value)}
                        placeholder="Välj tertiär tekniker..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Arbetsrapport och kundinformation */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Arbetsrapport & Kundinformation
                </h3>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Utfört arbete
                  </label>
                  <textarea
                    value={formData.work_report}
                    onChange={(e) => setFormData(prev => ({ ...prev, work_report: e.target.value }))}
                    disabled={isCustomerView}
                    rows={4}
                    placeholder="Beskriv utfört arbete..."
                    className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                  />
                </div>

                {/* Preparat/produkter - viktig säkerhetsinformation */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <AlertCircle className="inline w-4 h-4 text-amber-400 mr-1" />
                    Använda preparat & säkerhetsinformation
                  </label>
                  <textarea
                    value={formData.materials_used}
                    onChange={(e) => setFormData(prev => ({ ...prev, materials_used: e.target.value }))}
                    disabled={isCustomerView}
                    rows={4}
                    placeholder="Lista använda preparat, gifter och säkerhetsinformation för kunden..."
                    className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                  />
                  <p className="text-xs text-amber-400/70 mt-1">
                    Inkludera information om gifter, säkerhetsåtgärder och hanteringsriktlinjer
                  </p>
                </div>

                {/* Rekommendationer - viktig för kunder */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Star className="inline w-4 h-4 text-purple-400 mr-1" />
                    Rekommendationer
                  </label>
                  <textarea
                    value={formData.recommendations}
                    onChange={(e) => setFormData(prev => ({ ...prev, recommendations: e.target.value }))}
                    disabled={isCustomerView}
                    rows={3}
                    placeholder="Rekommendationer för kunden..."
                    className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Tid och kostnader - endast för koordinator/tekniker */}
              {!isCustomerView && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-purple-300 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Tid & Kostnader
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Arbetstid (minuter)
                      </label>
                      <input
                        type="number"
                        value={formData.time_spent_minutes}
                        onChange={(e) => setFormData(prev => ({ ...prev, time_spent_minutes: parseInt(e.target.value) || 0 }))}
                        min="0"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Materialkostnad (kr)
                      </label>
                      <input
                        type="number"
                        value={formData.material_cost}
                        onChange={(e) => setFormData(prev => ({ ...prev, material_cost: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Totalpris (kr)
                      </label>
                      <input
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                        min="0"
                        className="w-full px-3 py-2 bg-white/5 border border-purple-500/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-purple-500/20">
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Avbryt
              </Button>
              
              {!isCustomerView && (
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Sparar...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Spara ändringar
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}