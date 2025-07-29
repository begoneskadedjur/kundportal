import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Säkerställ att sökvägen till din supabase-klient är korrekt

// Importera dina komponenter
import CoordinatorDashboardCard from '../../components/admin/coordinator/CoordinatorDashboardCard';
import CoordinatorKpiCard from '../../components/admin/coordinator/CoordinatorKpiCard';
import CaseSearchCard from '../../components/admin/coordinator/CaseSearchCard';

// Importera ikoner
import { CalendarDays, Map, Wand2, Users, PieChart, Wrench, AlertTriangle } from 'lucide-react';

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
          supabase.from('technicians').select('id', { count: 'exact', head: true }).eq('is_active', true)
        ]);
        
        // Kombinera alla potentiella fel till ett meddelande för enklare felsökning
        const errors = [
            unplannedPrivate.error, unplannedBusiness.error,
            scheduledPrivate.error, scheduledBusiness.error,
            completedPrivate.error, completedBusiness.error,
            techniciansResult.error
        ].filter(Boolean);

        if (errors.length > 0) {
            throw new Error(errors.map(e => e.message).join(', '));
        }

        // Summera resultaten från de olika tabellerna
        const totalUnplanned = (unplannedPrivate.count ?? 0) + (unplannedBusiness.count ?? 0);
        const totalScheduledToday = (scheduledPrivate.count ?? 0) + (scheduledBusiness.count ?? 0);
        const totalCompletedWeek = (completedPrivate.count ?? 0) + (completedBusiness.count ?? 0);
        const totalActiveTechnicians = techniciansResult.count ?? 0;

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white">Coordinator Dashboard</h1>
          <p className="mt-2 text-lg text-slate-400">
            Samlad översikt för planering, bokning och optimering.
          </p>
        </header>

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
              <CoordinatorKpiCard title="Oplanerade Ärenden" value={kpiData.unplanned} icon={Wrench} />
              <CoordinatorKpiCard title="Schemalagda Idag" value={kpiData.scheduledToday} icon={CalendarDays} />
              <CoordinatorKpiCard title="Aktiva Tekniker" value={kpiData.activeTechnicians} icon={Users} />
              <CoordinatorKpiCard title="Avslutade (7 dagar)" value={kpiData.completedWeek} icon={PieChart} />
            </>
          )}
        </section>

        {/* --- Söksektion --- */}
        <section className="mt-16">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <CaseSearchCard />
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Snabbåtkomst</h3>
                <div className="space-y-3">
                  <a href="/koordinator/schema" className="block p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <CalendarDays className="w-5 h-5 text-blue-400" />
                      <span className="text-white font-medium">Schema & Planering</span>
                    </div>
                  </a>
                  <a href="/koordinator/ruttplanerare" className="block p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Map className="w-5 h-5 text-green-400" />
                      <span className="text-white font-medium">Ruttplanerare</span>
                    </div>
                  </a>
                  <a href="/koordinator/booking-assistant" className="block p-4 bg-slate-900 border border-slate-800 rounded-lg hover:border-blue-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Wand2 className="w-5 h-5 text-purple-400" />
                      <span className="text-white font-medium">Bokningsassistent</span>
                    </div>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Huvudsektion med verktyg (denna del påverkas inte av datahämtningen) --- */}
        <main className="mt-16">
          <h2 className="text-2xl font-bold text-white mb-6">Alla Verktyg</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            <CoordinatorDashboardCard
              href="/koordinator/schema"
              icon={CalendarDays}
              title="Schema & Planering"
              description="Visuell översikt av alla teknikers scheman. Dra och släpp oplanerade ärenden för att boka."
              tag="Kärnfunktion"
            />
            <CoordinatorDashboardCard
              href="/koordinator/ruttplanerare"
              icon={Map}
              title="Ruttplanerare"
              description="Välj en tekniker och ett datum för att se och optimera dagens körrutt med ett klick."
            />
            <CoordinatorDashboardCard
              href="/koordinator/booking-assistant"
              icon={Wand2}
              title="Intelligent Bokningsassistent"
              description="Ange en ny adress och få AI-förslag på den mest effektiva teknikern och tiden att boka."
              tag="Nytt"
            />
          </div>
        </main>
      </div>
    </div>
  );
}