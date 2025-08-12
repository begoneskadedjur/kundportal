// src/components/customer/PendingQuoteNotification.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { FileText, X, Mail, Clock, AlertCircle, Building2 } from 'lucide-react'

interface Quote {
  id: string
  case_number: string
  title: string
  quote_sent_at: string
  oneflow_contract_id: string
  source_type: 'case' | 'contract'
  company_name?: string
  products?: string
}

interface PendingQuoteNotificationProps {
  quotes: Quote[]
  onDismiss: () => void
}

const PendingQuoteNotification: React.FC<PendingQuoteNotificationProps> = ({ 
  quotes, 
  onDismiss 
}) => {
  const handleEmailReminder = () => {
    // Istället för OneFlow-länk, påminn om att kolla e-post
    // Eventuellt kan vi lägga till en toast-notifikation här
  }

  const getQuoteDisplayInfo = (quote: Quote) => {
    // Förbättrad logik för att visa bättre information
    const isContract = quote.source_type === 'contract'
    
    // För contracts: använd företagsnamn + offertnummer
    if (isContract) {
      const quoteNumber = quote.case_number.includes('Offert #') 
        ? quote.case_number 
        : `Offert #${quote.id.slice(-6)}`
      
      return {
        displayTitle: quote.company_name || 'BeGone Skadedjursbekämpning',
        displayNumber: quoteNumber,
        description: quote.products ? `Inkluderar: ${quote.products}` : 'Skadedjursbekämpning'
      }
    }
    
    // För cases: använd befintlig logik men förbättrad
    return {
      displayTitle: quote.title,
      displayNumber: quote.case_number,
      description: 'Skadedjursbekämpning'
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-20 right-4 z-50 max-w-md"
    >
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg shadow-2xl border border-orange-400/30 overflow-hidden">
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
                  Kontrollera er e-post för att signera
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
          {quotes.map((quote) => {
            const displayInfo = getQuoteDisplayInfo(quote)
            
            return (
              <motion.div
                key={quote.id}
                whileHover={{ scale: 1.02 }}
                className="bg-white/95 backdrop-blur rounded-lg p-4 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-orange-600" />
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
                      </h4>
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">
                      {displayInfo.description}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3 text-blue-600" />
                      <span className="text-xs text-blue-700">
                        Skickad till er e-post för signering
                      </span>
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
              <span>Kontrollera er e-post för att signera offerten</span>
            </div>
            <p className="text-xs text-white/70 text-center">
              Offerten har skickats till er registrerade e-postadress
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

export default PendingQuoteNotification