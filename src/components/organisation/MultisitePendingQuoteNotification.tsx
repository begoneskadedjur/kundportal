// src/components/organisation/MultisitePendingQuoteNotification.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { FileText, X, Mail, Clock, AlertCircle, Building2, Users, MapPin, Crown } from 'lucide-react'

interface MultisiteQuote {
  id: string
  case_number: string
  title: string
  quote_sent_at: string
  oneflow_contract_id: string
  source_type: 'case' | 'contract'
  company_name?: string
  products?: string
  site_name?: string
  recipient_role: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
  recipient_sites?: string[]
  region?: string
}

interface MultisitePendingQuoteNotificationProps {
  quotes: MultisiteQuote[]
  userRole: 'platsansvarig' | 'regionchef' | 'verksamhetschef'
  onDismiss: () => void
  organizationName?: string
}

const MultisitePendingQuoteNotification: React.FC<MultisitePendingQuoteNotificationProps> = ({ 
  quotes, 
  userRole,
  onDismiss,
  organizationName 
}) => {
  const getQuoteDisplayInfo = (quote: MultisiteQuote) => {
    const isContract = quote.source_type === 'contract'
    
    if (isContract) {
      const quoteNumber = quote.case_number.includes('Offert #') 
        ? quote.case_number 
        : `Offert #${quote.id.slice(-6)}`
      
      return {
        displayTitle: quote.company_name || organizationName || 'BeGone Skadedjursbekämpning',
        displayNumber: quoteNumber,
        description: quote.products ? `Inkluderar: ${quote.products}` : 'Skadedjursbekämpning',
        siteName: quote.site_name
      }
    }
    
    return {
      displayTitle: quote.title,
      displayNumber: quote.case_number,
      description: 'Skadedjursbekämpning',
      siteName: quote.site_name
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Idag'
    if (diffInDays === 1) return 'Igår'
    if (diffInDays < 7) return `${diffInDays} dagar sedan`
    
    return date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short'
    })
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'platsansvarig':
        return <Building2 className="w-4 h-4 text-blue-500" />
      case 'regionchef':
        return <MapPin className="w-4 h-4 text-purple-500" />
      case 'verksamhetschef':
        return <Crown className="w-4 h-4 text-amber-500" />
      default:
        return <Users className="w-4 h-4 text-gray-500" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'platsansvarig':
        return 'Platschef'
      case 'regionchef':
        return 'Regionchef'
      case 'verksamhetschef':
        return 'Verksamhetschef'
      default:
        return 'Okänd roll'
    }
  }

  const getRecipientInfo = (quote: MultisiteQuote) => {
    if (quote.recipient_role === userRole) {
      return {
        type: 'direct',
        text: 'Offert till dig'
      }
    }
    
    // Show who received the quote if it's not for current user
    const roleLabel = getRoleLabel(quote.recipient_role)
    if (quote.recipient_role === 'regionchef' && quote.recipient_sites) {
      const siteList = quote.recipient_sites.length > 2 
        ? `${quote.recipient_sites.slice(0, 2).join(', ')} (+${quote.recipient_sites.length - 2} till)`
        : quote.recipient_sites.join(', ')
      return {
        type: 'indirect',
        text: `Till ${roleLabel} för ${siteList}`
      }
    }
    
    return {
      type: 'indirect', 
      text: `Till ${roleLabel}`
    }
  }

  // Group quotes by recipient type
  const directQuotes = quotes.filter(q => q.recipient_role === userRole)
  const indirectQuotes = quotes.filter(q => q.recipient_role !== userRole)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-20 right-4 z-50 max-w-md"
    >
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-2xl border border-blue-400/30 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">
                  {quotes.length === 1 ? 'Väntande offert' : `${quotes.length} väntande offerter`}
                </h3>
                <p className="text-white/80 text-sm">
                  Kontrollera e-post för signering
                </p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Stäng notifikation"
            >
              <X className="w-5 h-5 text-white/80 hover:text-white" />
            </button>
          </div>
        </div>

        {/* Quote List */}
        <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
          {/* Direct quotes first */}
          {directQuotes.map((quote) => {
            const displayInfo = getQuoteDisplayInfo(quote)
            const recipientInfo = getRecipientInfo(quote)
            
            return (
              <motion.div
                key={quote.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white/95 backdrop-blur rounded-lg p-4 hover:shadow-lg transition-all border-l-4 border-l-emerald-500"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">
                        {displayInfo.displayNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        • {formatDate(quote.quote_sent_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-600" />
                      <h4 className="font-medium text-gray-800">
                        {displayInfo.displayTitle}
                        {displayInfo.siteName && (
                          <span className="text-sm text-gray-600 ml-1">
                            - {displayInfo.siteName}
                          </span>
                        )}
                      </h4>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">
                      {displayInfo.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-emerald-600" />
                        <span className="text-xs text-emerald-700 font-medium">
                          {recipientInfo.text}
                        </span>
                      </div>
                      {getRoleIcon(quote.recipient_role)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}

          {/* Indirect quotes (for information) */}
          {indirectQuotes.map((quote) => {
            const displayInfo = getQuoteDisplayInfo(quote)
            const recipientInfo = getRecipientInfo(quote)
            
            return (
              <motion.div
                key={quote.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white/80 backdrop-blur rounded-lg p-4 hover:shadow-lg transition-all border-l-4 border-l-blue-400"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {displayInfo.displayNumber}
                      </span>
                      <span className="text-xs text-gray-500">
                        • {formatDate(quote.quote_sent_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      <h4 className="font-medium text-gray-700">
                        {displayInfo.displayTitle}
                        {displayInfo.siteName && (
                          <span className="text-sm text-gray-500 ml-1">
                            - {displayInfo.siteName}
                          </span>
                        )}
                      </h4>
                    </div>
                    
                    <p className="text-xs text-gray-500 mb-2">
                      {displayInfo.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-blue-500" />
                        <span className="text-xs text-blue-600">
                          {recipientInfo.text}
                        </span>
                      </div>
                      {getRoleIcon(quote.recipient_role)}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/10 backdrop-blur-sm border-t border-white/10">
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-white/90 text-sm">
              <Mail className="w-4 h-4" />
              <span>
                {directQuotes.length > 0 
                  ? 'Kontrollera er e-post för att signera'
                  : 'Offert skickad till ansvarig person'
                }
              </span>
            </div>
            <p className="text-xs text-white/70 text-center">
              {directQuotes.length > 0 
                ? 'Offerten har skickats till er registrerade e-postadress'
                : 'Ni informeras när offerten behandlas'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Email reminder */}
      <div className="text-xs text-gray-400 text-center mt-2 px-4 space-y-1">
        <p>Hittar ni inte e-posten? Kontrollera er skräppost</p>
        <p className="text-gray-500">eller kontakta oss på info@begone.se</p>
      </div>
    </motion.div>
  )
}

export default MultisitePendingQuoteNotification