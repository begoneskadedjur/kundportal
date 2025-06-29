// src/services/technicianStatisticsService.ts - ENKEL FUNGERANDE VERSION
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
      console.log('🔍 Fetching technician stats...')
      
      // Hämta alla aktiva tekniker från technicians-tabellen
      const { data: technicians, error: techniciansError } = await supabase
        .from('technicians')
        .select('id, name, is_active')
        .eq('is_active', true)

      if (techniciansError) {
        console.error('❌ Error fetching technicians:', techniciansError)
        throw techniciansError
      }

      console.log('✅ Found technicians:', technicians?.length || 0)

      // Hämta alla cases
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select(`
          id, 
          status, 
          created_at, 
          completed_date, 
          scheduled_date, 
          assigned_technician_id, 
          assigned_technician_name,
          assigned_technician_email
        `)

      if (casesError) {
        console.error('❌ Error fetching cases:', casesError)
        throw casesError
      }

      console.log('✅ Found cases:', cases?.length || 0)

      const allTechnicians = technicians || []
      const allCases = cases || []

      // Debug: Kolla hur många cases som har assigned_technician_id vs assigned_technician_name
      const casesWithId = allCases.filter(c => c.assigned_technician_id)
      const casesWithName = allCases.filter(c => c.assigned_technician_name)
      
      console.log('📊 Cases with assigned_technician_id:', casesWithId.length)
      console.log('📊 Cases with assigned_technician_name:', casesWithName.length)

      // Filtrera aktiva cases
      const activeCasesList = allCases.filter(c => 
        c.status === 'in_progress' || 
        c.status === 'pending' || 
        c.status === 'open'
      )

      console.log('📋 Active cases:', activeCasesList.length)

      // Beräkna kapacitetsutnyttjande
      const optimalCasesPerTechnician = 8
      const totalOptimalCapacity = allTechnicians.length * optimalCasesPerTechnician
      const capacityUtilization = totalOptimalCapacity > 0 
        ? Math.min(100, (activeCasesList.length / totalOptimalCapacity) * 100) 
        : 0

      const stats = {
        activeTechnicians: allTechnicians.length,
        activeCases: activeCasesList.length,
        capacityUtilization,
        averageResolutionTime: this.calculateAverageResolutionTime(allCases),
        overdueCases: this.calculateOverdueCases(allCases),
        technicianWorkload: this.calculateTechnicianWorkloadImproved(allTechnicians, allCases)
      }

      console.log('📈 Final stats:', stats)
      return stats

    } catch (error) {
      console.error('💥 Error in getTechnicianStats:', error)
      
      // Returnera säkra standardvärden istället för att krascha
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

  private calculateTechnicianWorkloadImproved(technicians: any[], cases: any[]): TechnicianWorkload[] {
    const thisMonthStart = new Date()
    thisMonthStart.setDate(1)
    thisMonthStart.setHours(0, 0, 0, 0)

    console.log('🔄 Calculating workload for', technicians.length, 'technicians')

    return technicians.map(technician => {
      // Matcha cases på flera sätt för att vara säker:
      // 1. Direkt via assigned_technician_id (om det finns)
      // 2. Via assigned_technician_name som matchar technician.name
      // 3. Via assigned_technician_name som innehåller technician.name

      const technicianCases = cases.filter(c => {
        // Exakt ID-matchning
        if (c.assigned_technician_id === technician.id) {
          return true
        }
        
        // Exakt namn-matchning
        if (c.assigned_technician_name === technician.name) {
          return true
        }
        
        // Partiell namn-matchning (för att hantera variationer)
        if (c.assigned_technician_name && technician.name) {
          const caseName = c.assigned_technician_name.toLowerCase().trim()
          const techName = technician.name.toLowerCase().trim()
          
          // Kolla om namnen matchar (med flexibilitet för mellanslag och punkter)
          if (caseName.includes(techName) || techName.includes(caseName)) {
            return true
          }
          
          // Kolla om förnamn + efternamn matchar
          const caseNameParts = caseName.split(/[\s.]+/)
          const techNameParts = techName.split(/[\s.]+/)
          
          if (caseNameParts.length >= 2 && techNameParts.length >= 2) {
            const caseFirstLast = `${caseNameParts[0]} ${caseNameParts[caseNameParts.length - 1]}`
            const techFirstLast = `${techNameParts[0]} ${techNameParts[techNameParts.length - 1]}`
            
            if (caseFirstLast === techFirstLast) {
              return true
            }
          }
        }
        
        return false
      })

      // Räkna aktiva cases
      const activeCases = technicianCases.filter(c => 
        c.status === 'in_progress' || 
        c.status === 'pending' || 
        c.status === 'open'
      ).length

      // Räkna avslutade cases denna månad
      const completedThisMonth = technicianCases.filter(c => 
        (c.status === 'completed' || c.status === 'closed') &&
        c.completed_date && 
        new Date(c.completed_date) >= thisMonthStart
      ).length

      // Beräkna utnyttjandegrad
      const optimalCasesPerTechnician = 8
      const utilizationPercentage = Math.min(100, (activeCases / optimalCasesPerTechnician) * 100)

      console.log(`👤 ${technician.name}: ${activeCases} active, ${completedThisMonth} completed this month, ${utilizationPercentage.toFixed(1)}% utilization`)

      return {
        technician_id: technician.id,
        technician_name: technician.name,
        active_cases: activeCases,
        completed_this_month: completedThisMonth,
        utilization_percentage: Math.round(utilizationPercentage)
      }
    }).sort((a, b) => b.active_cases - a.active_cases)
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
      return sum + Math.max(0, daysDiff)
    }, 0)
    
    const avgTime = totalTime / completedCases.length
    console.log(`⏱️ Average resolution time: ${avgTime.toFixed(1)} days (from ${completedCases.length} completed cases)`)
    
    return avgTime
  }

  private calculateOverdueCases(cases: any[]): number {
    const now = new Date()
    const overdue = cases.filter(c => 
      c.scheduled_date && 
      new Date(c.scheduled_date) < now && 
      (c.status === 'pending' || c.status === 'in_progress' || c.status === 'open')
    ).length
    
    console.log(`⚠️ Overdue cases: ${overdue}`)
    return overdue
  }

  // Debug-metod för att se matchningar
  async debugTechnicianCaseMatching(): Promise<void> {
    try {
      const { data: technicians } = await supabase
        .from('technicians')
        .select('id, name, email')
        .eq('is_active', true)

      const { data: cases } = await supabase
        .from('cases')
        .select('assigned_technician_id, assigned_technician_name, assigned_technician_email')
        .not('assigned_technician_name', 'is', null)

      console.log('\n🔍 DEBUGGING TECHNICIAN-CASE MATCHING')
      console.log('====================================')
      
      technicians?.forEach(tech => {
        console.log(`\n👤 Technician: ${tech.name} (ID: ${tech.id})`)
        
        const matchingCases = cases?.filter(c => {
          return c.assigned_technician_id === tech.id || 
                 c.assigned_technician_name === tech.name ||
                 (c.assigned_technician_name && 
                  c.assigned_technician_name.toLowerCase().includes(tech.name.toLowerCase()))
        })
        
        console.log(`   📋 Matching cases: ${matchingCases?.length || 0}`)
        matchingCases?.slice(0, 3).forEach(c => {
          console.log(`   - ID match: ${c.assigned_technician_id === tech.id ? '✅' : '❌'} | Name: "${c.assigned_technician_name}"`)
        })
      })
      
      console.log('\n📊 CASE ASSIGNMENT SUMMARY')
      console.log('==========================')
      const totalCases = cases?.length || 0
      const casesWithId = cases?.filter(c => c.assigned_technician_id)?.length || 0
      const casesWithName = cases?.filter(c => c.assigned_technician_name)?.length || 0
      
      console.log(`Total cases with assignments: ${totalCases}`)
      console.log(`Cases with technician ID: ${casesWithId}`)
      console.log(`Cases with technician name: ${casesWithName}`)
      
    } catch (error) {
      console.error('Debug error:', error)
    }
  }
}

export const technicianStatisticsService = new TechnicianStatisticsService()