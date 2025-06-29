// src/pages/admin/Economics.tsx - FINAL FIX: Corrects component logic and maintains proper formatting

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, DollarSign, TrendingUp, Clock, Target, BarChart3,
  Calendar, AlertTriangle, ArrowUp, ArrowDown,
  Activity, Gift, Zap, Bug, UserCheck, Briefcase, Scale,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { supabase } from '../../lib/supabase';
import { economicStatisticsService } from '../../services/economicStatisticsService';
import type { DashboardStats, MonthlyGrowthAnalysis, UpsellOpportunity, ARRByBusinessType, PerformanceStats, ARRProjection, UnitEconomics } from '../../services/economicStatisticsService';

// --- TYPER & GRÄNSSNITT ---
type ChartDataPoint = { month: string; value: number };
type ChartState = {
  loading: boolean;
  error: string | null;
  data: ChartDataPoint[];
  year: number;
};

// --- FORMATTERING & UI-KOMPONENTER ---
const formatCurrency = (amount: number) => new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

const Tooltip = ({ children, content }: { children: React.ReactNode, content: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute z-50 px-3 py-2 text-sm text-white bg-slate-800 border border-slate-600 rounded-lg shadow-lg -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full whitespace-normal max-w-xs w-max">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ title, value, icon: Icon, color, tooltip }: { title: string, value: string | number, icon: any, color: string, tooltip: string }) => (
  <Tooltip content={tooltip}>
    <Card className={`hover:bg-slate-800/50 transition-colors cursor-help bg-${color}-500/10 border-${color}-500/20`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium text-${color}-400`}>{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className={`w-8 h-8 text-${color}-500`} />
      </div>
    </Card>
  </Tooltip>
);

const MonthlyChart = ({ title, chartState, onYearChange, type = 'contracts' }: { title: string; chartState: ChartState; onYearChange: (year: number) => void; type?: 'contracts' | 'revenue' }) => {
  const formatValue = (amount: number) => type === 'revenue' ? formatCurrency(amount) : amount.toString();
  const maxValue = Math.max(...chartState.data.map(d => d.value), 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
  
  return (
    <Card>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-green-500" />{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onYearChange(chartState.year - 1)} className="text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-white font-medium px-3">{chartState.year}</span>
          <Button variant="ghost" size="sm" onClick={() => onYearChange(chartState.year + 1)} disabled={chartState.year >= new Date().getFullYear()} className="text-slate-400 hover:text-white disabled:opacity-50"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      <div className="h-64 flex items-center justify-center">
        {chartState.loading ? (
           <Activity className="w-6 h-6 animate-spin text-blue-500" />
        ) : chartState.error ? (
          <div className="text-red-400 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/>{chartState.error}</div>
        ) : (
          <div className="h-full w-full flex items-end justify-between gap-2 mb-4">
            {chartState.data.map((monthData, index) => {
              const height = maxValue > 0 ? (monthData.value / maxValue) * 200 : 0;
              return (
                <div key={index} className="flex flex-col items-center flex-1 group">
                  <div className="relative w-full rounded-t-lg transition-all duration-300 group-hover:opacity-80" style={{ height: `${height}px`, minHeight: '4px', backgroundColor: type === 'contracts' ? '#22c55e' : '#3b82f6' }}>
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-800 text-white text-xs px-2 py-1 rounded">{formatValue(monthData.value)}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">{monthNames[index]}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!chartState.loading && !chartState.error && (
        <div className="pt-4 border-t border-slate-700 text-sm">
          <span className="text-slate-400">Total {chartState.year}: </span>
          <span className={`font-medium ${type === 'contracts' ? 'text-green-400' : 'text-blue-400'}`}>{formatValue(chartState.data.reduce((sum, d) => sum + (d?.value || 0), 0))}</span>
        </div>
      )}
    </Card>
  );
};

// --- ÖVRIGA KOMPONENTER (korrekt formaterade) ---

const MonthlyGrowthAnalysisCard = ({ analysis }: { analysis: MonthlyGrowthAnalysis }) => (
  <Card className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-slate-700 h-full">
    <h3 className="text-lg font-semibold text-white mb-4">Månadens Tillväxt-analys (MRR)</h3>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between items-center text-slate-400"><span>Start-MRR</span><span>{formatCurrency(analysis.startMRR)}</span></div>
      <div className="flex justify-between items-center text-green-400"><span><ArrowUp className="inline w-4 h-4 mr-1" />Nytt MRR</span><span className="font-semibold">{formatCurrency(analysis.newMRR)}</span></div>
      <div className="flex justify-between items-center text-red-400"><span><ArrowDown className="inline w-4 h-4 mr-1" />Förlorat MRR</span><span className="font-semibold">{formatCurrency(analysis.churnedMRR)}</span></div>
      <div className="border-t border-slate-700 my-2 !mt-3 !mb-3"></div>
      <div className="flex justify-between items-center text-white text-base font-bold"><span>Nettoförändring</span><span className={analysis.netChangeMRR >= 0 ? 'text-green-400' : 'text-red-400'}>{analysis.netChangeMRR >= 0 ? '+' : ''}{formatCurrency(analysis.netChangeMRR)}</span></div>
    </div>
  </Card>
);

const UpsellOpportunitiesCard = ({ opportunities }: { opportunities: UpsellOpportunity[] }) => (
  <Card className="bg-yellow-500/10 border-yellow-500/20 h-full">
    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Gift className="text-yellow-400"/> Upsell-möjligheter</h3>
    {opportunities.length > 0 ? (
      <ul className="space-y-3">
        {opportunities.map(opp => (
          <li key={opp.customerId} className="bg-slate-800/50 p-3 rounded-lg text-sm">
            <p className="font-bold text-white">{opp.companyName}</p>
            <div className="flex justify-between mt-1"><span className="text-slate-400">Avtal: {formatCurrency(opp.annualPremium)}</span><span className="text-cyan-400 font-semibold">Ärenden (6mån): {formatCurrency(opp.caseRevenueLast6Months)}</span></div>
          </li>
        ))}
      </ul>
    ) : (<p className="text-slate-400 text-sm">Inga tydliga upsell-möjligheter just nu.</p>)}
  </Card>
);

// FIX: Denna komponent anropar nu den korrekta funktionen och hanterar sitt eget state
const SegmentPerformanceCard = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<ARRByBusinessType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSegmentData = async () => {
      setLoading(true);
      setError(null);
      try {
        // ANROPAR NU KORREKT FUNKTION
        const segmentData = await economicStatisticsService.getARRByBusinessTypeForYear(year);
        setData(segmentData);
      } catch (err: any) {
        console.error("Failed to fetch segment data:", err);
        setError("Kunde inte ladda segmentdata.");
      } finally {
        setLoading(false);
      }
    };
    fetchSegmentData();
  }, [year]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => (b.arr + b.additional_case_revenue) - (a.arr + a.additional_case_revenue));
  }, [data]);

  const maxRevenue = Math.max(...sortedData.map(d => d.arr + d.additional_case_revenue), 1);

  return (
    <Card className="col-span-1 lg:col-span-2">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">Segmentanalys</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setYear(year - 1)} className="text-slate-400 hover:text-white"><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-white font-medium px-3">{year}</span>
          <Button variant="ghost" size="sm" onClick={() => setYear(year + 1)} disabled={year >= new Date().getFullYear()} className="text-slate-400 hover:text-white disabled:opacity-50"><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center"><Activity className="w-6 h-6 animate-spin text-blue-500" /></div>
      ) : error ? (
        <div className="h-48 flex items-center justify-center text-red-400"><AlertTriangle className="w-5 h-5 mr-2"/> {error}</div>
      ) : (
        <div className="space-y-3">
          {sortedData.length > 0 ? sortedData.slice(0, 7).map(item => {
            const totalItemRevenue = item.arr + item.additional_case_revenue;
            const barWidth = (totalItemRevenue / maxRevenue) * 100;
            const arrWidth = totalItemRevenue > 0 ? (item.arr / totalItemRevenue) * 100 : 0;
            return (
              <div key={item.business_type}>
                <div className="flex justify-between items-center mb-1 text-sm"><span className="font-medium text-white capitalize">{item.business_type} ({item.customer_count})</span><span className="font-semibold text-white">{formatCurrency(totalItemRevenue)}</span></div>
                <div className="w-full bg-slate-800 rounded-full h-4 relative"><div className="h-full flex rounded-full overflow-hidden" style={{ width: `${barWidth}%`}}><Tooltip content={`Avtal: ${formatCurrency(item.arr)}`}><div className="h-full bg-green-500" style={{ width: `${arrWidth}%`}} /></Tooltip><Tooltip content={`Ärenden: ${formatCurrency(item.additional_case_revenue)}`}><div className="h-full bg-cyan-500" style={{ width: `${100 - arrWidth}%`}} /></Tooltip></div></div>
              </div>
            );
          }) : <p className="text-slate-400 text-center py-10">Ingen data för valt år.</p>}
        </div>
      )}
    </Card>
  );
};

const PerformanceAndRevenueCard = ({ data }: { data: PerformanceStats }) => {
  const [activeTab, setActiveTab] = useState<'technician' | 'pest'>('technician');
  return (
    <Card>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
        <h2 className="text-xl font-bold text-white">Prestanda & Intäkter</h2>
        <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
          <Button size="sm" variant={activeTab === 'technician' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('technician')} className="flex items-center gap-2"><UserCheck className="w-4 h-4" />Per Tekniker</Button>
          <Button size="sm" variant={activeTab === 'pest' ? 'secondary' : 'ghost'} onClick={() => setActiveTab('pest')} className="flex items-center gap-2"><Bug className="w-4 h-4" />Per Skadedjurstyp</Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        {activeTab === 'technician' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700"><th className="text-left py-3 px-2 text-slate-400 font-medium">Tekniker</th><th className="text-right py-3 px-2 text-green-400 font-medium">Avtalsintäkt (#)</th><th className="text-right py-3 px-2 text-cyan-400 font-medium">Ärende-intäkt (#)</th><th className="text-right py-3 px-2 text-purple-400 font-medium">Total Intäkt</th></tr></thead>
            <tbody>{data.byTechnician.map(tech => (<tr key={tech.name} className="border-b border-slate-800 hover:bg-slate-800/30"><td className="py-3 px-2 text-white font-medium capitalize">{tech.name}</td><td className="py-3 px-2 text-right text-green-400">{formatCurrency(tech.contractRevenue)} <span className='text-xs text-slate-500'>({tech.contractCount})</span></td><td className="py-3 px-2 text-right text-cyan-400">{formatCurrency(tech.caseRevenue)} <span className='text-xs text-slate-500'>({tech.caseCount})</span></td><td className="py-3 px-2 text-right text-purple-400 font-bold">{formatCurrency(tech.totalRevenue)}</td></tr>))}</tbody>
          </table>
        )}
        {activeTab === 'pest' && (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700"><th className="text-left py-3 px-2 text-slate-400 font-medium">Skadedjurstyp</th><th className="text-right py-3 px-2 text-slate-400 font-medium">Antal Ärenden</th><th className="text-right py-3 px-2 text-cyan-400 font-medium">Total Intäkt</th></tr></thead>
            <tbody>{data.byPestType.map(pest => (<tr key={pest.pestType} className="border-b border-slate-800 hover:bg-slate-800/30"><td className="py-3 px-2 text-white font-medium">{pest.pestType}</td><td className="py-3 px-2 text-right">{pest.caseCount}</td><td className="py-3 px-2 text-right text-cyan-400 font-bold">{formatCurrency(pest.revenue)}</td></tr>))}</tbody>
          </table>
        )}
      </div>
    </Card>
  )
};

const FutureARRChart = ({ data }: { data: ARRProjection[] }) => (
  <Card>
    <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
      <TrendingUp className="w-5 h-5 text-blue-500"/>Framtida ARR
    </h2>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {data.map((yearData, index) => {
        const prevYearARR = index > 0 ? data[index - 1].projectedARR : 0;
        const growth = prevYearARR > 0 ? ((yearData.projectedARR - prevYearARR) / prevYearARR) * 100 : 0;
        const isCurrentYear = yearData.year === new Date().getFullYear();
        return (
          <div key={yearData.year} className={`p-4 rounded-lg flex flex-col justify-between ${isCurrentYear ? 'bg-blue-500/20 border border-blue-500/50' : 'bg-slate-800/50'}`}>
            <div>
              <p className={`font-bold text-lg ${isCurrentYear ? 'text-blue-300' : 'text-slate-400'}`}>{yearData.year}</p>
              <p className="text-2xl font-bold text-white mt-1">{formatCurrency(yearData.projectedARR)}</p>
            </div>
            <div className="mt-4">
              {index > 0 && (
                <div className={`flex items-center text-sm ${growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {growth >= 0 ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                  <span className="ml-1">{growth.toFixed(1)}%</span>
                </div>
              )}
              <div className="flex items-center text-xs text-slate-500 mt-1">
                <Briefcase className="w-3 h-3 mr-1.5"/>{yearData.activeContracts} avtal
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </Card>
);

const UnitEconomicsCard = ({ data }: { data: UnitEconomics }) => (
  <Card>
    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Scale className="w-6 h-6 text-indigo-400"/>Enhetsekonomi & Lönsamhet</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <p className="text-sm text-slate-400">Kundförvärvskostnad (CAC)</p>
        <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.cac)}</p>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <p className="text-sm text-slate-400">Livstidsvärde (LTV)</p>
        <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.ltv)}</p>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <p className="text-sm text-slate-400">LTV / CAC Ratio</p>
        <p className={`text-2xl font-bold mt-1 ${data.ltvToCacRatio >= 3 ? 'text-green-400' : 'text-yellow-400'}`}>
          {data.ltvToCacRatio.toFixed(1)}x
        </p>
      </div>
      <div className="bg-slate-800/50 p-4 rounded-lg">
        <p className="text-sm text-slate-400">Återbetalningstid</p>
        <p className="text-2xl font-bold text-white mt-1">{data.paybackPeriodMonths.toFixed(1)} <span className="text-base font-normal text-slate-400">mån</span></p>
      </div>
    </div>
  </Card>
);


// --- HUVUDKOMPONENT ---
export default function Economics() {
  const navigate = useNavigate();
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  const initialChartState = { loading: true, error: null, data: [], year: new Date().getFullYear() };
  const [contractsChartState, setContractsChartState] = useState<ChartState>(initialChartState);
  const [caseRevenueChartState, setCaseRevenueChartState] = useState<ChartState>(initialChartState);
  
  // Hämta huvuddata en gång vid sidladdning
  useEffect(() => {
    const fetchEconomicData = async () => {
      setPageLoading(true);
      setPageError(null);
      try {
        const stats = await economicStatisticsService.getDashboardStats(30);
        setDashboardStats(stats);
      } catch (error: any) {
        setPageError(error.message || 'Kunde inte hämta ekonomisk data');
      } finally {
        setPageLoading(false);
      }
    };
    fetchEconomicData();
  }, []);

  // Separata useEffects för varje diagram, triggas när deras respektive år ändras
  useEffect(() => {
    const fetchContractsData = async () => {
      setContractsChartState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const data = await getYearlyChartData('customers', 'created_at', contractsChartState.year, 'count');
        setContractsChartState(prev => ({ ...prev, data, loading: false }));
      } catch (error) {
        console.error("Error fetching contracts chart data", error);
        setContractsChartState(prev => ({ ...prev, loading: false, error: "Kunde inte ladda data" }));
      }
    };
    fetchContractsData();
  }, [contractsChartState.year]);

  useEffect(() => {
    const fetchCaseRevenueData = async () => {
      setCaseRevenueChartState(prev => ({ ...prev, loading: true, error: null }));
      try {
        const data = await getYearlyChartData('cases', 'completed_date', caseRevenueChartState.year, 'sum', 'price');
        setCaseRevenueChartState(prev => ({ ...prev, data, loading: false }));
      } catch (error) {
        console.error("Error fetching case revenue chart data", error);
        setCaseRevenueChartState(prev => ({ ...prev, loading: false, error: "Kunde inte ladda data" }));
      }
    };
    fetchCaseRevenueData();
  }, [caseRevenueChartState.year]);

  // Generisk funktion för att hämta årsdata med bättre typsäkerhet
  const getYearlyChartData = async (
    table: string, 
    date_col: string, 
    year: number, 
    aggregation: 'count' | 'sum', 
    sum_col?: string
  ): Promise<ChartDataPoint[]> => {
    
    type RowType = { [date_col: string]: string; [key: string]: any; };
    
    const select_cols = aggregation === 'sum' && sum_col ? `${date_col}, ${sum_col}` : date_col;
    let query = supabase.from(table).select(select_cols)
        .gte(date_col, `${year}-01-01T00:00:00Z`)
        .lt(date_col, `${year + 1}-01-01T00:00:00Z`);

    if(sum_col) { 
      query = query.not(sum_col, 'is', null).gt(sum_col, 0); 
    }

    const { data, error } = await query;
    if(error) throw error;
    
    const monthlyData: ChartDataPoint[] = Array.from({ length: 12 }, (_, i) => ({ 
      month: new Date(year, i).toLocaleDateString('sv-SE', { month: 'short' }), 
      value: 0 
    }));
    
    (data as RowType[]).forEach((row) => {
        if (!row[date_col]) return;
        const monthIndex = new Date(row[date_col]).getMonth();
        if(aggregation === 'count') {
          monthlyData[monthIndex].value++;
        } else if (sum_col && typeof row[sum_col] === 'number') {
          monthlyData[monthIndex].value += row[sum_col];
        }
    });
    return monthlyData;
  }

  if (pageLoading || !dashboardStats) {
    return (<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Activity className="w-8 h-8 text-green-500 mx-auto mb-4 animate-spin" /></div>);
  }

  const { arr, growthAnalysis, upsellOpportunities, performanceStats, arrProjections, unitEconomics } = dashboardStats;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center space-x-4"><Button variant="ghost" size="sm" onClick={() => navigate('/admin')} className="text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4 mr-2" />Tillbaka</Button><h1 className="text-xl font-bold text-white">Ekonomisk Översikt</h1></div>
          <Button variant="ghost" size="sm" onClick={() => window.location.reload()} disabled={pageLoading} className="text-slate-400 hover:text-white"><Activity className={`w-4 h-4 mr-2 ${pageLoading ? 'animate-spin' : ''}`} />Uppdatera</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {pageError && <Card className="bg-red-500/10 border-red-500/50"><AlertTriangle className="inline w-6 h-6 text-red-400 mr-2"/>{pageError}</Card>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            <MetricCard title="ARR (Avtal)" value={formatCurrency(arr.currentARR)} icon={DollarSign} color="green" tooltip="Årlig återkommande intäkt från aktiva avtal."/>
            <MetricCard title="Ärende-intäkter" value={formatCurrency(arr.additionalCaseRevenue)} icon={TrendingUp} color="cyan" tooltip="Totala intäkter från slutförda extra-ärenden."/>
            <MetricCard title="MRR" value={formatCurrency(arr.monthlyRecurringRevenue)} icon={Calendar} color="blue" tooltip="Månatlig återkommande intäkt (ARR / 12)."/>
            <MetricCard title="Total Intäkt" value={formatCurrency(arr.totalRevenue)} icon={TrendingUp} color="purple" tooltip="Total intäkt (ARR + Ärenden)."/>
          </div>
          <MonthlyGrowthAnalysisCard analysis={growthAnalysis} />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <SegmentPerformanceCard />
          <UpsellOpportunitiesCard opportunities={upsellOpportunities} />
        </div>
        
        <UnitEconomicsCard data={unitEconomics} />
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <MonthlyChart title="Nya Avtal per Månad" chartState={contractsChartState} onYearChange={(year) => setContractsChartState(prev => ({...prev, year}))} type="contracts" />
          <MonthlyChart title="Ärende-intäkter per Månad" chartState={caseRevenueChartState} onYearChange={(year) => setCaseRevenueChartState(prev => ({...prev, year}))} type="revenue" />
        </div>

        <FutureARRChart data={arrProjections} />
        
        <PerformanceAndRevenueCard data={performanceStats} />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Clock className="w-6 h-6 text-yellow-500" />Kommande Avtalsförnyelser</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-red-500/10 p-4 rounded-lg text-center"><p className="text-red-400 text-sm">Inom 3 mån</p><p className="text-2xl font-bold text-white">{arr.contractsExpiring3Months}</p></div>
              <div className="bg-orange-500/10 p-4 rounded-lg text-center"><p className="text-orange-400 text-sm">4-6 mån</p><p className="text-2xl font-bold text-white">{arr.contractsExpiring6Months}</p></div>
              <div className="bg-yellow-500/10 p-4 rounded-lg text-center"><p className="text-yellow-400 text-sm">7-12 mån</p><p className="text-2xl font-bold text-white">{arr.contractsExpiring12Months}</p></div>
            </div>
          </Card>
          <Card>
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3"><Target className="w-5 h-5 text-green-500" />Ekonomiska Nyckeltal</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">ARR per Kund</p><p className="text-white font-medium text-lg">{formatCurrency(arr.averageARRPerCustomer)}</p></div>
              <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Churn Rate</p><p className={`font-medium text-lg ${arr.churnRate > 5 ? 'text-red-400' : 'text-green-400'}`}>{arr.churnRate.toFixed(1)}%</p></div>
              <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Retention Rate</p><p className={`font-medium text-lg ${arr.retentionRate >= 90 ? 'text-green-400' : 'text-yellow-400'}`}>{arr.retentionRate.toFixed(1)}%</p></div>
              <div className="bg-slate-800/30 p-4 rounded-lg"><p className="text-slate-400 text-sm">Net Revenue Retention</p><p className={`font-medium text-lg ${arr.netRevenueRetention >= 100 ? 'text-green-400' : 'text-red-400'}`}>{arr.netRevenueRetention.toFixed(1)}%</p></div>
            </div>
          </Card>
        </div>

        <div className="mt-8 flex items-center justify-between text-xs text-slate-500">
          <span>Senast uppdaterad: {new Date().toLocaleTimeString('sv-SE')}</span>
          <div className="flex items-center gap-2"><Zap className="w-3 h-3 text-green-500" /><span>Verklig data från databas</span></div>
        </div>
      </main>
    </div>
  );
}