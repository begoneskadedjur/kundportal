// src/pages/admin/procurement/LessonsPage.tsx
// Marknad > Lärdomar (/marknad/lardomar): våra egna anbud med utfall, vunnet
// mot förlorat. Flyttad från Marknadens översikt i 3.63.0.

import LessonsSection from '../../../components/admin/procurement/market/LessonsSection'

export default function LessonsPage() {
  return (
    <div className="space-y-8">
      <LessonsSection />
    </div>
  )
}
