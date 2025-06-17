// src/pages/admin/NewCustomer.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Card from '../../components/ui/Card'
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
  
  // Formulärdata
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
    setLoading(true)

    try {
      // Validera formulär
      if (!formData.contract_type_id) {
        throw new Error('Välj en avtalstyp')
      }

      // Hitta vald avtalstyp
      const selectedContract = contractTypes.find(
        ct => ct.id === formData.contract_type_id
      )
      
      if (!selectedContract) {
        throw new Error('Ogiltig avtalstyp')
      }

      // För tillfällig testning - vi kommer flytta detta till en Edge Function senare
      const clickupApiToken = import.meta.env.VITE_CLICKUP_API_TOKEN // Temporärt för test
      
      // Skapa ClickUp-lista direkt (detta kommer vi flytta till backend senare)
      const listName = `${formData.company_name} - ${formData.org_number}`
      
      const clickupResponse = await fetch(
        `https://api.clickup.com/api/v2/folder/${selectedContract.clickup_folder_id}/list`,
        {
          method: 'POST',
          headers: {
            'Authorization': clickupApiToken || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: listName,
            content: `Kundportal för ${formData.company_name}`,
            priority: 1,
            status: 'active'
          }),
        }
      )

      if (!clickupResponse.ok) {
        const error = await clickupResponse.text()
        throw new Error(`ClickUp API fel: ${error}`)
      }

      const clickupList = await clickupResponse.json()

      // Spara kund i databasen
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          ...formData,
          clickup_list_id: clickupList.id,
          clickup_list_name: clickupList.name,
          is_active: true
        })
        .select()
        .single()

      if (customerError) throw customerError

      // Skapa användarkonto för kunden
      const { data: invitation, error: inviteError } = await supabase
        .from('user_invitations')
        .insert({
          email: formData.email,
          customer_id: customer.id,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dagar
        })
        .select()
        .single()

      if (inviteError) throw inviteError

      // Skicka e-postinbjudan (detta gör vi i nästa steg)
      // await sendInvitationEmail(invitation)

      toast.success('Kund skapad! En inbjudan har skickats.')
      navigate('/admin/customers')

    } catch (error: any) {
      console.error('Error creating customer:', error)
      toast.error(error.message || 'Något gick fel')
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
              onClick={() => navigate('/admin')}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka
            </Button>
            <h1 className="text-xl font-semibold text-white">
              Lägg till ny kund
            </h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Företagsinformation */}
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">
                Företagsinformation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Företagsnamn"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Organisationsnummer"
                  name="org_number"
                  value={formData.org_number}
                  onChange={handleChange}
                  placeholder="XXXXXX-XXXX"
                  required
                />
              </div>
            </Card>

            {/* Kontaktinformation */}
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">
                Kontaktinformation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Kontaktperson"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="E-postadress"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Telefonnummer"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                <Input
                  label="Adress"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                />
              </div>
            </Card>

            {/* Avtalstyp */}
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">
                Avtalstyp
              </h2>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                  Välj avtalstyp <span className="text-red-400">*</span>
                </label>
                <select
                  name="contract_type_id"
                  value={formData.contract_type_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                  required
                >
                  <option value="">Välj avtalstyp...</option>
                  {contractTypes.map(ct => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name}
                    </option>
                  ))}
                </select>
                {formData.contract_type_id && (
                  <p className="text-sm text-slate-400 mt-2">
                    En ClickUp-lista kommer skapas automatiskt för denna kund
                  </p>
                )}
              </div>
            </Card>

            {/* Knappar */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/admin')}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                loading={loading}
              >
                <Save className="w-4 h-4 mr-2" />
                Skapa kund
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}