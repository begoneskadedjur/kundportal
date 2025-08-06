// src/components/admin/contracts/StorageSetupCard.tsx - Komponent för att sätta upp contract-files storage
import React, { useState, useEffect } from 'react'
import { Settings, CheckCircle, AlertTriangle, Database, RefreshCw } from 'lucide-react'
import Card from '../../ui/Card'
import Button from '../../ui/Button'
import { setupContractFilesStorage, verifyContractFilesStorage } from '../../../utils/setupContractFilesStorage'
import toast from 'react-hot-toast'

export default function StorageSetupCard() {
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [setupResult, setSetupResult] = useState<any>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)

  // Automatisk verifiering vid mount
  useEffect(() => {
    handleVerify()
  }, [])

  const handleSetup = async () => {
    setIsSettingUp(true)
    setSetupResult(null)
    
    try {
      const result = await setupContractFilesStorage()
      setSetupResult(result)
      
      if (result.success) {
        toast.success(result.message)
        // Verifiera direkt efter setup
        handleVerify()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      console.error('Setup error:', error)
      toast.error('Oväntat fel vid setup')
      setSetupResult({
        success: false,
        message: 'Oväntat fel vid setup av storage'
      })
    } finally {
      setIsSettingUp(false)
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    
    try {
      const result = await verifyContractFilesStorage()
      setVerificationResult(result)
      
      if (result.isSetup) {
        console.log('✅ Storage verification successful')
      } else {
        console.warn('⚠️ Storage verification failed:', result.message)
      }
    } catch (error) {
      console.error('Verification error:', error)
      setVerificationResult({
        isSetup: false,
        message: 'Fel vid verifiering av storage'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const getStatusColor = () => {
    if (!verificationResult) return 'text-slate-400'
    return verificationResult.isSetup ? 'text-green-400' : 'text-red-400'
  }

  const getStatusIcon = () => {
    if (isVerifying) return <RefreshCw className="w-5 h-5 animate-spin" />
    if (!verificationResult) return <Database className="w-5 h-5 text-slate-400" />
    return verificationResult.isSetup 
      ? <CheckCircle className="w-5 h-5 text-green-400" />
      : <AlertTriangle className="w-5 h-5 text-red-400" />
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Settings className="w-6 h-6 text-blue-400" />
        <h3 className="text-lg font-semibold text-white">Contract Files Storage Setup</h3>
      </div>

      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
          {getStatusIcon()}
          <div className="flex-1">
            <div className={`font-medium ${getStatusColor()}`}>
              {verificationResult?.isSetup ? 'Storage Konfigurerat' : 'Storage Behöver Konfiguration'}
            </div>
            <div className="text-sm text-slate-400">
              {verificationResult?.message || 'Kontrollerar storage-status...'}
            </div>
          </div>
        </div>

        {/* Details */}
        {verificationResult && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Bucket existerar:</span>
              <span className={verificationResult.bucketExists ? 'text-green-400' : 'text-red-400'}>
                {verificationResult.bucketExists ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Kan ladda upp:</span>
              <span className={verificationResult.canUpload ? 'text-green-400' : 'text-red-400'}>
                {verificationResult.canUpload ? '✅' : '❌'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Kan ladda ner:</span>
              <span className={verificationResult.canDownload ? 'text-green-400' : 'text-red-400'}>
                {verificationResult.canDownload ? '✅' : '❌'}
              </span>
            </div>
          </div>
        )}

        {/* Setup Result */}
        {setupResult && (
          <div className={`p-3 rounded-lg border ${
            setupResult.success 
              ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            <div className="font-medium mb-1">
              {setupResult.success ? 'Setup Lyckades!' : 'Setup Misslyckades'}
            </div>
            <div className="text-sm opacity-90">
              {setupResult.message}
            </div>
            {setupResult.details && (
              <details className="mt-2 text-xs opacity-75">
                <summary className="cursor-pointer">Detaljer</summary>
                <pre className="mt-1 whitespace-pre-wrap">
                  {JSON.stringify(setupResult.details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            onClick={handleSetup}
            disabled={isSettingUp}
            variant="primary"
            size="sm"
          >
            {isSettingUp ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Sätter upp...
              </>
            ) : (
              <>
                <Database className="w-4 h-4 mr-2" />
                Sätt upp Storage
              </>
            )}
          </Button>

          <Button
            onClick={handleVerify}
            disabled={isVerifying}
            variant="ghost"
            size="sm"
          >
            {isVerifying ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Kontrollera Status
          </Button>
        </div>

        {/* Instructions */}
        {verificationResult && !verificationResult.isSetup && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="text-amber-400 font-medium mb-2">Manuell Setup Krävs</div>
            <div className="text-sm text-amber-300 mb-3">
              Om automatisk setup misslyckades, behöver du köra dessa SQL-kommandon i Supabase SQL Editor:
            </div>
            <div className="text-xs text-amber-200 bg-amber-500/10 p-2 rounded font-mono overflow-x-auto">
              {`-- Aktivera RLS för storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy för att läsa contract-files
CREATE POLICY "contract_files_read_policy" ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'contract-files');

-- Policy för att ladda upp contract-files  
CREATE POLICY "contract_files_upload_policy" ON storage.objects FOR INSERT
TO authenticated WITH CHECK (bucket_id = 'contract-files');`}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}