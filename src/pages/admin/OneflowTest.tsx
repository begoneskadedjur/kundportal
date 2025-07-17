// src/pages/admin/OneflowTest.tsx - KOMPLETT OCH KORRIGERAD VERSION
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
  
  // Hårdkodade värden för snabb testning
  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [contractData, setContractData] = useState<ContractData>({
    'foretag': 'Testkund',
    'org-nr': '002233-4455',
    'kontaktperson': 'Test kontaktperson',
    'e-post-kontaktperson': 'christian.karlsson@hotmail.se',
    'telefonnummer-kontaktperson': '0704466235',
    'utforande-adress': 'Rankhusvägen 31, 196 31 Kungsängen',
    'faktura-adress-pdf': 'test@faktura.se',
    'begynnelsedag': '2025-07-17',
    'avtalslngd': '3',
    'avtalsobjekt': '9st mekaniska fällor',
    'anstlld': 'Christian Karlsson',
    'e-post-anstlld': 'christian.karlsson@begone.se'
  })
  const [recipient, setRecipient] = useState<Recipient>({
    name: 'Test kontaktperson',
    email: 'christian.karlsson@hotmail.se',
    company_name: 'Testkund',
    organization_number: '002233-4455'
  })

  // State för att välja part-typ
  const [partyType, setPartyType] = useState<'company' | 'individual'>('company');

  const [sendForSigning, setSendForSigning] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)

  // Uppdatera formulärdata
  const handleInputChange = (fieldKey: string, value: string) => {
    setContractData(prev => ({ ...prev, [fieldKey]: value }))
  }

  // Uppdatera mottagare
  const handleRecipientChange = (field: keyof Recipient, value: string) => {
    setRecipient(prev => ({ ...prev, [field]: value }))
  }

  // Förhandsgranska mappning
  const handlePreview = () => {
    const mappedData = mapContractData(contractData)
    setPreviewData(mappedData)
    setShowPreview(true)
    toast.success('Mappning genererad! Se förhandsgranskning till höger.')
  }

  // Mappa Oneflow-data till customers-format (behålls för din preview-logik)
  const mapContractData = (data: ContractData) => ({
    company_name: data['foretag'] || '',
    org_number: data['org-nr'] || '',
    contact_person: data['kontaktperson'] || '',
    email: data['e-post-kontaktperson'] || '',
    phone: data['telefonnummer-kontaktperson'] || '',
    address: data['utforande-adress'] || '',
    contract_start_date: data['begynnelsedag'] || '',
    contract_length_months: data['avtalslngd'] ? parseInt(data['avtalslngd']) * 12 : 36,
    service_description: data['avtalsobjekt'] || '',
    assigned_account_manager: data['anstlld'] || 'Kristian Agnevik',
    oneflow_contract_id: 'PREVIEW_' + Date.now(),
    contract_status: 'active',
    contract_end_date: calculateEndDate(data['begynnelsedag'], data['avtalslngd']),
    business_type: detectBusinessType(data['avtalsobjekt']),
    invoicing_address: data['faktura-adress-pdf'] || data['utforande-adress'] || '',
    account_manager_email: data['e-post-anstlld'] || 'kristian.agnevik@begone.se'
  })

  // Hjälpfunktioner för preview
  const calculateEndDate = (startDate: string, lengthYears: string) => {
    if (!startDate || !lengthYears) return ''
    try {
      const start = new Date(startDate);
      const end = new Date(start.setFullYear(start.getFullYear() + parseInt(lengthYears)));
      return end.toISOString().split('T')[0]
    } catch { return '' }
  }

  const detectBusinessType = (text: string) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('gård') || lowerText.includes('lantbruk')) return 'Jordbruk';
    return 'Övrigt';
  }

  // Skapa riktigt kontrakt i Oneflow
  const handleCreateContract = async () => {
    if (!selectedTemplate || !recipient.email) {
      toast.error('Välj mall och fyll i Mottagarens e-post.')
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
          partyType // Skickar med den nya informationen
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
              <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" /> Tillbaka
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <TestTube className="w-6 h-6" /> Oneflow Test
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
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><FileText className="w-5 h-5 text-blue-500" /> Välj Avtals-mall</h2>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500">
                <option value="">-- Välj mall --</option>
                {ONEFLOW_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-green-500" /> Företagsinformation</h2>
              <div className="space-y-4">
                <Input label="Företag *" type="text" value={contractData['foretag'] || ''} onChange={(e) => handleInputChange('foretag', e.target.value)} />
                <Input label="Organisationsnummer" type="text" value={contractData['org-nr'] || ''} onChange={(e) => handleInputChange('org-nr', e.target.value)} />
                <Input label="Kontaktperson" type="text" value={contractData['kontaktperson'] || ''} onChange={(e) => handleInputChange('kontaktperson', e.target.value)} />
                <Input label="E-post kontaktperson *" type="email" value={contractData['e-post-kontaktperson'] || ''} onChange={(e) => handleInputChange('e-post-kontaktperson', e.target.value)} />
                <Input label="Telefonnummer" type="tel" value={contractData['telefonnummer-kontaktperson'] || ''} onChange={(e) => handleInputChange('telefonnummer-kontaktperson', e.target.value)} />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Mail className="w-5 h-5 text-red-500" /> Mottagare (Signering)</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-2">Typ av motpart</label>
                <div className="flex gap-4">
                  <label className="flex items-center space-x-2 text-white"><input type="radio" name="party-type" value="company" checked={partyType === 'company'} onChange={() => setPartyType('company')} className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"/><span>Företag</span></label>
                  <label className="flex items-center space-x-2 text-white"><input type="radio" name="party-type" value="individual" checked={partyType === 'individual'} onChange={() => setPartyType('individual')} className="w-4 h-4 text-blue-500 bg-slate-800 border-slate-600"/><span>Privatperson</span></label>
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
              <Button onClick={handlePreview} variant="outline" className="flex items-center gap-2"><Eye className="w-4 h-4" /> Förhandsgranska</Button>
              <Button onClick={handleCreateContract} disabled={isCreating} className="flex items-center gap-2">
                {isCreating ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                {sendForSigning ? 'Skapa & skicka' : 'Skapa utkast'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-6">
            {showPreview && (
                <Card>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Eye className="w-5 h-5 text-cyan-400"/> Förhandsgranskning av Mappning</h2>
                    <pre className="text-xs text-slate-400 bg-slate-800/50 p-4 rounded-lg overflow-x-auto">{JSON.stringify(previewData, null, 2)}</pre>
                </Card>
            )}
            {createdContract && (
              <Card>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-400" /> Kontrakt skapat!</h3>
                <div className="space-y-3 text-sm">
                  <p><strong className="text-slate-400">ID:</strong> <span className="text-white font-mono">{createdContract.id}</span></p>
                  <p><strong className="text-slate-400">Namn:</strong> <span className="text-white">{createdContract.name}</span></p>
                  <p><strong className="text-slate-400">Status:</strong> <span className="text-white font-semibold">{createdContract.state}</span></p>
                  <Button onClick={() => window.open(createdContract.url, '_blank')} className="w-full flex items-center justify-center gap-2 mt-4"><ExternalLink className="w-4 h-4" /> Öppna i Oneflow</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}