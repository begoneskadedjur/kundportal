import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ÄNDRAT: Uppdaterad interface för att matcha din nya databastabell
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

// NYTT: Interface för att hålla data om avtalstyper
interface ContractType {
  id: string
  name: string
}

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]) // NYTT: State för avtalstyper
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  
  // ÄNDRAT: Uppdaterat state för formulärdata med de nya fälten
  const [formData, setFormData] = useState({
    company_name: '',
    org_number: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    contract_type_id: '', // NYTT: För att hålla vald avtalstyp
  })

  useEffect(() => {
    loadCustomers()
    loadContractTypes() // NYTT: Ladda avtalstyper när komponenten monteras
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

  // NYTT: Funktion för att ladda alla tillgängliga avtalstyper
  const loadContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_types')
        .select('id, name')
        .eq('is_active', true) // Hämta bara aktiva avtalstyper

      if (error) throw error
      setContractTypes(data || [])
    } catch (error) {
      console.error('Error loading contract types:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // NYTT: Validering för att säkerställa att en avtalstyp är vald
    if (!formData.contract_type_id) {
        alert('Du måste välja en avtalstyp.');
        return;
    }

    setLoading(true)

    try {
      // ÄNDRAT: Inkludera de nya fälten i insert-anropet
      const { error: customerError } = await supabase
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

      if (customerError) throw customerError

      alert(`✅ Kund "${formData.company_name}" skapad!`)

      // ÄNDRAT: Rensa alla fält i formuläret
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

  const handleDelete = async (customerId: string, companyName: string) => {
    // VIKTIGT: Här bör du även hantera logik för att radera relaterade 'cases' och 'visits' om det behövs
    // (Cascading delete i databasen är att föredra för detta)
    if (!confirm(`Är du säker på att du vill ta bort ${companyName}? Detta raderar även alla dess ärenden och besök.`)) return

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
              {showForm ? 'Stäng' : '+ Ny Kund'}
            </button>
          </div>
        </div>

        {/* Add Customer Form (ÄNDRAT med nya fält) */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Skapa ny kund</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                {/* NYTT: Dropdown för att välja avtalstyp */}
                <label className="block text-sm font-medium text-slate-300 mb-2">Avtalstyp *</label>
                <select
                  required
                  value={formData.contract_type_id}
                  onChange={(e) => setFormData({...formData, contract_type_id: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="" disabled>Välj en avtalstyp...</option>
                  {contractTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-slate-300 mb-2">Adress</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                ></textarea>
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  {loading ? 'Skapar...' : 'Skapa Kund'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg font-medium transition-colors">
                  Avbryt
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Customers List (ÄNDRAT för att visa nya kolumner) */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-semibold text-white">Befintliga kunder ({customers.length})</h2>
          </div>
          {customers.length === 0 ? (
             <div className="p-12 text-center text-slate-400"> {/* ... (samma som förut) ... */} </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Bolag</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Kontaktperson</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">E-post</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Skapad</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{customer.company_name}</div>
                        <div className="text-sm text-slate-400">{customer.org_number}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{customer.contact_person || '-'}</td>
                      <td className="px-6 py-4 text-slate-300">{customer.email}</td>
                      <td className="px-6 py-4 text-slate-300">
                        {new Date(customer.created_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDelete(customer.id, customer.company_name)} className="text-red-400 hover:text-red-300 font-medium transition-colors">
                          Ta bort
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}