// src/components/admin/technicians/IndividualTechnicianAnalysis.tsx
// SLUTGILTIG VERSION: 2025-07-15 - Fullt integrerad med alla UI-komponenter i en enda fil.

import React, { useState, useEffect } from 'react';
import { 
  User, Brain, Sparkles, RefreshCw, AlertCircle, Bot, BarChart3, 
  TrendingUp, TrendingDown, Award, Target, CheckCircle, Zap, Briefcase, 
  Home, FileText, DollarSign, Users, BookOpen, AlertTriangle, ShieldCheck, 
  Droplet, Clock 
} from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../utils/formatters';

// --- SERVICE & DATASTRUKTUR-IMPORTS ---
import { aiAnalysisService } from '../../../services/aiAnalysisService';
import type { 
  AIAnalysis, AIAnalysisRequest, AIExecutiveSummary, AIPerformanceDashboard, 
  AIActionableDevelopmentPlan, AIStrength, AIDevelopmentArea, AIRevenueDeepDive, 
  AIMentorshipProfile, AIRiskAssessment, AISpecializationAnalysis, AIHistoricalTrends 
} from '../../../services/aiAnalysisService';

// --- BEFINTLIGA HOOKS ---
import { useCompleteTechnicianDashboard } from '../../../hooks/useTechnicianDashboard';
import type { TechnicianPerformance } from '../../../services/technicianAnalyticsService';

// =================================================================================
// SECTION 1: INBYGGDA UI-KORT FÖR ANALYSEN
// Alla UI-komponenter för att visa analysen är samlade här för enkelhetens skull.
// =================================================================================

//#region --- Analysis UI Cards ---

const ExecutiveSummaryCard: React.FC<{ summary: AIExecutiveSummary }> = ({ summary }) => (
  <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
    <div className="flex items-center gap-3 mb-3">
      <Bot className="w-6 h-6 text-orange-400" />
      <h3 className="text-xl font-bold text-orange-400">{summary.headline}</h3>
    </div>
    <p className="text-slate-300 leading-relaxed">{summary.summary}</p>
  </Card>
);

const PerformanceDashboardCard: React.FC<{ dashboard: AIPerformanceDashboard }> = ({ dashboard }) => {
    const getComparisonColor = (value: number) => {
        if (value > 5) return 'text-green-400';
        if (value < -5) return 'text-red-400';
        return 'text-slate-400';
    };
    return (
        <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-semibold text-white">Prestandapanel</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-slate-800/50 text-center flex flex-col justify-center items-center">
                    <p className="text-sm text-slate-400">Samlat Betyg</p>
                    <p className="text-5xl font-bold text-blue-300 mt-1 flex items-center gap-2"><Award className="w-8 h-8" />{dashboard.overall_performance_grade}</p>
                </div>
                {dashboard.key_metrics.map((metric, index) => (
                    <div key={index} className="p-4 rounded-lg bg-slate-800/50">
                        <p className="text-sm text-slate-400">{metric.metric}</p>
                        <p className="text-2xl font-bold text-white mt-1">{metric.value}</p>
                        {typeof metric.comparison_to_team_avg === 'number' && (
                            <div className={`flex items-center text-xs mt-2 font-semibold ${getComparisonColor(metric.comparison_to_team_avg)}`}>
                                {metric.comparison_to_team_avg > 5 && <TrendingUp className="w-4 h-4 mr-1" />}
                                {metric.comparison_to_team_avg < -5 && <TrendingDown className="w-4 h-4 mr-1" />}
                                <span>{metric.comparison_to_team_avg.toFixed(0)}% vs. teamet</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
};

const ActionableDevelopmentPlanCard: React.FC<{ plan: AIActionableDevelopmentPlan }> = ({ plan }) => {
    const getPriorityClass = (priority: 'Hög' | 'Medium' | 'Låg') => {
        switch (priority) {
            case 'Hög': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'Låg': return 'bg-green-500/20 text-green-300 border-green-500/30';
        }
    };
    return (
        <Card className="p-6 bg-slate-800/50 border-slate-700">
            <div className="flex items-center gap-3 mb-4"><Target className="w-6 h-6 text-purple-400" /><h3 className="text-xl font-semibold text-white">Handlingsplan - Nästa 30 Dagar</h3></div>
            <div className="p-4 rounded-lg bg-purple-500/10 mb-6 border border-purple-500/20"><p className="text-sm font-semibold text-purple-300 mb-1">Huvudfokus:</p><p className="text-white font-medium">{plan.primary_focus_30_days}</p></div>
            <div className="space-y-4">
                {plan.actions.map((action, index) => (
                    <div key={index} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="flex justify-between items-start mb-2 gap-4"><p className="font-semibold text-slate-200 flex-1 pr-4">{action.action}</p><span className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${getPriorityClass(action.priority)}`}>{action.priority} Prioritet</span></div>
                        <div className="text-sm text-slate-400 space-y-2 mt-3 border-t border-slate-600 pt-3"><p><span className="font-semibold text-slate-300">Förväntat resultat:</span> {action.expected_outcome}</p><p><span className="font-semibold text-slate-300">Hur vi mäter:</span> {action.how_to_measure}</p></div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const StrengthsAndDevelopmentCard: React.FC<{ strengths: AIStrength[], developmentAreas: AIDevelopmentArea[] }> = ({ strengths, developmentAreas }) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6"><div className="flex items-center gap-3 mb-4"><CheckCircle className="w-6 h-6 text-green-400" /><h3 className="text-xl font-semibold text-white">Styrkor</h3></div><div className="space-y-4">{strengths.map((item, index) => (<div key={index} className="p-3 bg-slate-800/50 rounded-lg"><p className="font-semibold text-green-300">{item.area}</p><p className="text-sm text-slate-300 mt-1">{item.description}</p><p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">Bevis: {item.evidence}</p></div>))}</div></Card>
        <Card className="p-6"><div className="flex items-center gap-3 mb-4"><Zap className="w-6 h-6 text-yellow-400" /><h3 className="text-xl font-semibold text-white">Utvecklingsområden</h3></div><div className="space-y-4">{developmentAreas.map((item, index) => (<div key={index} className="p-3 bg-slate-800/50 rounded-lg"><p className="font-semibold text-yellow-300">{item.area}</p><p className="text-sm text-slate-300 mt-1">{item.description}</p><p className="text-xs text-slate-400 mt-2 border-t border-slate-700 pt-2">Potential: {item.potential_impact}</p></div>))}</div></Card>
    </div>
);

const RevenueDeepDiveCard: React.FC<{ deepDive: AIRevenueDeepDive }> = ({ deepDive }) => {
    const icons = { Privat: <Home className="w-5 h-5 text-cyan-400" />, Företag: <Briefcase className="w-5 h-5 text-blue-400" />, Avtal: <FileText className="w-5 h-5 text-indigo-400" /> };
    return (
        <Card className="p-6"><div className="flex items-center gap-3 mb-4"><DollarSign className="w-6 h-6 text-green-400" /><h3 className="text-xl font-semibold text-white">Intäktsanalys</h3></div><div className="space-y-3 mb-4">{deepDive.breakdown.map((item) => (<div key={item.source} className="p-4 rounded-lg bg-slate-800/50 flex items-center gap-4"><div className="flex-shrink-0">{icons[item.source]}</div><div className="flex-1"><p className="font-semibold text-slate-200">{item.source}</p><p className="text-xs text-slate-400">{item.case_count} ärenden</p></div><div className="text-right"><p className="font-bold text-lg text-white">{formatCurrency(item.revenue)}</p><p className="text-xs text-slate-400">{formatCurrency(item.avg_value)} / ärende</p></div></div>))}</div><div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20"><p className="text-sm font-semibold text-green-300 mb-1">AI-Insikt:</p><p className="text-sm text-slate-300">{deepDive.profitability_analysis}</p></div>
        </Card>
    );
};

const MentorshipProfileCard: React.FC<{ profile: AIMentorshipProfile }> = ({ profile }) => (
    <Card className="p-6"><div className="flex items-center gap-3 mb-4"><Users className="w-6 h-6 text-teal-400" /><h3 className="text-xl font-semibold text-white">Mentorskapsprofil</h3></div><div className="text-center p-4 rounded-lg bg-teal-500/10 mb-6"><p className="text-lg font-bold text-teal-300">{profile.profile}</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{profile.should_mentor && (<div><h4 className="font-semibold text-white flex items-center gap-2 mb-2"><Award className="w-5 h-5 text-yellow-400" /> Kan Lära Ut:</h4><ul className="list-disc list-inside text-slate-300 space-y-1 text-sm">{profile.mentoring_areas.map((area) => <li key={area}>{area}</li>)}</ul></div>)}{profile.needs_mentoring && (<div><h4 className="font-semibold text-white flex items-center gap-2 mb-2"><BookOpen className="w-5 h-5 text-blue-400" /> Behöver Lära Sig:</h4><ul className="list-disc list-inside text-slate-300 space-y-1 text-sm">{profile.learning_focus.map((focus) => <li key={focus}>{focus}</li>)}</ul></div>)}</div>
    </Card>
);

const RiskAssessmentCard: React.FC<{ assessment: AIRiskAssessment }> = ({ assessment }) => (
    <Card className="p-6"><div className="flex items-center gap-3 mb-4"><AlertTriangle className="w-6 h-6 text-red-400" /><h3 className="text-xl font-semibold text-white">Riskbedömning</h3></div><div className="space-y-3">{assessment.key_risks.map((risk, index) => (<div key={index} className="p-3 bg-red-500/10 rounded-lg"><p className="font-semibold text-red-300">Risk: {risk.risk}</p><div className="flex items-start gap-2 text-sm text-slate-300 mt-2 pt-2 border-t border-red-500/20"><ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{risk.mitigation_strategy}</span></div></div>))}</div>
    </Card>
);

const SpecializationCard: React.FC<{ analysis: AISpecializationAnalysis }> = ({ analysis }) => (
    <Card className="p-6 h-full"><div className="flex items-center gap-3 mb-3"><Droplet className="w-5 h-5 text-rose-400" /><h4 className="text-lg font-semibold text-white">Huvudspecialisering</h4></div><p className="text-2xl font-bold text-rose-300">{analysis.primary_specialization}</p><p className="text-sm text-slate-400 mt-2">{analysis.recommendation}</p></Card>
);

const HistoricalTrendsCard: React.FC<{ trends: AIHistoricalTrends }> = ({ trends }) => (
    <Card className="p-6 h-full"><div className="flex items-center gap-3 mb-3"><Clock className="w-5 h-5 text-lime-400" /><h4 className="text-lg font-semibold text-white">Historisk Trend</h4></div><p className="text-2xl font-bold capitalize text-lime-300">{trends.six_month_revenue_trend}</p><p className="text-sm text-slate-400 mt-2">{trends.trend_analysis}</p></Card>
);

//#endregion --- Analysis UI Cards ---

// =================================================================================
// SECTION 2: HUVUDKOMPONENT
// =================================================================================

interface IndividualTechnicianAnalysisProps {
  selectedTechnicianName: string | null;
  setSelectedTechnicianName: (name: string | null) => void;
}

const IndividualTechnicianAnalysis: React.FC<IndividualTechnicianAnalysisProps> = ({ selectedTechnicianName, setSelectedTechnicianName }) => {
  const { performance: allTechnicians, monthlyData, pestSpecialization, loading: dashboardLoading } = useCompleteTechnicianDashboard();
  
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const technician = allTechnicians?.find((t: TechnicianPerformance) => t.name === selectedTechnicianName);

  useEffect(() => {
    setAiAnalysis(null);
    setAiError(null);
  }, [selectedTechnicianName]);

  const generateAIAnalysis = async () => {
    if (!technician || !allTechnicians) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    const request: AIAnalysisRequest = { technician, allTechnicians, monthlyData, pestSpecialization };
    try {
      const analysisResult = await aiAnalysisService.generateTechnicianAnalysis(request);
      setAiAnalysis(analysisResult);
    } catch (error: any) {
      setAiError(error.message || 'Ett okänt fel uppstod.');
    } finally {
      setAiLoading(false);
    }
  };

  if (dashboardLoading) {
    return <Card className="p-6 h-96 flex items-center justify-center"><RefreshCw className="w-8 h-8 text-orange-500 animate-spin" /></Card>;
  }
  
  if (!selectedTechnicianName || !technician) {
    const safeAllTechnicians = Array.isArray(allTechnicians) ? allTechnicians : []
    return (
      <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
         <div className="flex items-center gap-3 mb-6"><div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center"><Brain className="w-6 h-6 text-white" /></div><div><h2 className="text-xl font-semibold text-white flex items-center gap-2">AI-Driven Teknikeranalys<Sparkles className="w-5 h-5 text-yellow-400" /></h2><p className="text-sm text-slate-400">Välj en tekniker för en djupgående analys med personliga rekommendationer.</p></div></div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safeAllTechnicians.map((tech: TechnicianPerformance) => (
              <button key={tech.name} onClick={() => setSelectedTechnicianName(tech.name)} className="group text-left p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-orange-500/50 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10"><div className="font-medium text-white group-hover:text-orange-300 transition-colors">{tech.name}</div><div className="text-xs text-slate-400 mt-1">{tech.role}</div><div className="text-xs text-green-400 mt-2">{formatCurrency(tech.total_revenue)}</div></button>
            ))}
          </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4"><User className="w-10 h-10 text-orange-400 flex-shrink-0" /><div><h2 className="text-2xl font-bold text-white">{technician.name}</h2><p className="text-slate-400">{technician.role} • Ranking #{technician.rank} av {allTechnicians?.length}</p></div></div>
          <div className="flex items-center gap-3"><Button variant="secondary" size="sm" onClick={() => setSelectedTechnicianName(null)}>Byt Tekniker</Button><Button onClick={generateAIAnalysis} disabled={aiLoading} className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 shadow-lg shadow-purple-600/20">{aiLoading ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyserar...</> : <><Sparkles className="w-4 h-4 mr-2" /> {aiAnalysis ? 'Kör Igen' : 'Starta AI-Analys'}</>}</Button></div>
        </div>
      </Card>
      
      {aiError && <Card className="p-4 bg-red-500/10 border border-red-500/30"><div className="flex items-center gap-3 text-red-400"><AlertCircle className="w-5 h-5" /><p className="font-semibold">{aiError}</p></div></Card>}

      {aiAnalysis ? (
        <div className="space-y-6 animate-fade-in">
          <ExecutiveSummaryCard summary={aiAnalysis.executiveSummary} />
          <PerformanceDashboardCard dashboard={aiAnalysis.performanceDashboard} />
          <ActionableDevelopmentPlanCard plan={aiAnalysis.actionableDevelopmentPlan} />
          <StrengthsAndDevelopmentCard strengths={aiAnalysis.strengths} developmentAreas={aiAnalysis.developmentAreas} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueDeepDiveCard deepDive={aiAnalysis.revenueDeepDive} />
            <div className="space-y-6"><MentorshipProfileCard profile={aiAnalysis.mentorshipProfile} /><RiskAssessmentCard assessment={aiAnalysis.riskAssessment} /></div>
          </div>
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SpecializationCard analysis={aiAnalysis.specializationAnalysis} />
                <HistoricalTrendsCard trends={aiAnalysis.historicalTrends} />
           </div>
        </div>
      ) : (
        !aiLoading && (
            <Card className="p-8 text-center bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-purple-500/20">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4"><Brain className="w-8 h-8 text-white" /></div>
              <h3 className="text-xl font-semibold text-white mb-2">Redo för en djupgående analys?</h3>
              <p className="text-slate-400 mb-6 max-w-md mx-auto">Låt vår AI analysera {technician.name}s prestanda för att skapa en personlig utvecklingsplan.</p>
              <Button onClick={generateAIAnalysis} disabled={aiLoading} className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3"><Sparkles className="w-5 h-5 mr-2" />Generera AI-Analys</Button>
            </Card>
        )
      )}
    </div>
  );
};

export default IndividualTechnicianAnalysis;