// src/components/admin/ManageSpendCard.tsx - KOMPLETT FIXAD VERSION
import { useState, useEffect } from 'react'
import { Save, Calendar, DollarSign, FileText, Trash2 } from 'lucide-react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Input from '../ui/Input'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

type SpendEntry = { 
  id: number
  month: string
  spend: number
  notes: string | null
}

interface ManageSpendCardProps {
  onDataChange: () => void
  selectedMonth: Date
}

export default function ManageSpendCard({ 
  onDataChange, 
  selectedMonth 
}: ManageSpendCardProps) {
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [monthInput, setMonthInput] = useState(formatDateForInput(selectedMonth))
  const [spend, setSpend] = useState('')
  const [notes, setNotes] = useState('')
  
  // Hjälpfunktioner
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('sv-SE', { 
      style: 'currency', 
      currency: 'SEK', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(amount)

  const formatDateForInput = (date: Date) => 
    date.toISOString().split('T')[0]

  // Uppdatera monthInput när selectedMonth ändras
  useEffect(() => {
    setMonthInput(formatDateForInput(selectedMonth))
  }, [selectedMonth])


  // Hämta alla kostnadspoter
  const fetchSpendEntries = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('monthly_marketing_spend')
        .select('*')
        .order('month', { ascending: false })

      if (error) {
        console.error("Error fetching spend entries:", error)
        setError("Kunde inte ladda kostnadsposter.")
        toast.error("Kunde inte ladda kostnadsposter")
      } else {
        setSpendEntries(data || [])
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      setError("Ett oväntat fel inträffade")
      toast.error("Ett oväntat fel inträffade")
    } finally {
      setLoading(false)
    }
  }

  // Hämta data när komponenten mountas
  useEffect(() => {
    fetchSpendEntries()
  }, [])

  // Hantera formulärinlämning
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!monthInput || !spend) {
      toast.error("Datum och kostnad måste fyllas i")
      return
    }

    if (parseFloat(spend) < 0) {
      toast.error("Kostnad kan inte vara negativ")
      return
    }

    setSaving(true)
    
    try {
      // Använd insert för att lägga till ny post
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .insert({ 
          month: monthInput, 
          spend: Number(spend),
          notes: notes.trim() || null
        })

      if (error) {
        console.error("Error saving spend:", error)
        
        // Kontrollera om det är en unique constraint error
        if (error.code === '23505') {
          toast.error("En kostnad för denna månad finns redan. Ta bort den först.")
        } else {
          toast.error("Kunde inte spara kostnad: " + error.message)
        }
      } else {
        // Återställ formulär
        setSpend('')
        setNotes('')
        
        // Uppdatera lista
        await fetchSpendEntries()
        
        // Notifiera parent component
        onDataChange()
        
        toast.success("Kostnad sparad!")
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Ett oväntat fel inträffade")
    } finally {
      setSaving(false)
    }
  }

  // Hantera borttagning
  const handleDelete = async (id: number) => {
    if (!window.confirm("Är du säker på att du vill radera denna kostnadspost?")) {
      return
    }

    try {
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .delete()
        .eq('id', id)

      if (error) {
        console.error("Error deleting spend:", error)
        toast.error("Kunde inte radera post: " + error.message)
      } else {
        await fetchSpendEntries()
        onDataChange()
        toast.success("Post raderad!")
      }
    } catch (err) {
      console.error("Unexpected error:", err)
      toast.error("Ett oväntat fel inträffade")
    }
  }

  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-6">Hantera Marknadskostnader</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulär för att lägga till ny kostnad */}
        <div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Lägg till ny kostnad</h3>
            
            {/* Datum */}
            <div>
              <label htmlFor="month" className="block text-sm font-medium text-slate-400 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Datum
              </label>
              <Input 
                type="date" 
                id="month" 
                value={monthInput} 
                onChange={(e) => setMonthInput(e.target.value)}
                required
              />
            </div>
            
            {/* Kostnad */}
            <div>
              <label htmlFor="spend" className="block text-sm font-medium text-slate-400 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Kostnad (SEK)
              </label>
              <Input 
                type="number" 
                id="spend" 
                placeholder="15000" 
                value={spend} 
                onChange={(e) => setSpend(e.target.value)}
                min="0"
                step="0.01"
                required
              />
            </div>
            
            {/* Anteckningar */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-slate-400 mb-1">
                <FileText className="w-4 h-4 inline mr-1" />
                Anteckningar (valfritt)
              </label>
              <Input 
                type="text" 
                id="notes" 
                placeholder="Google Ads, Facebook etc." 
                value={notes} 
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            
            {/* Submit knapp */}
            <Button 
              type="submit" 
              className="w-full"
              loading={saving}
              disabled={saving}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Sparar kostnad...' : 'Spara kostnad'}
            </Button>
          </form>
        </div>

        {/* Lista över befintliga poster */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Befintliga poster</h3>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
              <span className="ml-2 text-slate-400">Laddar...</span>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={fetchSpendEntries}
                className="mt-2"
              >
                Försök igen
              </Button>
            </div>
          ) : spendEntries.length === 0 ? (
            <div className="bg-slate-800/30 rounded-lg p-4 text-center">
              <p className="text-slate-500 text-sm">Inga kostnader har registrerats än.</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
              {spendEntries.map(entry => (
                <div 
                  key={entry.id} 
                  className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between hover:bg-slate-800/70 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-bold text-white">
                      {new Date(entry.month).toLocaleDateString('sv-SE', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}: {formatCurrency(entry.spend)}
                    </p>
                    {entry.notes && (
                      <p className="text-sm text-slate-400 mt-1">{entry.notes}</p>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(entry.id)} 
                    className="text-red-500 hover:bg-red-500/10 hover:text-red-400 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}