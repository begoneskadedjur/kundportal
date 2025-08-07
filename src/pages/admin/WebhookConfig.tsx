// src/pages/admin/WebhookConfig.tsx - OneFlow Webhook Konfiguration Dashboard
import React, { useState, useEffect } from 'react'
import { Settings, Webhook, CheckCircle, XCircle, AlertTriangle, RefreshCw, Play } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import toast from 'react-hot-toast'

interface WebhookAnalysis {
  id: number
  callback_url: string
  sign_key_configured: boolean
  sign_key_matches: boolean
  template_group_id: number | null
  configured_events: string[]
  missing_events: string[]
  is_our_webhook: boolean
}

interface WebhookConfigData {
  webhooks: any[]
  analysis: WebhookAnalysis[]
  recommended_events: string[]
}

export default function WebhookConfig() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<WebhookConfigData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  // Ladda webhook-konfiguration
  const loadWebhookConfig = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log('🔄 Hämtar webhook-konfiguration...')
      const response = await fetch('/api/oneflow/webhook-config')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const result = await response.json()
      console.log('📦 Webhook config response:', result)

      if (!result.success) {
        throw new Error(result.error || 'Kunde inte hämta webhook-konfiguration')
      }

      // Validera att data har rätt struktur
      if (!result.data) {
        throw new Error('Ingen data returnerad från API')
      }
      
      if (!result.data.webhooks || !Array.isArray(result.data.webhooks)) {
        throw new Error('Webhook data har felaktig struktur')
      }

      setData(result.data)
      console.log('✅ Webhook-konfiguration laddad')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      setError(errorMessage)
      console.error('❌ Webhook config error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Uppdatera webhook med rekommenderade events
  const updateWebhookEvents = async (webhookId: number) => {
    try {
      setUpdating(true)

      const response = await fetch('/api/oneflow/webhook-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_events',
          webhook_id: webhookId
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Kunde inte uppdatera webhook')
      }

      toast.success('Webhook uppdaterad med nya event filters!')
      await loadWebhookConfig() // Ladda om data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      toast.error(`Fel vid uppdatering: ${errorMessage}`)
      console.error('Webhook update error:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Automatisk fix av befintlig webhook
  const autoFixWebhook = async () => {
    try {
      setUpdating(true)

      const response = await fetch('/api/oneflow/webhook-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'auto_fix_webhook'
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Kunde inte fixa webhook')
      }

      toast.success('Webhook automatiskt fixad!')
      await loadWebhookConfig() // Ladda om data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      toast.error(`Fel vid auto fix: ${errorMessage}`)
      console.error('Webhook auto fix error:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Skapa ny webhook
  const createWebhook = async () => {
    try {
      setUpdating(true)

      const response = await fetch('/api/oneflow/webhook-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create_webhook'
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Kunde inte skapa webhook')
      }

      toast.success('Ny webhook skapad!')
      await loadWebhookConfig() // Ladda om data

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Okänt fel'
      toast.error(`Fel vid skapande: ${errorMessage}`)
      console.error('Webhook create error:', err)
    } finally {
      setUpdating(false)
    }
  }

  useEffect(() => {
    loadWebhookConfig()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            OneFlow Webhook Konfiguration
          </h3>
        </div>
        
        <Card>
          <div className="h-40 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" />
            OneFlow Webhook Konfiguration
          </h3>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWebhookConfig}
            className="text-slate-400"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Försök igen
          </Button>
        </div>
        
        <Card className="bg-red-500/10 border-red-500/20">
          <div className="flex items-center text-red-400">
            <XCircle className="w-5 h-5 mr-2" />
            <div>
              <div className="font-medium">Fel vid laddning av webhook-konfiguration</div>
              <div className="text-sm text-red-300 mt-1">{error}</div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  const ourWebhook = data?.analysis.find(webhook => webhook.is_our_webhook)
  const hasCorrectEvents = ourWebhook && ourWebhook.missing_events.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" />
          OneFlow Webhook Konfiguration
        </h3>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWebhookConfig}
            className="text-slate-400"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Ladda om
          </Button>
          
          {!ourWebhook && (
            <Button
              variant="primary"
              size="sm"
              onClick={createWebhook}
              disabled={updating}
              className="flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Skapa Webhook
            </Button>
          )}
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`p-4 ${ourWebhook ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className="flex items-center gap-3">
            {ourWebhook ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
            <div>
              <div className="font-medium text-white">Webhook Status</div>
              <div className={`text-sm ${ourWebhook ? 'text-green-300' : 'text-red-300'}`}>
                {ourWebhook ? 'Webhook konfigurerad' : 'Ingen webhook hittad'}
              </div>
            </div>
          </div>
        </Card>

        <Card className={`p-4 ${ourWebhook?.sign_key_matches ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className="flex items-center gap-3">
            {ourWebhook?.sign_key_matches ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <XCircle className="w-8 h-8 text-red-400" />
            )}
            <div>
              <div className="font-medium text-white">Sign Key</div>
              <div className={`text-sm ${ourWebhook?.sign_key_matches ? 'text-green-300' : 'text-red-300'}`}>
                {ourWebhook?.sign_key_matches ? 'Korrekt konfigurerad' : 'Felaktig eller saknas'}
              </div>
            </div>
          </div>
        </Card>

        <Card className={`p-4 ${hasCorrectEvents ? 'bg-green-500/10 border-green-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
          <div className="flex items-center gap-3">
            {hasCorrectEvents ? (
              <CheckCircle className="w-8 h-8 text-green-400" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            )}
            <div>
              <div className="font-medium text-white">Events</div>
              <div className={`text-sm ${hasCorrectEvents ? 'text-green-300' : 'text-yellow-300'}`}>
                {hasCorrectEvents ? 'Alla events konfigurerade' : `${ourWebhook?.missing_events.length || 0} events saknas`}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Webhook Details */}
      {data?.analysis && data.analysis.length > 0 && (
        <Card>
          <div className="p-6">
            <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <Webhook className="w-5 h-5 text-blue-400" />
              Webhook Detaljer
            </h4>
            
            <div className="space-y-4">
              {data.analysis.map((webhook, index) => (
                <div key={webhook.id} className={`p-4 rounded-lg border ${webhook.is_our_webhook ? 'bg-blue-500/5 border-blue-500/20' : 'bg-slate-800 border-slate-700'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Webhook #{webhook.id}</span>
                      {webhook.is_our_webhook && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">Vår webhook</span>
                      )}
                    </div>
                    
                    {webhook.is_our_webhook && (webhook.missing_events.length > 0 || !webhook.sign_key_matches) && (
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => updateWebhookEvents(webhook.id)}
                          disabled={updating}
                          className="flex items-center gap-2"
                        >
                          <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                          Uppdatera Events
                        </Button>
                        
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={autoFixWebhook}
                          disabled={updating}
                          className="flex items-center gap-2"
                        >
                          <Settings className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                          Auto Fix
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-slate-400 mb-1">Callback URL:</div>
                      <div className="text-white font-mono text-xs bg-slate-900 p-2 rounded">
                        {webhook.callback_url}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 mb-1">Sign Key:</div>
                      <div className={`flex items-center gap-2 ${webhook.sign_key_matches ? 'text-green-400' : 'text-red-400'}`}>
                        {webhook.sign_key_configured ? (
                          webhook.sign_key_matches ? (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Konfigurerad och korrekt
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4" />
                              Konfigurerad men fel värde
                            </>
                          )
                        ) : (
                          <>
                            <XCircle className="w-4 h-4" />
                            Inte konfigurerad
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 mb-1">Konfigurerade Events ({webhook.configured_events.length}):</div>
                      <div className="flex flex-wrap gap-1">
                        {webhook.configured_events.map((event, i) => (
                          <span key={i} className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded">
                            {event}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-slate-400 mb-1">Saknade Events ({webhook.missing_events.length}):</div>
                      <div className="flex flex-wrap gap-1">
                        {webhook.missing_events.length > 0 ? webhook.missing_events.map((event, i) => (
                          <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded">
                            {event}
                          </span>
                        )) : (
                          <span className="text-green-400 text-xs">Inga saknade events</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Recommended Events */}
      {data?.recommended_events && (
        <Card>
          <div className="p-6">
            <h4 className="text-lg font-medium text-white mb-4">Rekommenderade Events</h4>
            <div className="text-sm text-slate-400 mb-3">
              Dessa events behövs för att automatisk contract creation ska fungera:
            </div>
            <div className="flex flex-wrap gap-2">
              {data.recommended_events.map((event, i) => (
                <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-300 text-sm rounded">
                  {event}
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}