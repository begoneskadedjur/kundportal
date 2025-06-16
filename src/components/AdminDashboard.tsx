// src/components/AdminDashboard.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Customer {
  id: string
  company_name: string
  org_number: string
  contact_person: string | null
  email: string
  phone: string
  address: string | null
  contract_type_id: string | null
  created_at: string
}

interface ContractType {
  id: string
  name: string
}

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contractTypes, setContractTypes] = useState<ContractType[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  const [formData, setFormData] = useState({
    company_name: '',
    org_number: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    contract_type_id: '',
  })

  useEffect(() => {
    loadCustomers()
    loadContractTypes()
  }, [])

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomers(data || [])
    } catch (error) {
      console.error('Error loading customers:', error)
      alert('Fel vid laddning av kunder')
    }
  }

  const loadContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_types')
        .select('id, name')
        .eq('is_active', true)

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error loading contract types:', error)
    }
  }

  // NYTT: Funktion för att skicka inbjudan via e-post (använder API)
  const sendCustomerInvitation = async (email: string, companyName: string) => {
    try {
      const response = await fetch('/api/invite-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          companyName,
          redirectUrl: `${window.location.origin}/activate-account`
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitation')
      }

      return result
    } catch (error) {
      console.error('Email sending failed:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.contract_type_id) {
      alert('Du måste välja en avtalstyp.')
      return;
    }

    setLoading(true)

    try {
      // Steg 1: Skapa kunden i databasen
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          company_name: formData.company_name,
          org_number: formData.org_number,
          contact_person: formData.contact_person,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          contract_type_id: formData.contract_type_id,
        })
        .select()
        .single()

      if (customerError) throw customerError

      // Steg 2: Skicka e-postinbjudan
      try {
        const emailResult = await sendCustomerInvitation(formData.email, formData.company_name)
        
        alert(`✅ Kund "${formData.company_name}" skapad!\n📧 ${emailResult.message}`)
      } catch (emailError) {
        // Om e-posten misslyckas, visa ändå att kunden skapades
        alert(`✅ Kund "${formData.company_name}" skapad!\n⚠️ E-postinbjudan misslyckades: ${(emailError as Error).message}\n\nDu kan skicka en manuell inbjudan senare.`)
      }

      // Steg 3: Rensa formuläret och ladda om listan
      setFormData({
        company_name: '',
        org_number: '',
        contact_person: '',
        email: '',
        phone: '',
        address: '',
        contract_type_id: '',
      })
      setShowForm(false)
      await loadCustomers()

    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Fel vid skapande av kund: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // NYTT: Funktion för att skicka om inbjudan manuellt
  const resendInvitation = async (customer: Customer) => {
    try {
      setLoading(true)
      const emailResult = await sendCustomerInvitation(customer.email, customer.company_name)
      alert(`📧 Inbjudan skickad till ${customer.email}!\n${emailResult.message}`)
    } catch (error) {
      alert(`Fel vid skickande av inbjudan: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (customerId: string, companyName: string) => {
    // Dubbel bekräftelse för borttagning
    const confirmName = prompt(`För att bekräfta borttagning, skriv företagsnamnet: "${companyName}"`)
    
    if (confirmName !== companyName) {
      alert('Borttagning avbruten - företagsnamnet matchade inte.')
      return
    }

    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)

      if (error) throw error

      alert('Kund borttagen!')
      await loadCustomers()
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Fel vid borttagning av kund')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">Hantera kunder och deras åtkomst till kundportalen</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {showForm ? 'Avbryt' : 'Skapa ny kund'}
            </button>
          </div>
        </div>

        {/* Formulär för ny kund */}
        {showForm && (
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6">Skapa ny kund</h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Bolagsnamn *</label>
                  <input
                    type="text" required
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Organisationsnummer *</label>
                  <input
                    type="text" required
                    value={formData.org_number}
                    onChange={(e) => setFormData({...formData, org_number: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Kontaktperson</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">E-postadress *</label>
                  <input
                    type="email" required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Telefonnummer</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Avtalstyp *</label>
                  <select
                    required
                    value={formData.contract_type_id}
                    onChange={(e) => setFormData({...formData, contract_type_id: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Välj avtalstyp</option>
                    {contractTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Adress</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Information om vad som händer */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-blue-400 text-sm">
                  <strong>Vad händer när du skapar kunden:</strong><br/>
                  1. Kunden läggs till i databasen<br/>
                  2. En inbjudan skickas automatiskt till kundens e-post<br/>
                  3. Kunden kan sedan aktivera sitt konto och sätta sitt lösenord
                </p>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Avbryt
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Skapar...' : 'Skapa kund'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista över befintliga kunder */}
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Befintliga kunder ({customers.length})</h2>
          
          {customers.length === 0 ? (
            <p className="text-slate-400 text-center py-8">Inga kunder registrerade än.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Bolag</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Kontaktperson</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">E-post</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">ClickUp</th>
                    <th className="text-left py-3 px-4 text-slate-300 font-medium">Skapad</th>
                    <th className="text-right py-3 px-4 text-slate-300 font-medium">Åtgärder</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(customer => (
                    <tr key={customer.id} className="border-b border-slate-700/50 hover:bg-slate-700/25">
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{customer.company_name}</div>
                        <div className="text-slate-400 text-sm">{customer.org_number}</div>
                      </td>
                      <td className="py-3 px-4 text-white">{customer.contact_person || '-'}</td>
                      <td className="py-3 px-4 text-white">{customer.email}</td>
                      <td className="py-3 px-4">
                        <span className="text-slate-400 text-sm">Inte konfigurerat</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-sm">
                        {new Date(customer.created_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => resendInvitation(customer)}
                            disabled={loading}
                            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            📧 Skicka inbjudan
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id, customer.company_name)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                          >
                            Ta bort
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
            <p className="text-yellow-400 text-sm">
              <strong>Debug:</strong> Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}