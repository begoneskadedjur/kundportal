import { useState, useEffect } from 'react' // useEffect lades till för att hantera klick utanför
import {
  User, Mail, Phone, MapPin, MoreVertical, Edit,
  Trash2, Power, Key, UserCheck, Send, Clock, UserX, Shield, Bell, AlertTriangle, BadgeCheck, Receipt
} from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../../ui/Button'
import { technicianManagementService, type Technician, type ExtraPortalRole } from '../../../../services/technicianManagementService'
import { ALL_INCIDENT_TYPES, INCIDENT_TYPE_CONFIG, type IncidentType } from '../../../../types/caseIncidents'
import { IncidentRecipientService } from '../../../../services/incidentRecipientService'

// Primärrollen (technicians.role) mappad till portalvyn den redan ger
const PRIMARY_ROLE_TO_PORTAL: Record<string, ExtraPortalRole | null> = {
  'Skadedjurstekniker': 'technician',
  'Koordinator': 'koordinator',
  'Admin': 'admin',
  'Säljare': null,
}

const EXTRA_ROLE_CONFIG: Record<ExtraPortalRole, { label: string; activeClass: string }> = {
  admin: { label: 'Admin', activeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  koordinator: { label: 'Koordinator', activeClass: 'bg-green-500/10 text-green-400 border-green-500/30' },
  technician: { label: 'Tekniker', activeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
}

type TechnicianCardProps = {
  technician: Technician
  onEdit: (technician: Technician) => void
  onToggleStatus: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
  onManageAuth: (technician: Technician) => void
  onManageWorkSchedule: (technician: Technician) => void
  onManageNotifications: (technician: Technician) => void
  onRecipientTypesChange?: (technicianId: string, types: IncidentType[]) => void
  onExtraRolesChange?: (technicianId: string, roles: ExtraPortalRole[]) => void
  onDiscountApproverChange?: (technicianId: string, canApprove: boolean) => void
  onInvoiceApproverChange?: (technicianId: string, canApprove: boolean) => void
}

export default function TechnicianCard({
  technician,
  onEdit,
  onToggleStatus,
  onDelete,
  onManageAuth,
  onManageWorkSchedule,
  onManageNotifications,
  onRecipientTypesChange,
  onExtraRolesChange,
  onDiscountApproverChange,
  onInvoiceApproverChange
}: TechnicianCardProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [recipientTypes, setRecipientTypes] = useState<Set<IncidentType>>(
    new Set(technician.incident_recipient_types || [])
  )
  const [savingTypes, setSavingTypes] = useState(false)
  const [extraRoles, setExtraRoles] = useState<Set<ExtraPortalRole>>(
    new Set(technician.extra_roles || [])
  )
  const [savingRoles, setSavingRoles] = useState(false)
  const [sendingPassword, setSendingPassword] = useState(false)
  const [isDiscountApprover, setIsDiscountApprover] = useState(!!technician.can_approve_discounts)
  const [savingDiscountApprover, setSavingDiscountApprover] = useState(false)
  const [isInvoiceApprover, setIsInvoiceApprover] = useState(!!technician.can_approve_invoices)
  const [savingInvoiceApprover, setSavingInvoiceApprover] = useState(false)

  const handleSendNewPassword = async () => {
    if (!technician.user_id || sendingPassword) return
    if (!window.confirm(
      `Skicka ett nytt lösenord till ${technician.name} (${technician.email})?\n\n` +
      'Ett säkert lösenord genereras automatiskt och mailas till personen, ' +
      'som sedan måste välja ett eget lösenord vid nästa inloggning.'
    )) return
    setSendingPassword(true)
    try {
      await technicianManagementService.sendNewPassword(technician.user_id)
    } catch {
      // Fel hanteras med toast i servicen
    } finally {
      setSendingPassword(false)
    }
  }

  useEffect(() => {
    setRecipientTypes(new Set(technician.incident_recipient_types || []))
  }, [technician.incident_recipient_types])

  useEffect(() => {
    setExtraRoles(new Set(technician.extra_roles || []))
  }, [technician.extra_roles])

  useEffect(() => {
    setIsDiscountApprover(!!technician.can_approve_discounts)
  }, [technician.can_approve_discounts])

  useEffect(() => {
    setIsInvoiceApprover(!!technician.can_approve_invoices)
  }, [technician.can_approve_invoices])

  const toggleDiscountApprover = async () => {
    if (!technician.user_id || savingDiscountApprover) return
    const previous = isDiscountApprover
    const next = !previous

    setIsDiscountApprover(next)
    setSavingDiscountApprover(true)
    try {
      await technicianManagementService.updateCanApproveDiscounts(technician.id, next)
      onDiscountApproverChange?.(technician.id, next)
      toast.success(next
        ? `${technician.name} är nu rabattansvarig`
        : `${technician.name} är inte längre rabattansvarig`)
    } catch {
      setIsDiscountApprover(previous)
    } finally {
      setSavingDiscountApprover(false)
    }
  }

  const toggleInvoiceApprover = async () => {
    if (!technician.user_id || savingInvoiceApprover) return
    const previous = isInvoiceApprover
    const next = !previous

    setIsInvoiceApprover(next)
    setSavingInvoiceApprover(true)
    try {
      await technicianManagementService.updateCanApproveInvoices(technician.id, next)
      onInvoiceApproverChange?.(technician.id, next)
      toast.success(next
        ? `${technician.name} är nu faktureringsansvarig`
        : `${technician.name} är inte längre faktureringsansvarig`)
    } catch {
      setIsInvoiceApprover(previous)
    } finally {
      setSavingInvoiceApprover(false)
    }
  }

  const primaryPortal = PRIMARY_ROLE_TO_PORTAL[technician.role] || null

  const toggleExtraRole = async (role: ExtraPortalRole) => {
    if (!technician.user_id || savingRoles) return
    const previous = extraRoles
    const next = new Set(previous)
    const activating = !next.has(role)
    if (activating) next.add(role)
    else next.delete(role)

    setExtraRoles(next)
    setSavingRoles(true)
    try {
      await technicianManagementService.updateExtraRoles(
        technician.id,
        [...next],
        technician.role === 'Admin'
      )
      onExtraRolesChange?.(technician.id, [...next])
      const label = EXTRA_ROLE_CONFIG[role].label
      toast.success(activating
        ? `${technician.name} har nu ${label}-vyn`
        : `${label}-vyn borttagen för ${technician.name}`)
    } catch {
      setExtraRoles(previous)
    } finally {
      setSavingRoles(false)
    }
  }

  const toggleRecipientType = async (type: IncidentType) => {
    if (!technician.user_id || savingTypes) return
    const previous = recipientTypes
    const next = new Set(previous)
    const activating = !next.has(type)
    if (activating) next.add(type)
    else next.delete(type)

    setRecipientTypes(next)
    setSavingTypes(true)
    try {
      await IncidentRecipientService.setRecipientTypes(technician.user_id, [...next])
      onRecipientTypesChange?.(technician.id, [...next])
      const label = INCIDENT_TYPE_CONFIG[type].label.toLowerCase()
      toast.success(activating
        ? `${technician.name} är nu mottagare av ${label}`
        : `${technician.name} tar inte längre emot ${label}`)
    } catch (err) {
      console.error('Error toggling incident recipient type:', err)
      setRecipientTypes(previous)
      toast.error('Kunde inte spara mottagarinställningen')
    } finally {
      setSavingTypes(false)
    }
  }

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
    <div className={`bg-slate-800/50 rounded-2xl border border-slate-700/40 p-5 hover:border-slate-600 transition-colors ${!technician.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-slate-300" />
            </div>
            {/* Login Status Indicator */}
            {technician.has_login && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                <Key className="w-2.5 h-2.5 text-[#fff]" />
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">{technician.name}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex px-2 py-1 rounded-md text-xs font-medium ${getRoleColor(technician.role)}`}>
                {technician.role}
              </span>
              {technician.is_admin && technician.role !== 'Admin' && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-purple-500/20 text-purple-400">
                  <Shield className="w-3 h-3 mr-1" />
                  Admin
                </span>
              )}
              {technician.has_login && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-500/20 text-green-400">
                  <Key className="w-3 h-3 mr-1" />
                  Inloggning
                </span>
              )}
              {isDiscountApprover && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-[#20c58f]/10 text-[#20c58f]">
                  <BadgeCheck className="w-3 h-3 mr-1" />
                  Rabattansvarig
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
                  onManageNotifications(technician)
                  setShowDropdown(false)
                }}
                className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Mailnotiser
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

              {technician.has_login && technician.user_id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDropdown(false)
                    handleSendNewPassword()
                  }}
                  disabled={sendingPassword}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2 disabled:opacity-50"
                >
                  <Key className="w-4 h-4" />
                  {sendingPassword ? 'Skickar…' : 'Skicka nytt lösenord'}
                </button>
              )}

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

      {/* Roller & vyer - togglas direkt på kortet */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-medium text-slate-400">Roller & vyer</span>
          <span className="text-xs text-slate-600">· {technician.role} ingår</span>
        </div>
        {technician.has_login && technician.user_id ? (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EXTRA_ROLE_CONFIG) as ExtraPortalRole[])
              .filter(role => role !== primaryPortal)
              .map(role => {
                const config = EXTRA_ROLE_CONFIG[role]
                const active = extraRoles.has(role)
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleExtraRole(role)}
                    disabled={savingRoles}
                    title={active
                      ? `Klicka för att ta bort ${config.label}-vyn`
                      : `Klicka för att ge ${config.label}-vyn`}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                      active
                        ? config.activeClass
                        : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {config.label}
                  </button>
                )
              })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Kräver aktiverad inloggning</p>
        )}
      </div>

      {/* Rabattansvarig - togglas direkt på kortet */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1.5 mb-2">
          <BadgeCheck className="w-3.5 h-3.5 text-[#20c58f]" />
          <span className="text-xs font-medium text-slate-400">Rabattansvarig</span>
        </div>
        {technician.has_login && technician.user_id ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {isDiscountApprover
                ? 'Granskar och godkänner rabatter på fakturor'
                : 'Kan tilldelas rätt att godkänna rabatter'}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={isDiscountApprover}
              onClick={toggleDiscountApprover}
              disabled={savingDiscountApprover}
              title={isDiscountApprover
                ? 'Klicka för att ta bort rabattansvaret'
                : 'Klicka för att göra personen rabattansvarig'}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                isDiscountApprover
                  ? 'bg-[#20c58f] border-[#20c58f]'
                  : 'bg-slate-700 border-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#fff] transition-transform ${
                  isDiscountApprover ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Kräver aktiverad inloggning - bara personer med konto kan vara rabattansvariga
          </p>
        )}
      </div>

      {/* Faktureringsansvarig - togglas direkt på kortet */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1.5 mb-2">
          <Receipt className="w-3.5 h-3.5 text-[#20c58f]" />
          <span className="text-xs font-medium text-slate-400">Faktureringsansvarig</span>
        </div>
        {technician.has_login && technician.user_id ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              {isInvoiceApprover
                ? 'Godkänner fakturor innan de skickas till Fortnox'
                : 'Kan tilldelas rätt att godkänna fakturor'}
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={isInvoiceApprover}
              onClick={toggleInvoiceApprover}
              disabled={savingInvoiceApprover}
              title={isInvoiceApprover
                ? 'Klicka för att ta bort faktureringsansvaret'
                : 'Klicka för att göra personen faktureringsansvarig'}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                isInvoiceApprover
                  ? 'bg-[#20c58f] border-[#20c58f]'
                  : 'bg-slate-700 border-slate-600'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-[#fff] transition-transform ${
                  isInvoiceApprover ? 'translate-x-[18px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Kräver aktiverad inloggning - bara personer med konto kan vara faktureringsansvariga
          </p>
        )}
      </div>

      {/* Incidentmottagare - togglas direkt på kortet */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex items-center gap-1.5 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-slate-400">Incidentmottagare</span>
        </div>
        {technician.has_login && technician.user_id ? (
          <div className="flex flex-wrap gap-1.5">
            {ALL_INCIDENT_TYPES.map(type => {
              const config = INCIDENT_TYPE_CONFIG[type]
              const active = recipientTypes.has(type)
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleRecipientType(type)}
                  disabled={savingTypes}
                  title={active
                    ? `Klicka för att sluta ta emot ${config.label.toLowerCase()}`
                    : `Klicka för att bli mottagare av ${config.label.toLowerCase()}`}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                    active
                      ? `${config.bgColor} ${config.color} ${config.borderColor}`
                      : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  {config.label}
                </button>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">Kräver aktiverad inloggning</p>
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
    </div>
  )
}