// src/components/admin/technicians/IndividualTechnicianAnalysis.tsx
// UPPDATERAD: 2025-07-15 - Fullständig integration av den nya, djupgående AI-analystjänsten.

import React, { useState, useEffect } from 'react';
import { 
  User, Brain, Sparkles, RefreshCw, AlertCircle, 
  Bot, TrendingUp, Users, Target
} from 'lucide-react';
import Card from '../../ui/Card';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../utils/formatters';

// --- NYA IMPORTS FÖR AI-ANALYS ---
// Importerar den nya servicen och de nya, detaljerade datatyperna.
import { aiAnalysisService } from '../../../services/aiAnalysisService';
import type { AIAnalysis, AIAnalysisRequest } from '../../../services/aiAnalysisService';

// --- BEFINTLIGA IMPORTS ---
import { useCompleteTechnicianDashboard } from '../../../hooks/useTechnicianDashboard';
import type { TechnicianPerformance } from '../../../services/technicianAnalyticsService';


// =================================================================================
// PLATSHÅLLARE FÖR FRAMTIDA UI-KOMPONENTER
// När du bygger ut UI:t, skapar du en separat fil för varje kort
// och importerar dem här. Detta är en mall att utgå ifrån.
// =================================================================================

const ExecutiveSummaryCard = ({ analysis }: { analysis: AIAnalysis }) => (
  <Card className="p-6 bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 animate-fade-in">
    <h3 className="text-xl font-bold text-orange-400 mb-2">{analysis.executiveSummary.headline}</h3>
    <p className="text-slate-300 leading-relaxed">{analysis.executiveSummary.summary}</p>
  </Card>
);

const ActionableDevelopmentPlanCard = ({ analysis }: { analysis: AIAnalysis }) => {
    const getPriorityClass = (priority: 'Hög' | 'Medium' | 'Låg') => {
        switch (priority) {
            case 'Hög': return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'Medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'Låg': return 'bg-green-500/20 text-green-300 border-green-500/30';
        }
    };
    return (
        <Card className="p-6 bg-slate-800/50 border-slate-700 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center gap-3 mb-4">
                <Target className="w-6 h-6 text-purple-400" />
                <h3 className="text-xl font-semibold text-white">Handlingsplan - Nästa 30 Dagar</h3>
            </div>
            <div className="p-4 rounded-lg bg-purple-500/10 mb-6 border border-purple-500/20">
                <p className="text-sm font-semibold text-purple-300 mb-1">Huvudfokus:</p>
                <p className="text-white font-medium">{analysis.actionableDevelopmentPlan.primary_focus_30_days}</p>
            </div>
            <div className="space-y-4">
                {analysis.actionableDevelopmentPlan.actions.map((action, index) => (
                    <div key={index} className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                        <div className="flex justify-between items-start mb-2 gap-4">
                            <p className="font-semibold text-slate-200 flex-1 pr-4">{action.action}</p>
                            <span className={`text-xs font-bold px-2 py-1 rounded-full border whitespace-nowrap ${getPriorityClass(action.priority)}`}>
                                {action.priority} Prioritet
                            </span>
                        </div>
                        <div className="text-sm text-slate-400 space-y-2 mt-3 border-t border-slate-600 pt-3">
                            <p><span className="font-semibold text-slate-300">Förväntat resultat:</span> {action.expected_outcome}</p>
                            <p><span className="font-semibold text-slate-300">Hur vi mäter:</span> {action.how_to_measure}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};


// Huvudkomponenten
interface IndividualTechnicianAnalysisProps {
  selectedTechnicianName: string | null; // Uppdaterad för att kunna av-välja
  setSelectedTechnicianName: (name: string | null) => void;
}

const IndividualTechnicianAnalysis: React.FC<IndividualTechnicianAnalysisProps> = ({
  selectedTechnicianName,
  setSelectedTechnicianName
}) => {
  const { performance: allTechnicians, monthlyData, pestSpecialization, loading: dashboardLoading } = useCompleteTechnicianDashboard();
  
  // State-hantering med den nya, korrekta typen
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const technician = allTechnicians?.find((t: TechnicianPerformance) => t.name === selectedTechnicianName);

  // Återställ analysen när en ny tekniker väljs
  useEffect(() => {
    setAiAnalysis(null);
    setAiError(null);
  }, [selectedTechnicianName]);

  // Funktion för att starta AI-analysen - nu med den nya servicen
  const generateAIAnalysis = async () => {
    if (!technician || !allTechnicians) return;

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);

    const request: AIAnalysisRequest = {
      technician,
      allTechnicians,
      monthlyData: monthlyData?.filter(m => m.technician_name === selectedTechnicianName) || [],
      pestSpecialization: pestSpecialization?.filter(p => p.technician_name === selectedTechnicianName) || [],
    };

    try {
      // Använder den nya, centraliserade servicen
      const analysisResult = await aiAnalysisService.generateTechnicianAnalysis(request);
      setAiAnalysis(analysisResult);
    } catch (error: any) {
      // Servicen hanterar fallback, men vi fångar eventuella kritiska fel
      setAiError(error.message || 'Ett okänt fel uppstod.');
    } finally {
      setAiLoading(false);
    }
  };

  // --- RENDERINGS-LOGIK ---

  if (dashboardLoading) {
    return (
      <Card className="p-6 h-96 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
      </Card>
    );
  }

  // VY 1: Om ingen tekniker är vald (BEVARAD FRÅN ORIGINALET)
  if (!selectedTechnicianName || !technician) {
    const safeAllTechnicians = Array.isArray(allTechnicians) ? allTechnicians : []
    return (
      <div className="space-y-6">
        <Card className="p-6 bg-gradient-to-br from-orange-600/10 to-red-600/10 border-orange-500/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                AI-Driven Teknikeranalys
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </h2>
              <p className="text-sm text-slate-400">
                Välj en tekniker för en djupgående analys med personliga rekommendationer.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {safeAllTechnicians.map((tech: TechnicianPerformance) => (
              <button key={tech.name} onClick={() => setSelectedTechnicianName(tech.name)} className="group text-left p-4 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-orange-500/50 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-orange-500/10">
                <div className="font-medium text-white group-hover:text-orange-300 transition-colors">{tech.name}</div>
                <div className="text-xs text-slate-400 mt-1">{tech.role}</div>
                <div className="text-xs text-green-400 mt-2">{formatCurrency(tech.total_revenue)}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  // VY 2: Huvudvyn för en vald tekniker
  return (
    <div className="space-y-6">
      {/* Header-kort (BEVARAD FRÅN ORIGINALET, med små justeringar) */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <User className="w-10 h-10 text-orange-400 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-bold text-white">{technician.name}</h2>
              <p className="text-slate-400">{technician.role} • Ranking #{technician.rank} av {allTechnicians?.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setSelectedTechnicianName(null)}>
              Byt Tekniker
            </Button>
            <Button
              onClick={generateAIAnalysis}
              disabled={aiLoading}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 shadow-lg shadow-purple-600/20"
            >
              {aiLoading ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Analyserar...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> {aiAnalysis ? 'Kör Analys Igen' : 'Starta AI-Analys'}</>
              )}
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Felmeddelande-hantering */}
      {aiError && (
        <Card className="p-4 bg-red-500/10 border border-red-500/30">
          <div className="flex items-center gap-3 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <div>
                <p className="font-semibold">Ett fel uppstod</p>
                <p className="text-sm">{aiError}</p>
            </div>
          </div>
        </Card>
      )}

      {/* VY 3: Resultatet av AI-analysen (HELT NYTT) */}
      {aiAnalysis ? (
        <div className="space-y-6">
          <ExecutiveSummaryCard analysis={aiAnalysis} />
          <ActionableDevelopmentPlanCard analysis={aiAnalysis} />
          {/* 
            NÄSTA STEG:
            Bygg ut fler komponenter (t.ex. PerformanceDashboardCard, RiskAssessmentCard)
            och lägg in dem här. Använd ActionableDevelopmentPlanCard som mall.
          */}

          {/* Temporärt kort för felsökning - kan tas bort i produktion */}
          <Card className="p-4 bg-slate-900">
            <h3 className="text-white mb-2 font-mono text-sm">[DEV] Fullständig AI Respons</h3>
            <pre className="text-xs text-slate-400 bg-black p-4 rounded-md overflow-x-auto">
              {JSON.stringify(aiAnalysis, null, 2)}
            </pre>
          </Card>
        </div>
      ) : (
        !aiLoading && (
            <Card className="p-8 text-center bg-gradient-to-br from-purple-600/10 to-blue-600/10 border-purple-500/20">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                    Redo för en djupgående analys?
                </h3>
                <p className="text-slate-400 mb-6 max-w-md mx-auto">
                    Låt vår AI analysera {technician.name}s prestanda, trender och potential för att skapa en personlig utvecklingsplan.
                </p>
                <Button
                    onClick={generateAIAnalysis}
                    disabled={aiLoading}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 py-3"
                >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Generera AI-Analys nu
                </Button>
            </Card>
        )
      )}
    </div>
  );
};

export default IndividualTechnicianAnalysis;