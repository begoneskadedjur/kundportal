// src/pages/admin/TestEdgeFunction.tsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function TestEdgeFunction() {
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const navigate = useNavigate()

  const testMinimalFunction = async () => {
    setLoading(true)
    setError('')
    setResponse(null)

    try {
      console.log('Testing edge function...')
      
      const { data, error } = await supabase.functions.invoke('test-function', {
        body: { test: 'data', timestamp: new Date().toISOString() }
      })

      console.log('Raw response:', { data, error })

      if (error) {
        throw error
      }

      setResponse(data)
    } catch (err: any) {
      console.error('Test error:', err)
      setError(err.message || 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  const testCreateCustomer = async () => {
    setLoading(true)
    setError('')
    setResponse(null)

    try {
      console.log('Testing create-customer-complete...')
      
      // Testdata med Betongstationer
      const testData = {
        company_name: 'Test Betongstation AB',
        org_number: '556677-8899',
        contact_person: 'Test Person',
        email: `test${Date.now()}@example.com`, // Unik e-post
        phone: '0701234567',
        address: 'Testgatan 1, 12345 Teststad',
        contract_type_id: '21ed7bc7-e767-48e3-b981-4305b1ae7141' // Betongstationer
      }

      const { data, error } = await supabase.functions.invoke('create-customer-complete', {
        body: testData
      })

      console.log('Raw response:', { data, error })

      if (error) {
        throw error
      }

      setResponse(data)
    } catch (err: any) {
      console.error('Test error:', err)
      setError(err.message || 'Ett fel uppstod')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka
          </Button>
          
          <h1 className="text-3xl font-bold text-white">Test Edge Functions</h1>
        </div>

        <div className="space-y-6">
          {/* Test minimal function */}
          <Card>
            <h2 className="text-xl font-semibold text-white mb-4">
              Test Minimal Function
            </h2>
            <p className="text-slate-400 mb-4">
              Testar om Edge Functions överhuvudtaget fungerar
            </p>
            <Button
              onClick={testMinimalFunction}
              loading={loading}
              disabled={loading}
            >
              Testa test-function
            </Button>
          </Card>

          {/* Test create customer */}
          <Card>
            <h2 className="text-xl font-semibold text-white mb-4">
              Test Create Customer
            </h2>
            <p className="text-slate-400 mb-4">
              Testar create-customer-complete funktionen med Betongstationer
            </p>
            <Button
              onClick={testCreateCustomer}
              loading={loading}
              disabled={loading}
              variant="secondary"
            >
              Testa create-customer-complete
            </Button>
          </Card>

          {/* Response/Error display */}
          {error && (
            <Card className="border-red-500/50">
              <h3 className="text-lg font-semibold text-red-500 mb-2">Fel:</h3>
              <pre className="text-red-400 text-sm whitespace-pre-wrap">{error}</pre>
            </Card>
          )}

          {response && (
            <Card className="border-green-500/50">
              <h3 className="text-lg font-semibold text-green-500 mb-2">Svar:</h3>
              <pre className="text-green-400 text-sm whitespace-pre-wrap">
                {JSON.stringify(response, null, 2)}
              </pre>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}