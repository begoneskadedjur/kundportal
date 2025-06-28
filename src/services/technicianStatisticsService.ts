// src/services/technicianStatisticsService.ts
import { supabase } from '../lib/supabase'

export interface TechnicianStats {
  activeTechnicians: number
  activeCases: number
  capacityUtilization: number
  averageResolutionTime: number
  overdueCases: number
  technicianWorkload: TechnicianWorkload[]
}

export interface TechnicianWorkload {
  technician_id: string
  technician_name: string
  active_cases: number
  completed_this_month: number
}


class TechnicianStatisticsService {
  
  async getTechnicianStats(periodInDays: number = 30): Promise<TechnicianStats> {
    const [techniciansRes, casesRes] = await Promise.all([
      supabase.from('technicians').select('id, name, is_active'),
      supabase.from('cases').select('id, status, created_at, completed_date, scheduled_date, assigned_technician_id')
    ]);

    if (techniciansRes.error) throw techniciansRes.error;
    if (casesRes.error) throw casesRes.error;

    const technicians = techniciansRes.data || [];
    const cases = casesRes.data || [];
    const activeTechnicians = technicians.filter(t => t.is_active);
    const activeCasesList = cases.filter(c => c.status === 'in_progress' || c.status === 'pending');

    const optimalCasesPerTechnician = 8;
    const totalOptimalCapacity = activeTechnicians.length * optimalCasesPerTechnician;
    const capacityUtilization = totalOptimalCapacity > 0 ? Math.min(100, (activeCasesList.length / totalOptimalCapacity) * 100) : 0;

    return {
      activeTechnicians: activeTechnicians.length,
      activeCases: activeCasesList.length,
      capacityUtilization,
      averageResolutionTime: this.calculateAverageResolutionTime(cases),
      overdueCases: this.calculateOverdueCases(cases),
      technicianWorkload: this.calculateTechnicianWorkload(activeTechnicians, cases)
    }
  }

  private calculateAverageResolutionTime(cases: any[]): number {
    const completedCases = cases.filter(c => c.status === 'completed' && c.created_at && c.completed_date);
    if (completedCases.length === 0) return 0;
    
    const totalTime = completedCases.reduce((sum, c) => {
      const daysDiff = (new Date(c.completed_date).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24);
      return sum + daysDiff;
    }, 0);
    
    return totalTime / completedCases.length;
  }

  private calculateOverdueCases(cases: any[]): number {
    const now = new Date();
    return cases.filter(c => 
      c.scheduled_date && 
      new Date(c.scheduled_date) < now && 
      (c.status === 'pending' || c.status === 'in_progress')
    ).length;
  }

  private calculateTechnicianWorkload(activeTechnicians: any[], cases: any[]): TechnicianWorkload[] {
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);

    return activeTechnicians.map(technician => {
      const technicianCases = cases.filter(c => c.assigned_technician_id === technician.id);
      return {
        technician_id: technician.id,
        technician_name: technician.name,
        active_cases: technicianCases.filter(c => c.status === 'in_progress' || c.status === 'pending').length,
        completed_this_month: technicianCases.filter(c => c.completed_date && new Date(c.completed_date) >= thisMonthStart).length
      }
    }).sort((a, b) => b.active_cases - a.active_cases);
  }
}

export const technicianStatisticsService = new TechnicianStatisticsService();