// src/components/customer/PendingQuoteNotification.tsx
import React from 'react'
import { motion } from 'framer-motion'
import { FileText, X, ExternalLink, Clock, AlertCircle } from 'lucide-react'

interface Quote {
  id: string
  case_number: string
  title: string
  quote_sent_at: string
  oneflow_contract_id: string
}

interface PendingQuoteNotificationProps {
  quotes: Quote[]
  onDismiss: () => void
}

const PendingQuoteNotification: React.FC<PendingQuoteNotificationProps> = ({ 
  quotes, 
  onDismiss 
}) => {
  const handleOpenQuote = (oneflowContractId: string) => {
    // Öppna Oneflow-länken för att visa offerten
    const oneflowUrl = `https://app.oneflow.com/contracts/${oneflowContractId}`
    window.open(oneflowUrl, '_blank')
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
                  Granska och signera för att komma igång
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
          {quotes.map((quote) => (
            <motion.div
              key={quote.id}
              whileHover={{ scale: 1.02 }}
              className="bg-white/95 backdrop-blur rounded-lg p-4 cursor-pointer hover:shadow-lg transition-all"
              onClick={() => handleOpenQuote(quote.oneflow_contract_id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-900">
                      {quote.case_number}
                    </span>
                    <span className="text-xs text-gray-500">
                      • {formatDate(quote.quote_sent_at)}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-800 mb-2">
                    {quote.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-amber-600" />
                    <span className="text-xs text-amber-700">
                      Väntar på din signatur
                    </span>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-orange-600 flex-shrink-0 ml-3" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/10 backdrop-blur-sm border-t border-white/10">
          <button
            onClick={() => {
              if (quotes.length === 1) {
                handleOpenQuote(quotes[0].oneflow_contract_id)
              }
            }}
            className="w-full py-2 px-4 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            {quotes.length === 1 ? 'Granska offert' : 'Visa alla offerter'}
          </button>
        </div>
      </div>

      {/* Subtle reminder text */}
      <p className="text-xs text-gray-400 text-center mt-2 px-4">
        Klicka för att öppna i Oneflow
      </p>
    </motion.div>
  )
}

export default PendingQuoteNotification