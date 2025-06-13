import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useCustomerData } from '../hooks/useCustomerData'
import { useClickUpSync } from '../hooks/useClickUpSync'
import type { Case } from '../types' // FIXAD: Tog bort oanvänd Visit import

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
} as const

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
} as const

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { cases, customer, stats, loading, reloadCustomerData } = useCustomerData()
  const { syncTasks, testClickUp, syncing, testing, lastSync } = useClickUpSync()

  const [selectedCase, setSelectedCase] = useState<Case | null>(null)

  const handleSignOut = async () => {
    await signOut()
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Okänt datum'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }
  
  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'Okänt datum'
    return new Date(dateString).toLocaleDateString('sv-SE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusText = (status: Case['status']) => {
    const statusMap = {
      pending: 'Väntande',
      in_progress: 'Pågående',
      completed: 'Avslutad',
    }
    return statusMap[status] || status
  }

  const handleTestClickUp = async () => {
    console.log('Testing ClickUp connection...')
    const result = await testClickUp()

    if (result.success) {
      alert(`✅ ClickUp connection successful!\n\nFound ${result.lists?.length || 0} lists. Check console (F12) for details.`)
    } else {
      alert(`❌ ClickUp test failed: ${result.error}`)
    }
  }

  const handleSyncClickUp = async () => {
    if (!customer?.id || !customer.clickup_list_id) {
      alert('❌ Fel: Kundprofilen saknar ett kopplat ClickUp List ID.\n\nKontakta administratör för att konfigurera detta.')
      return
    }

    const result = await syncTasks(customer.clickup_list_id, customer.company_name)

    if (result.success) {
      const message = `✅ Sync lyckades för "${customer.clickup_list_name || customer.company_name}"!\n\n` +
        `📊 Totalt: ${result.count} ärenden\n` +
        `🆕 Skapade: ${result.created}\n` +
        `🔄 Uppdaterade: ${result.updated}\n` +
        `⏭️ Hoppade över: ${result.skipped}\n` +
        `${result.errors && result.errors > 0 ? `⚠️ Fel: ${result.errors}` : ''}`

      alert(message)
      reloadCustomerData() // Använd den nya funktionen för att ladda om data
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
  
  // Modal för att visa ärendedetaljer
  const CaseDetailModal = ({ case_item, onClose }: { case_item: Case | null; onClose: () => void }) => {
    if (!case_item) return null

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full text-white" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-lg font-bold">{case_item.title} (#{case_item.case_number})</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white">×</button>
          </div>
          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-slate-300">{case_item.description || 'Ingen beskrivning tillgänglig.'}</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="font-semibold text-slate-400">Status</p>
                <p>{getStatusText(case_item.status)}</p>
              </div>
               <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="font-semibold text-slate-400">Skadedjur</p>
                <p>{case_item.pest_type || '-'}</p>
              </div>
               <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="font-semibold text-slate-400">Plats</p>
                <p>{case_item.location_details || '-'}</p>
              </div>
               <div className="bg-slate-700/50 p-3 rounded-lg">
                <p className="font-semibold text-slate-400">Skapat</p>
                <p>{formatDateTime(case_item.created_date)}</p>
              </div>
            </div>
            
            <h3 className="text-md font-semibold pt-4 border-t border-slate-700">Besökshistorik</h3>
            {case_item.visits && case_item.visits.length > 0 ? (
                <div className="space-y-3">
                  {case_item.visits.map(visit => (
                    <div key={visit.id} className="bg-slate-700/50 p-3 rounded-lg">
                       <p className="font-semibold">{formatDate(visit.visit_date)} - {visit.technician_name || 'Okänd tekniker'}</p>
                       <p className="text-sm text-slate-300 mt-1"><strong>Fynd:</strong> {visit.findings || '-'}</p>
                       <p className="text-sm text-slate-300"><strong>Åtgärd:</strong> {visit.work_performed || '-'}</p>
                    </div>
                  ))}
                </div>
            ) : <p className="text-slate-400 text-sm">Inga besök registrerade för detta ärende.</p> }
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <CaseDetailModal case_item={selectedCase} onClose={() => setSelectedCase(null)} />

      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">BeGone</h1>
                <p className="text-xs text-slate-400">{customer ? customer.company_name : 'Kundportal'}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-right">
                <p className="text-sm text-white">{user?.email}</p>
                <p className="text-xs text-slate-400">Inloggad</p>
              </div>
              <button onClick={handleSignOut} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Logga ut
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
                <p className="text-xl font-bold text-white">{stats?.activeCases || 0}</p>
              </div>
              <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                 <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg p-2 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Nästa besök</p>
                <p className="text-sm font-semibold text-white">
                  {stats?.nextVisit?.visit_date ? formatDate(stats.nextVisit.visit_date) : 'Inga'}
                </p>
              </div>
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                 <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-800/80 to-slate-800/40 backdrop-blur-xl rounded-lg p-2 border border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium">Avslutade ärenden</p>
                <p className="text-xl font-bold text-white">{stats?.completedCases || 0}</p>
              </div>
              <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
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
              <div className="p-6 text-center text-slate-400">Inga ärenden hittades. Prova att synka från ClickUp.</div>
            ) : (
              cases.map((case_item) => (
                <div key={case_item.id} className="p-3 border-b border-slate-700/30 last:border-b-0 hover:bg-slate-700/20 transition-colors cursor-pointer" onClick={() => setSelectedCase(case_item)}>
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
                        <span>Skadedjur: {case_item.pest_type || '-'}</span>
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
            <p className="text-slate-400 text-xs mb-2">{lastSync ? `Senast: ${lastSync.toLocaleTimeString('sv-SE')}` : 'Aldrig synkat'}</p>
            <div className="space-y-1">
              <button onClick={handleTestClickUp} disabled={testing} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full disabled:opacity-50">
                {testing ? 'Testar...' : 'Testa ClickUp'}
              </button>
              <button onClick={handleSyncClickUp} disabled={syncing} className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full disabled:opacity-50">
                {syncing ? 'Synkar...' : 'Synka från ClickUp'}
              </button>
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 rounded-lg p-3 border border-emerald-500/20">
            <h3 className="text-sm font-semibold text-white mb-1">Hjälp & Support</h3>
            <p className="text-slate-400 text-xs mb-2">Kontakta oss vid frågor</p>
            <div className="space-y-1">
              <button onClick={() => window.open('tel:DIN_TELEFONNUMMER', '_self')} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full">
                Ring oss
              </button>
              <button onClick={() => window.open('mailto:DIN_EPOST', '_self')} className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded text-xs font-medium transition-colors w-full">
                Skicka meddelande
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}