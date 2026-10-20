// src/components/admin/procurement/rfi/RfiFormBlock.tsx
// Steget Underlag i RFI-läget (3.71.0): köparens frågeformulär. Per Word-
// eller PDF-dokument visas hur många frågor som lästs ut och hur många som
// har plats för svaret i dokumentet, med knappen "Läs in frågorna" som kör
// utläsningen (igen). Svar på frågor med samma text följer med när
// frågorna läses in på nytt. Köparens bakgrundstext visas hopfälld.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { ProcurementRfiService } from '../../../../services/procurementRfiService'
import type { ProcurementDocument, ProcurementRfiQuestion } from '../../../../types/procurement'
import { EmptyState, LinkButton, SecondaryButton, StatusDot } from '../ui'
import { Block } from '../detail/fields'
import { errMsg, useConfirm } from '../detail/helpers'

const FORM_RE = /\.(docx|pdf)$/i

interface Props {
  documents: ProcurementDocument[]
  questions: ProcurementRfiQuestion[]
  onChanged: () => void
}

export default function RfiFormBlock({ documents, questions, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [showBg, setShowBg] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()
  const forms = documents.filter((d) => FORM_RE.test(d.file_name) || /wordprocessingml|pdf/.test(d.mime_type ?? ''))

  const run = async (doc: ProcurementDocument, replace: boolean) => {
    setBusy(doc.id)
    try {
      const r = await ProcurementRfiService.readDocument(doc.id, replace)
      if ('conflict' in r) {
        setBusy(null)
        confirm(
          'Läs in frågorna igen',
          `${r.conflict} frågor är redan inlästa ur ${doc.file_name}. Läs in dem igen? Svar på frågor med samma text följer med till den nya inläsningen.`,
          async () => {
            await run(doc, true)
          },
          { confirmLabel: 'Läs in igen', variant: 'warning' }
        )
        return
      }
      toast.success(
        `${r.questions} frågor inlästa${r.kind === 'docx' ? `, ${r.anchored} med plats för svaret i dokumentet` : ''}${r.carried ? `. ${r.carried} svar följde med` : ''}.`
      )
      if (r.aiError) toast(`AI:n svarade inte (${r.aiError.slice(0, 80)}). Frågorna lästes med den fasta tolkningen.`, { duration: 7000 })
    } catch (e) {
      toast.error(errMsg(e, 'Frågorna kunde inte läsas'))
    } finally {
      setBusy(null)
      onChanged()
    }
  }

  return (
    <Block icon="upphandling.rfi" title="Frågeformulär" framed={false}>
      <p className="text-[12.5px] text-slate-400 mb-3">
        En RFI har inga krav och inget pris. Portalen läser ut varje fråga ordagrant ur köparens formulär och var svaret ska stå, så att svaren kan skrivas in i en kopia av Word-filen. En PDF ger bara frågorna.
      </p>
      {forms.length === 0 ? (
        <div className="rounded-[10px] border border-slate-800">
          <EmptyState title="Inget formulär uppladdat" hint="Släpp köparens frågeformulär (Word eller PDF) i dokumentytan, så läses frågorna in." />
        </div>
      ) : (
        <ul className="divide-y divide-slate-800 border-y border-slate-800">
          {forms.map((d) => {
            const own = questions.filter((q) => q.document_id === d.id)
            const anchored = own.filter((q) => q.anchor?.verified).length
            const rfi = d.ai_extraction?.rfi
            return (
              <li key={d.id} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-slate-200 break-words">{d.file_name}</div>
                  <div className="mt-0.5">
                    {own.length > 0 ? (
                      <StatusDot tone={anchored === own.length || rfi?.kind === 'pdf' ? 'good' : 'warn'}>
                        {own.length} frågor
                        {rfi?.kind === 'pdf' ? ', PDF utan plats för svaren' : `, ${anchored} med plats för svaret`}
                        {rfi?.method === 'tolkning' ? ', fast tolkning' : rfi?.method === 'ai' ? ', AI' : ''}
                      </StatusDot>
                    ) : d.ai_status === 'running' || d.ai_status === 'pending' ? (
                      <StatusDot tone="warn">Läses</StatusDot>
                    ) : (
                      <StatusDot tone="muted">Frågorna är inte inlästa</StatusDot>
                    )}
                  </div>
                </div>
                <SecondaryButton onClick={() => void run(d, false)} disabled={busy != null || d.ai_status === 'running'}>
                  <Icon name={busy === d.id ? 'allman.laddar' : 'upphandling.rfi'} size={20} className={busy === d.id ? 'animate-spin' : ''} />
                  {busy === d.id ? 'Läser ...' : 'Läs in frågorna'}
                </SecondaryButton>
              </li>
            )
          })}
        </ul>
      )}
      {forms.some((d) => d.ai_extraction?.rfi?.background) && (
        <div className="mt-4">
          <LinkButton tone="muted" onClick={() => setShowBg((s) => !s)}>
            {showBg ? 'Dölj köparens bakgrund' : 'Visa köparens bakgrund (nuvarande avtal och mål)'}
          </LinkButton>
          {showBg &&
            forms
              .filter((d) => d.ai_extraction?.rfi?.background)
              .map((d) => (
                <p key={d.id} className="mt-2 pl-3 border-l border-slate-700 text-[12.5px] leading-relaxed text-slate-400 whitespace-pre-wrap">
                  {d.ai_extraction?.rfi?.background}
                </p>
              ))}
        </div>
      )}
      {confirmNode}
    </Block>
  )
}
