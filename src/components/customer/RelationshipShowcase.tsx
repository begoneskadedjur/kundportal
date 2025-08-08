// src/components/customer/RelationshipShowcase.tsx - Contact Persons Display
import React, { useState } from 'react'
import { User, Mail, Phone, Building2, Clock, Copy, CheckCircle } from 'lucide-react'
import Card from '../ui/Card'
import toast from 'react-hot-toast'

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
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedEmail(text)
    toast.success(`${type} kopierad!`)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  // Format name from email if no name provided
  const formatNameFromEmail = (email: string | null) => {
    if (!email) return 'Ej tilldelad'
    const name = email.split('@')[0]
    return name.split('.').map(part => 
      part.charAt(0).toUpperCase() + part.slice(1)
    ).join(' ')
  }

  const accountManager = customer.assigned_account_manager || 
    (customer.account_manager_email ? formatNameFromEmail(customer.account_manager_email) : null)

  return (
    <div className="space-y-6">
      {/* Your Account Manager */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 hover:border-emerald-500/30 transition-all duration-300">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Er kontaktperson</h3>
              <p className="text-sm text-slate-400">Dedikerad account manager</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Name */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <span className="text-sm text-slate-400">Namn</span>
              <span className="text-white font-medium">
                {accountManager || 'Ej tilldelad'}
              </span>
            </div>

            {/* Email */}
            {customer.account_manager_email && (
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg group hover:bg-slate-900/70 transition-colors">
                <span className="text-sm text-slate-400">E-post</span>
                <div className="flex items-center gap-2">
                  <a 
                    href={`mailto:${customer.account_manager_email}`}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    {customer.account_manager_email}
                  </a>
                  <button
                    onClick={() => copyToClipboard(customer.account_manager_email!, 'E-post')}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-700 rounded"
                    title="Kopiera e-post"
                  >
                    {copiedEmail === customer.account_manager_email ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Phone - if available in future */}
            {false && ( // Placeholder for future phone number
              <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg group hover:bg-slate-900/70 transition-colors">
                <span className="text-sm text-slate-400">Telefon</span>
                <div className="flex items-center gap-2">
                  <a 
                    href="tel:+46701234567"
                    className="text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    070-123 45 67
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* BeGone Support */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700 hover:border-blue-500/30 transition-all duration-300">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">BeGone Support</h3>
              <p className="text-sm text-slate-400">Allmän kundservice</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Support Email */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg group hover:bg-slate-900/70 transition-colors">
              <span className="text-sm text-slate-400">E-post</span>
              <div className="flex items-center gap-2">
                <a 
                  href="mailto:info@begone.se"
                  className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <Mail className="w-3 h-3" />
                  info@begone.se
                </a>
                <button
                  onClick={() => copyToClipboard('info@begone.se', 'E-post')}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-700 rounded"
                  title="Kopiera e-post"
                >
                  {copiedEmail === 'info@begone.se' ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Phone */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors">
              <span className="text-sm text-slate-400">Telefon</span>
              <a 
                href="tel:0102804410"
                className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                <Phone className="w-3 h-3" />
                010 280 44 10
              </a>
            </div>

            {/* Opening Hours */}
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
              <span className="text-sm text-slate-400">Öppettider</span>
              <div className="flex items-center gap-2 text-white">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-sm">08-17 mån-fre</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Your Company Info */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-800/50 border-slate-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Era uppgifter</h3>
              <p className="text-sm text-slate-400">Registrerad information</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Företag</span>
              <span className="text-white">{customer.company_name}</span>
            </div>
            {customer.organization_number && (
              <div className="flex justify-between py-2 border-b border-slate-700/50">
                <span className="text-slate-400">Org.nr</span>
                <span className="text-white">{customer.organization_number}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-400">Kontaktperson</span>
              <span className="text-white">{customer.contact_person}</span>
            </div>
            {customer.contact_address && (
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Adress</span>
                <span className="text-white text-right">{customer.contact_address}</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export default RelationshipShowcase