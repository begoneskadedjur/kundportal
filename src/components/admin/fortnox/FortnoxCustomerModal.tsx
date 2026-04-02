import { useEffect, useState } from 'react'
import { Building2, Mail, Phone, MapPin, Globe, Hash, User, CreditCard, FileText, Truck, Loader2, ExternalLink } from 'lucide-react'
import Modal from '../../ui/Modal'
import { FortnoxService, FortnoxCustomer } from '../../../services/fortnoxService'
import toast from 'react-hot-toast'

interface Props {
  customerNumber: string | null
  onClose: () => void
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex gap-2 py-1.5 border-b border-slate-700/40 last:border-0">
      <span className="text-xs text-slate-500 w-36 shrink-0">{label}</span>
      <span className="text-xs text-slate-200 break-all">{value}</span>
    </div>
  )
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div>{children}</div>
    </div>
  )
}

export default function FortnoxCustomerModal({ customerNumber, onClose }: Props) {
  const [customer, setCustomer] = useState<FortnoxCustomer | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!customerNumber) return
    setCustomer(null)
    setLoading(true)
    FortnoxService.getCustomer(customerNumber)
      .then(setCustomer)
      .catch(() => toast.error('Kunde inte hämta kunduppgifter'))
      .finally(() => setLoading(false))
  }, [customerNumber])

  const hasDelivery = customer && (
    customer.DeliveryAddress1 || customer.DeliveryCity || customer.DeliveryName
  )

  const hasBilling = customer && (
    customer.PaymentTerms || customer.Currency || customer.PriceList ||
    customer.CreditLimit || customer.InvoiceDiscount || customer.VATType
  )

  const hasRefs = customer && (
    customer.OurReference || customer.YourReference || customer.CostCenter ||
    customer.Project || customer.GLN
  )

  return (
    <Modal
      isOpen={!!customerNumber}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-slate-400" />
          <span>{customer?.Name ?? 'Kunduppgifter'}</span>
        </div>
      }
      subtitle={customerNumber ? `Kundnummer #${customerNumber}` : undefined}
      headerActions={
        customer ? (
          <a
            href={`https://apps.fortnox.se/fs/fs/customercard.php?search=${customerNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          >
            Öppna i Fortnox <ExternalLink className="w-3 h-3" />
          </a>
        ) : undefined
      }
    >
      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        )}

        {!loading && customer && (
          <>
            {/* Kontakt */}
            <Section title="Kontakt" icon={User}>
              <Row label="Namn" value={customer.Name} />
              <Row label="Org.nummer" value={customer.OrganisationNumber} />
              <Row label="GLN" value={customer.GLN} />
              <Row label="Kundtyp" value={customer.CustomerType === 'COMPANY' ? 'Företag' : customer.CustomerType === 'PRIVATE' ? 'Privatperson' : customer.CustomerType} />
              <Row label="Status" value={customer.Active ? 'Aktiv' : 'Inaktiv'} />
              <Row label="Kommentarer" value={customer.Comments} />
            </Section>

            {/* Kommunikation */}
            <Section title="Kommunikation" icon={Mail}>
              <Row label="E-post" value={customer.Email} />
              <Row label="Faktura e-post" value={customer.EmailInvoice} />
              <Row label="Faktura BCC" value={customer.EmailInvoiceBCC} />
              <Row label="Telefon 1" value={customer.Phone1} />
              <Row label="Telefon 2" value={customer.Phone2} />
              <Row label="Fax" value={customer.Fax} />
              <Row label="Webbplats" value={customer.WWW} />
            </Section>

            {/* Besöksadress */}
            <Section title="Adress" icon={MapPin}>
              <Row label="Adress 1" value={customer.Address1} />
              <Row label="Adress 2" value={customer.Address2} />
              <Row label="Postnummer" value={customer.ZipCode} />
              <Row label="Stad" value={customer.City} />
              <Row label="Land" value={customer.Country} />
            </Section>

            {/* Leveransadress */}
            {hasDelivery && (
              <Section title="Leveransadress" icon={Truck}>
                <Row label="Namn" value={customer.DeliveryName} />
                <Row label="Adress 1" value={customer.DeliveryAddress1} />
                <Row label="Adress 2" value={customer.DeliveryAddress2} />
                <Row label="Postnummer" value={customer.DeliveryZipCode} />
                <Row label="Stad" value={customer.DeliveryCity} />
                <Row label="Land" value={customer.DeliveryCountry} />
                <Row label="Telefon" value={customer.DeliveryPhone} />
              </Section>
            )}

            {/* Fakturering */}
            {hasBilling && (
              <Section title="Fakturering" icon={CreditCard}>
                <Row label="Valuta" value={customer.Currency} />
                <Row label="Prislista" value={customer.PriceList} />
                <Row label="Betalningsvillkor" value={customer.PaymentTerms} />
                <Row label="Momstyp" value={customer.VATType} />
                <Row label="Kreditgräns" value={customer.CreditLimit ? `${customer.CreditLimit.toLocaleString('sv-SE')} kr` : null} />
                <Row label="Fakturarabatt" value={customer.InvoiceDiscount ? `${customer.InvoiceDiscount}%` : null} />
              </Section>
            )}

            {/* Referenser */}
            {hasRefs && (
              <Section title="Referenser" icon={FileText}>
                <Row label="Vår referens" value={customer.OurReference} />
                <Row label="Er referens" value={customer.YourReference} />
                <Row label="Kostnadsställe" value={customer.CostCenter} />
                <Row label="Projekt" value={customer.Project} />
              </Section>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
