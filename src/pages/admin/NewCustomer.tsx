// src/pages/admin/NewCustomer.tsx - DIN BEFINTLIGA AVANCERADE VERSION + contract_end_date
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, Building2, User, Mail, Phone, MapPin, 
  FileText, Calendar, DollarSign, Clock, Users, Briefcase, Calculator
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import TechnicianDropdown from '../../components/admin/TechnicianDropdown'
import { customerService } from '../../services/customerService'
import { supabase } from '../../lib/supabase'
import { BUSINESS_TYPES, getBusinessTypeIcon } from '../../constants/businessTypes'
import { calculateContractEndDate } from '../../types/database' // 🆕 Import hjälpfunktion
import toast from 'react-hot-toast'

type ContractType = {
  id: string
  name: string
  clickup_folder_id: string
}

export default function NewCustomer() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [formData, setFormData] = useState({
    // Grundinformation
    company_name: '',
    org_number: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    contract_type_id: '',
    business_type: '',
    
    // Avtalsinformation - UPPDATERAD med contract_end_date
    contract_start_date: '',
    contract_length_months: '',
    contract_end_date: '', // 🆕 NYA FÄLTET
    annual_premium: '',
    total_contract_value: '',
    contract_description: '',
    assigned_account_manager: '' // Kommer att vara tekniker-email från TechnicianDropdown
  })

  useEffect(() => {
    fetchContractTypes()
  }, [])

  // 🆕 Automatisk beräkning av slutdatum
  useEffect(() => {
    if (formData.contract_start_date && formData.contract_length_months) {
      const months = parseInt(formData.contract_length_months)
      if (months > 0) {
        const endDate = calculateContractEndDate(formData.contract_start_date, months)
        setFormData(prev => ({ ...prev, contract_end_date: endDate }))
      }
    }
  }, [formData.contract_start_date, formData.contract_length_months])

  // Beräkna totalt avtalsvärde automatiskt (BEHÅLLS OFÖRÄNDRAD)
  useEffect(() => {
    if (formData.annual_premium && formData.contract_length_months) {
      const annualPremium = parseFloat(formData.annual_premium)
      const lengthYears = parseInt(formData.contract_length_months) / 12
      const totalValue = annualPremium * lengthYears
      
      setFormData(prev => ({
        ...prev,
        total_contract_value: totalValue.toFixed(2)
      }))
    }
  }, [formData.annual_premium, formData.contract_length_months])

  const fetchContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_types')
        .select('*')
        .eq('is_active', true)
        .order('display_order')

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error fetching contract types:', error)
      toast.error('Kunde inte hämta avtalstyper')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.contract_type_id) {
      toast.error('Du måste välja en avtalstyp')
      return
    }

    if (!formData.contract_start_date) {
      toast.error('Du måste ange avtalets startdatum')
      return
    }

    if (!formData.business_type) {
      toast.error('Du måste välja verksamhetstyp')
      return
    }

    if (!formData.assigned_account_manager) {
      toast.error('Du måste välja kontraktansvarig')
      return
    }

    setLoading(true)
    
    try {
      await customerService.createCustomer(formData)
      toast.success('Kund skapad och inbjudan skickad!')
      navigate('/admin/customers')
    } catch (error) {
      // Felhantering sker i service
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleBusinessTypeChange = (businessType: string) => {
    setFormData(prev => ({
      ...prev,
      business_type: businessType
    }))
  }

  const handleAccountManagerChange = (email: string) => {
    setFormData(prev => ({
      ...prev,
      assigned_account_manager: email
    }))
  }

  // Beräkna totalt avtalsvärde automatiskt (BEHÅLLS OFÖRÄNDRAD)
  const handlePremiumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const premium = parseFloat(e.target.value) || 0
    const months = parseInt(formData.contract_length_months) || 0
    
    setFormData(prev => ({
      ...prev,
      annual_premium: e.target.value,
      total_contract_value: months > 0 ? (premium * (months / 12)).toFixed(2) : ''
    }))
  }

  const handleLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const months = parseInt(e.target.value) || 0
    const premium = parseFloat(formData.annual_premium) || 0
    
    setFormData(prev => ({
      ...prev,
      contract_length_months: e.target.value,
      total_contract_value: premium > 0 ? (premium * (months / 12)).toFixed(2) : ''
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header (BEHÅLLS OFÖRÄNDRAD) */}
      <header className="glass border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/customers')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka
            </Button>
            <h1 className="text-xl font-semibold">Lägg till ny kund - Med automatisk slutdatum</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Företagsinformation (BEHÅLLS OFÖRÄNDRAD) */}
          <Card>
            <div className="flex items-center mb-6">
              <Building2 className="w-5 h-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold">Företagsinformation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Företagsnamn *"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                placeholder="AB Exempel"
              />
              
              <Input
                label="Organisationsnummer *"
                name="org_number"
                value={formData.org_number}
                onChange={handleChange}
                required
                placeholder="556677-8899"
              />
            </div>

            {/* Verksamhetstyp (BEHÅLLS OFÖRÄNDRAD) */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-slate-300 mb-4">
                <Briefcase className="w-4 h-4 inline mr-1" />
                Verksamhetstyp *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {BUSINESS_TYPES.map(type => (
                  <label
                    key={type.value}
                    className={`
                      flex flex-col items-center p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${formData.business_type === type.value
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'
                      }
                    `}
                  >
                    <input
                      type="radio"
                      name="business_type"
                      value={type.value}
                      checked={formData.business_type === type.value}
                      onChange={handleChange}
                      className="sr-only"
                      required
                    />
                    <div className="text-2xl mb-2">{getBusinessTypeIcon(type.value)}</div>
                    <span className="text-sm font-medium text-white text-center">
                      {type.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* Kontaktinformation (BEHÅLLS OFÖRÄNDRAD) */}
          <Card>
            <div className="flex items-center mb-6">
              <User className="w-5 h-5 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold">Kontaktinformation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Kontaktperson *"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                required
                placeholder="Anna Andersson"
              />
              
              <Input
                label="E-postadress *"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="anna@exempel.se"
              />
              
              <Input
                label="Telefonnummer *"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="070-123 45 67"
              />
              
              <Input
                label="Adress *"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Exempelgatan 1, 123 45 Stockholm"
              />
            </div>
          </Card>

          {/* Avtalsinformation - UPPDATERAD med slutdatum */}
          <Card>
            <div className="flex items-center mb-6">
              <FileText className="w-5 h-5 text-purple-500 mr-2" />
              <h2 className="text-lg font-semibold">Avtalsinformation</h2>
            </div>
            
            <div className="space-y-6">
              {/* Avtalstyp (BEHÅLLS OFÖRÄNDRAD) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-4">
                  Välj avtalstyp *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contractTypes.map(type => (
                    <label
                      key={type.id}
                      className={`
                        flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all
                        ${formData.contract_type_id === type.id 
                          ? 'border-green-500 bg-green-500/20'
                          : 'border-slate-600 hover:border-slate-500'
                        }
                      `}
                    >
                      <input
                        type="radio"
                        name="contract_type_id"
                        value={type.id}
                        checked={formData.contract_type_id === type.id}
                        onChange={handleChange}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${
                        formData.contract_type_id === type.id 
                          ? 'border-green-500 bg-green-500'
                          : 'border-slate-500'
                        }`}>
                        {formData.contract_type_id === type.id && (
                          <div className="w-2 h-2 rounded-full bg-slate-950" />
                        )}
                      </div>
                      <span className="text-white font-medium">{type.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Avtalsdatum och längd - UPPDATERAD med slutdatum */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Avtalets startdatum *
                  </label>
                  <input
                    type="date"
                    name="contract_start_date"
                    value={formData.contract_start_date}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Avtalslängd (månader) *
                  </label>
                  <input
                    type="number"
                    name="contract_length_months"
                    value={formData.contract_length_months}
                    onChange={handleLengthChange}
                    min="1"
                    max="120"
                    required
                    placeholder="12"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                {/* 🆕 Slutdatum - Automatiskt beräknat */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calculator className="w-4 h-4 inline mr-1 text-green-400" />
                    Avtalets slutdatum
                  </label>
                  <input
                    type="date"
                    name="contract_end_date"
                    value={formData.contract_end_date}
                    disabled
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Beräknas automatiskt från startdatum + månader
                  </p>
                </div>
              </div>

              {/* Ekonomisk information (BEHÅLLS OFÖRÄNDRAD) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Avtalets årspremie (SEK) *
                  </label>
                  <input
                    type="number"
                    name="annual_premium"
                    value={formData.annual_premium}
                    onChange={handlePremiumChange}
                    min="0"
                    step="0.01"
                    required
                    placeholder="50000"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-1" />
                    Avtalets sammanlagda värde (SEK)
                  </label>
                  <input
                    type="number"
                    name="total_contract_value"
                    value={formData.total_contract_value}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    placeholder="Beräknas automatiskt"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 placeholder-slate-500"
                    readOnly
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Beräknas automatiskt från årspremie × (månader ÷ 12)
                  </p>
                </div>
              </div>

              {/* Kontraktansvarig med TechnicianDropdown (BEHÅLLS OFÖRÄNDRAD) */}
              <div>
                <TechnicianDropdown
                  label="Kontraktansvarig *"
                  value={formData.assigned_account_manager}
                  onChange={handleAccountManagerChange}
                  placeholder="Välj ansvarig tekniker"
                  includeUnassigned={false}
                  onlyActive={true}
                  required={true}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Välj tekniker som kommer att vara huvudansvarig för detta kundavtal
                </p>
              </div>

              {/* Avtalsobjekt beskrivning (BEHÅLLS OFÖRÄNDRAD) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Avtalsobjekt - Beskrivning
                </label>
                <textarea
                  name="contract_description"
                  value={formData.contract_description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Beskriv vad avtalet omfattar: typ av skadedjursbekämpning, objekt, frekvens av besök, särskilda villkor etc."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </Card>

          {/* Sammanfattning - UPPDATERAD med slutdatum */}
          {formData.company_name && formData.contract_type_id && formData.business_type && (
            <Card className="bg-green-500/10 border-green-500/20">
              <div className="flex items-center mb-4">
                <FileText className="w-5 h-5 text-green-400 mr-2" />
                <h3 className="text-lg font-semibold text-green-400">Sammanfattning</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="space-y-2">
                  <p className="text-slate-300">
                    <strong>Företag:</strong> {formData.company_name}
                  </p>
                  <p className="text-slate-300">
                    <strong>Kontakt:</strong> {formData.contact_person}
                  </p>
                  <p className="text-slate-300">
                    <strong>Verksamhet:</strong> {BUSINESS_TYPES.find(t => t.value === formData.business_type)?.label}
                  </p>
                  <p className="text-slate-300">
                    <strong>Avtalstyp:</strong> {contractTypes.find(t => t.id === formData.contract_type_id)?.name}
                  </p>
                </div>
                <div className="space-y-2">
                  {formData.contract_start_date && (
                    <p className="text-slate-300">
                      <strong>Startdatum:</strong> {new Date(formData.contract_start_date).toLocaleDateString('sv-SE')}
                    </p>
                  )}
                  {/* 🆕 Visa slutdatum i sammanfattning */}
                  {formData.contract_end_date && (
                    <p className="text-slate-300">
                      <strong>Slutdatum:</strong> {new Date(formData.contract_end_date).toLocaleDateString('sv-SE')}
                    </p>
                  )}
                  {formData.contract_length_months && (
                    <p className="text-slate-300">
                      <strong>Längd:</strong> {formData.contract_length_months} månader ({(parseInt(formData.contract_length_months) / 12).toFixed(1)} år)
                    </p>
                  )}
                  {formData.annual_premium && (
                    <p className="text-slate-300">
                      <strong>Årspremie:</strong> {parseFloat(formData.annual_premium).toLocaleString('sv-SE')} SEK
                    </p>
                  )}
                  {formData.total_contract_value && (
                    <p className="text-slate-300">
                      <strong>Totalt värde:</strong> {parseFloat(formData.total_contract_value).toLocaleString('sv-SE')} SEK
                    </p>
                  )}
                </div>
              </div>

              {/* 🆕 Avtalsöversikt med visuell period */}
              {formData.contract_start_date && formData.contract_end_date && (
                <div className="mt-4 p-4 bg-slate-800/30 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">📅 Avtalsperiod</h4>
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span>{new Date(formData.contract_start_date).toLocaleDateString('sv-SE')}</span>
                    <div className="flex-1 mx-4 h-2 bg-slate-700 rounded-full">
                      <div className="h-2 bg-green-500 rounded-full w-0 transition-all duration-300"></div>
                    </div>
                    <span>{new Date(formData.contract_end_date).toLocaleDateString('sv-SE')}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    {(() => {
                      const start = new Date(formData.contract_start_date)
                      const end = new Date(formData.contract_end_date)
                      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
                      return `Avtalsperiod: ${totalDays} dagar`
                    })()}
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Information (BEHÅLLS OFÖRÄNDRAD) */}
          <Card className="bg-blue-500/10 border-blue-500/20">
            <h3 className="text-sm font-medium text-blue-400 mb-2">
              Vad händer efter skapande?
            </h3>
            <ul className="text-sm text-slate-300 space-y-1">
              <li>• Kunden läggs till i databasen med all avtalsinformation</li>
              <li>• En ClickUp-lista skapas automatiskt för kundens ärenden</li>
              <li>• En välkomstmail skickas till kundens e-postadress</li>
              <li>• Kunden får inloggningsuppgifter till kundportalen</li>
              <li>• Den tilldelade kontraktansvariga får notifiering</li>
              <li>• Tekniker kan nu tilldelas ärenden för denna kund</li>
              <li>• 🆕 Avtalsslutdatum beräknas och sparas automatiskt</li>
            </ul>
          </Card>

          {/* Knappar (BEHÅLLS OFÖRÄNDRAD) */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/customers')}
            >
              Avbryt
            </Button>
            <Button
              type="submit"
              loading={loading}
              disabled={loading || !formData.assigned_account_manager}
            >
              {loading ? 'Skapar kund...' : 'Skapa kund och skicka inbjudan'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}