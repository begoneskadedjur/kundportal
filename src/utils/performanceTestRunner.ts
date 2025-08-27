// src/utils/performanceTestRunner.ts
// Automatiserade performance-tester för admin dashboard

interface PerformanceMetrics {
  loadTime: number
  renderTime: number
  queryCount: number
  dataTransferred: number
  ttfb: number // Time to First Byte
  tti: number // Time to Interactive
  timestamp: string
  component: string
}

interface TestResult {
  testName: string
  metrics: PerformanceMetrics
  success: boolean
  errors: string[]
}

export class AdminDashboardPerformanceTester {
  private results: TestResult[] = []
  private testStartTime: number = 0

  // Starta performance measurement
  startTest(testName: string): void {
    this.testStartTime = performance.now()
    performance.mark(`${testName}-start`)
    console.log(`🚀 Starting performance test: ${testName}`)
  }

  // Avsluta test och samla metrics
  endTest(testName: string, component: string): PerformanceMetrics {
    const endTime = performance.now()
    performance.mark(`${testName}-end`)
    performance.measure(testName, `${testName}-start`, `${testName}-end`)

    const measure = performance.getEntriesByName(testName)[0] as PerformanceEntry
    const loadTime = measure.duration

    // Samla network metrics
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    
    const metrics: PerformanceMetrics = {
      loadTime: Math.round(loadTime),
      renderTime: Math.round(endTime - this.testStartTime),
      queryCount: this.countNetworkRequests(),
      dataTransferred: this.calculateDataTransferred(),
      ttfb: Math.round(navigationEntry.responseStart - navigationEntry.requestStart),
      tti: this.estimateTimeToInteractive(),
      timestamp: new Date().toISOString(),
      component
    }

    console.log(`✅ Test completed: ${testName}`, metrics)
    return metrics
  }

  // Räkna antal network requests till Supabase
  private countNetworkRequests(): number {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return entries.filter(entry => 
      entry.name.includes('supabase.co') && 
      entry.initiatorType === 'fetch'
    ).length
  }

  // Beräkna total data transferred
  private calculateDataTransferred(): number {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    return entries
      .filter(entry => entry.name.includes('supabase.co'))
      .reduce((total, entry) => total + (entry.transferSize || 0), 0)
  }

  // Uppskatta Time to Interactive
  private estimateTimeToInteractive(): number {
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    return Math.round(navigationEntry.loadEventEnd - navigationEntry.fetchStart)
  }

  // Test Economics Dashboard Load
  async testEconomicsDashboardLoad(): Promise<TestResult> {
    const testName = 'economics-dashboard-load'
    this.startTest(testName)

    try {
      // Vänta på att alla kritiska komponenter laddat
      await this.waitForElement('[data-testid="kpi-cards"]', 5000)
      await this.waitForElement('[data-testid="marketing-spend-manager"]', 5000)
      await this.waitForElement('[data-testid="monthly-revenue-chart"]', 5000)

      const metrics = this.endTest(testName, 'EconomicsDashboard')
      
      const result: TestResult = {
        testName,
        metrics,
        success: metrics.loadTime < 3000, // Success under 3 seconds
        errors: []
      }

      this.results.push(result)
      return result

    } catch (error) {
      const metrics = this.endTest(testName, 'EconomicsDashboard')
      const result: TestResult = {
        testName,
        metrics,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }

      this.results.push(result)
      return result
    }
  }

  // Test MarketingSpendManager CRUD Operations
  async testMarketingSpendCRUD(): Promise<TestResult[]> {
    const crudResults: TestResult[] = []

    // Test CREATE operation
    const createResult = await this.testCRUDOperation('marketing-spend-create', async () => {
      // Simulera att lägga till ny marketing spend
      const createButton = document.querySelector('[data-testid="add-marketing-spend"]') as HTMLButtonElement
      if (createButton) createButton.click()
      await this.waitForElement('[data-testid="marketing-spend-form"]', 2000)
    })
    crudResults.push(createResult)

    // Test READ operation
    const readResult = await this.testCRUDOperation('marketing-spend-read', async () => {
      // Refresh data
      const refreshButton = document.querySelector('[data-testid="refresh-data"]') as HTMLButtonElement
      if (refreshButton) refreshButton.click()
      await this.waitForElement('[data-testid="marketing-spend-list"]', 3000)
    })
    crudResults.push(readResult)

    this.results.push(...crudResults)
    return crudResults
  }

  // Generic CRUD operation tester
  private async testCRUDOperation(testName: string, operation: () => Promise<void>): Promise<TestResult> {
    this.startTest(testName)

    try {
      await operation()
      const metrics = this.endTest(testName, 'MarketingSpendManager')
      
      return {
        testName,
        metrics,
        success: metrics.loadTime < 1000, // CRUD should be under 1 second
        errors: []
      }

    } catch (error) {
      const metrics = this.endTest(testName, 'MarketingSpendManager')
      
      return {
        testName,
        metrics,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  // Test heavy data load (simulate large dataset)
  async testHeavyDataLoad(): Promise<TestResult> {
    const testName = 'heavy-data-load'
    this.startTest(testName)

    try {
      // Simulera laddning av stort dataset
      // Detta skulle triggas av att navigera till sida med mycket data
      await new Promise(resolve => setTimeout(resolve, 500)) // Simulate async load
      
      const metrics = this.endTest(testName, 'HeavyDataSet')
      
      const result: TestResult = {
        testName,
        metrics,
        success: metrics.loadTime < 5000, // Heavy load should be under 5 seconds
        errors: []
      }

      this.results.push(result)
      return result

    } catch (error) {
      const metrics = this.endTest(testName, 'HeavyDataSet')
      const result: TestResult = {
        testName,
        metrics,
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }

      this.results.push(result)
      return result
    }
  }

  // Utility: Wait for element to appear
  private waitForElement(selector: string, timeout: number): Promise<Element> {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector)
      if (element) {
        resolve(element)
        return
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector)
        if (element) {
          observer.disconnect()
          resolve(element)
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true
      })

      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
    })
  }

  // Generate comprehensive report
  generateReport(): {
    summary: {
      totalTests: number
      successfulTests: number
      averageLoadTime: number
      totalDataTransferred: number
    }
    details: TestResult[]
    recommendations: string[]
  } {
    const successfulTests = this.results.filter(r => r.success).length
    const averageLoadTime = this.results.reduce((sum, r) => sum + r.metrics.loadTime, 0) / this.results.length
    const totalDataTransferred = this.results.reduce((sum, r) => sum + r.metrics.dataTransferred, 0)

    const recommendations: string[] = []

    // Generate recommendations based on results
    if (averageLoadTime > 2000) {
      recommendations.push('Consider implementing query result caching for faster load times')
    }
    if (totalDataTransferred > 1000000) { // 1MB
      recommendations.push('Optimize data payload size - consider pagination or field selection')
    }
    if (successfulTests / this.results.length < 0.8) {
      recommendations.push('Address failing tests - performance targets may be too aggressive')
    }

    return {
      summary: {
        totalTests: this.results.length,
        successfulTests,
        averageLoadTime: Math.round(averageLoadTime),
        totalDataTransferred
      },
      details: this.results,
      recommendations
    }
  }

  // Clear all results
  clearResults(): void {
    this.results = []
    performance.clearMarks()
    performance.clearMeasures()
  }

  // Export results to JSON
  exportResults(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      testSuite: 'AdminDashboardPerformance',
      report: this.generateReport()
    }, null, 2)
  }
}

// Singleton instance for global usage
export const performanceTester = new AdminDashboardPerformanceTester()

// Usage example:
/*
import { performanceTester } from '../utils/performanceTestRunner'

// In your component
useEffect(() => {
  const runTests = async () => {
    await performanceTester.testEconomicsDashboardLoad()
    await performanceTester.testMarketingSpendCRUD()
    await performanceTester.testHeavyDataLoad()
    
    const report = performanceTester.generateReport()
    console.log('Performance Test Report:', report)
  }
  
  runTests()
}, [])
*/