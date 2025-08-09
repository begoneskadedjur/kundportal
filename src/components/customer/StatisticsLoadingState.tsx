// src/components/customer/StatisticsLoadingState.tsx - Beautiful loading state for statistics
import React from 'react'
import { BarChart3 } from 'lucide-react'

const StatisticsLoadingState: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header Skeleton */}
      <div className="bg-slate-800/50 backdrop-blur border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-7 h-7 text-purple-400 animate-pulse" />
                <div className="h-8 bg-slate-700 rounded w-48 animate-pulse"></div>
              </div>
              <div className="h-4 bg-slate-700 rounded w-72 animate-pulse"></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 bg-slate-700 rounded w-40 animate-pulse"></div>
              <div className="flex gap-2">
                <div className="h-10 bg-slate-700 rounded w-16 animate-pulse"></div>
                <div className="h-10 bg-slate-700 rounded w-16 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 animate-pulse">
                  <div className="w-5 h-5 bg-slate-600 rounded"></div>
                </div>
                <div className="w-8 h-3 bg-slate-700 rounded animate-pulse"></div>
              </div>
              
              <div className="h-4 bg-slate-700 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-8 bg-slate-700 rounded w-20 mb-1 animate-pulse"></div>
              <div className="h-3 bg-slate-700 rounded w-24 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pie Chart Skeleton */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-blue-400/20 rounded animate-pulse"></div>
              <div className="h-6 bg-slate-700 rounded w-48 animate-pulse"></div>
            </div>
            
            <div className="flex items-center justify-center h-64">
              <div className="relative">
                {/* Spinning circle */}
                <div className="w-32 h-32 border-8 border-slate-700 rounded-full animate-spin">
                  <div className="absolute top-0 left-0 w-full h-full border-8 border-transparent border-t-purple-400 rounded-full"></div>
                </div>
                {/* Inner circle */}
                <div className="absolute inset-6 bg-slate-800 rounded-full border-4 border-slate-700"></div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2 animate-pulse">
                  <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                  <div className="h-3 bg-slate-700 rounded flex-1"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Line Chart Skeleton */}
          <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-purple-400/20 rounded animate-pulse"></div>
              <div className="h-6 bg-slate-700 rounded w-36 animate-pulse"></div>
            </div>
            
            <div className="h-64 flex items-end justify-between gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-slate-700 rounded-t animate-pulse"
                  style={{
                    height: `${Math.random() * 80 + 20}%`,
                    width: '12%',
                    animationDelay: `${index * 100}ms`
                  }}
                ></div>
              ))}
            </div>
          </div>

          {/* Bar Chart Skeleton */}
          <div className="lg:col-span-2 bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-5 h-5 bg-green-400/20 rounded animate-pulse"></div>
              <div className="h-6 bg-slate-700 rounded w-40 animate-pulse"></div>
            </div>
            
            <div className="h-80 flex items-end justify-between gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="flex flex-col items-center gap-2 flex-1">
                  <div
                    className="bg-slate-700 rounded w-full animate-pulse"
                    style={{
                      height: `${Math.random() * 60 + 20}%`,
                      animationDelay: `${index * 150}ms`
                    }}
                  ></div>
                  <div className="h-3 bg-slate-700 rounded w-16 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating loading indicator */}
      <div className="fixed bottom-8 right-8 bg-purple-500/20 backdrop-blur border border-purple-500/30 rounded-full p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-purple-400 text-sm font-medium">Laddar statistik...</span>
        </div>
      </div>
    </div>
  )
}

export default StatisticsLoadingState