// src/services/technicianStatisticsService.ts - KORRIGERAD VERSION för BeGone
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
  utilization_percentage: number
}

class TechnicianStatisticsService {
  
  async getTechnicianStats(periodInDays: number = 30): Promise<TechnicianStats> {
    try {
      // Först, försök hämta från technicians-tabellen
      const { data: technicians, error: techniciansError } = await supabase
        .from('technicians')
        .select('id, name, is_active')

      if (techniciansError) {
        console.error('Error fetching technicians:', techniciansError)
        // Fallback: använd tekniker från cases-tabellen istället
        return this.getFallbackTechnicianStats(periodInDays)
      }

      // Hämta alla cases
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id, status, created_at, completed_date, scheduled_date, assigned_technician_id, assigned_technician_name')

      if (casesError) {
        console.error('Error fetching cases:', casesError)
        throw casesError
      }

      const allTechnicians = technicians || []
      const allCases = cases || []

      // Om technicians-tabellen är tom, använd fallback
      if (allTechnicians.length === 0) {
        console.log('Technicians table is empty, using fallback method')
        return this.getFallbackTechnicianStats(periodInDays)
      }

      const activeTechnicians = allTechnicians.filter(t => t.is_active)
      
      // Filtrera aktiva cases
      const activeCasesList = allCases.filter(c => 
        c.status === 'in_progress' || c.status === 'pending' || c.status === 'open'
      )

      // Beräkna kapacitetsutnyttjande
      const optimalCasesPerTechnician = 8
      const totalOptimalCapacity = activeTechnicians.length * optimalCasesPerTechnician
      const capacityUtilization = totalOptimalCapacity > 0 
        ? Math.min(100, (activeCasesList.length / totalOptimalCapacity) * 100) 
        : 0

      return {
        activeTechnicians: activeTechnicians.length,
        activeCases: activeCasesList.length,
        capacityUtilization,
        averageResolutionTime: this.calculateAverageResolutionTime(allCases),
        overdueCases: this.calculateOverdueCases(allCases),
        technicianWorkload: this.calculateTechnicianWorkload(activeTechnicians, allCases)
      }
    } catch (error) {
      console.error('Error in getTechnicianStats:', error)
      // Sista försök: använd fallback-metoden
      return this.getFallbackTechnicianStats(periodInDays)
    }
  }

  // Fallback-metod som använder tekniker från cases och customers
  private async getFallbackTechnicianStats(periodInDays: number): Promise<TechnicianStats> {
    try {
      console.log('Using fallback technician stats method')
      
      // Hämta alla cases för analys
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('id, status, created_at, completed_date, scheduled_date, assigned_technician_name, assigned_technician_email')

      if (casesError) throw casesError

      // Hämta alla kunder för att få kontraktsansvariga tekniker
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('assigned_account_manager')
        .eq('is_active', true)

      if (customersError) throw customersError

      const allCases = cases || []
      const allCustomers = customers || []

      // Samla alla unika tekniker från både cases och customers
      const technicianNames = new Set<string>()
      
      // Från cases (assigned_technician_name)
      allCases.forEach(c => {
        if (c.assigned_technician_name && c.assigned_technician_name.trim()) {
          technicianNames.add(c.assigned_technician_name.trim())
        }
      })
      
      // Från customers (assigned_account_manager)
      allCustomers.forEach(c => {
        if (c.assigned_account_manager && c.assigned_account_manager.trim()) {
          technicianNames.add(c.assigned_account_manager.trim())
        }
      })

      const activeTechniciansList = Array.from(technicianNames)
      
      // Filtrera aktiva cases
      const activeCasesList = allCases.filter(c => 
        c.status === 'in_progress' || c.status === 'pending' || c.status === 'open'
      )

      // Beräkna kapacitetsutnyttjande
      const optimalCasesPerTechnician = 8
      const totalOptimalCapacity = activeTechniciansList.length * optimalCasesPerTechnician
      const capacityUtilization = totalOptimalCapacity > 0 
        ? Math.min(100, (activeCasesList.length / totalOptimalCapacity) * 100) 
        : 0

      // Skapa fake technician workload för fallback
      const fallbackWorkload = this.calculateFallbackTechnicianWorkload(activeTechniciansList, allCases)

      return {
        activeTechnicians: activeTechniciansList.length,
        activeCases: activeCasesList.length,
        capacityUtilization,
        averageResolutionTime: this.calculateAverageResolutionTime(allCases),
        overdueCases: this.calculateOverdueCases(allCases),
        technicianWorkload: fallbackWorkload
      }
    } catch (error) {
      console.error('Error in fallback technician stats:', error)
      // Returnera default värden om allt misslyckas
      return {
        activeTechnicians: 0,
        activeCases: 0,
        capacityUtilization: 0,
        averageResolutionTime: 0,
        overdueCases: 0,
        technicianWorkload: []
      }
    }
  }

  private calculateAverageResolutionTime(cases: any[]): number {
    const completedCases = cases.filter(c => 
      (c.status === 'completed' || c.status === 'closed') && 
      c.created_at && 
      c.completed_date
    )
    
    if (completedCases.length === 0) return 0
    
    const totalTime = completedCases.reduce((sum, c) => {
      const createdDate = new Date(c.created_at)
      const completedDate = new Date(c.completed_date)
      const daysDiff = (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      return sum + Math.max(0, daysDiff) // Säkerställ att tiden inte är negativ
    }, 0)
    
    return totalTime / completedCases.length
  }

  private calculateOverdueCases(cases: any[]): number {
    const now = new Date()
    return cases.filter(c => 
      c.scheduled_date && 
      new Date(c.scheduled_date) < now && 
      (c.status === 'pending' || c.status === 'in_progress' || c.status === 'open')
    ).length
  }

  private calculateTechnicianWorkload(technicians: any[], cases: any[]): TechnicianWorkload[] {
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    return technicians.map(technician => {
      // Hitta alla cases tilldelade denna tekniker (via ID eller namn)
      const technicianCases = cases.filter(c => 
        c.assigned_technician_id === technician.id ||
        c.assigned_technician_name === technician.name
      )

      // Räkna aktiva cases
      const activeCases = technicianCases.filter(c => 
        c.status === 'in_progress' || c.status === 'pending' || c.status === 'open'
      ).length

      // Räkna avslutade cases denna månad
      const completedThisMonth = technicianCases.filter(c => 
        (c.status === 'completed' || c.status === 'closed') &&
        c.completed_date && 
        new Date(c.completed_date) >= thisMonthStart
      ).length

      // Beräkna utnyttjandegrad (baserat på optimal kapacitet)
      const optimalCasesPerTechnician = 8
      const utilizationPercentage = Math.min(100, (activeCases / optimalCasesPerTechnician) * 100)

      return {
        technician_id: technician.id,
        technician_name: technician.name,
        active_cases: activeCases,
        completed_this_month: completedThisMonth,
        utilization_percentage: utilizationPercentage
      }
    }).sort((a, b) => b.active_cases - a.active_cases) // Sortera efter antal aktiva cases
  }

  private calculateFallbackTechnicianWorkload(technicianNames: string[], cases: any[]): TechnicianWorkload[] {
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    return technicianNames.map((technicianName, index) => {
      // Hitta alla cases tilldelade denna tekniker
      const technicianCases = cases.filter(c => 
        c.assigned_technician_name === technicianName
      )

      // Räkna aktiva cases
      const activeCases = technicianCases.filter(c => 
        c.status === 'in_progress' || c.status === 'pending' || c.status === 'open'
      ).length

      // Räkna avslutade cases denna månad
      const completedThisMonth = technicianCases.filter(c => 
        (c.status === 'completed' || c.status === 'closed') &&
        c.completed_date && 
        new Date(c.completed_date) >= thisMonthStart
      ).length

      // Beräkna utnyttjandegrad (baserat på optimal kapacitet)
      const optimalCasesPerTechnician = 8
      const utilizationPercentage = Math.min(100, (activeCases / optimalCasesPerTechnician) * 100)

      return {
        technician_id: `fallback-${index}`, // Fake ID för fallback
        technician_name: technicianName,
        active_cases: activeCases,
        completed_this_month: completedThisMonth,
        utilization_percentage: utilizationPercentage
      }
    }).sort((a, b) => b.active_cases - a.active_cases) // Sortera efter antal aktiva cases
  }

  // Hjälpmetod för att testa om technicians-tabellen fungerar
  async testTechniciansTable(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, name')
        .limit(1)

      if (error) {
        console.error('Technicians table test failed:', error)
        return false
      }

      console.log('Technicians table test successful:', data)
      return true
    } catch (error) {
      console.error('Technicians table test error:', error)
      return false
    }
  }

  // Hjälpmetod för att populera technicians-tabellen med data från cases
  async populateTechniciansFromCases(): Promise<void> {
    try {
      console.log('Attempting to populate technicians table from cases...')
      
      // Hämta alla unika tekniker från cases
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('assigned_technician_name, assigned_technician_email')
        .not('assigned_technician_name', 'is', null)

      if (casesError) throw casesError

      // Samla unika tekniker
      const technicianMap = new Map()
      cases?.forEach(c => {
        if (c.assigned_technician_name) {
          const key = c.assigned_technician_name.trim().toLowerCase()
          if (!technicianMap.has(key)) {
            technicianMap.set(key, {
              name: c.assigned_technician_name.trim(),
              email: c.assigned_technician_email || `${c.assigned_technician_name.trim().replace(/\s+/g, '.').toLowerCase()}@begone.se`,
              role: 'Skadedjurstekniker',
              is_active: true
            })
          }
        }
      })

      const techniciansToInsert = Array.from(technicianMap.values())
      
      if (techniciansToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('technicians')
          .insert(techniciansToInsert)

        if (insertError) {
          console.error('Error inserting technicians:', insertError)
        } else {
          console.log(`Successfully inserted ${techniciansToInsert.length} technicians`)
        }
      }
    } catch (error) {
      console.error('Error populating technicians table:', error)
    }
  }
}

export const technicianStatisticsService = new TechnicianStatisticsService()