// src/hooks/usePerformanceMonitoring.ts
// React hook för att övervaka prestanda i admin dashboard komponenter

import { useEffect, useState, useRef } from 'react'

interface PerformanceData {
  componentName: string
  loadTime: number
  renderTime: number
  queryCount: number
  lastUpdated: string
  isLoading: boolean
}

interface UsePerformanceMonitoringOptions {
  componentName: string
  trackNetworkRequests?: boolean
  enableLogging?: boolean
  thresholds?: {
    loadTime: number // ms
    renderTime: number // ms
  }
}

export const usePerformanceMonitoring = (options: UsePerformanceMonitoringOptions) => {
  const {
    componentName,
    trackNetworkRequests = true,
    enableLogging = true,
    thresholds = { loadTime: 2000, renderTime: 1000 }
  } = options

  const [performanceData, setPerformanceData] = useState<PerformanceData>({
    componentName,
    loadTime: 0,
    renderTime: 0,
    queryCount: 0,
    lastUpdated: '',
    isLoading: true
  })

  const startTimeRef = useRef<number>(0)
  const networkRequestCountRef = useRef<number>(0)

  // Starta performance monitoring när komponenten mountas
  useEffect(() => {
    startTimeRef.current = performance.now()
    performance.mark(`${componentName}-mount-start`)
    
    if (trackNetworkRequests) {
      networkRequestCountRef.current = countCurrentNetworkRequests()
    }

    if (enableLogging) {
      console.log(`🔍 Starting performance monitoring for ${componentName}`)
    }

    // Cleanup function
    return () => {
      if (enableLogging) {
        console.log(`🏁 Performance monitoring ended for ${componentName}`)
      }
    }
  }, [componentName, trackNetworkRequests, enableLogging])

  // Funktion för att märka när data har laddats
  const markDataLoaded = () => {
    const endTime = performance.now()
    performance.mark(`${componentName}-data-loaded`)
    
    const loadTime = Math.round(endTime - startTimeRef.current)
    const newQueryCount = trackNetworkRequests 
      ? countCurrentNetworkRequests() - networkRequestCountRef.current
      : 0

    const updatedData: PerformanceData = {
      componentName,
      loadTime,
      renderTime: loadTime, // Samma som loadTime för nu
      queryCount: newQueryCount,
      lastUpdated: new Date().toISOString(),
      isLoading: false
    }

    setPerformanceData(updatedData)

    // Logga results och varningar
    if (enableLogging) {
      console.log(`📊 Performance data for ${componentName}:`, updatedData)
      
      // Varna om thresholds överskrids
      if (loadTime > thresholds.loadTime) {
        console.warn(`⚠️ ${componentName} load time (${loadTime}ms) exceeds threshold (${thresholds.loadTime}ms)`)
      }
      if (newQueryCount > 10) {
        console.warn(`⚠️ ${componentName} made ${newQueryCount} network requests - consider optimization`)
      }
    }

    // Skapa performance measure
    try {
      performance.measure(
        `${componentName}-total-load`,
        `${componentName}-mount-start`,
        `${componentName}-data-loaded`
      )
    } catch (error) {
      console.warn(`Could not create performance measure for ${componentName}:`, error)
    }
  }

  // Funktion för att märka när rendering är klar
  const markRenderComplete = () => {
    const endTime = performance.now()
    performance.mark(`${componentName}-render-complete`)
    
    const renderTime = Math.round(endTime - startTimeRef.current)

    setPerformanceData(prev => ({
      ...prev,
      renderTime,
      lastUpdated: new Date().toISOString()
    }))

    if (enableLogging && renderTime > thresholds.renderTime) {
      console.warn(`⚠️ ${componentName} render time (${renderTime}ms) exceeds threshold (${thresholds.renderTime}ms)`)
    }
  }

  // Räkna aktuella network requests
  const countCurrentNetworkRequests = (): number => {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return entries.filter(entry => 
      entry.name.includes('supabase.co') && 
      entry.initiatorType === 'fetch'
    ).length
  }

  // Få detaljerad performance report
  const getDetailedReport = () => {
    const measures = performance.getEntriesByName(`${componentName}-total-load`)
    const marks = performance.getEntriesByType('mark').filter(mark => 
      mark.name.includes(componentName)
    )

    return {
      performanceData,
      measures,
      marks,
      recommendations: generateRecommendations(performanceData, thresholds)
    }
  }

  // Rensa performance data för komponenten
  const clearPerformanceData = () => {
    performance.clearMarks()
    performance.clearMeasures()
    setPerformanceData({
      componentName,
      loadTime: 0,
      renderTime: 0,
      queryCount: 0,
      lastUpdated: '',
      isLoading: true
    })
  }

  return {
    performanceData,
    markDataLoaded,
    markRenderComplete,
    getDetailedReport,
    clearPerformanceData,
    isPerformant: performanceData.loadTime < thresholds.loadTime && performanceData.renderTime < thresholds.renderTime
  }
}

// Generera recommendations baserat på performance data
const generateRecommendations = (
  data: PerformanceData, 
  thresholds: { loadTime: number; renderTime: number }
): string[] => {
  const recommendations: string[] = []

  if (data.loadTime > thresholds.loadTime) {
    recommendations.push(`Reduce load time from ${data.loadTime}ms to under ${thresholds.loadTime}ms`)
  }

  if (data.renderTime > thresholds.renderTime) {
    recommendations.push(`Optimize rendering from ${data.renderTime}ms to under ${thresholds.renderTime}ms`)
  }

  if (data.queryCount > 5) {
    recommendations.push(`Reduce database queries from ${data.queryCount} - consider data caching or batching`)
  }

  if (data.queryCount > 15) {
    recommendations.push(`High query count (${data.queryCount}) - implement pagination or lazy loading`)
  }

  return recommendations
}

// Hook specificerar för Economics Dashboard
export const useEconomicsDashboardPerformance = () => {
  return usePerformanceMonitoring({
    componentName: 'EconomicsDashboard',
    trackNetworkRequests: true,
    enableLogging: true,
    thresholds: {
      loadTime: 3000, // Economics dashboard får ta lite längre tid
      renderTime: 2000
    }
  })
}

// Hook för MarketingSpendManager
export const useMarketingSpendPerformance = () => {
  return usePerformanceMonitoring({
    componentName: 'MarketingSpendManager',
    trackNetworkRequests: true,
    enableLogging: true,
    thresholds: {
      loadTime: 1500,
      renderTime: 800
    }
  })
}

// Hook för KPI Cards (borde vara snabbaste)
export const useKpiCardsPerformance = () => {
  return usePerformanceMonitoring({
    componentName: 'KpiCards',
    trackNetworkRequests: true,
    enableLogging: true,
    thresholds: {
      loadTime: 1000,
      renderTime: 500
    }
  })
}