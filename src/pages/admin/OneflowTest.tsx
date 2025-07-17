// src/pages/admin/OneflowTest.tsx - KOMPLETT VERSION MED VAL FÖR PART-TYP
import React, { useState } from 'react'
import { ArrowLeft, TestTube, Eye, FileText, Building2, User, Mail, Phone, MapPin, Calendar, Send, CheckCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import toast from 'react-hot-toast'

// Dina exakta Oneflow-mallar
const ONEFLOW_TEMPLATES = [
  { id: '8486368', name: 'Skadedjursavtal' },
  { id: '9324573', name: 'Avtal Betesstationer' },
  { id: '8465556', name: 'Avtal Betongstationer' },
  { id: '8462854', name: 'Avtal Mekaniska fällor' },
  { id: '10102378', name: 'Komplett Skadedjursavtal' },
  { id: '8732196', name: 'Skadedjursavtal indikationsfällor' }
]

interface ContractData {
  [key: string]: string
}

interface Recipient {
  name: string
  email: string
  company_name: string
  organization_number: string
}

export default function OneflowTest() {
  const navigate = useNavigate()
  
  // Hårdkodade värden för snabb och pålitlig testning
  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [contractData, setContractData] = useState<ContractData>({
    'foretag': 'Testkund AB',
    'org-nr': '556677-1234',
    'kontaktperson': 'Testperson Testsson',
    'e-post-kontaktperson': 'christian.karlsson@hotmail.se',
    'telefonnummer-kontaktperson': '070-123 45 67',
    'utforande-adress': 'Testgatan 1, 123 45 Teststad',
    'faktura-adress-pdf': 'faktura@testkund.se',
    'begynnelsedag': '2025-08-01',
    'avtalslngd': '3',
    'avtalsobjekt': 'Test av 9st mekaniska fällor med full service.',
    'anstlld': 'Christian Karlsson',
    'e-post-anstlld': 'christian.karlsson@begone.se'
  })
  const [recipient, setRecipient] = useState<Recipient>({
    name: 'Testperson Testsson',
    email: 'christian.karlsson@hotmail.se',
    company_name: 'Testkund AB',
    organization_number: '556677-1234'
  })
  
  // NYTT: State för att välja part-typ
  const [partyType, setPartyType] = useState<'company' | 'individual'>('company');

  const [sendForSigning, setSendForSigning] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)

  const handleInputChange = (fieldKey: string, value: string) => {
    setContractData(prev => ({ ...prev, [fieldKey]: value }))
  }

  const handleRecipientChange = (field: keyof Recipient, value: string) => {
    setRecipient(prev => ({ ...prev, [field]: value }))
  }

  const handleCreateContract = async () => {
    if (!selectedTemplate) {
      toast.error('Välj en mall först')
      return
    }
    if (!recipient.email) {
      toast.error('Fyll i minst mottagarens e-post')
      return
    }

    setIsCreating(true)
    
    try {
      const response = await fetch('/api/oneflow-create-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          contractData,
          recipient,
          sendForSigning,
          partyType // Skicka med vald part-typ
        })
      })

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Ett okänt serverfel inträffade');
      }

      const result = await response.json();
      setCreatedContract(result.contract);
      toast.success(`✅ Kontrakt skapat!`);
      
    } catch (error) {
      console.error('Fel vid skapande av kontrakt:', error);
      toast.error(`❌ Fel: ${error instanceof Error ? error.message : 'Okänt fel'}`);
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => navigate('/admin/dashboard')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TestTube className="w-6 h-6" />
                  Oneflow Test
                </h1>
                <p className="text-slate-400">Testa kontraktsskapande</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <div className="space-y-6">
            
            <Card>
              <div className="flex items-center mb-4">
                <FileText className="w-5 h-5 text-blue-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Välj Avtals-mall</h2>
              </div>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Välj mall --</option>
                {ONEFLOW_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </Card>

            <Card>
              <div className="flex items-center mb-4">
                <Building2 className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Företagsinformation</h2>
              </div>
              <div className="space-y-4">
                <Input label="Företag *" type="text" value={contractData['foretag'] || ''} onChange={(e) => handleInputChange('foretag', e.target.value)} />
                <Input label="Organisationsnummer" type="text" value={contractData['org-nr'] || ''} onChange={(e) => handleInputChange('org-nr', e.target.value)} />
              </div>
            </Card>

            <Card>
              <div className="flex items-center mb-4">
                <Mail className="w-5 h-5 text-red-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Mottagare (Signering)</h2>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Typ av motpart</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 text-white">
                    <input type="radio" name="party-type" value="company" checked={partyType === 'company'} onChange={() => setPartyType('company')} className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"/>
                    <span>Företag</span>
                  </label>
                  <label className="flex items-center space-x-2 text-white">
                    <input type="radio" name="party-type" value="individual" checked={partyType === 'individual'} onChange={() => setPartyType('individual')} className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"/>
                    <span>Privatperson</span>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <Input label="Mottagarens namn *" type="text" value={recipient.name} onChange={(e) => handleRecipientChange('name', e.target.value)} />
                <Input label="Mottagarens e-post *" type="email" value={recipient.email} onChange={(e) => handleRecipientChange('email', e.target.value)} />
                {partyType === 'company' && (
                  <>
                    <Input label="Företagsnamn för signering" type="text" value={recipient.company_name} onChange={(e) => handleRecipientChange('company_name', e.target.value)} />
                    <Input label="Org.nr för signering" type="text" value={recipient.organization_number} onChange={(e) => handleRecipientChange('organization_number', e.target.value)} />
                  </>
                )}
              </div>
            </Card>
            
            <div className="flex gap-3">
              <Button onClick={handleCreateContract} disabled={isCreating} className="flex items-center gap-2">
                {isCreating ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                {sendForSigning ? 'Skapa & skicka kontrakt' : 'Skapa som utkast'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-6">
            {createdContract && (
              <Card>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  Kontrakt skapat!
                </h3>
                <div className="space-y-3">
                  <p><strong className="text-slate-400">ID:</strong> <span className="text-white font-mono">{createdContract.id}</span></p>
                  <p><strong className="text-slate-400">Namn:</strong> <span className="text-white">{createdContract.name}</span></p>
                  <p><strong className="text-slate-400">Status:</strong> <span className="text-white font-semibold">{createdContract.state}</span></p>
                  <Button onClick={() => window.open(createdContract.url, '_blank')} className="w-full flex items-center gap-2 mt-4">
                    <ExternalLink className="w-4 h-4" />
                    Öppna i Oneflow
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}