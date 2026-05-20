import React, { useState, useEffect } from 'react'
import { Mail, Phone, Clock, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

interface RelationshipShowcaseProps {
  customer: {
    assigned_account_manager: string | null
    account_manager_email: string | null
    sales_person: string | null
    sales_person_email: string | null
    contact_person: string
    contact_email: string
    contact_phone: string | null
    contact_address: string | null
    company_name: string
    organization_number: string | null
  }
}

const RelationshipShowcase: React.FC<RelationshipShowcaseProps> = ({ customer }) => {
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [accountManagerName, setAccountManagerName] = useState<string | null>(null)

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    toast.success(`${label} kopierad!`)
    setTimeout(() => setCopiedText(null), 2000)
  }

  useEffect(() => {
    const fetchName = async () => {
      if (!customer.account_manager_email) {
        setAccountManagerName(null)
        return
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('email', customer.account_manager_email)
          .maybeSingle()

        if (!error && data?.display_name) {
          setAccountManagerName(data.display_name)
        } else {
          const name = customer.account_manager_email.split('@')[0]
          setAccountManagerName(
            name.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
          )
        }
      } catch {
        const name = customer.account_manager_email.split('@')[0]
        setAccountManagerName(
          name.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
        )
      }
    }
    fetchName()
  }, [customer.account_manager_email])

  const accountManager = accountManagerName || customer.assigned_account_manager

  return (
    <div className="space-y-4">
      {/* Er kontaktperson */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Er kontaktperson</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Namn</span>
            <span className="text-sm text-white font-medium">
              {accountManager || 'Ej tilldelad'}
            </span>
          </div>
          {customer.account_manager_email && (
            <div className="flex items-center justify-between group">
              <span className="text-xs text-slate-500">E-post</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(customer.account_manager_email!, 'E-post')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Kopiera"
                >
                  {copiedText === customer.account_manager_email ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                  )}
                </button>
                <a
                  href={`mailto:${customer.account_manager_email}`}
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {customer.account_manager_email}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BeGone Support */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">BeGone Support</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between group">
            <span className="text-xs text-slate-500">E-post</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard('info@begone.se', 'E-post')}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                title="Kopiera"
              >
                {copiedText === 'info@begone.se' ? (
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-300" />
                )}
              </button>
              <a
                href="mailto:info@begone.se"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                info@begone.se
              </a>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Telefon</span>
            <a
              href="tel:0102804410"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <Phone className="w-3 h-3" />
              010 280 44 10
            </a>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Öppettider</span>
            <div className="flex items-center gap-1.5 text-sm text-white">
              <Clock className="w-3 h-3 text-slate-500" />
              <span className="font-mono">08:00–17:00</span>
              <span className="text-slate-400">mån–fre</span>
            </div>
          </div>
        </div>
      </div>

      {/* Era uppgifter */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Era uppgifter</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Företag</span>
            <span className="text-white">{customer.company_name}</span>
          </div>
          {customer.organization_number && (
            <div className="flex justify-between">
              <span className="text-slate-500">Org.nr</span>
              <span className="text-white font-mono">{customer.organization_number}</span>
            </div>
          )}
          {customer.contact_person && (
            <div className="flex justify-between">
              <span className="text-slate-500">Kontaktperson</span>
              <span className="text-white">{customer.contact_person}</span>
            </div>
          )}
          {customer.contact_address && (
            <div className="flex justify-between gap-4">
              <span className="text-slate-500 flex-shrink-0">Adress</span>
              <span className="text-white text-right">{customer.contact_address}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default RelationshipShowcase
