import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Input from '../../ui/Input'
import Select from '../../ui/Select'
import AddressAutocomplete from '../../ui/AddressAutocomplete'
import type { GeocodeResult } from '../../../services/geocoding'
import { CustomerGroupService } from '../../../services/customerGroupService'
import type { CustomerGroup } from '../../../types/customerGroups'
import { orgDigits } from '../../../shared/fortnoxCustomerNumbers'
import FortnoxNumberField, {
  EMPTY_FORTNOX_RESOLUTION,
  runFortnoxAllocation,
  type FortnoxNumberResolution,
} from '../customers/FortnoxNumberField'
import { Building2, Mail, Copy, Loader2, User } from 'lucide-react'
import toast from 'react-hot-toast'

interface SiteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  organizationId: string
  organizationName: string
  parentCustomerId: string
  existingSite?: {
    id: string
    site_name: string
    site_code: string
    region: string
    organization_number?: string
    contact_person?: string
    contact_email: string
    contact_phone?: string
    contact_address?: string
    billing_email?: string
    billing_address?: string
    billing_reference?: string
    /** Enhetens eget Fortnox-kundnummer (null = ärver/delar) */
    customer_number?: number | null
    customer_group_id?: string | null
  } | null
}

interface ParentData {
  billing_email?: string
  billing_address?: string
  billing_reference?: string
  is_regional?: boolean
  contract_type?: string
  assigned_account_manager?: string
  account_manager_email?: string
  sales_person?: string
  sales_person_email?: string
  organization_number?: string | null
  customer_number?: number | null
  customer_group_id?: string | null
  organization_id?: string | null
  company_name?: string
}

const sectionClass = 'p-3 bg-slate-800/30 border border-slate-700 rounded-xl'
const headerClass = 'text-sm font-semibold text-white mb-2 flex items-center gap-1.5'

export default function SiteModal({
  isOpen,
  onClose,
  onSuccess,
  organizationId,
  organizationName,
  parentCustomerId,
  existingSite
}: SiteModalProps) {
  const [loading, setLoading] = useState(false)
  const [parentData, setParentData] = useState<ParentData | null>(null)
  const [customerGroups, setCustomerGroups] = useState<CustomerGroup[]>([])

  // Grundinformation
  const [siteName, setSiteName] = useState('')
  const [region, setRegion] = useState('')
  const [organizationNumber, setOrganizationNumber] = useState('')

  // Fortnox: kundnummer och kundgrupp (bara när enheten är ett eget bolag)
  const [customerGroupId, setCustomerGroupId] = useState('')
  const [fortnox, setFortnox] = useState<FortnoxNumberResolution>(EMPTY_FORTNOX_RESOLUTION)

  // Kontaktinformation
  const [contactPerson, setContactPerson] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactAddress, setContactAddress] = useState('')

  // Faktureringsuppgifter
  const [billingEmail, setBillingEmail] = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [billingReference, setBillingReference] = useState('')
  const [useSameBilling, setUseSameBilling] = useState(false)

  // Senaste ort som adressvalet självt skrev in i Region. Låter oss skilja
  // "regionen står kvar från ett tidigare autofyll" från "någon har skrivit
  // något eget här" — bara det förra får skrivas över. Se handleAddressChange.
  const autofilledRegionRef = useRef<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchParentData()
      CustomerGroupService.getActiveGroups().then(setCustomerGroups).catch(() => setCustomerGroups([]))

      if (existingSite) {
        // Fyll i fält från befintlig enhet
        setSiteName(existingSite.site_name || '')
        setRegion(existingSite.region || '')
        setOrganizationNumber(existingSite.organization_number || '')
        setContactPerson(existingSite.contact_person || '')
        setContactEmail(existingSite.contact_email || '')
        setContactPhone(existingSite.contact_phone || '')
        setContactAddress(existingSite.contact_address || '')
        setBillingEmail(existingSite.billing_email || '')
        setBillingAddress(existingSite.billing_address || '')
        setBillingReference(existingSite.billing_reference || '')
        setCustomerGroupId(existingSite.customer_group_id || '')
        // Sparad region räknas som användarens egen — aldrig som autofyll.
        autofilledRegionRef.current = null
      } else {
        // Återställ för ny enhet
        resetForm()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingSite, parentCustomerId])

  const fetchParentData = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('billing_email, billing_address, billing_reference, is_regional, contract_type, assigned_account_manager, account_manager_email, sales_person, sales_person_email, organization_number, customer_number, customer_group_id, organization_id, company_name')
        .eq('id', parentCustomerId)
        .single()

      if (error) throw error
      const parent = data as ParentData
      setParentData(parent)
      // Kundgrupp för ett eget bolag: enhetens egen, annars huvudkontorets som start
      setCustomerGroupId(prev => prev || existingSite?.customer_group_id || parent.customer_group_id || '')
    } catch (error) {
      console.error('Error fetching parent data:', error)
    }
  }

  const resetForm = () => {
    setSiteName('')
    setRegion('')
    setOrganizationNumber('')
    setContactPerson('')
    setContactEmail('')
    setContactPhone('')
    setContactAddress('')
    setBillingEmail('')
    setBillingAddress('')
    setBillingReference('')
    setUseSameBilling(false)
    setCustomerGroupId('')
    setFortnox(EMPTY_FORTNOX_RESOLUTION)
    autofilledRegionRef.current = null
  }

  const handleCopyBilling = () => {
    if (parentData) {
      setBillingEmail(parentData.billing_email || '')
      setBillingAddress(parentData.billing_address || '')
      setBillingReference(parentData.billing_reference || '')
      setUseSameBilling(true)
      toast.success('Faktureringsuppgifter kopierade från huvudkontor')
    }
  }

  /**
   * Regionalkunder (Stockholms Kommun m.fl.) använder region som en kod
   * — "Södermalm Väst", inte en ort. Koden genererar e-postadresser och
   * matchar enheter mot kartpolygoner, så den får aldrig fyllas i med orten.
   *
   * Kräver att huvudkontoret hämtats: så länge parentData är null vet vi inte
   * vilken sorts kund det är, och då är det säkrare att låta bli att fylla i
   * än att gissa fel på en regionalkund.
   */
  const regionFollowsCity = parentData !== null && !parentData.is_regional

  // Enheten är ett eget bolag när den har ett org.nr skilt från huvudkontorets.
  // Då äger den sitt Fortnox-nummer och sin kundgrupp; annars ärvs båda.
  const ownCompany = !!orgDigits(organizationNumber) && orgDigits(organizationNumber) !== orgDigits(parentData?.organization_number)

  const handleAddressChange = (val: string | GeocodeResult) => {
    // Fri text: användaren skriver själv, ingen ort att hämta.
    if (typeof val === 'string') {
      setContactAddress(val)
      return
    }

    setContactAddress(val.formatted_address)

    const city = val.city?.trim()
    if (!city || !regionFollowsCity) return

    // Fyll bara i tomt fält eller en ort vi själva satt. Har någon skrivit
    // "Borlänge 2" eller "Ludvika kommun" för hand står det kvar.
    setRegion(prev => {
      const ours = !prev.trim() || prev === autofilledRegionRef.current
      if (!ours) return prev
      autofilledRegionRef.current = city
      return city
    })
  }

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()

    if (!siteName || !region || !contactEmail) {
      toast.error('Vänligen fyll i alla obligatoriska fält')
      return
    }
    if (fortnox.pending) {
      toast('Kundnumret slås fortfarande upp i Fortnox. Försök igen om en sekund.', { icon: 'ℹ️' })
      return
    }
    if (fortnox.allocate && !customerGroupId) {
      toast.error('Välj kundgrupp innan enheten skapas i Fortnox')
      return
    }

    setLoading(true)

    try {
      // Fälten användaren faktiskt redigerar här. Bara dessa får skrivas vid
      // UPDATE: avtalsdata, status, härkomst och ägarskap har inga kontroller i
      // modalen, och en osynlig skrivning är alltid fel. En enhet kan tillkomma
      // mitt i avtalsperioden eller teckna eget avtal — dess datum ska bevaras,
      // aldrig harmoniseras mot huvudkontoret.
      const formValues: Record<string, unknown> = {
        company_name: `${organizationName} - ${siteName}`,
        site_name: siteName,
        // Enhetens kod ÄR fakturamärkningen (billing_reference). Den gamla
        // kolumnen site_code lämnas orörd och skrivs inte längre härifrån.
        region: region,
        organization_number: organizationNumber || null,
        contact_person: contactPerson || null,
        contact_email: contactEmail,
        contact_phone: contactPhone || null,
        contact_address: contactAddress || null,
        billing_email: billingEmail || null,
        billing_address: billingAddress || null,
        billing_reference: billingReference.trim() || null,
        // Fortnox-numret kommer från uppslaget i FortnoxNumberField, aldrig fritt
        // ifyllt. Verifieringsstämpeln räknas dessutom om av databasens trigger.
        customer_number: fortnox.customerNumber,
        ...(fortnox.customerNumber != null && fortnox.verified
          ? { fortnox_verified_at: new Date().toISOString() }
          : {}),
        // Kundgruppen syns bara för ett eget bolag, och skrivs bara då
        ...(ownCompany ? { customer_group_id: customerGroupId || null } : {}),
      }

      const describeError = (error: { code?: string; message?: string }) => {
        if (error.code === '23505') {
          if (error.message?.includes('customer_number')) {
            return new Error('Kundnumret sitter redan på en annan kundrad i portalen')
          }
          return new Error('En enhet med samma uppgifter finns redan')
        }
        return error
      }

      let savedId: string

      if (existingSite) {
        const { error } = await supabase
          .from('customers')
          .update(formValues)
          .eq('id', existingSite.id)

        if (error) throw describeError(error)
        savedId = existingSite.id
        toast.success('Enhet uppdaterad')
      } else {
        // Huvudkontorets uppgifter behövs bara när enheten skapas.
        const { data: parentOrg, error: parentError } = await supabase
          .from('customers')
          .select('organization_id, contract_type, contract_start_date, contract_end_date')
          .eq('id', parentCustomerId)
          .single()

        if (parentError || !parentOrg) {
          throw new Error('Kunde inte hämta organisationsinformation')
        }

        // Startvärden för en ny enhet. Huvudkontoret är en rimlig gissning vid
        // skapandet — därefter äger enheten sina egna värden.
        const insertData = {
          ...formValues,
          organization_id: parentOrg.organization_id,
          parent_customer_id: parentCustomerId,
          is_multisite: true,
          site_type: 'enhet',
          contract_type: parentOrg.contract_type,
          contract_start_date: parentOrg.contract_start_date || null,
          contract_end_date: parentOrg.contract_end_date || null,
          contract_status: 'signed',
          is_active: true,
          source_type: 'oneflow' as const,
          // Kopiera account manager info från parent om det finns
          ...(parentData && {
            assigned_account_manager: parentData.assigned_account_manager,
            account_manager_email: parentData.account_manager_email,
            sales_person: parentData.sales_person,
            sales_person_email: parentData.sales_person_email
          })
        }

        const { data: inserted, error } = await supabase
          .from('customers')
          .insert(insertData)
          .select('id')
          .single()

        if (error || !inserted) throw describeError(error ?? { message: 'Enheten kunde inte skapas' })
        savedId = inserted.id
        toast.success('Ny enhet skapad')
      }

      // Ingen träff i Fortnox (eller val som kräver Fortnox): raden finns nu,
      // så allocate-customer kan skapa/återaktivera kunden och skriva numret.
      if (fortnox.allocate) {
        await runFortnoxAllocation({
          customerId: savedId,
          groupId: customerGroupId || null,
          request: fortnox.allocate,
        })
      }

      onSuccess()
      onClose()
      resetForm()
    } catch (error: unknown) {
      console.error('Error saving site:', error)
      toast.error((error as { message?: string } | null)?.message || 'Kunde inte spara enhet')
    } finally {
      setLoading(false)
    }
  }

  const effectiveOrganizationId = parentData?.organization_id || organizationId || null

  const footer = (
    <div className="flex justify-end gap-3 px-4 py-2.5">
      <Button onClick={onClose} variant="secondary" disabled={loading}>
        Avbryt
      </Button>
      <Button
        onClick={handleSubmit}
        variant="primary"
        disabled={loading}
        className="flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Sparar...
          </>
        ) : (
          <>
            <Building2 className="w-4 h-4" />
            {existingSite ? 'Spara ändringar' : 'Lägg till enhet'}
          </>
        )}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existingSite ? 'Redigera enhet' : 'Lägg till ny enhet'}
      subtitle={organizationName}
      size="lg"
      preventClose={loading}
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        {/* Info: enhet = fullvärdig kund */}
        {!existingSite && (
          <p className="text-xs text-slate-400">
            Enheten skapas som en fullvärdig kund i systemet. Ärenden, kontrollrundor,
            utrustningsplaceringar och scheman kan hanteras direkt på enheten.
          </p>
        )}

        {/* Grundinformation */}
        <div className={sectionClass}>
          <h3 className={headerClass}>
            <Building2 className="w-4 h-4 text-slate-400" />
            Grundinformation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Enhetsnamn *"
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="t.ex. Stockholm City"
            />
            <div>
              <Input
                label="Region *"
                type="text"
                value={region}
                onChange={(e) => {
                  // Egen redigering — sluta betrakta värdet som autofyllt.
                  autofilledRegionRef.current = null
                  setRegion(e.target.value)
                }}
                placeholder="t.ex. Stockholm"
              />
              {regionFollowsCity && (
                <p className="text-xs text-slate-500 mt-1">
                  Fylls i automatiskt från adressen. Kan ändras.
                </p>
              )}
            </div>
            <div>
              <Input
                label="Organisationsnummer"
                type="text"
                value={organizationNumber}
                onChange={(e) => setOrganizationNumber(e.target.value)}
                placeholder="XXXXXX-XXXX"
              />
              <p className="text-xs text-slate-500 mt-1">
                Lämna tomt om enheten tillhör samma bolag som huvudkontoret.
              </p>
            </div>
            {ownCompany && (
              <Select
                label="Kundgrupp (Fortnox)"
                value={customerGroupId}
                onChange={setCustomerGroupId}
                placeholder="Välj kundgrupp"
                options={customerGroups.map(g => ({ value: g.id, label: `${g.name} (${g.series_start}-${g.series_end})` }))}
              />
            )}
            <div className="md:col-span-2">
              {parentData ? (
                <FortnoxNumberField
                  orgNr={organizationNumber}
                  savedOrgNr={existingSite?.organization_number ?? null}
                  parent={{
                    orgNr: parentData.organization_number ?? null,
                    customerNumber: parentData.customer_number ?? null,
                    name: parentData.company_name ?? organizationName,
                  }}
                  organizationId={effectiveOrganizationId}
                  customerId={existingSite?.id ?? null}
                  customerGroupId={customerGroupId || null}
                  initialNumber={existingSite?.customer_number ?? null}
                  onChange={setFortnox}
                />
              ) : (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Hämtar huvudkontoret…
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Kontaktinformation */}
        <div className={sectionClass}>
          <h3 className={headerClass}>
            <User className="w-4 h-4 text-slate-400" />
            Kontaktinformation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Kontaktperson"
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="För- och efternamn"
            />
            <Input
              label="Kontakt-email *"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="kontakt@foretag.se"
            />
            <Input
              label="Telefon"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="07X-XXX XX XX"
            />
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Adress
              </label>
              <AddressAutocomplete
                value={contactAddress}
                onChange={handleAddressChange}
                placeholder="Sök adress..."
              />
            </div>
          </div>
        </div>

        {/* Faktureringsuppgifter */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-slate-400" />
              Faktureringsuppgifter
            </h3>
            {parentData && (
              <Button
                type="button"
                onClick={handleCopyBilling}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Copy className="w-3 h-3" />
                Kopiera från huvudkontor
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Faktura-email"
              type="email"
              value={billingEmail}
              onChange={(e) => setBillingEmail(e.target.value)}
              placeholder="faktura@foretag.se"
            />
            <Input
              label="Faktureringsadress"
              type="text"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="Fakturaadress eller referens"
            />
            <div className="md:col-span-2">
              <Input
                label="Enhetskod (märkning faktura)"
                type="text"
                value={billingReference}
                onChange={(e) => setBillingReference(e.target.value)}
                placeholder="t.ex. YX301, PO-nummer eller kostnadsställe"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enhetens kod. Blir Er referens på fakturan och fylls i automatiskt när ärenden skapas mot enheten.
              </p>
            </div>
          </div>
          {useSameBilling && (
            <p className="text-xs text-[#20c58f] mt-2">
              Använder samma faktureringsuppgifter som huvudkontoret
            </p>
          )}
        </div>
      </form>
    </Modal>
  )
}
