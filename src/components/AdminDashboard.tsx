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
  clickup_list_id: string | null
  clickup_list_name: string | null
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
  const [syncingCustomer, setSyncingCustomer] = useState<string | null>(null)
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.contract_type_id) {
        alert('Du måste välja en avtalstyp.')
        return
    }

    setLoading(true)

    try {
      // Använd den nya API-endpointen som skapar kund, auth-användare och ClickUp-lista
      const response = await fetch('/api/admin/create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Något gick fel')
      }
      
      // Hantera olika svar från API:et
      if (data.success) {
        // Om e-post skickades framgångsrikt
        if (data.emailSent) {
          alert(`✅ Kund "${data.customer.company_name}" skapad!\n\nVälkomstmail har skickats till ${formData.email}`)
        } 
        // Om e-post misslyckades men vi har en recovery-länk
        else if (data.recoveryLink) {
          const copyToClipboard = async (text: string) => {
            try {
              await navigator.clipboard.writeText(text);
              alert('Länken har kopierats till urklipp!');
            } catch (err) {
              console.error('Kunde inte kopiera till urklipp:', err);
            }
          };
          
          // Visa länken och erbjud att kopiera den
          if (confirm(`✅ Kund "${data.customer.company_name}" skapad!\n\n⚠️ E-postutskick misslyckades. Vill du kopiera lösenordslänken?\n\nKlicka OK för att kopiera länken till urklipp.`)) {
            await copyToClipboard(data.recoveryLink);
            
            // Visa länken också i konsolen för säkerhet
            console.log('Recovery link för', formData.email, ':', data.recoveryLink);
          }
        }
        // Om vi har en varning
        else if (data.warning) {
          alert(`⚠️ ${data.warning}\n\nDu kan skicka inbjudan manuellt från Supabase Dashboard.`);
        }
        
        // Återställ formuläret
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
        
      } else {
        throw new Error(data.error || 'Kunde inte skapa kund')
      }

    } catch (error) {
      console.error('Error creating customer:', error)
      alert('Fel vid skapande av kund: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSyncClickUp = async (customerId: string) => {
    setSyncingCustomer(customerId)
    
    try {
      const response = await fetch('/api/sync/clickup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ Synkronisering klar!\n\n` +
              `📥 ${data.created} nya ärenden\n` +
              `🔄 ${data.updated} uppdaterade ärenden`)
      } else {
        throw new Error(data.error || 'Synkronisering misslyckades')
      }
    } catch (error) {
      console.error('Sync error:', error)
      alert('Fel vid synkronisering: ' + (error as Error).message)
    } finally {
      setSyncingCustomer(null)
    }
  }

  const handleFixMissingClickUp = async (customer: Customer) => {
    if (!confirm(`Vill du skapa en ClickUp-lista för ${customer.company_name}?`)) return

    try {
      const response = await fetch('/api/admin/create-customer-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          customerName: customer.company_name,
          contractTypeId: customer.contract_type_id
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`✅ ClickUp-lista skapad!`)
        await loadCustomers()
      } else {
        throw new Error(data.error || 'Kunde inte skapa lista')
      }
    } catch (error) {
      console.error('Error creating ClickUp list:', error)
      alert('Fel vid skapande av ClickUp-lista: ' + (error as Error).message)
    }
  }

  const handleDelete = async (customerId: string, companyName: string) => {
    if (!confirm(`Är du säker på att du vill ta bort ${companyName}? Detta raderar även alla dess ärenden, besök och användardata.`)) return

    try {
      // Först måste vi hitta och ta bort auth-användaren
      // Hämta kundens email för att hitta auth-användaren
      const { data: customer, error: fetchError } = await supabase
        .from('customers')
        .select('email')
        .eq('id', customerId)
        .single()

      if (fetchError) throw fetchError

      // Om vi har en email, försök hitta och ta bort auth-användaren
      if (customer?.email) {
        // Vi behöver anropa en API-endpoint för att ta bort auth-användaren
        // eftersom detta kräver admin-rättigheter
        const response = await fetch('/api/admin/delete-customer', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            customerId,
            email: customer.email 
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Kunde inte ta bort kunden')
        }

        alert('✅ Kund och all relaterad data har tagits bort!')
        await loadCustomers()
      } else {
        // Om ingen email finns, ta bara bort från customers-tabellen
        const { error } = await supabase
          .from('customers')
          .delete()
          .eq('id', customerId)

        if (error) throw error

        alert('✅ Kund borttagen!')
        await loadCustomers()
      }

    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Fel vid borttagning av kund: ' + (error as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
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

        {/* Add Customer Form */}
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

              <div className="md:col-span-2">
                <div className="bg-slate-700/30 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-slate-300 mb-2">Vad händer när du skapar en kund:</h3>
                  <ul className="text-sm text-slate-400 space-y-1">
                    <li>✅ Kunden läggs till i databasen</li>
                    <li>📧 En inbjudan skickas till angiven e-post</li>
                    <li>📋 En ClickUp-lista skapas i rätt folder baserat på avtalstyp</li>
                    <li>🔐 Kunden kan logga in när de accepterat inbjudan</li>
                  </ul>
                </div>
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

        {/* Customers List */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-semibold text-white">Befintliga kunder ({customers.length})</h2>
          </div>
          {customers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <p>Inga kunder registrerade än.</p>
              <p className="mt-2">Klicka på "+ Ny Kund" för att komma igång.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Bolag</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Kontaktperson</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">E-post</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">ClickUp</th>
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
                      <td className="px-6 py-4">
                        {customer.clickup_list_id ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                              ✓ Kopplad
                            </span>
                            <button
                              onClick={() => handleSyncClickUp(customer.id)}
                              disabled={syncingCustomer === customer.id}
                              className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                            >
                              {syncingCustomer === customer.id ? 'Synkar...' : 'Synka'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleFixMissingClickUp(customer)}
                            className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors"
                          >
                            Skapa lista
                          </button>
                        )}
                      </td>
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