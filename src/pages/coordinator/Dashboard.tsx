import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Säkerställ att sökvägen till din supabase-klient är korrekt

// Importera dina komponenter
import CoordinatorDashboardCard from '../../components/admin/coordinator/CoordinatorDashboardCard';
import CoordinatorKpiCard from '../../components/admin/coordinator/CoordinatorKpiCard';
import CaseSearchCard from '../../components/admin/coordinator/CaseSearchCard';
import KpiCaseListModal from '../../components/admin/coordinator/KpiCaseListModal';
import { BeGoneCaseRow, Technician } from '../../types/database';

// Importera ikoner
import { CalendarDays, Wand2, Users, PieChart, Wrench, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/shared';

export default function CoordinatorDashboard() {
  // State för att hålla vår data, laddningsstatus och eventuella fel
  const [kpiData, setKpiData] = useState({
    unplanned: 0,
    scheduledToday: 0,
    activeTechnicians: 0,
    completedWeek: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State för modal och data
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    title: string;
    cases: BeGoneCaseRow[];
    technicians?: Technician[];
    kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians';
  }>({
    title: '',
    cases: [],
    technicians: [],
    kpiType: 'unplanned'
  });
  
  // State för alla ärenden och tekniker
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);

  useEffect(() => {
    // Funktion för att hämta all nödvändig data från Supabase
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // --- Beräkna datumgränser ---
        const today = new Date();
        const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
        const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
        
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);
        const weekAgoStart = new Date(weekAgo.setHours(0, 0, 0, 0)).toISOString();

        // Statusar som indikerar att ett ärende är oplanerat och behöver en åtgärd
        const unplannedStatuses = ['Öppen', 'Offert signerad - boka in'];

        // --- Hämta data parallellt för bästa prestanda ---
        const [
          unplannedPrivate,
          unplannedBusiness,
          scheduledPrivate,
          scheduledBusiness,
          completedPrivate,
          completedBusiness,
          techniciansResult,
          allPrivateCases,
          allBusinessCases,
        ] = await Promise.all([
          // 1. Räkna oplanerade ärenden
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).in('status', unplannedStatuses),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).in('status', unplannedStatuses),
          
          // 2. Räkna ärenden schemalagda idag
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).gte('start_date', todayStart).lte('start_date', todayEnd),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).gte('start_date', todayStart).lte('start_date', todayEnd),
          
          // 3. Räkna ärenden avslutade senaste 7 dagarna
          supabase.from('private_cases').select('id', { count: 'exact', head: true }).gte('completed_date', weekAgoStart),
          supabase.from('business_cases').select('id', { count: 'exact', head: true }).gte('completed_date', weekAgoStart),

          // 4. Räkna aktiva tekniker
          supabase.from('technicians').select('*').eq('is_active', true),
          
          // 5. Hämta alla ärenden för modal-visning
          supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
          supabase.from('business_cases').select('*').order('created_at', { ascending: false })
        ]);
        
        // Kombinera alla potentiella fel till ett meddelande för enklare felsökning
        const errors = [
            unplannedPrivate.error, unplannedBusiness.error,
            scheduledPrivate.error, scheduledBusiness.error,
            completedPrivate.error, completedBusiness.error,
            techniciansResult.error, allPrivateCases.error, allBusinessCases.error
        ].filter(Boolean);

        if (errors.length > 0) {
            throw new Error(errors.map(e => e.message).join(', '));
        }

        // Kombinera alla ärenden för modal-visning
        const combinedCases = [
          ...(allPrivateCases.data || []).map(c => ({ ...c, case_type: 'private' as const })),
          ...(allBusinessCases.data || []).map(c => ({ ...c, case_type: 'business' as const }))
        ];
        
        setAllCases(combinedCases as BeGoneCaseRow[]);
        setAllTechnicians(techniciansResult.data || []);

        // Summera resultaten från de olika tabellerna
        const totalUnplanned = (unplannedPrivate.count ?? 0) + (unplannedBusiness.count ?? 0);
        const totalScheduledToday = (scheduledPrivate.count ?? 0) + (scheduledBusiness.count ?? 0);
        const totalCompletedWeek = (completedPrivate.count ?? 0) + (completedBusiness.count ?? 0);
        const totalActiveTechnicians = (techniciansResult.data || []).length;

        // Uppdatera state med den nya datan
        setKpiData({
          unplanned: totalUnplanned,
          scheduledToday: totalScheduledToday,
          activeTechnicians: totalActiveTechnicians,
          completedWeek: totalCompletedWeek,
        });

      } catch (err: any) {
        console.error("Fel vid hämtning av dashboard-data:", err.message);
        setError("Kunde inte ladda dashboard-data. Kontrollera konsolen för mer information.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []); // Den tomma arrayen [] betyder att denna effekt bara körs en gång.

  // Funktioner för att filtrera ärenden baserat på KPI-typ
  const getUnplannedCases = () => {
    const unplannedStatuses = ['Öppen', 'Offert signerad - boka in'];
    return allCases.filter(c => unplannedStatuses.includes(c.status));
  };

  const getScheduledTodayCases = () => {
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    return allCases.filter(c => {
      if (!c.start_date) return false;
      const caseDate = c.start_date;
      return caseDate >= todayStart && caseDate <= todayEnd;
    });
  };

  const getCompletedWeekCases = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStart = new Date(weekAgo.setHours(0, 0, 0, 0)).toISOString();
    
    return allCases.filter(c => {
      if (!c.completed_date) return false;
      return c.completed_date >= weekAgoStart;
    });
  };

  // Funktioner för att hantera klick på KPI-kort
  const handleKpiCardClick = (kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians') => {
    let title = '';
    let cases: BeGoneCaseRow[] = [];
    let technicians: Technician[] | undefined = undefined;

    switch (kpiType) {
      case 'unplanned':
        title = 'Oplanerade Ärenden';
        cases = getUnplannedCases();
        break;
      case 'scheduled':
        title = 'Schemalagda Idag';
        cases = getScheduledTodayCases();
        break;
      case 'completed':
        title = 'Avslutade (7 dagar)';
        cases = getCompletedWeekCases();
        break;
      case 'technicians':
        title = 'Aktiva Tekniker';
        cases = [];
        technicians = allTechnicians;
        break;
    }

    setModalData({ title, cases, technicians, kpiType });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        
        <PageHeader 
          title="Koordinator Dashboard"
          showBackButton={false}
        />

        {/* --- KPI Sektion med laddning/fel-hantering --- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            // Visa "skelett"-kort medan datan laddas
            Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-slate-900 p-5 rounded-xl border border-slate-800 h-[104px] animate-pulse"></div>
            ))
          ) : error ? (
            // Visa ett felmeddelande om något går snett
            <div className="col-span-full bg-red-900/20 border border-red-500/30 text-red-300 p-4 rounded-lg flex items-center gap-4">
              <AlertTriangle className="w-6 h-6" />
              <div>
                <p className="font-bold">Ett fel uppstod</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            // Visa de riktiga korten med data
            <>
              <CoordinatorKpiCard 
                title="Oplanerade Ärenden" 
                value={kpiData.unplanned} 
                icon={Wrench} 
                onClick={() => handleKpiCardClick('unplanned')}
              />
              <CoordinatorKpiCard 
                title="Schemalagda Idag" 
                value={kpiData.scheduledToday} 
                icon={CalendarDays} 
                onClick={() => handleKpiCardClick('scheduled')}
              />
              <CoordinatorKpiCard 
                title="Aktiva Tekniker" 
                value={kpiData.activeTechnicians} 
                icon={Users} 
                onClick={() => handleKpiCardClick('technicians')}
              />
              <CoordinatorKpiCard 
                title="Avslutade (7 dagar)" 
                value={kpiData.completedWeek} 
                icon={PieChart} 
                onClick={() => handleKpiCardClick('completed')}
              />
            </>
          )}
        </section>

        {/* --- Söksektion --- */}
        <section className="mt-16">
          <CaseSearchCard />
        </section>

        {/* --- Huvudsektion med verktyg (denna del påverkas inte av datahämtningen) --- */}
        <main className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6">Verktyg</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            <CoordinatorDashboardCard
              href="/koordinator/schema"
              icon={CalendarDays}
              title="Schema & Planering"
              description="Visuell översikt av alla teknikers scheman. Dra och släpp oplanerade ärenden för att boka."
              tag="Kärnfunktion"
            />
            <CoordinatorDashboardCard
              href="/koordinator/booking-assistant"
              icon={Wand2}
              title="Schemaoptimerare"
              description="Optimera befintligt schema för att minska körsträckor och maximera tekniker-effektivitet."
              tag="Uppdaterad"
            />
          </div>
        </main>
      </div>

      {/* KPI Case List Modal */}
      <KpiCaseListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalData.title}
        cases={modalData.cases}
        technicians={modalData.technicians}
        kpiType={modalData.kpiType}
      />
    </div>
  );
}