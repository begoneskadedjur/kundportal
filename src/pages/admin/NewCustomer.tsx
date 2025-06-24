// src/pages/admin/NewCustomer.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, User, Mail, Phone, MapPin, FileText } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
import { customerService } from '../../services/customerService'
import { supabase } from '../../lib/supabase'
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
    company_name: '',
    org_number: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    contract_type_id: ''
  })

  useEffect(() => {
    fetchContractTypes()
  }, [])

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

    setLoading(true)
    
    try {
      await customerService.createCustomer(formData)
      navigate('/admin/customers')
    } catch (error) {
      // Felhantering sker i service
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <h1 className="text-xl font-semibold">Lägg till ny kund</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Företagsinformation */}
          <Card>
            <div className="flex items-center mb-6">
              <Building2 className="w-5 h-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold">Företagsinformation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Företagsnamn"
                name="company_name"
                value={formData.company_name}
                onChange={handleChange}
                required
                placeholder="AB Exempel"
              />
              
              <Input
                label="Organisationsnummer"
                name="org_number"
                value={formData.org_number}
                onChange={handleChange}
                required
                placeholder="556677-8899"
              />
            </div>
          </Card>

          {/* Kontaktinformation */}
          <Card>
            <div className="flex items-center mb-6">
              <User className="w-5 h-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold">Kontaktinformation</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Kontaktperson"
                name="contact_person"
                value={formData.contact_person}
                onChange={handleChange}
                required
                placeholder="Anna Andersson"
              />
              
              <Input
                label="E-postadress"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="anna@exempel.se"
              />
              
              <Input
                label="Telefonnummer"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="070-123 45 67"
              />
              
              <Input
                label="Adress"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                placeholder="Exempelgatan 1, 123 45 Stockholm"
              />
            </div>
          </Card>

          {/* Avtalstyp */}
          <Card>
            <div className="flex items-center mb-6">
              <FileText className="w-5 h-5 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold">Avtalstyp</h2>
            </div>
            
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Välj avtalstyp <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {contractTypes.map(type => (
                  <label
                    key={type.id}
                    className={`
                      relative flex items-center p-4 rounded-lg border cursor-pointer
                      transition-all duration-200
                      ${formData.contract_type_id === type.id
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-slate-700 hover:border-slate-600'
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
                    <div className="flex items-center">
                      <div className={`
                        w-4 h-4 rounded-full border-2 mr-3
                        ${formData.contract_type_id === type.id
                          ? 'border-green-500 bg-green-500'
                          : 'border-slate-500'
                        }
                      `}>
                        {formData.contract_type_id === type.id && (
                          <div className="w-2 h-2 rounded-full bg-slate-950 m-0.5" />
                        )}
                      </div>
                      <span className="text-white">{type.name}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* Knappar */}
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
              disabled={loading}
            >
              Skapa kund och skicka inbjudan
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}