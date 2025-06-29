// src/components/admin/ManageSpendCard.tsx - Updated to use insert instead of upsert

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { Save, Trash2 } from 'lucide-react';

type SpendEntry = { id: number; month: string; spend: number; notes: string | null; };

const formatCurrency = (amount: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
const formatDateForInput = (date: Date) => date.toISOString().split('T')[0];

export default function ManageSpendCard({ onDataChange, selectedMonth }: { onDataChange: () => void, selectedMonth: Date }) {
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [monthInput, setMonthInput] = useState(formatDateForInput(selectedMonth));
  const [spend, setSpend] = useState('');
  const [notes, setNotes] = useState('');
  
  useEffect(() => {
    setMonthInput(formatDateForInput(selectedMonth));
  }, [selectedMonth]);

  const fetchSpendEntries = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('monthly_marketing_spend')
      .select('*')
      .order('month', { ascending: false });

    if (error) {
      console.error("Error fetching spend entries:", error);
      setError("Kunde inte ladda kostnadsposter.");
    } else {
      setSpendEntries(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSpendEntries();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!monthInput || !spend) {
      alert("Datum och kostnad måste fyllas i.");
      return;
    }
    
    // FIX: Använd enkel 'insert' istället för 'upsert'
    const { error } = await supabase.from('monthly_marketing_spend').insert({ 
        month: monthInput, 
        spend: Number(spend),
        notes
      });

    if (error) {
      console.error(error);
      alert("Kunde inte spara kostnad: " + error.message);
    } else {
      setSpend('');
      setNotes('');
      await fetchSpendEntries();
      onDataChange();
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Är du säker på att du vill radera denna kostnadspost?")) return;
    const { error } = await supabase.from('monthly_marketing_spend').delete().eq('id', id);
    if (error) {
      alert("Kunde inte radera post: " + error.message);
    } else {
      await fetchSpendEntries();
      onDataChange();
    }
  };
  
  return (
    <Card>
      <h2 className="text-xl font-bold text-white mb-6">Hantera Marknadskostnader</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Lägg till ny kostnad</h3>
          <div>
            <label htmlFor="month" className="block text-sm font-medium text-slate-400 mb-1">Datum</label>
            <Input type="date" id="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
          </div>
          <div>
            <label htmlFor="spend" className="block text-sm font-medium text-slate-400 mb-1">Kostnad (SEK)</label>
            <Input type="number" id="spend" placeholder="15000" value={spend} onChange={(e) => setSpend(e.target.value)} />
          </div>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-400 mb-1">Anteckningar (valfritt)</label>
            <Input type="text" id="notes" placeholder="Google Ads, Facebook etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="w-full"><Save className="w-4 h-4 mr-2"/>Spara kostnad</Button>
        </form>
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Befintliga poster</h3>
          {loading ? <p className="text-slate-400">Laddar...</p> : 
           error ? <p className="text-red-400">{error}</p> :
           spendEntries.length === 0 ? <p className="text-slate-500 text-sm">Inga kostnader har registrerats än.</p> :
           <div className="max-h-64 overflow-y-auto pr-2">
             {spendEntries.map(entry => (
               <div key={entry.id} className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-between">
                 <div>
                   <p className="font-bold text-white">{new Date(entry.month).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}: {formatCurrency(entry.spend)}</p>
                   {entry.notes && <p className="text-sm text-slate-400">{entry.notes}</p>}
                 </div>
                 <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="text-red-500 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
               </div>
             ))}
           </div>
          }
        </div>
      </div>
    </Card>
  )
}