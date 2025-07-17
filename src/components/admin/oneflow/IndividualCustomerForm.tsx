// 📁 src/components/admin/oneflow/IndividualCustomerForm.tsx
import React from 'react'
import { User, Mail, Phone, MapPin, Hash } from 'lucide-react'
import Input from '../../ui/Input'
import Button from '../../ui/Button'

interface IndividualCustomerData {
  Kontaktperson: string
  'e-post-kontaktperson': string
  'telefonnummer-kontaktperson': string
  'utforande-adress': string
  'org-nr': string  // Används för personnummer för privatpersoner
}

interface IndividualCustomerFormProps {
  data: IndividualCustomerData
  onChange: (field: string, value: string) => void
  disabled?: boolean
}

const IndividualCustomerForm: React.FC<IndividualCustomerFormProps> = ({
  data,
  onChange,
  disabled = false
}) => {
  // Snabbfyll för privatpersoner
  const fillTestPersonData = () => {
    const testData = {
      Kontaktperson: 'Anna Svensson',
      'e-post-kontaktperson': 'anna.svensson@email.se',
      'telefonnummer-kontaktperson': '070-123 45 67',
      'utforande-adress': 'Storgatan 15, 111 22 Stockholm',
      'org-nr': '19850315-1234'  // Personnummer istället för org.nr
    }
    
    Object.entries(testData).forEach(([field, value]) => {
      onChange(field, value)
    })
  }

  const fillTestPerson2Data = () => {
    const testData = {
      Kontaktperson: 'Erik Johansson',
      'e-post-kontaktperson': 'erik.johansson@gmail.com',
      'telefonnummer-kontaktperson': '073-987 65 43',
      'utforande-adress': 'Vasagatan 8, 411 37 Göteborg',
      'org-nr': '19780622-5678'  // Personnummer istället för org.nr
    }
    
    Object.entries(testData).forEach(([field, value]) => {
      onChange(field, value)
    })
  }

  // Validering för privatperson
  const isValid = () => {
    return data.Kontaktperson.trim() !== '' && 
           data['e-post-kontaktperson'].trim() !== ''
  }

  const missingFields = () => {
    const required = [
      { field: 'Kontaktperson', label: 'Namn' },
      { field: 'e-post-kontaktperson', label: 'E-post' }
    ]
    
    return required.filter(item => !data[item.field as keyof IndividualCustomerData]?.trim()).map(item => item.label)
  }

  return (
    <div className="space-y-6">
      {/* Personuppgifter */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Personuppgifter</h3>
        
        <Input 
          label="Namn *" 
          value={data.Kontaktperson} 
          onChange={e => onChange('Kontaktperson', e.target.value)}
          icon={<User className="w-4 h-4" />}
          required
          disabled={disabled}
          placeholder="Förnamn Efternamn"
        />

        <Input 
          label="Personnummer" 
          value={data['org-nr']} 
          onChange={e => onChange('org-nr', e.target.value)}
          icon={<Hash className="w-4 h-4" />}
          disabled={disabled}
          placeholder="YYYYMMDD-XXXX"
        />
        
        <Input 
          label="E-post *" 
          type="email" 
          value={data['e-post-kontaktperson']} 
          onChange={e => onChange('e-post-kontaktperson', e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          required
          disabled={disabled}
          placeholder="namn@email.se"
        />
        
        <Input 
          label="Telefon" 
          type="tel" 
          value={data['telefonnummer-kontaktperson']} 
          onChange={e => onChange('telefonnummer-kontaktperson', e.target.value)}
          icon={<Phone className="w-4 h-4" />}
          disabled={disabled}
          placeholder="070-123 45 67"
        />
        
        <Input 
          label="Adress" 
          value={data['utforande-adress']} 
          onChange={e => onChange('utforande-adress', e.target.value)}
          icon={<MapPin className="w-4 h-4" />}
          disabled={disabled}
          placeholder="Gatuadress, Postnummer Stad"
        />
      </div>

      {/* Validering och feedback */}
      {!isValid() && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 text-orange-400 text-sm">
            <User className="w-4 h-4" />
            <span>Obligatoriska fält saknas: {missingFields().join(', ')}</span>
          </div>
        </div>
      )}

      {/* Snabbfyll för privatpersoner */}
      <div className="bg-slate-800/30 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">⚡ Snabbfyll Testpersoner</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fillTestPersonData}
            disabled={disabled}
            className="text-xs"
          >
            👤 Anna S.
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fillTestPerson2Data}
            disabled={disabled}
            className="text-xs"
          >
            👤 Erik J.
          </Button>
        </div>
      </div>

      {/* Information för privatpersoner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 text-blue-400 text-sm">
          <Hash className="w-4 h-4" />
          <span>Avtal för privatperson - personnummer används för identifiering</span>
        </div>
      </div>
    </div>
  )
}

export default IndividualCustomerForm