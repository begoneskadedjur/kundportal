// src/components/admin/economics/PerformanceTestReport.tsx
// Detaljerad performance rapport för RLS-optimeringar

import React, { useState, useEffect } from 'react'
import { Activity, Clock, Database, TrendingUp, CheckCircle, AlertTriangle, BarChart3 } from 'lucide-react'
import Button from '../../ui/Button'
import { performanceTester } from '../../../utils/performanceTestRunner'

interface PerformanceTestResult {
  testName: string
  loadTime: number
  queryCount: number
  dataTransferred: number
  success: boolean
  timestamp: string
}

const PerformanceTestReport: React.FC = () => {
  const [testResults, setTestResults] = useState<PerformanceTestResult[]>([])
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [showDetailedReport, setShowDetailedReport] = useState(false)

  // Kör alla performance tester
  const runPerformanceTests = async () => {
    setIsRunningTests(true)
    try {
      console.log('🚀 Starting comprehensive admin dashboard performance tests...')
      
      // Rensa tidigare resultat
      performanceTester.clearResults()
      
      // Kör alla tester sekventiellt
      const economicsDashboardResult = await performanceTester.testEconomicsDashboardLoad()
      const crudResults = await performanceTester.testMarketingSpendCRUD()
      const heavyDataResult = await performanceTester.testHeavyDataLoad()
      
      // Samla alla resultat
      const allResults = [economicsDashboardResult, ...crudResults, heavyDataResult]
      
      // Konvertera till vårt format
      const formattedResults: PerformanceTestResult[] = allResults.map(result => ({
        testName: result.testName,
        loadTime: result.metrics.loadTime,
        queryCount: result.metrics.queryCount,
        dataTransferred: result.metrics.dataTransferred,
        success: result.success,
        timestamp: result.metrics.timestamp
      }))
      
      setTestResults(formattedResults)
      
      // Generera detaljerad rapport
      const report = performanceTester.generateReport()
      console.log('📊 Performance Test Report Complete:', report)
      
    } catch (error) {
      console.error('❌ Error running performance tests:', error)
    } finally {
      setIsRunningTests(false)
    }
  }

  // Beräkna sammanfattning
  const calculateSummary = () => {
    if (testResults.length === 0) return null
    
    const successfulTests = testResults.filter(r => r.success).length
    const averageLoadTime = testResults.reduce((sum, r) => sum + r.loadTime, 0) / testResults.length
    const totalQueries = testResults.reduce((sum, r) => sum + r.queryCount, 0)
    const totalDataTransferred = testResults.reduce((sum, r) => sum + r.dataTransferred, 0)
    
    return {
      totalTests: testResults.length,
      successfulTests,
      successRate: (successfulTests / testResults.length) * 100,
      averageLoadTime: Math.round(averageLoadTime),
      totalQueries,
      totalDataTransferred: Math.round(totalDataTransferred / 1024) // KB
    }
  }

  const summary = calculateSummary()

  return (
    <div className="p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BarChart3 className="w-5 h-5 text-cyan-500 mr-2" />
          <h2 className="text-lg font-semibold text-white">Performance Test Report</h2>
          <span className="ml-2 text-xs text-slate-400">RLS Optimering Validering</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={runPerformanceTests}
            disabled={isRunningTests}
            className="flex items-center gap-2"
          >
            <Activity className={`w-4 h-4 ${isRunningTests ? 'animate-spin' : ''}`} />
            {isRunningTests ? 'Kör tester...' : 'Kör Performance Tester'}
          </Button>
        </div>
      </div>

      {/* Test Status */}
      {isRunningTests && (
        <div className="mb-6 p-4 bg-blue-900/20 rounded-lg border border-blue-700">
          <div className="flex items-center">
            <Activity className="w-5 h-5 text-blue-400 animate-spin mr-3" />
            <div>
              <h3 className="text-white font-medium">Kör Performance Tester</h3>
              <p className="text-sm text-slate-400">
                Testar Economics Dashboard, MarketingSpend CRUD och Heavy Data Load...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Success Rate</p>
                <p className="text-lg font-bold text-green-400">{Math.round(summary.successRate)}%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
          
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Avg Load Time</p>
                <p className="text-lg font-bold text-blue-400">{summary.averageLoadTime}ms</p>
              </div>
              <Clock className="w-8 h-8 text-blue-400" />
            </div>
          </div>
          
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Queries</p>
                <p className="text-lg font-bold text-purple-400">{summary.totalQueries}</p>
              </div>
              <Database className="w-8 h-8 text-purple-400" />
            </div>
          </div>
          
          <div className="p-4 bg-slate-800/30 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Data Transfer</p>
                <p className="text-lg font-bold text-orange-400">{summary.totalDataTransferred}KB</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>
      )}

      {/* Performance Insights */}
      {summary && (
        <div className="mb-6 p-4 bg-slate-800/20 rounded-lg border border-slate-700">
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            RLS-Optimering Insights
          </h3>
          
          <div className="space-y-2 text-sm">
            {summary.averageLoadTime < 1500 && (
              <div className="flex items-center text-green-400">
                <CheckCircle className="w-4 h-4 mr-2" />
                Excellent performance: Average load time under 1.5 seconds
              </div>
            )}
            
            {summary.successRate >= 80 && (
              <div className="flex items-center text-green-400">
                <CheckCircle className="w-4 h-4 mr-2" />
                High success rate: {Math.round(summary.successRate)}% of tests passed
              </div>
            )}
            
            {summary.totalQueries < 20 && (
              <div className="flex items-center text-green-400">
                <CheckCircle className="w-4 h-4 mr-2" />
                Optimized queries: Low total query count ({summary.totalQueries})
              </div>
            )}
            
            {summary.averageLoadTime > 2000 && (
              <div className="flex items-center text-yellow-400">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Performance warning: Load times above 2 seconds detected
              </div>
            )}
            
            {summary.totalQueries > 30 && (
              <div className="flex items-center text-yellow-400">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Query optimization needed: High query count ({summary.totalQueries})
              </div>
            )}
          </div>
        </div>
      )}

      {/* Test Results Table */}
      {testResults.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Test Results Detail</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDetailedReport(!showDetailedReport)}
            >
              {showDetailedReport ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Test Name</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Load Time</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Queries</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Status</th>
                  {showDetailedReport && (
                    <>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Data Transfer</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-300">Timestamp</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {testResults.map((result, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
                    <td className="py-3 px-4 text-sm text-white">{result.testName}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`font-medium ${
                        result.loadTime < 1000 ? 'text-green-400' :
                        result.loadTime < 2000 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {result.loadTime}ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-purple-400">{result.queryCount}</td>
                    <td className="py-3 px-4 text-sm">
                      {result.success ? (
                        <span className="flex items-center text-green-400">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Pass
                        </span>
                      ) : (
                        <span className="flex items-center text-red-400">
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          Fail
                        </span>
                      )}
                    </td>
                    {showDetailedReport && (
                      <>
                        <td className="py-3 px-4 text-sm text-orange-400">
                          {Math.round(result.dataTransferred / 1024)}KB
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-400">
                          {new Date(result.timestamp).toLocaleTimeString('sv-SE')}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {summary && (
        <div className="p-4 bg-slate-800/20 rounded-lg border border-slate-700">
          <h3 className="text-white font-medium mb-3">Performance Recommendations</h3>
          <div className="space-y-2 text-sm text-slate-300">
            <p>• RLS-optimering för monthly_marketing_spend: ✅ Implementerad</p>
            <p>• Database index för quote_recipients: ✅ Implementerat</p>
            <p>• current_user_role() wrapper: ✅ Aktiv</p>
            
            {summary.averageLoadTime > 1500 && (
              <p>• 🔧 Consider implementing query result caching</p>
            )}
            {summary.totalQueries > 25 && (
              <p>• 🔧 Review query patterns for further optimization</p>
            )}
            {summary.successRate < 90 && (
              <p>• ⚠️ Investigate failing test cases</p>
            )}
          </div>
        </div>
      )}
      
      {testResults.length === 0 && !isRunningTests && (
        <div className="text-center py-8 text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-4 text-slate-600" />
          <p>Inga performance tester körda ännu</p>
          <p className="text-sm">Klicka på "Kör Performance Tester" för att börja</p>
        </div>
      )}
    </div>
  )
}

export default PerformanceTestReport