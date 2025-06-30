// src/components/customer/QuickActions.tsx
import React from 'react'
import { Plus, FileText, Calendar, Phone, Mail, MessageCircle } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'

interface QuickActionsProps {
  onCreateCase: () => void
  customer: {
    company_name: string
    contact_person: string
    email: string
    phone?: string
    assigned_account_manager?: string
  }
}

const QuickActions: React.FC<QuickActionsProps> = ({ onCreateCase, customer }) => {
  const handleContactSupport = () => {
    window.open('mailto:support@begone.se?subject=Fråga från ' + customer.company_name, '_blank')
  }

  const handleCallSupport = () => {
    window.open('tel:010-123-45-67', '_blank')
  }

  const handleContactAccountManager = () => {
    if (customer.assigned_account_manager) {
      window.open(`mailto:${customer.assigned_account_manager}?subject=Fråga från ${customer.company_name}`, '_blank')
    } else {
      handleContactSupport()
    }
  }

  const actions = [
    {
      title: 'Skapa nytt ärende',
      description: 'Rapportera ett problem eller boka service',
      icon: Plus,
      color: 'text-green-500',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30',
      onClick: onCreateCase,
      primary: true
    },
    {
      title: 'Kontakta kundtjänst',
      description: 'Skicka e-post till vårt supportteam',
      icon: Mail,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30',
      onClick: handleContactSupport
    },
    {
      title: 'Ring oss',
      description: 'Direktkontakt för akuta ärenden',
      icon: Phone,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30',
      onClick: handleCallSupport
    },
    {
      title: 'Kontakta din kontakt',
      description: customer.assigned_account_manager 
        ? `Din kontakt: ${customer.assigned_account_manager.split('@')[0].replace('.', ' ')}`
        : 'Kontakta din ansvarige',
      icon: MessageCircle,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30',
      onClick: handleContactAccountManager
    }
  ]

  return (
    <Card>
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">Snabbåtgärder</h3>
        <p className="text-slate-400 text-sm">
          Vanliga åtgärder för att hantera ditt konto och ärenden
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <div
              key={action.title}
              onClick={action.onClick}
              className={`
                group cursor-pointer p-4 rounded-lg border-2 transition-all duration-200
                ${action.primary 
                  ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:border-green-500/50 hover:from-green-500/20 hover:to-emerald-500/20' 
                  : `${action.bgColor} ${action.borderColor} hover:${action.borderColor.replace('/30', '/50')}`
                }
                hover:scale-[1.02] hover:shadow-lg
              `}
            >
              <div className="flex items-start space-x-4">
                <div className={`
                  w-12 h-12 rounded-lg flex items-center justify-center
                  ${action.primary ? 'bg-green-500/30' : action.bgColor}
                  group-hover:scale-110 transition-transform duration-200
                `}>
                  <Icon className={`w-6 h-6 ${action.color}`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`
                    font-semibold mb-1 transition-colors duration-200
                    ${action.primary ? 'text-green-100 group-hover:text-green-50' : 'text-white group-hover:text-slate-100'}
                  `}>
                    {action.title}
                  </h4>
                  <p className={`
                    text-sm transition-colors duration-200
                    ${action.primary ? 'text-green-200/80 group-hover:text-green-200' : 'text-slate-400 group-hover:text-slate-300'}
                  `}>
                    {action.description}
                  </p>
                </div>
              </div>

              {action.primary && (
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  <div className="flex items-center text-green-300 text-xs">
                    <span>Tryck för att komma igång</span>
                    <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Contact Info */}
      <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-2">Kontaktinformation</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center text-slate-300">
            <Phone className="w-4 h-4 mr-2 text-slate-400" />
            <span>010-123 45 67</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Mail className="w-4 h-4 mr-2 text-slate-400" />
            <span>support@begone.se</span>
          </div>
          <div className="flex items-center text-slate-300">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <span>Vardagar 08:00-17:00</span>
          </div>
          <div className="flex items-center text-slate-300">
            <MessageCircle className="w-4 h-4 mr-2 text-slate-400" />
            <span>Akut: 24/7 beredskap</span>
          </div>
        </div>
      </div>
    </Card>
  )
}

export default QuickActions