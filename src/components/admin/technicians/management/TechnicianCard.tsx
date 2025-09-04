import { useState, useEffect } from 'react' // useEffect lades till för att hantera klick utanför
import { 
  User, Mail, Phone, MapPin, MoreVertical, Edit, 
  Trash2, Power, Key, UserCheck, Send, Clock, UserX // ✅ UserX behövs för varning
} from 'lucide-react'
import Button from '../../../ui/Button'
import Card from '../../../ui/Card'
import { technicianManagementService, type Technician } from '../../../../services/technicianManagementService'

// ✅ PROP-TYPEN ÄR UPPDATERAD
type TechnicianCardProps = {
  technician: Technician
  onEdit: (technician: Technician) => void
  onToggleStatus: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
  onManageAuth: (technician: Technician) => void
  onManageWorkSchedule: (technician: Technician) => void // ✅ NY PROP FÖR ARBETSSCHEMA
}

export default function TechnicianCard({ 
  technician, 
  onEdit, 
  onToggleStatus, 
  onDelete,
  onManageAuth,
  onManageWorkSchedule // ✅ NY PROP TILLAGD
}: TechnicianCardProps) {
  const [showDropdown, setShowDropdown] = useState(false)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'VD': return 'bg-purple-500/20 text-purple-400'
      case 'Marknad & Försäljningschef': return 'bg-blue-500/20 text-blue-400'
      case 'Regionchef Dalarna': return 'bg-orange-500/20 text-orange-400'
      case 'Koordinator/kundtjänst': return 'bg-green-500/20 text-green-400'
      case 'Skadedjurstekniker': return 'bg-cyan-500/20 text-cyan-400'
      default: return 'bg-slate-500/20 text-slate-400'
    }
  }

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    if (showDropdown) {
      const handleClick = () => setShowDropdown(false)
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [showDropdown])

  return (
    <Card className={`transition-all duration-200 ${!technician.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-slate-300" />
            </div>
            {/* Login Status Indicator */}
            {technician.has_login && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Key className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">{technician.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${getRoleColor(technician.role)}`}>
                {technician.role}
              </span>
              {technician.has_login && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-500/20 text-green-400">
                  <Key className="w-3 h-3 mr-1" />
                  Inloggning
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setShowDropdown(!showDropdown)
            }}
            className="hover:bg-slate-700"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-lg z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(technician)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2 rounded-t-lg"
              >
                <Edit className="w-4 h-4" />
                Redigera uppgifter
              </button>
              
              {/* ✅ NY KNAPP FÖR ARBETSSCHEMA */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onManageWorkSchedule(technician)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Hantera arbetstider
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onManageAuth(technician)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                {technician.has_login ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Hantera inloggning
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Skicka inbjudan
                  </>
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleStatus(technician.id, !technician.is_active)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <Power className="w-4 h-4" />
                {technician.is_active ? 'Inaktivera' : 'Aktivera'}
              </button>
              
              <div className="border-t border-slate-600 my-1"></div>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (window.confirm(`Är du säker på att du vill ta bort ${technician.name}? All historik kopplad till personen kommer att förloras.`)) {
                    onDelete(technician.id)
                  }
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2 rounded-b-lg"
              >
                <Trash2 className="w-4 h-4" />
                Ta bort permanent
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Kontaktinformation */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <a 
            href={`mailto:${technician.email}`} 
            className="text-slate-300 hover:text-white transition-colors truncate"
            title={technician.email}
          >
            {technician.email}
          </a>
        </div>
        
        {technician.direct_phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <a 
              href={`tel:${technicianManagementService.formatPhoneForLink(technician.direct_phone)}`} 
              className="text-slate-300 hover:text-white transition-colors"
              title="Ring direkt"
            >
              {technicianManagementService.formatPhoneForDisplay(technician.direct_phone)} (direkt)
            </a>
          </div>
        )}
        
        {technician.office_phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <a 
              href={`tel:${technicianManagementService.formatPhoneForLink(technician.office_phone)}`} 
              className="text-slate-300 hover:text-white transition-colors"
              title="Ring kontor"
            >
              {technicianManagementService.formatPhoneForDisplay(technician.office_phone)} (kontor)
            </a>
          </div>
        )}
        
        {technician.address && (
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span className="text-slate-300 text-sm leading-relaxed">
              {technician.address}
            </span>
          </div>
        )}

        {/* Display Name om den skiljer sig från namnet */}
        {technician.display_name && technician.display_name !== technician.name && (
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-300 text-sm">
              Visas som: {technician.display_name}
            </span>
          </div>
        )}
      </div>

      {/* Status footer */}
      <div className="mt-4 pt-3 border-t border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
            technician.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {technician.is_active ? 'Aktiv' : 'Inaktiv'}
          </span>
          
          {/* Quick Invitation Action */}
          {!technician.has_login && technician.is_active && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onManageAuth(technician)}
              className="text-xs py-1 px-2 h-6 border-teal-500/50 text-teal-400 hover:bg-teal-500/10"
              title="Skicka inbjudan via mail till denna tekniker"
            >
              <Send className="w-3 h-3 mr-1" />
              Bjud in
            </Button>
          )}
        </div>
        
        <span className="text-xs text-slate-500">
          Skapad: {new Date(technician.created_at).toLocaleDateString('sv-SE')}
        </span>
      </div>

      {/* Warning för inaktiva tekniker med inloggning */}
      {!technician.is_active && technician.has_login && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-xs font-medium">
              Inaktiv men har fortfarande inloggning
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}