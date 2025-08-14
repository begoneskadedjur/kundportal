// src/pages/organisation/shared/Statistik.tsx - Statistik för alla multisite-roller
import React, { useState, useEffect } from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import { supabase } from '../../../lib/supabase'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import Card from '../../../components/ui/Card'
import { BarChart3, TrendingUp, Users, AlertTriangle, MapPin, Calendar, CheckCircle, Clock } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const OrganisationStatistik: React.FC = () => {
  const { organization, sites, accessibleSites, userRole, loading: contextLoading } = useMultisite()
  const location = useLocation()
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all')
  const [loading, setLoading] = useState(false)
  const [statistics, setStatistics] = useState<any>(null)
  
  // Bestäm användarroll baserat på URL
  const getUserRoleType = (): 'verksamhetschef' | 'regionchef' | 'platsansvarig' => {
    if (location.pathname.includes('verksamhetschef')) return 'verksamhetschef'
    if (location.pathname.includes('regionchef')) return 'regionchef'
    if (location.pathname.includes('platsansvarig')) return 'platsansvarig'
    return 'verksamhetschef' // fallback
  }
  
  const userRoleType = getUserRoleType()
  
  // Filtrera sites baserat på roll
  const getAvailableSites = () => {
    if (userRoleType === 'verksamhetschef') {
      // Verksamhetschef ser alla sites
      return sites
    } else if (userRoleType === 'regionchef') {
      // Regionchef ser bara sites i sin region
      return accessibleSites
    } else if (userRoleType === 'platsansvarig') {
      // Platsansvarig ser bara sin site
      return accessibleSites
    }
    return []
  }
  
  const availableSites = getAvailableSites()
  
  useEffect(() => {
    fetchStatistics()
  }, [selectedSiteId, availableSites])
  
  const fetchStatistics = async () => {
    try {
      setLoading(true)
      
      // Bestäm vilka sites att hämta data för
      let targetSites = availableSites
      if (selectedSiteId !== 'all') {
        targetSites = availableSites.filter(s => s.id === selectedSiteId)
      }
      
      if (targetSites.length === 0) {
        setStatistics(null)
        return
      }
      
      const siteIds = targetSites.map(s => s.id)
      
      // Hämta cases statistik från cases tabellen (inte private_cases)
      const { data: cases, error: casesError } = await supabase
        .from('cases')
        .select('status, created_at, customer_id')
        .in('customer_id', siteIds)
      
      if (casesError) throw casesError
      
      // Beräkna statistik med svenska statusvärden
      const totalCases = cases?.length || 0
      const completedCases = cases?.filter(c => 
        c.status === 'Slutförd' || c.status === 'Stängd'
      ).length || 0
      const activeCases = cases?.filter(c => 
        c.status === 'Pågående' || c.status === 'Schemalagd'
      ).length || 0
      const pendingCases = cases?.filter(c => c.status === 'Öppen').length || 0
      
      // Månadsvis trend
      const monthlyData = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthCases = cases?.filter(c => {
          const caseDate = new Date(c.created_at)
          return caseDate.getMonth() === month.getMonth() && 
                 caseDate.getFullYear() === month.getFullYear()
        })
        
        monthlyData.push({
          month: month.toLocaleDateString('sv-SE', { month: 'short' }),
          ärenden: monthCases?.length || 0,
          avklarade: monthCases?.filter(c => 
            c.status === 'Slutförd' || c.status === 'Stängd'
          ).length || 0
        })
      }
      
      // Status distribution
      const statusData = [
        { name: 'Avklarade', value: completedCases, color: '#10b981' },
        { name: 'Pågående', value: activeCases, color: '#f59e0b' },
        { name: 'Öppna', value: pendingCases, color: '#3b82f6' }
      ]
      
      // Site-baserad statistik
      const siteData = targetSites.map(site => {
        const siteCases = cases?.filter(c => c.customer_id === site.id)
        return {
          name: site.site_name,
          ärenden: siteCases?.length || 0,
          avklarade: siteCases?.filter(c => 
            c.status === 'Slutförd' || c.status === 'Stängd'
          ).length || 0,
          pågående: siteCases?.filter(c => 
            c.status === 'Pågående' || c.status === 'Schemalagd'
          ).length || 0
        }
      })
      
      setStatistics({
        totalCases,
        completedCases,
        activeCases,
        pendingCases,
        completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
        monthlyData,
        statusData,
        siteData
      })
    } catch (error) {
      console.error('Error fetching statistics:', error)
      setStatistics(null)
    } finally {
      setLoading(false)
    }
  }

  if (contextLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Laddar statistik..." />
      </div>
    )
  }

  // Om platsansvarig och har bara en site, visa inte väljaren
  const showSiteSelector = userRoleType !== 'platsansvarig' || availableSites.length > 1

  return (
    <OrganisationLayout userRoleType={userRoleType}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">
                Statistik - {organization?.organization_name}
              </h1>
              <p className="text-purple-200">
                {userRoleType === 'verksamhetschef' && 'Översikt över organisationens prestanda'}
                {userRoleType === 'regionchef' && 'Översikt över regionens prestanda'}
                {userRoleType === 'platsansvarig' && 'Översikt över enhetens prestanda'}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-400" />
          </div>
        </div>

        {/* Site selector - visa bara om relevant */}
        {showSiteSelector && (
          <Card className="bg-slate-800/50 border-slate-700">
            <div className="p-4 flex items-center gap-4">
              <MapPin className="w-5 h-5 text-purple-400" />
              <label className="text-slate-300">Välj enhet:</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">
                  {userRoleType === 'verksamhetschef' && 'Alla enheter'}
                  {userRoleType === 'regionchef' && 'Alla enheter i regionen'}
                  {userRoleType === 'platsansvarig' && 'Min enhet'}
                </option>
                {availableSites.map(site => (
                  <option key={site.id} value={site.id}>
                    {site.site_name} {site.region && `- ${site.region}`}
                  </option>
                ))}
              </select>
            </div>
          </Card>
        )}

        {/* Statistics content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Laddar statistik..." />
          </div>
        ) : statistics ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Totalt antal ärenden</p>
                      <p className="text-3xl font-bold text-white mt-2">{statistics.totalCases}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-purple-500" />
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Avklarade</p>
                      <p className="text-3xl font-bold text-green-400 mt-2">{statistics.completedCases}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Pågående</p>
                      <p className="text-3xl font-bold text-amber-400 mt-2">{statistics.activeCases}</p>
                    </div>
                    <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                  </div>
                </div>
              </Card>
              
              <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">Avklaringsgrad</p>
                      <p className="text-3xl font-bold text-blue-400 mt-2">{statistics.completionRate}%</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-blue-500" />
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trend */}
              <Card className="bg-slate-800/50 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                  <h2 className="text-xl font-semibold text-white">Månadsvis trend</h2>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={statistics.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="ärenden" 
                        stroke="#a78bfa" 
                        strokeWidth={2}
                        name="Totalt"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="avklarade" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        name="Avklarade"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Status Distribution */}
              <Card className="bg-slate-800/50 border-slate-700">
                <div className="p-6 border-b border-slate-700">
                  <h2 className="text-xl font-semibold text-white">Statusfördelning</h2>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={statistics.statusData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {statistics.statusData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Site Comparison - om fler än en site */}
              {statistics.siteData.length > 1 && (
                <Card className="bg-slate-800/50 border-slate-700 lg:col-span-2">
                  <div className="p-6 border-b border-slate-700">
                    <h2 className="text-xl font-semibold text-white">Jämförelse mellan enheter</h2>
                  </div>
                  <div className="p-6">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={statistics.siteData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                          labelStyle={{ color: '#f8fafc' }}
                        />
                        <Legend />
                        <Bar dataKey="ärenden" fill="#a78bfa" name="Totalt" />
                        <Bar dataKey="avklarade" fill="#10b981" name="Avklarade" />
                        <Bar dataKey="pågående" fill="#f59e0b" name="Pågående" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              )}
            </div>
          </>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Ingen statistik tillgänglig</p>
              <p className="text-slate-500 text-sm mt-2">
                Välj en enhet för att se statistik
              </p>
            </div>
          </Card>
        )}
      </div>
    </OrganisationLayout>
  )
}

export default OrganisationStatistik