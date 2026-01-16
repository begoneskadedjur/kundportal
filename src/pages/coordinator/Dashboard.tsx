import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Säkerställ att sökvägen till din supabase-klient är korrekt

// Importera dina komponenter
import CoordinatorDashboardCard from '../../components/admin/coordinator/CoordinatorDashboardCard';
import CoordinatorKpiCard from '../../components/admin/coordinator/CoordinatorKpiCard';
import KpiCaseListModal from '../../components/admin/coordinator/KpiCaseListModal';
import GeographicOverview from '../../components/admin/coordinator/GeographicOverview';
import { BeGoneCaseRow, Technician } from '../../types/database';

// Importera ikoner
import { CalendarDays, Wand2, Users, PieChart, Wrench, AlertTriangle, FileSearch, BarChart3, FileSignature, UserPlus, Building2, TrendingUp, Receipt, Target } from 'lucide-react';
import { PageHeader } from '../../components/shared';
import GlobalCoordinatorChat from '../../components/coordinator/GlobalCoordinatorChat';
import EventLogCard from '../../components/shared/EventLogCard';
// NotificationCenter borttagen - nu finns global header med notifikationer

export default function CoordinatorDashboard() {
  // State för att hålla vår data, laddningsstatus och eventuella fel
  const [kpiData, setKpiData] = useState({
    unplanned: 0,
    scheduledToday: 0,
    activeTechnicians: '0/0' as string | number,
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
    absences?: any[];
    kpiType: 'unplanned' | 'scheduled' | 'completed' | 'technicians';
  }>({
    title: '',
    cases: [],
    technicians: [],
    absences: [],
    kpiType: 'unplanned'
  });
  
  // State för alla ärenden och tekniker
  const [allCases, setAllCases] = useState<BeGoneCaseRow[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<Technician[]>([]);
  const [currentAbsences, setCurrentAbsences] = useState<any[]>([]);

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

        // Dagens datum för frånvarokontroll
        const todayDateString = today.toISOString().split('T')[0];

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
          absenceResult,
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

          // 4. Hämta skadedjurstekniker (filtrera bort admins/koordinatorer)
          supabase.from('technicians').select('*').eq('is_active', true).eq('role', 'Skadedjurstekniker'),
          
          // 5. Hämta frånvaro för alla tekniker (för dagens datum)
          supabase.from('technician_absences').select('*')
            .lte('start_date', todayDateString + ' 23:59:59')
            .gte('end_date', todayDateString + ' 00:00:00'),
          
          // 6. Hämta alla ärenden för modal-visning
          supabase.from('private_cases').select('*').order('created_at', { ascending: false }),
          supabase.from('business_cases').select('*').order('created_at', { ascending: false })
        ]);
        
        // Kombinera alla potentiella fel till ett meddelande för enklare felsökning
        const errors = [
            unplannedPrivate.error, unplannedBusiness.error,
            scheduledPrivate.error, scheduledBusiness.error,
            completedPrivate.error, completedBusiness.error,
            techniciansResult.error, absenceResult.error, allPrivateCases.error, allBusinessCases.error
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
        setCurrentAbsences(absenceResult.data || []);

        // Summera resultaten från de olika tabellerna
        const totalUnplanned = (unplannedPrivate.count ?? 0) + (unplannedBusiness.count ?? 0);
        const totalScheduledToday = (scheduledPrivate.count ?? 0) + (scheduledBusiness.count ?? 0);
        const totalCompletedWeek = (completedPrivate.count ?? 0) + (completedBusiness.count ?? 0);
        
        // Beräkna tillgängliga tekniker
        const allSkadedjurstekniker = techniciansResult.data || [];
        const currentAbsences = absenceResult.data || [];
        
        // Hitta vilka tekniker som är frånvarande idag
        const absentTechnicianIds = currentAbsences.map(absence => absence.technician_id);
        const availableTechnicians = allSkadedjurstekniker.filter(tech => !absentTechnicianIds.includes(tech.id));
        
        const technicianAvailability = `${availableTechnicians.length}/${allSkadedjurstekniker.length}`;

        // Uppdatera state med den nya datan
        setKpiData({
          unplanned: totalUnplanned,
          scheduledToday: totalScheduledToday,
          activeTechnicians: technicianAvailability,
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
    let absences: any[] | undefined = undefined;

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
        title = 'Tekniker Status';
        cases = [];
        technicians = allTechnicians;
        absences = currentAbsences;
        break;
    }

    setModalData({ title, cases, technicians, absences, kpiType });
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


        {/* --- Notifikationer borttagna - nu finns global header --- */}

        {/* --- Verktyg (flyttat ovanför kartan) --- */}
        <section className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
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
            <CoordinatorDashboardCard
              href="/coordinator/leads"
              icon={Target}
              iconColor="text-amber-400"
              title="Lead Pipeline"
              description="Hantera potentiella kunder och säljprocessen."
              tag="Ny"
            />
            <CoordinatorDashboardCard
              href="/koordinator/oneflow-contract-creator"
              icon={FileSignature}
              title="Avtal & Offerter"
              description="Skapa professionella serviceavtal och offertförslag direkt från ärendedata med Oneflow-integration."
              tag="Tillgänglig"
            />
            <CoordinatorDashboardCard
              href="/koordinator/organisation/register"
              icon={UserPlus}
              title="Registrera Organisation"
              description="Registrera ny multisite-organisation med flera anläggningar och sites."
              tag="Ny"
            />
            <CoordinatorDashboardCard
              href="/koordinator/organisation/organizations"
              icon={Building2}
              title="Organisationsöversikt"
              description="Visa och hantera alla registrerade organisationer och deras anläggningar."
              tag="Hantering"
            />
            <CoordinatorDashboardCard
              href="/koordinator/organisation/traffic-light"
              icon={TrendingUp}
              title="Trafikljusöversikt"
              description="Övervakningssystem för att bedöma organisationers prestanda och status."
              tag="Analys"
            />
            <CoordinatorDashboardCard
              href="/koordinator/organisation/billing"
              icon={Receipt}
              title="Multisite-fakturering"
              description="Hantera fakturering för multisite-organisationer med konsoliderad eller per-site fakturering."
              tag="Finans"
            />
            <CoordinatorDashboardCard
              href="/koordinator/sok-arenden"
              icon={FileSearch}
              title="Sök Ärenden"
              description="Avancerad sökning bland alla ärenden med filter för status, tekniker, datum och mer."
              tag="Komplett"
            />
            <CoordinatorDashboardCard
              href="/koordinator/analytics"
              icon={BarChart3}
              title="Analytics & Insights"
              description="Djup analys av din koordinatorspåverkan på verksamheten och konkreta förbättringsförslag."
              tag="Ny"
            />
          </div>
        </section>

        {/* --- Geografisk översikt och Händelselogg --- */}
        <section className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <GeographicOverview />
          </div>
          <div className="lg:col-span-1">
            <EventLogCard maxEntries={8} />
          </div>
        </section>
      </div>

      {/* KPI Case List Modal */}
      <KpiCaseListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalData.title}
        cases={modalData.cases}
        technicians={modalData.technicians}
        absences={modalData.absences}
        kpiType={modalData.kpiType}
      />
      
      {/* Global Coordinator Chat */}
      <GlobalCoordinatorChat 
        currentPage="dashboard"
        contextData={{
          kpiData,
          recentCases: modalData.cases
        }}
      />
      
    </div>
  );
}