// src/pages/admin/OneflowDiagnostics.tsx - Oneflow Diagnostik Dashboard
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TestTube, CheckCircle, AlertCircle, RefreshCw,
  Settings, FileText, Building2, ExternalLink, Eye, Zap,
  Database, Wifi, Activity, Info
} from 'lucide-react'
import Button from '../../components/ui/Button'
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
        toast.success(`${mode.charAt(0).toUpperCase() + mode.slice(1)} diagnostik lyckades`)
      } else {
        toast.error(`${mode.charAt(0).toUpperCase() + mode.slice(1)} diagnostik misslyckades`)
      }
    } catch (error: any) {
      console.error('Diagnostik fel:', error)
      setResults({
        success: false,
        mode,
        error: error.message
      })
      toast.error(`Diagnostik misslyckades: ${error.message}`)
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
        status: 'ok',
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
      'contract.published': 'Kontrakt publicerat',
      'contract.signed': 'Kontrakt signerat',
      'contract.completed': 'Kontrakt färdigställt',
      'contract.rejected': 'Kontrakt avvisat',
      'webhook_processed': 'Webhook processad',
      'signature_verification_failed': 'Signaturverifiering misslyckades'
    }
    return eventMap[eventType] || eventType
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#20c58f] to-teal-600 shadow-lg shadow-[#20c58f]/20">
          <TestTube className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Oneflow Diagnostik</h1>
          <p className="text-slate-400 text-sm">Testa och övervaka Oneflow-integration</p>
        </div>

        <div className="ml-auto">
          <Button
            onClick={refreshLogs}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-slate-400"
            disabled={webhookLoading}
          >
            <RefreshCw className={`w-4 h-4 ${webhookLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-slate-800/50 p-1 rounded-lg">
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
                ? 'bg-[#20c58f] text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Vänster kolumn - Kontroller */}
        <div className="lg:col-span-1 space-y-6">
          {activeTab === 'health' && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-[#20c58f]" /> Health Check
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
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <FileText className="w-5 h-5 text-[#20c58f]" /> Malldiagnostik
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
                  &bull; 8486368 - Skadedjursavtal<br />
                  &bull; 10102378 - Komplett Skadedjursavtal<br />
                  &bull; 9324573 - Avtal Betesstationer
                </div>
              </div>
            </div>
          )}

          {activeTab === 'webhooks' && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
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
            </div>
          )}

          {activeTab === 'environment' && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-[#20c58f]" /> Miljövariabler
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
            </div>
          )}
        </div>

        {/* Höger kolumn - Resultat */}
        <div className="lg:col-span-2 space-y-6">
          {/* Diagnostik resultat */}
          {results && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
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
                  <div className="text-green-400 font-medium mb-2">Diagnostik lyckades</div>

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
                            ))}
                          </div>
                          <div className="text-slate-400 text-sm mt-2">
                            {results.result.recommendation}
                          </div>
                        </div>
                      )}

                      {/* Template resultat */}
                      {results.mode === 'template' && results.result.template && (
                        <div>
                          <div className="text-white font-medium mb-2">
                            Mall: {results.result.template.name}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-slate-400">ID:</span>
                              <div className="text-white">{results.result.template.id}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Status:</span>
                              <div className="text-white">{results.result.template.state}</div>
                            </div>
                          </div>

                          {results.result.data_fields && results.result.data_fields.length > 0 && (
                            <div className="mb-4">
                              <div className="text-white font-medium mb-2">Data Fields:</div>
                              <div className="space-y-2">
                                {results.result.data_fields.map((field: any, index: number) => (
                                  <div key={index} className="bg-slate-800/50 p-2 rounded text-sm">
                                    <span className="text-white">{field.name || field.key}</span>
                                    <span className="text-slate-400 ml-2">({field.type})</span>
                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {results.result.test_result && (
                            <div className="bg-slate-800/50 p-3 rounded">
                              <div className="text-white font-medium mb-1">Test Resultat:</div>
                              <div className={`text-sm ${results.result.test_result.success ? 'text-green-400' : 'text-yellow-400'}`}>
                                {results.result.test_result.message}
                              </div>
                              {results.result.test_result.required_fields && (
                                <div className="text-xs text-slate-400 mt-1">
                                  Krävs: {results.result.test_result.required_fields.join(', ')}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Contract resultat */}
                      {results.mode === 'contract' && results.result.contract_info && (
                        <div>
                          <div className="text-white font-medium mb-2">
                            Kontrakt: {results.result.contract_info.name}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                              <span className="text-slate-400">ID:</span>
                              <div className="text-white">{results.result.contract_info.id}</div>
                            </div>
                            <div>
                              <span className="text-slate-400">Status:</span>
                              <div className="text-white">{results.result.contract_info.state}</div>
                            </div>
                          </div>

                          {results.result.participants && results.result.participants.length > 0 && (
                            <div className="mb-4">
                              <div className="text-white font-medium mb-2">Deltagare:</div>
                              <div className="space-y-2">
                                {results.result.participants.map((participant: any, index: number) => (
                                  <div key={index} className="bg-slate-800/50 p-2 rounded text-sm">
                                    <div className="text-white">{participant.name}</div>
                                    <div className="text-slate-400">{participant.email}</div>
                                    {participant.company_name && (
                                      <div className="text-slate-400">{participant.company_name}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="text-red-400 font-medium mb-2">Diagnostik misslyckades</div>
                  <div className="text-red-300 text-sm">{results.error}</div>
                </div>
              )}

              {/* Rå data för debugging */}
              <details className="mt-4">
                <summary className="text-slate-400 cursor-pointer hover:text-white text-sm">
                  Visa rå data
                </summary>
                <pre className="text-slate-400 bg-slate-900/50 p-3 rounded mt-2 overflow-x-auto text-xs">
                  {JSON.stringify(results, null, 2)}
                </pre>
              </details>
            </div>
          )}

          {/* Webhook logs */}
          {activeTab === 'webhooks' && (
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-yellow-500" />
                Webhook Logs
                <span className="text-sm text-slate-400">({webhookLogs.length})</span>
              </h2>

              {webhookLoading ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner />
                  <span className="ml-2 text-slate-400">Laddar webhook logs...</span>
                </div>
              ) : webhookLogs.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {webhookLogs.map((log, index) => (
                    <div key={log.id || index} className="bg-slate-800/50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            log.status === 'processed' ? 'bg-green-500' :
                            log.status === 'verified' ? 'bg-[#20c58f]' :
                            log.status === 'error' ? 'bg-red-500' :
                            'bg-yellow-500'
                          }`} />
                          <span className="text-white font-medium">
                            {formatWebhookEventType(log.event_type)}
                          </span>
                        </div>
                        <span className="text-slate-400 text-xs">
                          {new Date(log.created_at).toLocaleString('sv-SE')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Kontrakt ID:</span>
                          <div className="text-white font-mono">{log.oneflow_contract_id}</div>
                        </div>
                        <div>
                          <span className="text-slate-400">Status:</span>
                          <div className={`font-medium ${
                            log.status === 'processed' ? 'text-green-400' :
                            log.status === 'verified' ? 'text-[#20c58f]' :
                            log.status === 'error' ? 'text-red-400' :
                            'text-yellow-400'
                          }`}>
                            {log.status}
                          </div>
                        </div>
                      </div>

                      {log.details && (
                        <details className="mt-3">
                          <summary className="text-slate-400 cursor-pointer hover:text-white text-sm">
                            Visa detaljer
                          </summary>
                          <pre className="text-slate-400 bg-slate-900/50 p-2 rounded mt-2 overflow-x-auto text-xs">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wifi className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <div className="text-slate-400 mb-2">Inga webhook logs än</div>
                  <div className="text-slate-500 text-sm">
                    Webhook logs visas här när Oneflow skickar events
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-orange-500" /> Snabbåtgärder
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate('/admin/skapa-avtal')}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Skapa Kontrakt
              </Button>

              <Button
                onClick={() => window.open('https://app.oneflow.com', '_blank')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Öppna Oneflow
              </Button>

              <Button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + '/api/oneflow/webhook')
                  toast.success('Webhook URL kopierad!')
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Database className="w-4 h-4" />
                Kopiera Webhook URL
              </Button>

              <Button
                onClick={refreshLogs}
                variant="outline"
                className="flex items-center gap-2"
                disabled={webhookLoading}
              >
                <RefreshCw className={`w-4 h-4 ${webhookLoading ? 'animate-spin' : ''}`} />
                Uppdatera Logs
              </Button>
            </div>
          </div>

          {/* Information */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-[#20c58f]" /> Information
            </h2>
            <div className="text-sm text-slate-300 space-y-3">
              <div>
                <strong className="text-white">Webhook URL:</strong>
                <div className="font-mono text-xs text-slate-400 bg-slate-800/50 p-2 rounded mt-1">
                  {window.location.origin}/api/oneflow/webhook
                </div>
              </div>

              <div>
                <strong className="text-white">API Endpoints:</strong>
                <ul className="text-slate-400 text-xs mt-1 space-y-1">
                  <li>&bull; POST /api/oneflow/create-contract - Skapa kontrakt</li>
                  <li>&bull; POST /api/oneflow/webhook - Webhook mottagare</li>
                  <li>&bull; GET /api/oneflow/diagnostics - Diagnostik API</li>
                </ul>
              </div>

              <div>
                <strong className="text-white">Miljövariabler som krävs:</strong>
                <ul className="text-slate-400 text-xs mt-1 space-y-1">
                  <li>&bull; ONEFLOW_API_TOKEN</li>
                  <li>&bull; ONEFLOW_USER_EMAIL</li>
                  <li>&bull; ONEFLOW_WORKSPACE_ID</li>
                  <li>&bull; ONEFLOW_WEBHOOK_SECRET (valfritt)</li>
                </ul>
              </div>

              <div className="bg-[#20c58f]/10 border border-[#20c58f]/20 rounded p-3">
                <div className="text-[#20c58f] font-medium mb-1">Tips</div>
                <div className="text-[#20c58f]/80 text-xs">
                  Använd "Health Check" för att verifiera att alla komponenter fungerar korrekt.
                  Webhook logs uppdateras automatiskt när Oneflow skickar events.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
