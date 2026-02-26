// src/components/organisation/MultisiteQuotesView.tsx
// Wrapper för offerter: per enhet eller ackumulerat

import React from 'react'
import QuoteListView from '../customer/QuoteListView'
import MultisiteQuoteListView from './MultisiteQuoteListView'

interface MultisiteQuotesViewProps {
  selectedSiteId: string | 'all'
  userRoleType: 'verksamhetschef' | 'regionchef' | 'platsansvarig'
}

export default function MultisiteQuotesView({
  selectedSiteId,
  userRoleType
}: MultisiteQuotesViewProps) {
  // En enhet vald → använd QuoteListView direkt
  if (selectedSiteId !== 'all') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <QuoteListView customerId={selectedSiteId} />
        </div>
      </div>
    )
  }

  // Alla enheter → MultisiteQuoteListView (hanterar multi-site internt)
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MultisiteQuoteListView userRole={userRoleType} />
      </div>
    </div>
  )
}
