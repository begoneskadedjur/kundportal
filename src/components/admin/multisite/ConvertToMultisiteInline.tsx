// src/components/admin/multisite/ConvertToMultisiteInline.tsx
// Inline 3-stegs konvertering av befintlig kund till multisite-organisation

import React, { useState } from 'react'
import {
  Building2,
  Users,
  Check,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Plus,
  Edit2,
  Trash2,
  Shield,
  MapPin,
  Mail,
  Phone,
  User,
  Loader2,
  AlertTriangle,
  Copy,
  CheckCircle
} from 'lucide-react'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import { supabase } from '../../../lib/supabase'
import toast from 'react-hot-toast'

// ============================================
// TYPES
// ============================================

interface Organization {
  id: string
  name: string
  organization_number: string
  billing_address: string
  billing_email: string
  billing_method: 'consolidated' | 'per_site'
  contract_type?: string
  contact_phone?: string
  contact_person?: string
  contact_email?: string
  primary_contact_email?: string
}

interface ConvertToMultisiteInlineProps {
  customer: Organization
  onSuccess: () => void
  onCancel: () => void
}

interface PendingSite {
  tempId: string
  site_name: string
  site_code: string
  region: string
  contact_person: string
  contact_email: string
  contact_phone: string
  contact_address: string
  billing_email: string
  billing_address: string
}

interface PendingUser {
  tempId: string
  name: string
  email: string
  phone: string
}

interface PendingRoleAssignment {
  userTempId: string
  role: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  siteTempIds: string[]
}

type Step = 'sites' | 'hierarchy' | 'confirm'

// ============================================
// MAIN COMPONENT
// ============================================

export default function ConvertToMultisiteInline({
  customer,
  onSuccess,
  onCancel,
}: ConvertToMultisiteInlineProps) {
  const [step, setStep] = useState<Step>('sites')
  const [loading, setLoading] = useState(false)

  // Sites
  const [pendingSites, setPendingSites] = useState<PendingSite[]>([])
  const [showSiteForm, setShowSiteForm] = useState(false)
  const [editingSiteIndex, setEditingSiteIndex] = useState<number | null>(null)

  // Users & roles
  const [users, setUsers] = useState<PendingUser[]>([])
  const [roleAssignments, setRoleAssignments] = useState<PendingRoleAssignment[]>([])
  const [addingLevel, setAddingLevel] = useState<'verksamhetschef' | 'regionchef' | 'platsansvarig' | null>(null)

  const steps: { key: Step; label: string }[] = [
    { key: 'sites', label: '1. Enheter' },
    { key: 'hierarchy', label: '2. Användare' },
    { key: 'confirm', label: '3. Bekräfta' },
  ]
  const stepIndex = steps.findIndex(s => s.key === step)

  // ============================================
  // SITE MANAGEMENT
  // ============================================

  const handleAddSite = (site: PendingSite) => {
    if (editingSiteIndex !== null) {
      setPendingSites(prev => prev.map((s, i) => i === editingSiteIndex ? site : s))
      setEditingSiteIndex(null)
    } else {
      setPendingSites(prev => [...prev, site])
    }
    setShowSiteForm(false)
  }

  const handleEditSite = (index: number) => {
    setEditingSiteIndex(index)
    setShowSiteForm(true)
  }

  const handleDeleteSite = (index: number) => {
    const siteId = pendingSites[index].tempId
    setPendingSites(prev => prev.filter((_, i) => i !== index))
    // Remove role assignments referencing this site
    setRoleAssignments(prev =>
      prev.map(ra => ({
        ...ra,
        siteTempIds: ra.siteTempIds.filter(id => id !== siteId),
      }))
    )
  }

  // ============================================
  // USER/ROLE MANAGEMENT
  // ============================================

  const handleAddUserWithRole = (
    user: PendingUser,
    role: 'verksamhetschef' | 'regionchef' | 'platsansvarig',
    siteTempIds: string[]
  ) => {
    setUsers(prev => [...prev, user])
    setRoleAssignments(prev => [...prev, { userTempId: user.tempId, role, siteTempIds }])
    setAddingLevel(null)
  }

  const handleRemoveUser = (userTempId: string) => {
    setUsers(prev => prev.filter(u => u.tempId !== userTempId))
    setRoleAssignments(prev => prev.filter(ra => ra.userTempId !== userTempId))
  }

  // ============================================
  // CONVERSION LOGIC
  // ============================================

  const handleConvert = async () => {
    setLoading(true)

    try {
      // 1. Generate organization_id
      const organizationId = crypto.randomUUID()

      // 2. Update existing customer to be HQ
      const { error: updateError } = await supabase
        .from('customers')
        .update({
          is_multisite: true,
          site_type: 'huvudkontor',
          organization_id: organizationId,
        })
        .eq('id', customer.id)

      if (updateError) throw updateError

      // 3. Create all site records
      let createdSiteIds: string[] = []
      if (pendingSites.length > 0) {
        const sitesToInsert = pendingSites.map(site => ({
          company_name: `${customer.name} - ${site.site_name}`,
          site_name: site.site_name,
          site_code: site.site_code,
          region: site.region,
          contact_person: site.contact_person || null,
          contact_email: site.contact_email,
          contact_phone: site.contact_phone || null,
          contact_address: site.contact_address || null,
          billing_email: site.billing_email || null,
          billing_address: site.billing_address || null,
          organization_id: organizationId,
          parent_customer_id: customer.id,
          is_multisite: true,
          site_type: 'enhet' as const,
          contract_type: customer.contract_type || null,
          contract_status: 'signed' as const,
          is_active: true,
          source_type: 'oneflow' as const,
        }))

        const { data: createdSites, error: sitesError } = await supabase
          .from('customers')
          .insert(sitesToInsert)
          .select('id')

        if (sitesError) {
          // Rollback HQ update
          await supabase
            .from('customers')
            .update({ is_multisite: false, site_type: null, organization_id: null })
            .eq('id', customer.id)
          throw sitesError
        }

        createdSiteIds = (createdSites || []).map(s => s.id)
      }

      // 4. Map tempIds to real site IDs
      const tempIdToRealId = new Map<string, string>()
      pendingSites.forEach((pending, index) => {
        if (createdSiteIds[index]) {
          tempIdToRealId.set(pending.tempId, createdSiteIds[index])
        }
      })

      // 5. Create users via API
      if (users.length > 0) {
        const apiUsers = users.map(u => ({
          id: u.tempId,
          email: u.email,
          name: u.name,
          phone: u.phone,
        }))

        const apiRoleAssignments = roleAssignments.map(ra => {
          const realSiteIds = ra.siteTempIds
            .map(tid => tempIdToRealId.get(tid))
            .filter((id): id is string => !!id)

          return {
            userId: ra.userTempId,
            role: ra.role,
            // Regionchef uses 'sites', platsansvarig uses 'siteIds' (API convention)
            ...(ra.role === 'regionchef' ? { sites: realSiteIds } : {}),
            ...(ra.role === 'platsansvarig' ? { siteIds: realSiteIds } : {}),
          }
        })

        const response = await fetch('/api/create-multisite-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            users: apiUsers,
            roleAssignments: apiRoleAssignments,
            sendEmail: true,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          // Sites already created — show partial success
          toast.error(`Enheter skapade, men användarfel: ${result.error}`)
          onSuccess()
          return
        }

        if (result.summary?.failed > 0) {
          toast(`${result.summary.failed} av ${result.summary.total} användare kunde inte skapas`, { icon: '⚠️' })
        }
      }

      toast.success(`${customer.name} konverterad till multisite-organisation!`)
      onSuccess()
    } catch (error: any) {
      console.error('Conversion error:', error)
      toast.error(error.message || 'Konvertering misslyckades')
    } finally {
      setLoading(false)
    }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="mt-4 p-4 bg-slate-800/30 border border-[#20c58f]/30 rounded-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#20c58f]" />
          <h3 className="text-sm font-semibold text-white">Konvertera till multisite</h3>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          Avbryt
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s.key
                    ? 'bg-[#20c58f] text-white'
                    : stepIndex > i
                    ? 'bg-[#20c58f]/20 text-[#20c58f]'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {stepIndex > i ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-xs ${step === s.key ? 'text-white font-medium' : 'text-slate-500'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-slate-600 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      {step === 'sites' && (
        <SitesStep
          customer={customer}
          pendingSites={pendingSites}
          showSiteForm={showSiteForm}
          editingSiteIndex={editingSiteIndex}
          onShowSiteForm={() => { setShowSiteForm(true); setEditingSiteIndex(null) }}
          onHideSiteForm={() => { setShowSiteForm(false); setEditingSiteIndex(null) }}
          onAddSite={handleAddSite}
          onEditSite={handleEditSite}
          onDeleteSite={handleDeleteSite}
        />
      )}

      {step === 'hierarchy' && (
        <HierarchyStep
          pendingSites={pendingSites}
          users={users}
          roleAssignments={roleAssignments}
          addingLevel={addingLevel}
          onSetAddingLevel={setAddingLevel}
          onAddUserWithRole={handleAddUserWithRole}
          onRemoveUser={handleRemoveUser}
        />
      )}

      {step === 'confirm' && (
        <ConfirmStep
          customer={customer}
          pendingSites={pendingSites}
          users={users}
          roleAssignments={roleAssignments}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        <Button
          onClick={() => {
            if (step === 'sites') onCancel()
            else if (step === 'hierarchy') setStep('sites')
            else setStep('hierarchy')
          }}
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {step === 'sites' ? 'Avbryt' : 'Tillbaka'}
        </Button>

        {step === 'confirm' ? (
          <Button
            onClick={handleConvert}
            variant="primary"
            size="sm"
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Konverterar...
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                Konvertera
              </>
            )}
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (step === 'sites') {
                if (pendingSites.length === 0) {
                  toast.error('Lägg till minst en enhet')
                  return
                }
                setStep('hierarchy')
              } else {
                setStep('confirm')
              }
            }}
            variant="primary"
            size="sm"
            className="flex items-center gap-1.5"
          >
            Nästa
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================
// STEP 1: SITES
// ============================================

function SitesStep({
  customer,
  pendingSites,
  showSiteForm,
  editingSiteIndex,
  onShowSiteForm,
  onHideSiteForm,
  onAddSite,
  onEditSite,
  onDeleteSite,
}: {
  customer: Organization
  pendingSites: PendingSite[]
  showSiteForm: boolean
  editingSiteIndex: number | null
  onShowSiteForm: () => void
  onHideSiteForm: () => void
  onAddSite: (site: PendingSite) => void
  onEditSite: (index: number) => void
  onDeleteSite: (index: number) => void
}) {
  return (
    <div className="space-y-3">
      {/* HQ badge */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#20c58f]/10 border border-[#20c58f]/30 rounded-lg">
        <Building2 className="w-4 h-4 text-[#20c58f]" />
        <span className="text-sm font-medium text-white">{customer.name}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#20c58f]/20 text-[#20c58f] font-medium">
          Huvudkontor
        </span>
      </div>

      {/* Sites list */}
      {pendingSites.length > 0 && (
        <div className="space-y-1.5">
          {pendingSites.map((site, index) => (
            <div
              key={site.tempId}
              className="flex items-center justify-between px-3 py-2 bg-slate-800/50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {site.site_name} <span className="text-slate-500">({site.site_code})</span>
                  </p>
                  <p className="text-xs text-slate-400 truncate">{site.region} · {site.contact_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onEditSite(index)}
                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                >
                  <Edit2 className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  onClick={() => onDeleteSite(index)}
                  className="p-1 hover:bg-red-500/20 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline site form */}
      {showSiteForm ? (
        <InlineSiteForm
          customer={customer}
          existingSite={editingSiteIndex !== null ? pendingSites[editingSiteIndex] : null}
          onSave={onAddSite}
          onCancel={onHideSiteForm}
        />
      ) : (
        <button
          onClick={onShowSiteForm}
          className="flex items-center gap-1.5 text-xs text-[#20c58f] hover:text-[#1ba876] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Lägg till enhet
        </button>
      )}
    </div>
  )
}

// ============================================
// INLINE SITE FORM
// ============================================

function InlineSiteForm({
  customer,
  existingSite,
  onSave,
  onCancel,
}: {
  customer: Organization
  existingSite: PendingSite | null
  onSave: (site: PendingSite) => void
  onCancel: () => void
}) {
  const [siteName, setSiteName] = useState(existingSite?.site_name || '')
  const [siteCode, setSiteCode] = useState(existingSite?.site_code || '')
  const [region, setRegion] = useState(existingSite?.region || '')
  const [contactPerson, setContactPerson] = useState(existingSite?.contact_person || '')
  const [contactEmail, setContactEmail] = useState(existingSite?.contact_email || '')
  const [contactPhone, setContactPhone] = useState(existingSite?.contact_phone || '')
  const [contactAddress, setContactAddress] = useState(existingSite?.contact_address || '')
  const [billingEmail, setBillingEmail] = useState(existingSite?.billing_email || '')
  const [billingAddress, setBillingAddress] = useState(existingSite?.billing_address || '')

  const handleCopyBilling = () => {
    setBillingEmail(customer.billing_email || '')
    setBillingAddress(customer.billing_address || '')
    toast.success('Faktureringsuppgifter kopierade')
  }

  const handleSubmit = () => {
    if (!siteName || !siteCode || !region || !contactEmail) {
      toast.error('Fyll i alla obligatoriska fält')
      return
    }

    onSave({
      tempId: existingSite?.tempId || crypto.randomUUID(),
      site_name: siteName,
      site_code: siteCode.toUpperCase(),
      region,
      contact_person: contactPerson,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      contact_address: contactAddress,
      billing_email: billingEmail,
      billing_address: billingAddress,
    })
  }

  return (
    <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-3">
      <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5 text-blue-400" />
        {existingSite ? 'Redigera enhet' : 'Ny enhet'}
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Enhetsnamn *</label>
          <Input
            value={siteName}
            onChange={e => setSiteName(e.target.value)}
            placeholder="t.ex. Gjutargatan"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Enhetskod *</label>
          <Input
            value={siteCode}
            onChange={e => setSiteCode(e.target.value.toUpperCase())}
            placeholder="t.ex. GJU01"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Region *</label>
          <Input
            value={region}
            onChange={e => setRegion(e.target.value)}
            placeholder="t.ex. Dalarna"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Kontakt-email *</label>
          <Input
            type="email"
            value={contactEmail}
            onChange={e => setContactEmail(e.target.value)}
            placeholder="kontakt@foretag.se"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Kontaktperson</label>
          <Input
            value={contactPerson}
            onChange={e => setContactPerson(e.target.value)}
            placeholder="Namn"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Telefon</label>
          <Input
            value={contactPhone}
            onChange={e => setContactPhone(e.target.value)}
            placeholder="07X-XXX XX XX"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-400 mb-1">Adress</label>
          <Input
            value={contactAddress}
            onChange={e => setContactAddress(e.target.value)}
            placeholder="Gatuadress, Postnr Ort"
          />
        </div>
      </div>

      {/* Billing */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Fakturering</span>
          <button
            onClick={handleCopyBilling}
            className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-[#20c58f] transition-colors"
          >
            <Copy className="w-3 h-3" />
            Kopiera från HK
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Faktura-email</label>
            <Input
              type="email"
              value={billingEmail}
              onChange={e => setBillingEmail(e.target.value)}
              placeholder="faktura@foretag.se"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Faktureringsadress</label>
            <Input
              value={billingAddress}
              onChange={e => setBillingAddress(e.target.value)}
              placeholder="Adress"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
        <Button onClick={onCancel} variant="outline" size="sm">
          Avbryt
        </Button>
        <Button onClick={handleSubmit} variant="primary" size="sm" className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" />
          {existingSite ? 'Spara' : 'Lägg till'}
        </Button>
      </div>
    </div>
  )
}

// ============================================
// STEP 2: HIERARCHY
// ============================================

const ROLE_CONFIG = [
  {
    role: 'verksamhetschef' as const,
    label: 'Verksamhetschef',
    description: 'Ser alla enheter',
    icon: Shield,
    color: 'text-[#20c58f]',
    bgColor: 'bg-[#20c58f]/10',
    borderColor: 'border-[#20c58f]/30',
    needsSites: false,
  },
  {
    role: 'regionchef' as const,
    label: 'Regionchef',
    description: 'Ser tilldelade enheter',
    icon: Users,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    needsSites: true,
  },
  {
    role: 'platsansvarig' as const,
    label: 'Platsansvarig',
    description: 'Ser enskild enhet',
    icon: MapPin,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    needsSites: true,
  },
]

function HierarchyStep({
  pendingSites,
  users,
  roleAssignments,
  addingLevel,
  onSetAddingLevel,
  onAddUserWithRole,
  onRemoveUser,
}: {
  pendingSites: PendingSite[]
  users: PendingUser[]
  roleAssignments: PendingRoleAssignment[]
  addingLevel: 'verksamhetschef' | 'regionchef' | 'platsansvarig' | null
  onSetAddingLevel: (level: 'verksamhetschef' | 'regionchef' | 'platsansvarig' | null) => void
  onAddUserWithRole: (
    user: PendingUser,
    role: 'verksamhetschef' | 'regionchef' | 'platsansvarig',
    siteTempIds: string[]
  ) => void
  onRemoveUser: (userTempId: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400">
        Bygg organisationshierarkin. Alla nivåer är valfria — lägg till användare där det behövs.
      </p>

      {ROLE_CONFIG.map(config => {
        const RoleIcon = config.icon
        const roleUsers = roleAssignments
          .filter(ra => ra.role === config.role)
          .map(ra => ({
            ...ra,
            user: users.find(u => u.tempId === ra.userTempId)!,
          }))
          .filter(ra => ra.user)

        return (
          <div key={config.role} className={`p-3 ${config.bgColor} border ${config.borderColor} rounded-xl`}>
            <div className="flex items-center gap-1.5 mb-2">
              <RoleIcon className={`w-4 h-4 ${config.color}`} />
              <span className="text-sm font-semibold text-white">{config.label}</span>
              <span className="text-xs text-slate-500 ml-1">— {config.description}</span>
            </div>

            {/* Users in this level */}
            {roleUsers.length > 0 && (
              <div className="space-y-1.5 ml-5 border-l-2 border-slate-700 pl-3 mb-2">
                {roleUsers.map(({ user, userTempId, siteTempIds }) => (
                  <div
                    key={userTempId}
                    className="flex items-center justify-between px-3 py-2 bg-slate-800/40 rounded-lg"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {user.email}
                        {config.needsSites && siteTempIds.length > 0 && (
                          <span className="text-slate-500">
                            {' → '}
                            {siteTempIds
                              .map(tid => pendingSites.find(s => s.tempId === tid)?.site_name)
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => onRemoveUser(userTempId)}
                      className="p-1 hover:bg-red-500/20 rounded transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add user form */}
            {addingLevel === config.role ? (
              <InlineUserForm
                role={config.role}
                needsSites={config.needsSites}
                pendingSites={pendingSites}
                onAdd={onAddUserWithRole}
                onCancel={() => onSetAddingLevel(null)}
              />
            ) : (
              <button
                onClick={() => onSetAddingLevel(config.role)}
                className={`flex items-center gap-1.5 text-xs ${config.color} hover:opacity-80 transition-opacity mt-1`}
              >
                <Plus className="w-3.5 h-3.5" />
                Lägg till {config.label.toLowerCase()}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// INLINE USER FORM
// ============================================

function InlineUserForm({
  role,
  needsSites,
  pendingSites,
  onAdd,
  onCancel,
}: {
  role: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
  needsSites: boolean
  pendingSites: PendingSite[]
  onAdd: (
    user: PendingUser,
    role: 'verksamhetschef' | 'regionchef' | 'platsansvarig',
    siteTempIds: string[]
  ) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedSites, setSelectedSites] = useState<string[]>([])

  const handleSubmit = () => {
    if (!name || !email) {
      toast.error('Namn och e-post krävs')
      return
    }
    if (needsSites && selectedSites.length === 0) {
      toast.error('Välj minst en enhet')
      return
    }

    const user: PendingUser = {
      tempId: crypto.randomUUID(),
      name,
      email,
      phone,
    }

    onAdd(user, role, selectedSites)
  }

  return (
    <div className="mt-2 p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Namn *</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="För- och efternamn"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">E-post *</label>
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="namn@foretag.se"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Telefon</label>
          <Input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="07X-XXX XX XX"
          />
        </div>
      </div>

      {/* Site selection */}
      {needsSites && pendingSites.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Välj enheter *</label>
          <div className="max-h-32 overflow-y-auto border border-slate-700/50 rounded-lg">
            {pendingSites.map(site => (
              <label
                key={site.tempId}
                className="flex items-center px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedSites.includes(site.tempId)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedSites(prev => [...prev, site.tempId])
                    } else {
                      setSelectedSites(prev => prev.filter(id => id !== site.tempId))
                    }
                  }}
                  className="mr-2 rounded border-slate-600 bg-slate-700 text-[#20c58f] focus:ring-[#20c58f]"
                />
                <span className="text-xs text-white">{site.site_name}</span>
                <span className="text-xs text-slate-500 ml-1">({site.region})</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={onCancel} variant="outline" size="sm">
          Avbryt
        </Button>
        <Button onClick={handleSubmit} variant="primary" size="sm" className="flex items-center gap-1.5">
          <Plus className="w-3 h-3" />
          Lägg till
        </Button>
      </div>
    </div>
  )
}

// ============================================
// STEP 3: CONFIRM
// ============================================

function ConfirmStep({
  customer,
  pendingSites,
  users,
  roleAssignments,
}: {
  customer: Organization
  pendingSites: PendingSite[]
  users: PendingUser[]
  roleAssignments: PendingRoleAssignment[]
}) {
  const getRoleName = (role: string) => {
    const names: Record<string, string> = {
      verksamhetschef: 'Verksamhetschef',
      regionchef: 'Regionchef',
      platsansvarig: 'Platsansvarig',
    }
    return names[role] || role
  }

  return (
    <div className="space-y-3">
      {/* Warning */}
      <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-200">
          Kunden konverteras till multisite-organisation. Befintlig kunddata behålls.
          Inbjudningar skickas till alla nya användare.
        </p>
      </div>

      {/* HQ */}
      <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
        <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-[#20c58f]" />
          Huvudkontor
        </h4>
        <p className="text-sm text-white">{customer.name}</p>
      </div>

      {/* Sites */}
      <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
        <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          Enheter ({pendingSites.length})
        </h4>
        <div className="space-y-1">
          {pendingSites.map(site => (
            <div key={site.tempId} className="flex items-center gap-2 text-xs">
              <span className="text-white">{site.site_name}</span>
              <span className="text-slate-500">{site.site_code} · {site.region}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users */}
      <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
        <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#20c58f]" />
          Användare ({users.length})
        </h4>
        {users.length === 0 ? (
          <p className="text-xs text-slate-500">Inga användare tillagda — kan läggas till efter konvertering.</p>
        ) : (
          <div className="space-y-1.5">
            {roleAssignments.map(ra => {
              const user = users.find(u => u.tempId === ra.userTempId)
              if (!user) return null
              return (
                <div key={ra.userTempId} className="flex items-center gap-2 text-xs">
                  <span className="text-white">{user.name}</span>
                  <span className="text-slate-500">{user.email}</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                    {getRoleName(ra.role)}
                  </span>
                  {ra.siteTempIds.length > 0 && (
                    <span className="text-slate-500">
                      → {ra.siteTempIds
                        .map(tid => pendingSites.find(s => s.tempId === tid)?.site_name)
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
