import React, { useState } from 'react'
import { ArrowLeft, TestTube, Eye, FileText, Building2, Mail, Phone, MapPin, Calendar, Send, CheckCircle, ExternalLink } from 'lucide-react'
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
  
  // Förifyllda värden för snabb testning
  const [selectedTemplate, setSelectedTemplate] = useState('8486368')
  const [contractData, setContractData] = useState<ContractData>({
    anstalld: 'Christian Karlsson',
    avtalslngd: '3',
    avtalsobjekt: '9st mekaniska fällor',
    begynnelsedag: '2025-07-17',
    'dokument-skapat': new Date().toISOString().split('T')[0],
    'e-post-anstlld': 'christian.karlsson@begone.se',
    'e-post-kontaktperson': 'christian.karlsson@hotmail.se',
    'faktura-adress-pdf': 'test@faktura.se',
    foretag: 'Testkund',
    kontaktperson: 'Test kontaktperson',
    'org-nr': '002233-4455',
    'stycke-1': 'Standardpunkt 1',
    'telefonnummer-kontaktperson': '0704466235',
    'utforande-adress': 'Rankhusvägen 31, 196 31 Kungsängen',
  })
  const [recipient, setRecipient] = useState<Recipient>({
    name: contractData.kontaktperson,
    email: contractData['e-post-kontaktperson'],
    company_name: contractData.foretag,
    organization_number: contractData['org-nr'],
  })

  const [partyType, setPartyType] = useState<'company' | 'individual'>('company')
  const [sendForSigning, setSendForSigning] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [createdContract, setCreatedContract] = useState<any>(null)

  // Uppdatera formulärdata
  const handleInputChange = (field: string, value: string) => {
    setContractData(prev => ({ ...prev, [field]: value }))
    // Om fält ingår i recipient, uppdatera recipient
    if (field === 'kontaktperson' || field === 'e-post-kontaktperson' || field === 'foretag' || field === 'org-nr') {
      setRecipient(prev => ({
        ...prev,
        name: field === 'kontaktperson' ? value : prev.name,
        email: field === 'e-post-kontaktperson' ? value : prev.email,
        company_name: field === 'foretag' ? value : prev.company_name,
        organization_number: field === 'org-nr' ? value : prev.organization_number,
      }))
    }
  }

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
        body: JSON.stringify({ templateId: selectedTemplate, contractData, recipient, sendForSigning, partyType })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Ett okänt serverfel inträffade')
      }
      const result = await response.json()
      setCreatedContract(result.contract)
      toast.success('✅ Kontrakt skapat!')
    } catch (err: any) {
      console.error('Fel vid skapande av kontrakt:', err)
      toast.error(`❌ Fel: ${err.message}`)
    } finally {
      setIsCreating(false)
    }
  }

  const handlePreview = () => {
    setPreviewData(contractData)
    setShowPreview(true)
    toast.success('Mappning genererad!')
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="secondary" size="sm" onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Tillbaka
            </Button>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <TestTube className="w-6 h-6" /> Oneflow Test
            </h1>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8 grid lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><FileText className="w-5 h-5 text-blue-500" /> Välj Mall</h2>
            <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white">
              <option value="">-- Välj mall --</option>
              {ONEFLOW_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Building2 className="w-5 h-5 text-green-500" /> Data Fields</h2>
            <div className="space-y-4">
              {Object.entries(contractData).map(([key, value]) => (
                <Input
                  key={key}
                  label={key.replace(/-/g, ' ')}
                  type={key.includes('e-post') ? 'email' : key.includes('telefonnummer') ? 'tel' : key.includes('dag') ? 'date' : 'text'}
                  value={value}
                  onChange={e => handleInputChange(key, e.target.value)}
                />
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Mail className="w-5 h-5 text-red-500" /> Mottagare</h2>
            <div className="mb-4">
              <label className="text-sm text-white mb-2 block">Typ av motpart</label>
              <div className="flex gap-4">
                <label className="flex items-center space-x-2 text-white"><input type="radio" checked={partyType==='company'} onChange={()=>setPartyType('company')} /> Företag</label>
                <label className="flex items-center space-x-2 text-white"><input type="radio" checked={partyType==='individual'} onChange={()=>setPartyType('individual')} /> Privatperson</label>
              </div>
            </div>
            <div className="space-y-4">
              <Input label="Namn" type="text" value={recipient.name} onChange={e=>setRecipient(prev=>({...prev, name:e.target.value}))} />
              <Input label="E-post" type="email" value={recipient.email} onChange={e=>setRecipient(prev=>({...prev, email:e.target.value}))} />
              {partyType==='company' && (
                <>
                  <Input label="Företag" type="text" value={recipient.company_name} onChange={e=>setRecipient(prev=>({...prev, company_name:e.target.value}))} />
                  <Input label="Org.nr" type="text" value={recipient.organization_number} onChange={e=>setRecipient(prev=>({...prev, organization_number:e.target.value}))} />
                </>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Send className="w-5 h-5 text-yellow-400" /> Signeringsalternativ</h2>
            <label className="flex items-center space-x-2 text-white">
              <input type="checkbox" checked={sendForSigning} onChange={()=>setSendForSigning(prev=>!prev)} /> Skicka för signering direkt
            </label>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handlePreview} className="flex items-center gap-2"><Eye className="w-4 h-4" /> Förhandsgranska</Button>
            <Button disabled={isCreating} onClick={handleCreateContract} className="flex items-center gap-2">
              {isCreating?<LoadingSpinner size="sm"/>:<CheckCircle className="w-4 h-4"/>} {sendForSigning?'Skapa & skicka':'Skapa utkast'}
            </Button>
          </div>
        </div>
        <div className="space-y-6">
          {showPreview && <Card><h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><Eye className="w-5 h-5 text-cyan-400"/> Förhandsgranskning</h2><pre className="text-xs text-slate-400 bg-slate-800/50 p-4 rounded overflow-x-auto">{JSON.stringify(previewData,null,2)}</pre></Card>}
          {createdContract && <Card><h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4"><CheckCircle className="w-5 h-5 text-green-400"/> Kontrakt skapat!</h3><div className="space-y-2 text-sm text-white"><p>ID: <span className="font-mono">{createdContract.id}</span></p><p>Namn: {createdContract.name}</p><p>Status: {createdContract.state}</p><Button onClick={()=>window.open(createdContract.url, '_blank')} className="w-full flex items-center justify-center gap-2 mt-2"><ExternalLink className="w-4 h-4"/> Öppna i Oneflow</Button></div></Card>}
        </div>
      </main>
    </div>
  )
}
