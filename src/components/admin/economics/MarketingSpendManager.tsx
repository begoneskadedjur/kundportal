// 📁 src/components/admin/economics/MarketingSpendManager.tsx
import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Save, X, Banknote, Calendar, TrendingUp } from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

interface MarketingSpend {
  id: string
  month: string
  spend: number
  notes: string
  created_at: string
  updated_at: string
}

interface MarketingSpendForm {
  month: string
  spend: string
  notes: string
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

const formatMonth = (monthString: string): string => {
  const date = new Date(monthString + '-01')
  return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' })
}

const MarketingSpendManager: React.FC = () => {
  const [spendData, setSpendData] = useState<MarketingSpend[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<MarketingSpendForm>({
    month: '',
    spend: '',
    notes: ''
  })

  // Hämta alla marknadsföringskostnader
  const fetchSpendData = async (cancelled?: { current: boolean }) => {
    try {
      setLoading(true)

      const { data, error } = await supabase
        .from('monthly_marketing_spend')
        .select('*')
        .order('month', { ascending: false })

      if (cancelled?.current) return
      if (error) throw error
      setSpendData(data || [])
    } catch (error) {
      if (cancelled?.current) return
      console.error('Error fetching marketing spend:', error)
      toast.error('Kunde inte hämta marknadsföringskostnader')
    } finally {
      if (!cancelled?.current) setLoading(false)
    }
  }

  useEffect(() => {
    const cancelled = { current: false }
    fetchSpendData(cancelled)
    return () => { cancelled.current = true }
  }, [])

  // Hantera formulärförändringar
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Validera formulärdata
  const validateForm = (): boolean => {
    if (!formData.month) {
      toast.error('Månad måste anges')
      return false
    }
    if (!formData.spend || isNaN(Number(formData.spend)) || Number(formData.spend) < 0) {
      toast.error('Kostnad måste vara ett giltigt positiv tal')
      return false
    }
    return true
  }

  // Skapa ny post
  const handleCreate = async () => {
    if (!validateForm()) return

    try {
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .insert([{
          month: formData.month + '-01',
          spend: Number(formData.spend),
          notes: formData.notes
        }])

      if (error) throw error

      toast.success('Marknadsföringskostnad sparad!')
      setFormData({ month: '', spend: '', notes: '' })
      setShowForm(false)
      fetchSpendData()
    } catch (error: any) {
      console.error('Error creating marketing spend:', error)
      if (error.code === '23505') {
        toast.error('Det finns redan en kostnad för den månaden')
      } else {
        toast.error('Kunde inte spara marknadsföringskostnad')
      }
    }
  }

  // Uppdatera befintlig post
  const handleUpdate = async (id: string) => {
    if (!validateForm()) return

    try {
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .update({
          month: formData.month + '-01',
          spend: Number(formData.spend),
          notes: formData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      toast.success('Marknadsföringskostnad uppdaterad!')
      setEditingId(null)
      setFormData({ month: '', spend: '', notes: '' })
      fetchSpendData()
    } catch (error: any) {
      console.error('Error updating marketing spend:', error)
      if (error.code === '23505') {
        toast.error('Det finns redan en kostnad för den månaden')
      } else {
        toast.error('Kunde inte uppdatera marknadsföringskostnad')
      }
    }
  }

  // Ta bort post
  const handleDelete = async (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna marknadsföringskostnad?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('monthly_marketing_spend')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Marknadsföringskostnad borttagen!')
      fetchSpendData()
    } catch (error) {
      console.error('Error deleting marketing spend:', error)
      toast.error('Kunde inte ta bort marknadsföringskostnad')
    }
  }

  // Starta redigering
  const startEdit = (spend: MarketingSpend) => {
    setEditingId(spend.id)
    setFormData({
      month: spend.month.slice(0, 7), // YYYY-MM format
      spend: spend.spend.toString(),
      notes: spend.notes || ''
    })
    setShowForm(false)
  }

  // Avbryt redigering
  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ month: '', spend: '', notes: '' })
  }

  // Beräkna total kostnad
  const totalSpend = spendData.reduce((sum, item) => sum + item.spend, 0)

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl" data-testid="marketing-spend-manager">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Banknote className="w-4 h-4 text-[#20c58f] mr-2" />
          <h2 className="text-sm font-semibold text-white">Marknadsföringskostnader</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm text-slate-400">Total kostnad</p>
            <p className="text-lg font-bold text-[#20c58f]">{formatCurrency(totalSpend)}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2"
            data-testid="add-marketing-spend"
          >
            <Plus className="w-4 h-4" />
            Lägg till
          </Button>
        </div>
      </div>

      {/* Formulär för att lägga till ny kostnad */}
      {showForm && (
        <div className="mb-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700" data-testid="marketing-spend-form">
          <h3 className="text-white font-medium mb-4">Lägg till marknadsföringskostnad</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Månad"
              name="month"
              type="month"
              value={formData.month}
              onChange={handleInputChange}
              required
            />
            <Input
              label="Kostnad (SEK)"
              name="spend"
              type="number"
              value={formData.spend}
              onChange={handleInputChange}
              placeholder="0"
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Anteckningar
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={1}
                className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-[#20c58f]"
                placeholder="Valfri beskrivning..."
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleCreate} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Spara
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowForm(false)
                setFormData({ month: '', spend: '', notes: '' })
              }}
            >
              Avbryt
            </Button>
          </div>
        </div>
      )}

      {/* Lista över kostnader */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#20c58f]"></div>
        </div>
      ) : spendData.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p>Inga marknadsföringskostnader registrerade</p>
          <p className="text-sm">Klicka på "Lägg till" för att börja</p>
        </div>
      ) : (
        <div className="space-y-3" data-testid="marketing-spend-list">
          {spendData.map((spend) => (
            <div
              key={spend.id}
              className="flex items-center justify-between p-4 bg-slate-800/30 rounded-lg border border-slate-700 hover:bg-slate-800/50 transition-colors"
              data-testid={`marketing-spend-item-${spend.id}`}
            >
              {editingId === spend.id ? (
                // Redigeringsläge
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    name="month"
                    type="month"
                    value={formData.month}
                    onChange={handleInputChange}
                  />
                  <Input
                    name="spend"
                    type="number"
                    value={formData.spend}
                    onChange={handleInputChange}
                  />
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={1}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-[#20c58f]"
                    placeholder="Anteckningar..."
                  />
                </div>
              ) : (
                // Visningsläge
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-medium">{formatMonth(spend.month.slice(0, 7))}</h3>
                      <p className="text-sm text-slate-400">{spend.notes || 'Ingen beskrivning'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-[#20c58f]">{formatCurrency(spend.spend)}</p>
                      <p className="text-xs text-slate-500">
                        Uppdaterad: {new Date(spend.updated_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Åtgärdsknappar */}
              <div className="flex items-center gap-2 ml-4">
                {editingId === spend.id ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(spend.id)}
                      className="p-2"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={cancelEdit}
                      className="p-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(spend)}
                      className="p-2"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDelete(spend.id)}
                      className="p-2 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sammanfattning */}
      {spendData.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center text-sm text-slate-400">
              <TrendingUp className="w-4 h-4 mr-1" />
              <span>{spendData.length} månader registrerade</span>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Genomsnittlig månadskostnad</p>
              <p className="text-lg font-bold text-white">
                {formatCurrency(spendData.length > 0 ? totalSpend / spendData.length : 0)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MarketingSpendManager