// src/pages/admin/OneflowDiagnostics.tsx - Oneflow Diagnostik Dashboard
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, TestTube, CheckCircle, AlertCircle, RefreshCw,
  Settings, FileText, Building2, ExternalLink, Eye, Zap,
  Database, Wifi, Clock, Activity, Shield, Info
} from 'lucide-react'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import { useOneflowWebhook } from '../../hooks/useOneflowWebhook'
import toast from 'react-hot-toast'

interface DiagnosticsResult {
  success: boolean
  mode: string
  result?: any
  error?: string
}

interface EnvironmentCheck {
  name: string
  status: 'ok' | 'warning' | 'error'
  value?: string
  message: string
}

export default function OneflowDiagnostics() {
  const navigate = useNavigate()
  const { webhookLogs, loading: webhookLoading, refreshLogs } = useOneflowWebhook()

  const [activeTab, setActiveTab] = useState<'health' | 'templates' | 'webhooks' | 'environment'>('health')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<DiagnosticsResult | null>(null)
  const [templateId, setTemplateId] = useState('8486368')
  const [contractId, setContractId] = useState('')

  // Environment checks
  const [environmentChecks, setEnvironmentChecks] = useState<EnvironmentCheck[]>([])

  useEffect(() => {
    if (activeTab === 'health') {
      runHealthCheck()
    }
  }, [activeTab])

  const runDiagnostics = async (mode: string, params: any = {}) => {
    setLoading(true)
    setResults(null)

    try {
      const queryParams = new URLSearchParams({ mode, ...params })
      const response = await fetch(`/api/oneflow/diagnostics?${queryParams}`)
      const data = await response.json()

      setResults(data)
      
      if (data.success) {
        toast.success(`✅ ${mode.charAt(0).toUpperCase() + mode.slice(1)} diagnostik lyckades`)
      } else {
        toast.error(`❌ ${mode.charAt(0).toUpperCase() + mode.slice(1)} diagnostik misslyckades`)
      }
    } catch (error: any) {
      console.error('Diagnostik fel:', error)
      setResults({
        success: false,
        mode,
        error: error.message
      })
      toast.error(`❌ Diagnostik misslyckades: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const runHealthCheck = () => runDiagnostics('health')
  const runWorkspacesCheck = () => runDiagnostics('workspaces')
  const runTemplateCheck = () => runDiagnostics('template', { templateId })
  const runContractCheck = () => runDiagnostics('contract', { contractId })

  // Simulerad environment check (detta skulle vara från backend i verkligheten)
  useEffect(() => {
    const checks: EnvironmentCheck[] = [
      {
        name: 'ONEFLOW_API_TOKEN',
        status: 'ok', // Detta skulle kontrolleras mot backend
        message: 'API-token är konfigurerad'
      },
      {
        name: 'ONEFLOW_USER_EMAIL',
        status: 'ok',
        message: 'Användar-email är konfigurerad'
      },
      {
        name: 'ONEFLOW_WORKSPACE_ID',
        status: 'ok',
        message: 'Workspace ID är konfigurerad'
      },
      {
        name: 'ONEFLOW_WEBHOOK_SECRET',
        status: 'warning',
        message: 'Webhook secret är inte verifierad'
      }
    ]
    setEnvironmentChecks(checks)
  }, [])

  const StatusIcon = ({ status }: { status: 'ok' | 'warning' | 'error' }) => {
    switch (status) {
      case 'ok':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
    }
  }

  const formatWebhookEventType = (eventType: string) => {
    const eventMap: { [key: string]: string } = {
      'contract.published': '📧 Kontrakt publicerat',
      'contract.signed': '✍️ Kontrakt signerat',
      'contract.completed': '✅ Kontrakt färdigställt',
      'contract.rejected': '❌ Kontrakt avvisat',
      'webhook_processed': '🔄 Webhook processad',
      'signature_verification_failed': '🔒 Signaturverifiering misslyckades'
    }
    return eventMap[eventType] || eventType
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => navigate('/admin/customers')} 
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg">
                <TestTube className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Oneflow Diagnostik</h1>
                <p className="text-sm text-slate-400">Testa och övervaka Oneflow-integration</p>
              </div>
            </div>
            
            <div className="ml-auto">
              <Button
                onClick={refreshLogs}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                disabled={webhookLoading}
              >
                <RefreshCw className={`w-4 h-4 ${webhookLoading ? 'animate-spin' : ''}`} />
                Uppdatera
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-slate-800/50 p-1 rounded-lg">
          {[
            { id: 'health', label: 'Health Check', icon: Activity },
            { id: 'templates', label: 'Mallar', icon: FileText },
            { id: 'webhooks', label: 'Webhooks', icon: Zap },
            { id: 'environment', label: 'Miljövariabler', icon: Settings }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Vänster kolumn - Kontroller */}
          <div className="lg:col-span-1 space-y-6">
            {activeTab === 'health' && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-green-500" /> Health Check
                </h2>
                <div className="space-y-3">
                  <Button
                    onClick={runHealthCheck}
                    disabled={loading}
                    className="w-full flex items-center gap-2"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : <CheckCircle className="w-4 h-4" />}
                    Kör Health Check
                  </Button>
                  
                  <Button
                    onClick={runWorkspacesCheck}
                    disabled={loading}
                    variant="outline"
                    className="w-full flex items-center gap-2"
                  >
                    <Building2 className="w-4 h-4" />
                    Lista Arbetsytor
                  </Button>
                </div>
              </Card>
            )}

            {activeTab === 'templates' && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-500" /> Malldiagnostik
                </h2>
                <div className="space-y-4">
                  <Input
                    label="Mall-ID"
                    value={templateId}
                    onChange={e => setTemplateId(e.target.value)}
                    placeholder="t.ex. 8486368"
                  />
                  <Button
                    onClick={runTemplateCheck}
                    disabled={loading || !templateId}
                    className="w-full flex items-center gap-2"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : <Eye className="w-4 h-4" />}
                    Analysera Mall
                  </Button>
                  
                  <div className="text-xs text-slate-400">
                    <strong>Tillgängliga mallar:</strong><br />
                    • 8486368 - Skadedjursavtal<br />
                    • 10102378 - Komplett Skadedjursavtal<br />
                    • 9324573 - Avtal Betesstationer
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'webhooks' && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Zap className="w-5 h-5 text-yellow-500" /> Webhook Test
                </h2>
                <div className="space-y-4">
                  <Input
                    label="Kontrakt-ID (valfritt)"
                    value={contractId}
                    onChange={e => setContractId(e.target.value)}
                    placeholder="Filtrera på specifikt kontrakt"
                  />
                  <Button
                    onClick={runContractCheck}
                    disabled={loading || !contractId}
                    className="w-full flex items-center gap-2"
                  >
                    {loading ? <LoadingSpinner size="sm" /> : <Database className="w-4 h-4" />}
                    Analysera Kontrakt
                  </Button>
                  
                  <div className="bg-slate-800/50 p-3 rounded text-xs text-slate-400">
                    <div className="font-medium text-white mb-1">Webhook Status:</div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${webhookLogs.length > 0 ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      {webhookLogs.length > 0 
                        ? `${webhookLogs.length} webhooks mottagna`
                        : 'Inga webhooks mottagna än'
                      }
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {activeTab === 'environment' && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  <Settings className="w-5 h-5 text-purple-500" /> Miljövariabler
                </h2>
                <div className="space-y-3">
                  {environmentChecks.map((check, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded">
                      <StatusIcon status={check.status} />
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium">{check.name}</div>
                        <div className="text-slate-400 text-xs">{check.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Höger kolumn - Resultat */}
          <div className="lg:col-span-2 space-y-6">
            {/* Diagnostik resultat */}
            {results && (
              <Card>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                  {results.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  Diagnostik Resultat - {results.mode}
                </h2>
                
                {results.success ? (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <div className="text-green-400 font-medium mb-2">✅ Diagnostik lyckades</div>
                    
                    {results.result && (
                      <div className="space-y-4">
                        {/* Health check resultat */}
                        {results.mode === 'health' && results.result.api_connection && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">API Anslutning:</span>
                              <div className="text-green-400 font-medium">{results.result.api_connection}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Token Giltig:</span>
                              <div className="text-green-400 font-medium">
                                {results.result.token_valid ? 'Ja' : 'Nej'}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400">Arbetsytor:</span>
                              <div className="text-green-400 font-medium">
                                {results.result.workspaces_accessible ? 'Tillgängliga' : 'Ej tillgängliga'}
                              </div>
                            </div>
                            <div>
                              <span className="text-slate-400">Miljövariabler:</span>
                              <div className="text-green-400 font-medium">
                                {Object.values(results.result.environment).every(Boolean) ? 'Kompletta' : 'Saknas'}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Workspace resultat */}
                        {results.mode === 'workspaces' && results.result.workspaces && (
                          <div>
                            <div className="text-white font-medium mb-2">
                              Hittade {results.result.count} arbetsytor:
                            </div>
                            <div className="space-y-2">
                              {results.result.workspaces.map((ws: any, index: number) => (
                                <div key={index} className="bg-slate-800/50 p-3 rounded">
                                  <div className="text-white font-medium">
                                    {ws.name} {ws.is_default && '(Standard)'}
                                  </div>
                                  <div className="text-slate-400 text-sm">ID: {ws.id}</div>
                                </div>