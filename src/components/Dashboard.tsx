import { useAuth } from '../hooks/useAuth'
import { useCustomerData } from '../hooks/useCustomerData'
import { useClickUpSync } from '../hooks/useClickUpSync'

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200'
}

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-orange-100 text-orange-700', 
  high: 'bg-red-100 text-red-700'
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { cases, customer, stats, loading } = useCustomerData()
  const { syncTasks, testClickUp, syncing, testing, lastSync } = useClickUpSync()

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusText = (status) => {
    const statusMap = {
      pending: 'Väntande',
      in_progress: 'Pågående', 
      completed: 'Avslutad'
    }
    return statusMap[status] || status
  }

  // ClickUp Test Function
  const handleTestClickUp = async () => {
    console.log('Testing ClickUp connection...')
    const result = await testClickUp()
    
    if (result.success) {
      alert(`✅ ClickUp connection successful!\n\nFound ${result.lists?.length || 0} lists. Check console (F12) for details.`)
    } else {
      alert(`❌ ClickUp test failed: ${result.error}`)
    }
  }

  // ClickUp Sync Function
  const handleSyncClickUp = async () => {
    if (!customer?.id) {
      alert('Ingen kundprofil hittad')
      return
    }

    // För demo - använd en hårdkodad List ID
    // TODO: I produktion kommer du att ha en mapping-tabell eller konfig
    const LIST_ID = 'din_list_id_här' // Ersätt med riktigt ID från test-funktionen
    
    if (LIST_ID === 'din_list_id_här') {
      alert('⚠️ Du behöver uppdatera LIST_ID!\n\n1. Kör "Testa ClickUp"\n2. Hitta rätt List ID i console\n3. Uppdatera LIST_ID i koden')
      return
    }

    const result = await syncTasks(LIST_ID, customer.company_name)
    
    if (result.success) {
      const message = `✅ Sync lyckades!\n\n` +
        `📊 Totalt: ${result.count} ärenden\n` +
        `🆕 Skapade: ${result.created}\n` +
        `🔄 Uppdaterade: ${result.updated}\n` +
        `⏭️ Hoppade över: ${result.skipped}\n` +
        `${result.errors > 0 ? `⚠️ Fel: ${result.errors}` : ''}`
      
      alert(message)
      
      // Ladda om kunddata för att visa nya ärenden
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } else {
      alert(`❌ Sync misslyckades: ${result.error}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Laddar kunddata...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">BeGone</h1>
                <p className="text-xs text-slate-400">
                  {customer ? customer.company_name : 'Kundportal'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right">
                <p className="text-sm text-white">{user?.email}</p>
                <p className="text-xs text-slate-400">Inloggad</p>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Welcome Section */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-1">
            Välkommen tillbaka{customer ? `, ${customer.contact_person || customer.company_name}` : ''}!
          </h2>
          <p className="text-slate-400 text-xs">Här är en översikt av dina aktuella ärenden och behandlingar.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg p-2 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Aktiva ärenden</p>
                <p className="text-xl font-bold text-white">{stats.activeCases}</p>
              </div>
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg p-2 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Nästa besök</p>
                <p className="text-sm font-semibold text-white">
                  {stats.nextVisit 
                    ? new Date(stats.nextVisit.scheduled_date).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric' })
                    : 'Inga'}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg p-2 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Avslutade ärenden</p>
                <p className="text-xl font-bold text-white">{stats.completedCases}</p>
              </div>
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Cases List */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg border border-slate-700/50 overflow-hidden">
          <div className="p-3 border-b border-slate-700/50">
            <h3 className="text-base font-semibold text-white">Dina ärenden</h3>
            <p className="text-slate-400 text-xs mt-1">Översikt av alla behandlingar och besök</p>
          </div>
          
          <div className="overflow-hidden">
            {cases.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                Inga ärenden hittades för ditt konto.
              </div>
            ) : (
              cases.map((case_item) => (
                <div key={case_item.id} className="p-3 border-b border-slate-700/30 last:border-b-0 hover:bg-slate-700/20 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-semibold text-white">{case_item.title}</h4>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[case_item.status]}`}>
                          {getStatusText(case_item.status)}
                        </span>
                        <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${priorityColors[case_item.priority]}`}>
                          {case_item.priority === 'high' ? 'Hög' : case_item.priority === 'medium' ? 'Medium' : 'Låg'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-slate-400">
                        <span>#{case_item.case_number}</span>
                        <span>Skadedjur: {case_item.pest_type}</span>
                        {case_item.scheduled_date && (
                          <span>Schemalagt: {formatDate(case_item.scheduled_date)}</span>
                        )}
                        {case_item.visits && case_item.visits.length > 0 && (
                          <span>Senaste besök: {formatDate(case_item.visits[0].visit_date)}</span>
                        )}
                      </div>
                    </div>
                    <button className="ml-4 bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
                      Visa detaljer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-lg p-3 border border-purple-500/20">
            <h3 className="text-sm font-semibold text-white mb-1">ClickUp Synkronisering</h3>
            <p className="text-slate-400 text-xs mb-2">
              {lastSync ? `Senast: ${lastSync.toLocaleTimeString('sv-SE')}` : 'Aldrig synkat'}
            </p>
            <div className="space-y-1">
              <button 
                onClick={handleTestClickUp}
                disabled={testing}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full disabled:opacity-50"
              >
                {testing ? 'Testar...' : 'Testa ClickUp'}
              </button>
              <button 
                onClick={handleSyncClickUp}
                disabled={syncing}
                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full disabled:opacity-50"
              >
                {syncing ? 'Synkar...' : 'Synka ärenden'}
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-lg p-3 border border-emerald-500/20">
            <h3 className="text-sm font-semibold text-white mb-1">Behöver hjälp?</h3>
            <p className="text-slate-400 text-xs mb-2">Kontakta oss för akuta problem eller frågor.</p>
            <button className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
              Kontakta support
            </button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-lg p-3 border border-blue-500/20">
            <h3 className="text-sm font-semibold text-white mb-1">Rapporter & Dokumentation</h3>
            <p className="text-slate-400 text-xs mb-2">Ladda ner rapporter och dokumentation.</p>
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors">
              Visa rapporter
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}