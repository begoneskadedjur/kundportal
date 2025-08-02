// src/components/coordinator/AIAnalysisSection.tsx
import React, { useState } from 'react';
import { 
  Brain, 
  TrendingUp, 
  Users, 
  MapPin, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  RefreshCw,
  Target,
  Activity,
  Zap,
  Clock,
  BarChart3,
  FileText,
  FileSpreadsheet
} from 'lucide-react';
import Button from '../ui/Button';
import { AICoordinatorAnalysis } from '../../services/coordinatorAIAnalysisService';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface AIAnalysisSectionProps {
  analysis: AICoordinatorAnalysis | null;
  loading: boolean;
  onRefresh: () => void;
  dateRange: { startDate: Date; endDate: Date };
}

export default function AIAnalysisSection({ analysis, loading, onRefresh, dateRange }: AIAnalysisSectionProps) {
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-green-400';
      case 'B':
        return 'text-teal-400';
      case 'C':
        return 'text-yellow-400';
      case 'D':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getTrendIcon = (trend: 'positive' | 'negative' | 'neutral') => {
    switch (trend) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'negative':
        return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
      default:
        return <Activity className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Hög':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Låg':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const exportToPDF = async () => {
    if (!analysis) return;
    
    setExportingPDF(true);
    try {
      const pdf = new jsPDF();
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      let yPosition = 20;
      
      // Professional header with brand colors
      pdf.setFillColor(10, 19, 40); // Brand primary: #0a1328
      pdf.rect(0, 0, pageWidth, 45, 'F');
      
      // Brand accent line
      pdf.setFillColor(32, 197, 143); // Brand accent: #20c58f
      pdf.rect(0, 45, pageWidth, 2, 'F');
      
      pdf.setFontSize(26);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.text('AI-Driven Koordinatoranalys', 20, 28);
      
      // Professional subtitle
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(226, 232, 240); // Slate-200
      pdf.text('Prestationsanalys & Handlingsplan', 20, 38);
      
      // Company branding (right-aligned)
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(32, 197, 143); // Accent color
      pdf.text('BeGone', pageWidth - 45, 28);
      pdf.setFontSize(10);
      pdf.setTextColor(148, 163, 184); // Slate-400
      pdf.text('Skadedjärskontroll', pageWidth - 45, 36);
      
      yPosition = 55;
      
      // Executive summary box with professional styling
      pdf.setFillColor(248, 250, 252); // Slate-50
      pdf.setDrawColor(203, 213, 225); // Slate-300 border
      pdf.setLineWidth(0.5);
      pdf.rect(15, yPosition - 5, pageWidth - 30, 35, 'FD');
      
      // Document metadata header
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59); // Slate-800
      pdf.setFont('helvetica', 'bold');
      pdf.text('ANALYSRAPPORT', 20, yPosition + 2);
      
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(71, 85, 105); // Slate-600
      pdf.text(`Analysperiod: ${dateRange.startDate.toLocaleDateString('sv-SE')} - ${dateRange.endDate.toLocaleDateString('sv-SE')}`, 20, yPosition + 8);
      pdf.text(`Genererad: ${new Date(analysis.metadata.generated_at).toLocaleString('sv-SE')}`, 20, yPosition + 14);
      pdf.text(`Datacompleteness: ${analysis.metadata.data_completeness}%`, 20, yPosition + 20);
      pdf.text(`Konfidensnivå: ${analysis.metadata.confidence_level}`, pageWidth - 80, yPosition + 14);
      
      // Professional classification with enhanced styling
      pdf.setFillColor(32, 197, 143, 0.1); // Light accent background
      pdf.setDrawColor(32, 197, 143); // Accent border
      pdf.setLineWidth(0.5);
      pdf.rect(pageWidth - 95, yPosition + 3, 75, 10, 'FD');
      pdf.setTextColor(32, 197, 143); // Accent color
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('KONFIDENTIELL', pageWidth - 87, yPosition + 9);
      
      yPosition += 38;
      
      // Summary section with style
      pdf.setDrawColor(147, 51, 234); // Purple-600
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(18);
      pdf.setTextColor(30, 41, 59); // Slate-800
      pdf.setFont('helvetica', 'bold');
      pdf.text(analysis.summary.headline, 20, yPosition);
      yPosition += 10;
      
      pdf.setFont('helvetica', 'normal');
      
      pdf.setFontSize(10);
      const summaryLines = pdf.splitTextToSize(analysis.summary.summary, 170);
      summaryLines.forEach((line: string) => {
        if (yPosition > pageHeight - 20) {
          pdf.addPage();
          yPosition = 20;
        }
        pdf.text(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 10;
      
      // Scheduling Analysis with grade highlight
      pdf.setFillColor(147, 51, 234, 0.1); // Purple background
      pdf.rect(15, yPosition - 5, pageWidth - 30, 30, 'F');
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 41, 59);
      pdf.text('Schemaläggningsanalys', 20, yPosition);
      
      // Grade with color
      const gradeColors: Record<string, [number, number, number]> = {
        'A+': [34, 197, 94], // Green
        'A': [34, 197, 94],
        'B': [20, 184, 166], // Teal
        'C': [234, 179, 8], // Yellow
        'D': [239, 68, 68] // Red
      };
      const gradeColor = gradeColors[analysis.schedulingAnalysis.overall_efficiency_grade] || [100, 100, 100];
      pdf.setTextColor(...gradeColor);
      pdf.setFontSize(20);
      pdf.text(analysis.schedulingAnalysis.overall_efficiency_grade, pageWidth - 40, yPosition + 2);
      
      yPosition += 15;
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(10);
      
      analysis.schedulingAnalysis.key_insights.forEach(insight => {
        if (yPosition > pageHeight - 30) {
          pdf.addPage();
          yPosition = 20;
        }
        // Insight box
        pdf.setFillColor(248, 250, 252);
        pdf.rect(20, yPosition - 3, pageWidth - 40, 20, 'F');
        
        // Trend indicator
        if (insight.trend === 'positive') {
          pdf.setTextColor(34, 197, 94);
          pdf.text('↑', 25, yPosition);
        } else if (insight.trend === 'negative') {
          pdf.setTextColor(239, 68, 68);
          pdf.text('↓', 25, yPosition);
        }
        
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${insight.metric}:`, 35, yPosition);
        pdf.setFont('helvetica', 'normal');
        pdf.text(insight.value, 90, yPosition);
        yPosition += 5;
        
        pdf.setTextColor(71, 85, 105);
        const insightLines = pdf.splitTextToSize(insight.insight, 150);
        insightLines.forEach((line: string) => {
          pdf.text(line, 35, yPosition);
          yPosition += 4;
        });
        yPosition += 5;
      });
      yPosition += 10;
      
      // Action Plan with styled header
      pdf.setDrawColor(147, 51, 234);
      pdf.setLineWidth(0.5);
      pdf.line(15, yPosition, pageWidth - 15, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Handlingsplan', 20, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(12);
      pdf.setTextColor(147, 51, 234);
      pdf.text('Omedelbara åtgärder:', 20, yPosition);
      yPosition += 8;
      pdf.setTextColor(30, 41, 59);
      
      pdf.setFontSize(10);
      analysis.actionPlan.immediate_actions.forEach(action => {
        if (yPosition > pageHeight - 40) {
          pdf.addPage();
          yPosition = 20;
        }
        // Enhanced priority color system with print-friendly variants
        const priorityConfig: Record<string, { 
          color: [number, number, number]; 
          textColor: [number, number, number];
          symbol: string;
        }> = {
          'Hög': { 
            color: [239, 68, 68], 
            textColor: [255, 255, 255],
            symbol: '●'
          },
          'Medium': { 
            color: [234, 179, 8], 
            textColor: [0, 0, 0],
            symbol: '◐'
          },
          'Låg': { 
            color: [59, 130, 246], 
            textColor: [255, 255, 255],
            symbol: '○'
          }
        };
        const config = priorityConfig[action.priority] || { 
          color: [100, 100, 100], 
          textColor: [255, 255, 255],
          symbol: '◇'
        };
        
        // Professional action box with subtle shadow effect
        pdf.setFillColor(248, 250, 252);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.rect(20, yPosition - 3, pageWidth - 40, 28, 'FD');
        
        // Priority indicator with symbol
        pdf.setTextColor(...config.color);
        pdf.setFontSize(10);
        pdf.text(config.symbol, 25, yPosition - 1);
        
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 41, 59);
        pdf.text(action.area, 32, yPosition);
        
        // Enhanced priority badge with rounded corners simulation
        pdf.setFillColor(...config.color);
        pdf.rect(pageWidth - 65, yPosition - 4, 40, 8, 'F');
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...config.textColor);
        pdf.text(action.priority.toUpperCase(), pageWidth - 55, yPosition);
        
        yPosition += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(71, 85, 105);
        pdf.text(`Åtgärd: ${action.recommended_action}`, 25, yPosition);
        yPosition += 5;
        pdf.setTextColor(34, 197, 94);
        pdf.text(`Förväntat: ${action.expected_impact}`, 25, yPosition);
        yPosition += 10;
        pdf.setTextColor(30, 41, 59);
      });
      
      // Add professional footer to all pages
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        
        // Footer line
        pdf.setDrawColor(203, 213, 225);
        pdf.setLineWidth(0.3);
        pdf.line(15, pageHeight - 25, pageWidth - 15, pageHeight - 25);
        
        // Footer content
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139); // Slate-500
        pdf.setFont('helvetica', 'normal');
        pdf.text('BeGone Skadedjärskontroll - Konfidentiell analysrapport', 20, pageHeight - 18);
        pdf.text(`Sida ${i} av ${pageCount}`, pageWidth - 35, pageHeight - 18);
        
        // Generation timestamp
        pdf.text(`Genererad: ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`, 20, pageHeight - 12);
      }
      
      // Save PDF with descriptive filename
      const fileName = `BeGone-Koordinatoranalys-${dateRange.startDate.toISOString().split('T')[0]}-${dateRange.endDate.toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      toast.success('PDF exporterad!');
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Kunde inte exportera PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  const exportToExcel = async () => {
    if (!analysis) return;
    
    setExportingExcel(true);
    try {
      const wb = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Koordinator AI-Analys'],
        [''],
        ['Period', `${dateRange.startDate.toLocaleDateString('sv-SE')} - ${dateRange.endDate.toLocaleDateString('sv-SE')}`],
        ['Genererad', new Date(analysis.metadata.generated_at).toLocaleString('sv-SE')],
        [''],
        ['Sammanfattning'],
        ['Rubrik', analysis.summary.headline],
        ['Beskrivning', analysis.summary.summary],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Sammanfattning');
      
      // Scheduling insights sheet with more detail
      const schedulingData = [
        ['Schemaläggningsanalys'],
        ['Betyg', analysis.schedulingAnalysis.overall_efficiency_grade],
        ['Analysperiod', `${dateRange.startDate.toLocaleDateString('sv-SE')} - ${dateRange.endDate.toLocaleDateString('sv-SE')}`],
        ['Datacompleteness', `${analysis.metadata.data_completeness}%`],
        [''],
        ['Nyckelinsikter'],
        ['Metrik', 'Värde', 'Trend', 'Insikt', 'Påverkan'],
        ...analysis.schedulingAnalysis.key_insights.map(insight => [
          insight.metric,
          insight.value,
          insight.trend === 'positive' ? '↑ Positiv' : insight.trend === 'negative' ? '↓ Negativ' : '- Neutral',
          insight.insight,
          insight.trend === 'positive' ? 'Förbättrar effektiviteten' : 'Kräver åtgärd'
        ])
      ];
      const schedulingSheet = XLSX.utils.aoa_to_sheet(schedulingData);
      XLSX.utils.book_append_sheet(wb, schedulingSheet, 'Schemaläggning');
      
      // Utilization Analysis sheet
      if (analysis.utilizationAnalysis.insights.length > 0) {
        const utilizationData = [
          ['Tekniker-utnyttjande'],
          ['Teambalans', analysis.utilizationAnalysis.team_balance_score],
          [''],
          ['Tekniker', 'Utnyttjandegrad %', 'Status', 'Rekommendation'],
          ...analysis.utilizationAnalysis.insights.map(tech => [
            tech.technician_name,
            tech.utilization_percent.toFixed(1),
            tech.status === 'optimal' ? 'Optimal' : tech.status === 'underutilized' ? 'Underutnyttjad' : 'Överutnyttjad',
            tech.recommendation
          ]),
          [''],
          ['Övergripande rekommendation', analysis.utilizationAnalysis.overall_recommendation]
        ];
        const utilizationSheet = XLSX.utils.aoa_to_sheet(utilizationData);
        XLSX.utils.book_append_sheet(wb, utilizationSheet, 'Tekniker-utnyttjande');
      }
      
      // Business Impact sheet
      const businessData = [
        ['Affärspåverkan'],
        [''],
        ['Analys', analysis.businessImpact.revenue_impact_analysis],
        [''],
        ['Nyckelmöjligheter'],
        ['Metrik', 'Nuvarande värde', 'Potentiellt värde', 'Förbättringsmöjlighet'],
        ...analysis.businessImpact.key_opportunities.map(opp => [
          opp.metric,
          opp.current_value,
          opp.potential_value,
          opp.improvement_opportunity
        ])
      ];
      const businessSheet = XLSX.utils.aoa_to_sheet(businessData);
      XLSX.utils.book_append_sheet(wb, businessSheet, 'Affärspåverkan');
      
      // Geographic Optimization sheet
      const geoData = [
        ['Geografisk optimering'],
        ['Rutteffektivitet', analysis.geographicOptimization.overall_routing_efficiency],
        ['Kostnadsbesparing', analysis.geographicOptimization.cost_saving_potential],
        [''],
        ['Område', 'Effektivitetspoäng', 'Restidspåverkan', 'Optimeringspotential'],
        ...analysis.geographicOptimization.insights.map(geo => [
          geo.area,
          geo.efficiency_score,
          geo.travel_time_impact,
          geo.optimization_potential
        ])
      ];
      const geoSheet = XLSX.utils.aoa_to_sheet(geoData);
      XLSX.utils.book_append_sheet(wb, geoSheet, 'Geografisk optimering');
      
      // Action plan sheet
      const actionData = [
        ['Handlingsplan'],
        [''],
        ['Omedelbara åtgärder'],
        ['Område', 'Nuvarande läge', 'Rekommenderad åtgärd', 'Förväntat resultat', 'Prioritet'],
        ...analysis.actionPlan.immediate_actions.map(action => [
          action.area,
          action.current_state,
          action.recommended_action,
          action.expected_impact,
          action.priority
        ]),
        [''],
        ['Långsiktiga förbättringar'],
        ['Område', 'Nuvarande läge', 'Rekommenderad åtgärd', 'Förväntat resultat', 'Prioritet'],
        ...analysis.actionPlan.long_term_improvements.map(action => [
          action.area,
          action.current_state,
          action.recommended_action,
          action.expected_impact,
          action.priority
        ]),
        [''],
        ['Framgångsmått'],
        ...analysis.actionPlan.success_metrics.map(metric => [metric])
      ];
      const actionSheet = XLSX.utils.aoa_to_sheet(actionData);
      XLSX.utils.book_append_sheet(wb, actionSheet, 'Handlingsplan');
      
      // Save Excel
      XLSX.writeFile(wb, `koordinator-analys-${dateRange.startDate.toISOString().split('T')[0]}-${dateRange.endDate.toISOString().split('T')[0]}.xlsx`);
      toast.success('Excel exporterad!');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Kunde inte exportera Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) {
    return (
      <section aria-labelledby="ai-analysis-heading">
        <h2 id="ai-analysis-heading" className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          AI-driven Analys
        </h2>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="animate-pulse">
              <Brain className="w-12 h-12 text-purple-400" />
            </div>
            <p className="text-slate-400">AI analyserar data...</p>
          </div>
        </div>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section aria-labelledby="ai-analysis-heading">
        <h2 id="ai-analysis-heading" className="text-2xl font-semibold text-white mb-6 flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          AI-driven Analys
        </h2>
        <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-8">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Brain className="w-12 h-12 text-slate-600" />
            <p className="text-slate-400 text-center">
              Klicka på knappen nedan för att generera en AI-driven analys av din koordinatordata
            </p>
            <Button variant="primary" onClick={onRefresh}>
              <Brain className="w-4 h-4 mr-2" />
              Generera AI-analys
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="ai-analysis-heading" className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 id="ai-analysis-heading" className="text-2xl font-semibold text-white flex items-center gap-3">
          <Brain className="w-6 h-6 text-purple-400" />
          AI-driven Analys
        </h2>
        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            onClick={exportToPDF}
            disabled={exportingPDF}
            aria-label="Exportera som PDF"
          >
            <FileText className="w-4 h-4 mr-2" />
            PDF
          </Button>
          <Button 
            variant="secondary" 
            onClick={exportToExcel}
            disabled={exportingExcel}
            aria-label="Exportera som Excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Excel
          </Button>
          <Button 
            variant="secondary" 
            onClick={onRefresh}
            aria-label="Uppdatera AI-analys"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30 p-6">
        <h3 className="text-xl font-semibold text-white mb-3">{analysis.summary.headline}</h3>
        <p className="text-slate-300">{analysis.summary.summary}</p>
        <p className="text-sm text-slate-400 mt-3">Period: {analysis.summary.period}</p>
      </div>

      {/* Scheduling Analysis */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-400" />
            Schemaläggningseffektivitet
          </h3>
          <span className={`text-2xl font-bold ${getGradeColor(analysis.schedulingAnalysis.overall_efficiency_grade)}`}>
            {analysis.schedulingAnalysis.overall_efficiency_grade}
          </span>
        </div>
        <div className="space-y-4">
          {analysis.schedulingAnalysis.key_insights.map((insight, index) => (
            <div key={index} className="bg-slate-900/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-slate-200">{insight.metric}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-white">{insight.value}</span>
                  {getTrendIcon(insight.trend)}
                </div>
              </div>
              <p className="text-sm text-slate-400">{insight.insight}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Utilization Analysis */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Tekniker-utnyttjande
        </h3>
        <div className="mb-4">
          <span className="text-sm text-slate-400">Teambalans: </span>
          <span className={`font-semibold ${
            analysis.utilizationAnalysis.team_balance_score === 'utmärkt' ? 'text-green-400' :
            analysis.utilizationAnalysis.team_balance_score === 'bra' ? 'text-teal-400' :
            analysis.utilizationAnalysis.team_balance_score === 'behöver förbättring' ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {analysis.utilizationAnalysis.team_balance_score}
          </span>
        </div>
        <p className="text-slate-300 mb-4">{analysis.utilizationAnalysis.overall_recommendation}</p>
        {analysis.utilizationAnalysis.insights.length > 0 && (
          <div className="space-y-3">
            {analysis.utilizationAnalysis.insights.slice(0, 3).map((insight, index) => (
              <div key={index} className="bg-slate-900/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200">{insight.technician_name}</span>
                  <span className={`text-sm px-2 py-1 rounded-full ${
                    insight.status === 'optimal' ? 'bg-green-500/20 text-green-400' :
                    insight.status === 'underutilized' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {insight.utilization_percent}%
                  </span>
                </div>
                <p className="text-xs text-slate-400">{insight.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Business Impact */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-400" />
          Affärspåverkan
        </h3>
        <p className="text-slate-300 mb-4">{analysis.businessImpact.revenue_impact_analysis}</p>
        {analysis.businessImpact.key_opportunities.length > 0 && (
          <div className="space-y-3">
            {analysis.businessImpact.key_opportunities.map((opp, index) => (
              <div key={index} className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="font-medium text-slate-200 mb-2">{opp.metric}</h4>
                <div className="grid grid-cols-2 gap-4 mb-2">
                  <div>
                    <span className="text-xs text-slate-400">Nuvarande:</span>
                    <p className="text-sm font-semibold text-white">{opp.current_value}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400">Potential:</span>
                    <p className="text-sm font-semibold text-teal-400">{opp.potential_value}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">{opp.improvement_opportunity}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Geographic Optimization */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-400" />
          Geografisk optimering
        </h3>
        <div className="mb-4">
          <span className="text-sm text-slate-400">Rutteffektivitet: </span>
          <span className={`font-semibold ${
            analysis.geographicOptimization.overall_routing_efficiency === 'optimal' ? 'text-green-400' :
            analysis.geographicOptimization.overall_routing_efficiency === 'god' ? 'text-teal-400' :
            analysis.geographicOptimization.overall_routing_efficiency === 'kan förbättras' ? 'text-yellow-400' :
            'text-red-400'
          }`}>
            {analysis.geographicOptimization.overall_routing_efficiency}
          </span>
        </div>
        <p className="text-sm text-slate-300 mb-4">
          Potentiell kostnadsbesparing: <span className="font-semibold text-green-400">{analysis.geographicOptimization.cost_saving_potential}</span>
        </p>
      </div>

      {/* Action Plan */}
      <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-400" />
          Handlingsplan
        </h3>
        
        {/* Immediate Actions */}
        <div className="mb-6">
          <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-400" />
            Omedelbara åtgärder
          </h4>
          <div className="space-y-3">
            {analysis.actionPlan.immediate_actions.map((action, index) => (
              <div key={index} className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <h5 className="font-medium text-white">{action.area}</h5>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(action.priority)}`}>
                    {action.priority}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-2">Nuläge: {action.current_state}</p>
                <p className="text-sm text-slate-300 mb-2">
                  <span className="text-teal-400">→</span> {action.recommended_action}
                </p>
                <p className="text-sm text-green-400">Förväntat resultat: {action.expected_impact}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Long-term Improvements */}
        {analysis.actionPlan.long_term_improvements.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Långsiktiga förbättringar
            </h4>
            <div className="space-y-3">
              {analysis.actionPlan.long_term_improvements.map((action, index) => (
                <div key={index} className="bg-slate-900/50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h5 className="font-medium text-white">{action.area}</h5>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(action.priority)}`}>
                      {action.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mb-2">Nuläge: {action.current_state}</p>
                  <p className="text-sm text-slate-300 mb-2">
                    <span className="text-teal-400">→</span> {action.recommended_action}
                  </p>
                  <p className="text-sm text-green-400">Förväntat resultat: {action.expected_impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Metrics */}
        <div>
          <h4 className="font-medium text-slate-200 mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            Framgångsmått
          </h4>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <ul className="space-y-2">
              {analysis.actionPlan.success_metrics.map((metric, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-slate-300">
                  <div className="w-1.5 h-1.5 bg-teal-400 rounded-full" />
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-xs text-slate-500 text-center">
        <p>
          AI-analys genererad {new Date(analysis.metadata.generated_at).toLocaleString('sv-SE')} | 
          Datacompleteness: {analysis.metadata.data_completeness}% | 
          Konfidensnivå: {analysis.metadata.confidence_level}
        </p>
      </div>
    </section>
  );
}