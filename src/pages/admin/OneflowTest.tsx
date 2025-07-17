// src/pages/admin/OneflowTest.tsx - Testa kontraktsskapande utan att spara
import React, { useState } from 'react'
import { ArrowLeft, TestTube, Eye, FileText, Building2, User, Mail, Phone, MapPin, Calendar } from 'lucide-react'
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

// Dina exakta datafält med ID:n
const ONEFLOW_FIELD_MAPPING = {
  'foretag': { id: '15a28bab-5d17-4f3a-b021-fb9e4b5d6840', label: 'Företag', type: 'text' },
  'org-nr': { id: '978226a1-6a53-4162-87b8-61e74ff10b61', label: 'Organisationsnummer', type: 'text' },
  'kontaktperson': { id: '0da9f741-02d1-4372-84ca-02f4a76c1dbb', label: 'Kontaktperson', type: 'text' },
  'e-post-kontaktperson': { id: '8d8dac3a-18ab-4019-9ada-8c843e696ba2', label: 'E-post kontaktperson', type: 'email' },
  'telefonnummer-kontaktperson': { id: 'cc29ae86-0a6c-4703-a45f-21a065e05a16', label: 'Telefonnummer', type: 'tel' },
  'utforande-adress': { id: '80ec7903-f636-43b0-bf7e-09c9888eb6b6', label: 'Utförande adress', type: 'textarea' },
  'faktura-adress-pdf': { id: '101d137e-236c-43c9-bf11-d14749ac8f4b', label: 'Faktura adress', type: 'textarea' },
  'avtalslngd': { id: 'cdaa9624-2b43-410a-a5e5-aec724d65bb0', label: 'Avtalslängd (år)', type: 'number' },
  'begynnelsedag': { id: 'f612ef4c-299f-4ce0-b5b3-d99fb30aea0e', label: 'Begynnelsedag', type: 'date' },
  'avtalsobjekt': { id: '288c2e67-c6a0-44e6-9fa8-d9742627f82e', label: 'Avtalsobjekt', type: 'textarea' },
  'anstlld': { id: 'b0a5c543-f554-41b2-8401-e0dd272cffed', label: 'Anställd', type: 'text' },
  'e-post-anstlld': { id: 'c6941ca5-86d0-48f1-b903-7042e9e5a36e', label: 'E-post anställd', type: 'email' }
}

interface ContractData {
  [key: string]: string
}

export default function OneflowTest() {
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [contractData, setContractData] = useState<ContractData>({})
  const [isCreating, setIsCreating] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Uppdatera formulärdata
  const handleInputChange = (fieldKey: string, value: string) => {
    setContractData(prev => ({
      ...prev,
      [fieldKey]: value
    }))
  }

  // Förhandsgranska mappning
  const handlePreview = () => {
    const mappedData = mapContractData(contractData)
    setPreviewData(mappedData)
    setShowPreview(true)
    toast.success('Mappning genererad! Se förhandsgranskning till höger.')
  }

  // Mappa Oneflow-data till customers-format
  const mapContractData = (data: ContractData) => {
    const mapped = {
      // Grundinformation
      company_name: data['foretag'] || '',
      org_number: data['org-nr'] || '',
      contact_person: data['kontaktperson'] || '',
      email: data['e-post-kontaktperson'] || '',
      phone: data['telefonnummer-kontaktperson'] || '',
      address: data['utforande-adress'] || '',
      
      // Avtalsinformation
      contract_start_date: data['begynnelsedag'] || '',
      contract_length_months: data['avtalslngd'] ? parseInt(data['avtalslngd']) * 12 : 36,
      service_description: data['avtalsobjekt'] || '',
      assigned_account_manager: data['anstlld'] || 'Kristian Agnevik',
      
      // Oneflow-specifikt
      oneflow_contract_id: 'TEST_' + Date.now(),
      oneflow_data_fields: data,
      contract_status: 'active',
      
      // Beräknat
      contract_end_date: calculateEndDate(data['begynnelsedag'], data['avtalslngd']),
      business_type: detectBusinessType(data['avtalsobjekt']),
      
      // Extra fält
      invoicing_address: data['faktura-adress-pdf'] || data['utforande-adress'] || '',
      account_manager_email: data['e-post-anstlld'] || 'kristian.agnevik@begone.se'
    }
    
    return mapped
  }

  // Hjälpfunktioner
  const calculateEndDate = (startDate: string, lengthYears: string) => {
    if (!startDate || !lengthYears) return ''
    try {
      const start = new Date(startDate)
      const years = parseInt(lengthYears)
      const end = new Date(start)
      end.setFullYear(end.getFullYear() + years)
      return end.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  const detectBusinessType = (avtalsobjekt: string) => {
    const text = avtalsobjekt.toLowerCase()
    if (text.includes('gård') || text.includes('lantbruk')) return 'Jordbruk'
    if (text.includes('restaurang') || text.includes('kök')) return 'Restaurang och hotell'
    if (text.includes('skola') || text.includes('förskola')) return 'Utbildning'
    if (text.includes('industri') || text.includes('fabrik')) return 'Industri'
    if (text.includes('bygg') || text.includes('anläggning')) return 'Bygg och anläggning'
    if (text.includes('vård') || text.includes('sjukhus')) return 'Vård och omsorg'
    return 'Övrigt'
  }

  // Testa att skapa kontrakt (utan att spara)
  const handleTestCreate = async () => {
    if (!selectedTemplate) {
      toast.error('Välj en mall först')
      return
    }

    if (!contractData['foretag'] || !contractData['e-post-kontaktperson']) {
      toast.error('Fyll i minst företag och e-post')
      return
    }

    setIsCreating(true)
    
    try {
      // Simulera API-anrop
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      const mappedData = mapContractData(contractData)
      console.log('🧪 Test Contract Data:', mappedData)
      
      toast.success('Test lyckades! Kontraktsdata loggad i konsolen.')
      setPreviewData(mappedData)
      setShowPreview(true)
      
    } catch (error) {
      toast.error('Test misslyckades')
      console.error('Test error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
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
                <p className="text-slate-400">Testa kontraktsskapande utan att spara någonting</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Vänster kolumn - Formulär */}
          <div className="space-y-6">
            
            {/* Mall-val */}
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
                  <option key={template.id} value={template.id}>
                    {template.name} (ID: {template.id})
                  </option>
                ))}
              </select>
            </Card>

            {/* Företagsinformation */}
            <Card>
              <div className="flex items-center mb-4">
                <Building2 className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Företagsinformation</h2>
              </div>
              
              <div className="space-y-4">
                <Input
                  label="Företag *"
                  type="text"
                  value={contractData['foretag'] || ''}
                  onChange={(e) => handleInputChange('foretag', e.target.value)}
                  placeholder="Bobacken Gård AB"
                />
                
                <Input
                  label="Organisationsnummer"
                  type="text"
                  value={contractData['org-nr'] || ''}
                  onChange={(e) => handleInputChange('org-nr', e.target.value)}
                  placeholder="559319-3757"
                />
                
                <Input
                  label="Kontaktperson"
                  type="text"
                  value={contractData['kontaktperson'] || ''}
                  onChange={(e) => handleInputChange('kontaktperson', e.target.value)}
                  placeholder="Marcus Jansson"
                />
                
                <Input
                  label="E-post kontaktperson *"
                  type="email"
                  value={contractData['e-post-kontaktperson'] || ''}
                  onChange={(e) => handleInputChange('e-post-kontaktperson', e.target.value)}
                  placeholder="marcus@bobackengard.se"
                />
                
                <Input
                  label="Telefonnummer"
                  type="tel"
                  value={contractData['telefonnummer-kontaktperson'] || ''}
                  onChange={(e) => handleInputChange('telefonnummer-kontaktperson', e.target.value)}
                  placeholder="0761135055"
                />
              </div>
            </Card>

            {/* Adresser */}
            <Card>
              <div className="flex items-center mb-4">
                <MapPin className="w-5 h-5 text-orange-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Adressinformation</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Utförande adress
                  </label>
                  <textarea
                    value={contractData['utforande-adress'] || ''}
                    onChange={(e) => handleInputChange('utforande-adress', e.target.value)}
                    placeholder="Bobacken 1, 762 91 Rimbo, Sverige"
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Faktura adress
                  </label>
                  <textarea
                    value={contractData['faktura-adress-pdf'] || ''}
                    onChange={(e) => handleInputChange('faktura-adress-pdf', e.target.value)}
                    placeholder="inbox.lev.1158481@arkivplats.se"
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>

            {/* Avtalsinformation */}
            <Card>
              <div className="flex items-center mb-4">
                <Calendar className="w-5 h-5 text-purple-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Avtalsinformation</h2>
              </div>
              
              <div className="space-y-4">
                <Input
                  label="Begynnelsedag"
                  type="date"
                  value={contractData['begynnelsedag'] || ''}
                  onChange={(e) => handleInputChange('begynnelsedag', e.target.value)}
                />
                
                <Input
                  label="Avtalslängd (år)"
                  type="number"
                  value={contractData['avtalslngd'] || ''}
                  onChange={(e) => handleInputChange('avtalslngd', e.target.value)}
                  placeholder="3"
                  min="1"
                  max="10"
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Avtalsobjekt
                  </label>
                  <textarea
                    value={contractData['avtalsobjekt'] || ''}
                    onChange={(e) => handleInputChange('avtalsobjekt', e.target.value)}
                    placeholder="Placering av 9 stycken betesstationer innehållande rodenticider..."
                    rows={4}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </Card>

            {/* Personal */}
            <Card>
              <div className="flex items-center mb-4">
                <User className="w-5 h-5 text-indigo-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Personal</h2>
              </div>
              
              <div className="space-y-4">
                <Input
                  label="Anställd"
                  type="text"
                  value={contractData['anstlld'] || ''}
                  onChange={(e) => handleInputChange('anstlld', e.target.value)}
                  placeholder="Kristian Agnevik"
                />
                
                <Input
                  label="E-post anställd"
                  type="email"
                  value={contractData['e-post-anstlld'] || ''}
                  onChange={(e) => handleInputChange('e-post-anstlld', e.target.value)}
                  placeholder="kristian.agnevik@begone.se"
                />
              </div>
            </Card>

            {/* Test-knappar */}
            <div className="flex gap-3">
              <Button
                onClick={handlePreview}
                variant="outline"
                className="flex items-center gap-2"
                disabled={!contractData['foretag']}
              >
                <Eye className="w-4 h-4" />
                Förhandsgranska mappning
              </Button>
              
              <Button
                onClick={handleTestCreate}
                disabled={isCreating || !selectedTemplate}
                className="flex items-center gap-2"
              >
                {isCreating ? <LoadingSpinner size="sm" /> : <TestTube className="w-4 h-4" />}
                Testa skapa kontrakt
              </Button>
            </div>
          </div>

          {/* Höger kolumn - Förhandsgranskning */}
          <div className="space-y-6">
            <Card>
              <div className="flex items-center mb-4">
                <Eye className="w-5 h-5 text-green-500 mr-2" />
                <h2 className="text-lg font-semibold text-white">Förhandsgranskning</h2>
              </div>
              
              {showPreview && previewData ? (
                <div className="space-y-4">
                  <div className="bg-slate-800/50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-300 mb-3">Mapped Customer Data:</h3>
                    <pre className="text-xs text-slate-400 overflow-x-auto">
                      {JSON.stringify(previewData, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Företag:</span>
                      <p className="text-white">{previewData.company_name || 'Ej angivet'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Verksamhetstyp:</span>
                      <p className="text-white">{previewData.business_type}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Avtalslängd:</span>
                      <p className="text-white">{previewData.contract_length_months} månader</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Slutdatum:</span>
                      <p className="text-white">{previewData.contract_end_date || 'Ej beräknat'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">
                  <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Fyll i formuläret och klicka "Förhandsgranska mappning"</p>
                </div>
              )}
            </Card>

            {/* Test resultat */}
            {previewData && (
              <Card>
                <h3 className="text-lg font-semibold text-white mb-4">Test Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Vald mall:</span>
                    <span className="text-white">{ONEFLOW_TEMPLATES.find(t => t.id === selectedTemplate)?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Test ID:</span>
                    <span className="text-white">{previewData.oneflow_contract_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="text-green-400">Endast test - ej sparat</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}