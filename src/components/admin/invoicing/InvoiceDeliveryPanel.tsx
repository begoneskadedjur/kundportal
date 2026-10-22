// src/components/admin/invoicing/InvoiceDeliveryPanel.tsx
// Fakturavägen: hur kunden får sina fakturor. Visar vägen som en rad när den
// är bekräftad och ett val (e-post, e-faktura, brev) när den saknas. Ekonomi
// väljer här vid första fakturan; valet sparas på kunden och Fortnox-kortet
// (InvoiceDeliveryService.saveChoice). Används i fakturamodalen och i
// kundens faktureringsinställningar.
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Mail, Pencil, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import Input from '../../ui/Input'
import { InvoiceDeliveryService, type CustomerDelivery } from '../../../services/invoiceDeliveryService'
import {
  INVOICE_DELIVERY_LABEL,
  INVOICE_DELIVERY_METHODS,
  INVOICE_DELIVERY_SOURCE_LABEL,
  isInvoiceDeliveryMethod,
  validateDeliveryChoice,
  type DeliveryCustomer,
  type DeliveryEvaluation,
  type InvoiceDeliveryMethod,
  type InvoiceDeliverySource,
} from '../../../shared/invoiceDelivery'

interface InvoiceDeliveryPanelProps {
  customerId: string | null
  /** Får välja och ändra väg (faktureringsansvarig eller admin) */
  canEdit: boolean
  /** Namnet som sparas som den som bekräftade */
  actorName: string
  /** Meddelas varje gång bedömningen laddats eller ändrats */
  onEvaluation?: (evaluation: DeliveryEvaluation | null) => void
  /** Laddar om när värdet ändras, t.ex. efter att kundraden skapats vid sändning */
  reloadKey?: number
  /** Efter sparat val, med kundraden som den ser ut nu */
  onSaved?: (owner: DeliveryCustomer) => void
  className?: string
}

const METHOD_HELP: Record<InvoiceDeliveryMethod, string> = {
  email: 'Fakturan mejlas från Fortnox till fakturamejlet.',
  einvoice: 'Fakturan går som e-faktura (Peppol) på organisationsnumret.',
  print: 'Fakturan skickas som brev till fakturaadressen.',
}

export default function InvoiceDeliveryPanel({
  customerId,
  canEdit,
  actorName,
  onEvaluation,
  reloadKey = 0,
  onSaved,
  className = '',
}: InvoiceDeliveryPanelProps) {
  const [delivery, setDelivery] = useState<CustomerDelivery | null>(null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [method, setMethod] = useState<InvoiceDeliveryMethod | null>(null)
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [reference, setReference] = useState('')

  const load = useCallback(async () => {
    if (!customerId) {
      setDelivery(null)
      onEvaluation?.(null)
      return
    }
    setLoading(true)
    try {
      const d = await InvoiceDeliveryService.getForCustomer(customerId)
      setDelivery(d)
      onEvaluation?.(d?.evaluation ?? null)
      if (d) {
        const o = d.owner
        setMethod(isInvoiceDeliveryMethod(o.invoice_delivery_method) ? o.invoice_delivery_method : null)
        setEmail(o.billing_email ?? '')
        setAddress(o.billing_address ?? '')
        setReference(o.billing_reference ?? '')
      }
    } catch (err) {
      console.error('Kunde inte läsa fakturavägen:', err)
      onEvaluation?.(null)
    } finally {
      setLoading(false)
    }
    // onEvaluation hålls utanför beroendena: föräldern skickar en ny funktion varje rendering
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId])

  useEffect(() => {
    setEditing(false)
    load()
  }, [load, reloadKey])

  if (!customerId) return null
  if (loading && !delivery) {
    return (
      <div className={`text-xs text-slate-500 flex items-center gap-1.5 ${className}`}>
        <RefreshCw className="w-3 h-3 animate-spin" /> Läser fakturavägen
      </div>
    )
  }
  if (!delivery) return null

  const { evaluation, owner, inheritedFromParent } = delivery
  const showForm = canEdit && (editing || !evaluation.ok)
  const ownerMethod = isInvoiceDeliveryMethod(owner.invoice_delivery_method) ? owner.invoice_delivery_method : null
  const source = owner.invoice_delivery_source as InvoiceDeliverySource | null
  const formError = method
    ? validateDeliveryChoice(
        { method, billingEmail: email, billingAddress: address, billingReference: reference },
        owner.organization_number
      )
    : 'Välj hur kunden ska få fakturan.'

  const handleSave = async () => {
    if (!method || formError) return
    setSaving(true)
    try {
      const saved = await InvoiceDeliveryService.saveChoice(owner.id, {
        method,
        billingEmail: email,
        billingAddress: address,
        billingReference: reference,
      }, actorName)
      toast.success(
        owner.customer_number
          ? `Fakturavägen är sparad och Fortnox-kortet ${owner.customer_number} uppdaterat`
          : 'Fakturavägen är sparad. Fortnox-kortet får den när kunden läggs upp.'
      )
      setEditing(false)
      onSaved?.(saved)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara fakturavägen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`p-3 rounded-xl border ${
        evaluation.ok ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-800/30 border-amber-500/40'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {evaluation.ok
            ? <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
          <span className="text-sm font-semibold text-white">Fakturaväg</span>
          {ownerMethod && (
            <span className="text-sm text-slate-200 truncate">
              {INVOICE_DELIVERY_LABEL[ownerMethod]}
            </span>
          )}
        </div>
        {canEdit && evaluation.ok && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors"
            title="Ändra fakturaväg"
            aria-label="Ändra fakturaväg"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {evaluation.ok && !editing && (
        <p className="text-[11px] text-slate-500 mt-1">
          {source ? `Satt av ${INVOICE_DELIVERY_SOURCE_LABEL[source] ?? source}` : 'Bekräftad'}
          {owner.invoice_delivery_confirmed_by_name && source === 'ekonomi' ? ` (${owner.invoice_delivery_confirmed_by_name})` : ''}
          {owner.invoice_delivery_confirmed_at ? ` · ${owner.invoice_delivery_confirmed_at.slice(0, 10)}` : ''}
          {inheritedFromParent && owner.company_name ? ` · gäller via ${owner.company_name}` : ''}
        </p>
      )}

      {!evaluation.ok && (
        <p className="text-xs text-amber-300 mt-1">{evaluation.message}</p>
      )}
      {!evaluation.ok && !canEdit && (
        <p className="text-[11px] text-slate-500 mt-1">Faktureringsansvarig väljer fakturavägen.</p>
      )}

      {showForm && (
        <div className="mt-3 space-y-3">
          {inheritedFromParent && owner.company_name && (
            <p className="text-[11px] text-slate-400">
              Enheten faktureras på {owner.company_name}s Fortnox-kort. Valet gäller hela kunden.
            </p>
          )}
          <fieldset>
            <legend className="block text-xs font-medium text-slate-400 mb-1">Hur ska kunden få fakturan?</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {INVOICE_DELIVERY_METHODS.map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="radio"
                    name={`fakturavag-${owner.id}`}
                    checked={method === m}
                    onChange={() => setMethod(m)}
                    className="accent-[#20c58f]"
                  />
                  {INVOICE_DELIVERY_LABEL[m]}
                </label>
              ))}
            </div>
            {method && <p className="text-[11px] text-slate-500 mt-1">{METHOD_HELP[method]}</p>}
          </fieldset>

          <Input
            label={method === 'email' ? 'Fakturamejl' : 'Fakturamejl (valfritt)'}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="faktura@kund.se"
            required={method === 'email'}
          />
          <Input
            label={method === 'print' ? 'Fakturaadress' : 'Fakturaadress (valfritt)'}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Box 123, 831 90 Östersund"
            helperText="Gata eller box, postnummer och ort. Det kunden skrev i avtalet står här tills du rättar det."
            required={method === 'print'}
          />
          <Input
            label="Er referens (valfritt)"
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="T.ex. Ansvar 28310"
            helperText="Kundens referens eller ansvarskod. Står på alla kundens fakturor."
          />

          {formError && method && <p className="text-xs text-amber-300">{formError}</p>}

          <div className="flex items-center justify-end gap-2">
            {editing && evaluation.ok && (
              <button
                type="button"
                onClick={() => { setEditing(false); load() }}
                className="px-3 py-1.5 text-sm text-slate-300 hover:text-white rounded-lg transition-colors"
              >
                Avbryt
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !!formError}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#20c58f] hover:bg-[#1bb07e] text-sm text-[#fff] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Sparar...' : owner.customer_number ? 'Spara och uppdatera Fortnox' : 'Spara fakturaväg'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
