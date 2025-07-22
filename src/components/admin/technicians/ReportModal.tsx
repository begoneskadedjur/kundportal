// 📁 src/components/admin/technicians/ReportModal.tsx
// ⭐ SLUTGILTIG KORRIGERING: Rättar databasfrågan för 'case_type'. ⭐

import React, { useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Search, X } from 'lucide-react';
import Button from '../../ui/Button';
import LoadingSpinner from '../../shared/LoadingSpinner';

// Interface
interface ScheduledCase { id: string; title: string; case_type: 'private' | 'business' | 'contract'; kontaktperson?: string; start_date: string; status: string; case_price?: number; skadedjur?: string; }

interface ReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    technicianId: string;
    onOpenCase: (caseData: ScheduledCase) => void;
}

const ALL_STATUSES = ['Öppen', 'Bokad', 'Offert skickad', 'Offert signerad - boka in', 'Återbesök 1', 'Återbesök 2', 'Återbesök 3', 'Återbesök 4', 'Återbesök 5', 'Privatperson - review', 'Stängt - slasklogg', 'Avslutat'];

const toDateString = (date: Date): string => date.toISOString().split('T')[0];

export default function ReportModal({ isOpen, onClose, technicianId, onOpenCase }: ReportModalProps) {
    const [loading, setLoading] = useState(false);
    const [reportCases, setReportCases] = useState<ScheduledCase[]>([]);
    
    // Filter-state
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return toDateString(d);
    });
    const [endDate, setEndDate] = useState(toDateString(new Date()));
    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set(ALL_STATUSES));
    const [searchQuery, setSearchQuery] = useState('');

    const fetchReportData = useCallback(async () => {
        if (!technicianId) return;
        setLoading(true);

        try {
            // KORRIGERING: 'case_type' borttagen från commonFields.
            const commonFields = `id, title, kontaktperson, start_date, status, skadedjur, pris`;

            const [privateResult, businessResult] = await Promise.all([
                supabase.from('private_cases').select(commonFields).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId}`).gte('start_date', startDate).lte('start_date', `${endDate}T23:59:59`),
                supabase.from('business_cases').select(commonFields).or(`primary_assignee_id.eq.${technicianId},secondary_assignee_id.eq.${technicianId}`).gte('start_date', startDate).lte('start_date', `${endDate}T23:59:59`)
            ]);

            if (privateResult.error) throw privateResult.error;
            if (businessResult.error) throw businessResult.error;

            // KORRIGERING: Mappar 'pris' till 'case_price' OCH lägger manuellt till 'case_type'.
            const privateCases = (privateResult.data || []).map(c => ({
                ...c,
                case_price: c.pris,
                case_type: 'private' as const // Lägg till typen manuellt
            }));
            const businessCases = (businessResult.data || []).map(c => ({
                ...c,
                case_price: c.pris,
                case_type: 'business' as const // Lägg till typen manuellt
            }));

            const allCases = [...privateCases, ...businessCases];

            setReportCases(allCases as ScheduledCase[]);

        } catch (error) {
            console.error("Fel vid hämtning av rapportdata:", error);
            setReportCases([]);
        } finally {
            setLoading(false);
        }
    }, [technicianId, startDate, endDate]);

    const filteredReportCases = useMemo(() => {
        return reportCases
            .filter(c => {
                const matchesStatus = selectedStatuses.has(c.status);
                const query = searchQuery.toLowerCase();
                const matchesSearch = !query || c.title.toLowerCase().includes(query) || c.kontaktperson?.toLowerCase().includes(query) || c.skadedjur?.toLowerCase().includes(query);
                return matchesStatus && matchesSearch;
            })
            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
    }, [reportCases, selectedStatuses, searchQuery]);
    
    const stats = useMemo(() => {
        const totalValue = filteredReportCases.reduce((acc, c) => acc + (c.case_price || 0), 0);
        return {
            caseCount: filteredReportCases.length,
            totalValue,
        };
    }, [filteredReportCases]);

    const toggleStatus = (status: string) => {
        const newStatuses = new Set(selectedStatuses);
        newStatuses.has(status) ? newStatuses.delete(status) : newStatuses.add(status);
        setSelectedStatuses(newStatuses);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl">
                        <header className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3"><BarChart className="w-6 h-6 text-purple-400" /><h2 className="text-xl font-bold">Rapport & Analys</h2></div>
                            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
                        </header>
                        <div className="p-4 bg-slate-950/50 border-b border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-semibold text-slate-400 block mb-1">Startdatum</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm"/></div>
                                <div><label className="text-xs font-semibold text-slate-400 block mb-1">Slutdatum</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm"/></div>
                            </div>
                            <div><Button onClick={fetchReportData} disabled={loading} className="w-full">{loading ? 'Hämtar...' : 'Hämta Rapport'}</Button></div>
                        </div>
                        <div className="flex-grow flex overflow-hidden">
                            <aside className="w-1/3 xl:w-1/4 p-4 border-r border-slate-800 overflow-y-auto shrink-0">
                                <h3 className="text-lg font-bold mb-4">Statistik</h3>
                                <div className="space-y-3 text-sm mb-6">
                                    <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded-lg"><span>Antal Ärenden:</span><span className="font-bold text-lg">{stats.caseCount}</span></div>
                                    <div className="flex justify-between items-center p-2 bg-slate-800/50 rounded-lg"><span>Totalt Värde:</span><span className="font-bold text-lg">{stats.totalValue.toLocaleString('sv-SE')} kr</span></div>
                                </div>
                                <h3 className="text-lg font-bold mb-2">Filtrera Status</h3>
                                <div className="space-y-1">
                                    {ALL_STATUSES.map(status => (<label key={status} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-slate-800/50 text-sm cursor-pointer"><input type="checkbox" checked={selectedStatuses.has(status)} onChange={() => toggleStatus(status)} className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"/><span>{status}</span></label>))}
                                </div>
                            </aside>
                            <main className="flex-grow flex flex-col overflow-y-auto">
                                <div className="p-4 border-b border-slate-800 shrink-0"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><input type="text" placeholder="Sök i resultat..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500"/></div></div>
                                <div className="flex-grow overflow-y-auto">
                                {loading && <div className="flex items-center justify-center h-full"><LoadingSpinner/></div>}
                                {!loading && filteredReportCases.length === 0 && <div className="text-center p-16 text-slate-500">Inga ärenden matchade dina val. Prova att justera datum eller filter.</div>}
                                {!loading && filteredReportCases.map(caseData => (
                                    <div key={caseData.id} onClick={() => onOpenCase(caseData)} className="p-4 border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors">
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-white">{caseData.title}</span><span className="text-sm font-semibold text-blue-300">{caseData.case_price?.toLocaleString('sv-SE')} kr</span></div>
                                        <div className="flex justify-between items-center text-sm text-slate-400"><span>{new Date(caseData.start_date).toLocaleDateString('sv-SE')} - {caseData.kontaktperson}</span><span>{caseData.status}</span></div>
                                    </div>
                                ))}
                                </div>
                            </main>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}