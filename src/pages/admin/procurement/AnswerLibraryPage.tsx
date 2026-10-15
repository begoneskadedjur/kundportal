// src/pages/admin/procurement/AnswerLibraryPage.tsx
// Anbud > Anbudsbibliotek (/anbud/bibliotek): sparade kvalitetssvar per
// kriterietyp. Flyttad från Inställningar i 3.63.0, eftersom biblioteket är
// ett arbetsverktyg för anbud.

import AnswerLibrary from '../../../components/admin/procurement/workshop/AnswerLibrary'

export default function AnswerLibraryPage() {
  return (
    <div className="space-y-8">
      <AnswerLibrary />
    </div>
  )
}
