// src/pages/multisite/Portal.tsx - Multisite Organization Portal
import React, { useState, useEffect } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { useMultisite } from '../../contexts/MultisiteContext'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'

// Import multisite components
import MultisitePortalNavigation from '../../components/multisite/MultisitePortalNavigation'
import MultisiteDashboard from '../../components/multisite/MultisiteDashboard'
import MultisiteStatistics from '../../components/multisite/MultisiteStatistics'
import MultisiteReports from '../../components/multisite/MultisiteReports'
import TrafficLightSystem from '../../components/multisite/TrafficLightSystem'

const MultisitePortal: React.FC = () => {
  const { profile } = useAuth()
  const { organization, userRole, loading, error, refreshData } = useMultisite()
  const [currentView, setCurrentView] = useState<'dashboard' | 'statistics' | 'reports' | 'traffic-light'>('dashboard')
  const [refreshing, setRefreshing] = useState(false)

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()
    setRefreshing(false)
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner />
          <p className="text-white mt-4">Laddar multisite-portal...</p>
        </div>
      </div>
    )
  }

  // Error state or no organization access
  if (error || !organization || !userRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="text-center p-8 max-w-md bg-slate-800/50 backdrop-blur border-slate-700">
          <div className="text-amber-500 mb-4">
            <AlertTriangle className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Ingen multisite-åtkomst</h2>
          <p className="text-slate-400 mb-4">
            {error || 'Du har inte tillgång till någon multisite-organisation'}
          </p>
          <Button onClick={handleRefresh} className="bg-emerald-500 hover:bg-emerald-600">
            <RefreshCw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </Card>
      </div>
    )
  }

  // Render view based on current selection
  const renderView = () => {
    switch (currentView) {
      case 'statistics':
        return <MultisiteStatistics />
      case 'reports':
        return <MultisiteReports />
      case 'traffic-light':
        return <TrafficLightSystem />
      default:
        return <MultisiteDashboard />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <MultisitePortalNavigation
        currentView={currentView}
        onViewChange={setCurrentView}
        organizationName={organization.organization_name}
        userRole={userRole.role_type}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      {/* Main Content */}
      <div className="pt-4">
        {renderView()}
      </div>
    </div>
  )
}

export default MultisitePortal