import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Customer {
  id: string
  company_name: string
  org_number: string
  email: string
  phone: string
  created_at: string
}

export default function AdminDashboard() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    company_name: '',
    org_number: '',
    email: '',
    phone: ''
  })

  useEffect(() => {
    loadCustomers()
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Skapa kund i Supabase
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          company_name: formData.company_name,
          org_number: formData.org_number,
          email: formData.email,
          phone: formData.phone
        })

      if (customerError) throw customerError

      alert(`✅ Kund "${formData.company_name}" skapad!\n\nDen kommer att kopplas till ClickUp-listan med samma namn.`)

      // Reset form och ladda om lista
      setFormData({
        company_name: '',
        org_number: '',
        email: '',
        phone: ''
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
    if (!confirm(`Är du säker på att du vill ta bort ${companyName}?`)) return

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
      {/* Header */}
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-slate-400 mt-2">Hantera kunder och deras åtkomst till kundportalen</p>
          </div>
          <div className="flex gap-4">
            <a
              href="/"
              className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Tillbaka till Dashboard
            </a>
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
          <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Skapa ny kund</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Bolagsnamn * (måste matcha ClickUp-listnamn)
                </label>
                <input
                  type="text"
                  required
                  value={formData.company_name}
                  onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="BRF Skörden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Organisationsnummer *
                </label>
                <input
                  type="text"
                  required
                  value={formData.org_number}
                  onChange={(e) => setFormData({...formData, org_number: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="123456-7890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  E-postadress *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="kontakt@brfskorden.se"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Telefonnummer *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="08-123 456 78"
                />
              </div>

              <div className="md:col-span-2 flex gap-4">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Skapar...' : 'Skapa Kund'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-slate-600 hover:bg-slate-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customers List */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden">
          <div className="p-6 border-b border-slate-700/50">
            <h2 className="text-xl font-semibold text-white">Befintliga kunder ({customers.length})</h2>
          </div>

          {customers.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-lg font-medium mb-2">Inga kunder ännu</p>
              <p>Skapa din första kund för att komma igång</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/30">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Bolag</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Org.nr</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">E-post</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Telefon</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Skapad</th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-slate-300">Åtgärder</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{customer.company_name}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">{customer.org_number}</td>
                      <td className="px-6 py-4 text-slate-300">{customer.email}</td>
                      <td className="px-6 py-4 text-slate-300">{customer.phone}</td>
                      <td className="px-6 py-4 text-slate-300">
                        {new Date(customer.created_at).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(customer.id, customer.company_name)}
                          className="text-red-400 hover:text-red-300 font-medium transition-colors"
                        >
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

        {/* Instructions */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-3">📋 Så här fungerar det:</h3>
          <div className="space-y-2 text-slate-300">
            <p><strong>1.</strong> Skapa kund med bolagsnamn som matchar ClickUp-listans namn (t.ex. "BRF Skörden")</p>
            <p><strong>2.</strong> Kunden registrerar sig med samma e-post som angavs här</p>
            <p><strong>3.</strong> När de loggar in kopplas de automatiskt till rätt ärenden baserat på bolagsnamnet</p>
            <p><strong>4.</strong> Alla ärenden i ClickUp-listan "BRF Skörden" visas för den kunden</p>
          </div>
        </div>
      </div>
    </div>
  )
}