// 📁 src/components/admin/oneflow/CompanyCustomerForm.tsx
import React from 'react'
import { Building2, Hash, User, Mail, Phone, MapPin } from 'lucide-react'
import Input from '../../ui/Input'
import Button from '../../ui/Button'

interface CompanyCustomerData {
  foretag: string
  'org-nr': string
  Kontaktperson: string
  'e-post-kontaktperson': string
  'telefonnummer-kontaktperson': string
  'utforande-adress': string
}

interface CompanyCustomerFormProps {
  data: CompanyCustomerData
  onChange: (field: string, value: string) => void
  disabled?: boolean
}

const CompanyCustomerForm: React.FC<CompanyCustomerFormProps> = ({
  data,
  onChange,
  disabled = false
}) => {
  // Snabbfyll funktioner för företag
  const fillRestaurantData = () => {
    const restaurantData = {
      foretag: 'Bella Vista Ristorante AB',
      'org-nr': '556789-0123',
      Kontaktperson: 'Giuseppe Romano',
      'e-post-kontaktperson': 'giuseppe@bellavista.se',
      'telefonnummer-kontaktperson': '08-555 0123',
      'utforande-adress': 'Kungsgatan 25, 111 56 Stockholm'
    }
    
    Object.entries(restaurantData).forEach(([field, value]) => {
      onChange(field, value)
    })
  }

  const fillHotelData = () => {
    const hotelData = {
      foretag: 'Grand Hotel Stockholm AB',
      'org-nr': '556456-1234',
      Kontaktperson: 'Elisabeth Andersson',
      'e-post-kontaktperson': 'elisabeth@grandhotel.se',
      'telefonnummer-kontaktperson': '08-679 3500',
      'utforande-adress': 'Södra Blasieholmshamnen 8, 103 27 Stockholm'
    }
    
    Object.entries(hotelData).forEach(([field, value]) => {
      onChange(field, value)
    })
  }

  // Validering för företag
  const isValid = () => {
    return data.foretag.trim() !== '' && 
           data['e-post-kontaktperson'].trim() !== '' &&
           data.Kontaktperson.trim() !== ''
  }

  const missingFields = () => {
    const required = [
      { field: 'foretag', label: 'Företagsnamn' },
      { field: 'e-post-kontaktperson', label: 'E-post' },
      { field: 'Kontaktperson', label: 'Kontaktperson' }
    ]
    
    return required.filter(item => !data[item.field as keyof CompanyCustomerData]?.trim()).map(item => item.label)
  }

  return (
    <div className="space-y-6">
      {/* Företagsinformation */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Företagsinformation</h3>
        
        <Input 
          label="Företagsnamn *" 
          value={data.foretag} 
          onChange={e => onChange('foretag', e.target.value)}
          icon={<Building2 className="w-4 h-4" />}
          required
          disabled={disabled}
          placeholder="AB Företagsnamn"
        />
        
        <Input 
          label="Organisationsnummer" 
          value={data['org-nr']} 
          onChange={e => onChange('org-nr', e.target.value)}
          icon={<Hash className="w-4 h-4" />}
          disabled={disabled}
          placeholder="556123-4567"
        />
      </div>

      {/* Kontaktperson */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-300 mb-3">Kontaktuppgifter</h3>
        
        <Input 
          label="Kontaktperson *" 
          value={data.Kontaktperson} 
          onChange={e => onChange('Kontaktperson', e.target.value)}
          icon={<User className="w-4 h-4" />}
          required
          disabled={disabled}
          placeholder="Förnamn Efternamn"
        />
        
        <Input 
          label="E-post *" 
          type="email" 
          value={data['e-post-kontaktperson']} 
          onChange={e => onChange('e-post-kontaktperson', e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          required
          disabled={disabled}
          placeholder="kontakt@foretag.se"
        />
        
        <Input 
          label="Telefon" 
          type="tel" 
          value={data['telefonnummer-kontaktperson']} 
          onChange={e => onChange('telefonnummer-kontaktperson', e.target.value)}
          icon={<Phone className="w-4 h-4" />}
          disabled={disabled}
          placeholder="08-555 0123"
        />
        
        <Input 
          label="Utförande adress" 
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
            <Hash className="w-4 h-4" />
            <span>Obligatoriska fält saknas: {missingFields().join(', ')}</span>
          </div>
        </div>
      )}

      {/* Snabbfyll för företag */}
      <div className="bg-slate-800/30 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">⚡ Snabbfyll Företagsdata</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fillRestaurantData}
            disabled={disabled}
            className="text-xs"
          >
            🍝 Restaurang
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fillHotelData}
            disabled={disabled}
            className="text-xs"
          >
            🏨 Hotell
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CompanyCustomerForm