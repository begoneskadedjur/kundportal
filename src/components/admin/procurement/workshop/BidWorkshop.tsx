// src/components/admin/procurement/workshop/BidWorkshop.tsx
// Anbudsverkstaden (planens avsnitt 5b) som ett block på detaljsidan:
// kravlista, prisbilaga, frågor till köparen och inlämningskontroll.
// Portalen producerar underlag och filer; anbudet lämnas på köparens plattform.

import type { NoticeWithRelations, ProcurementManagerProfile } from '../../../../services/procurementService'
import type { PricingSettings } from '../../../../types/pricingSettings'
import type {
  ProcurementBid,
  ProcurementDocument,
  ProcurementEvent,
  ProcurementPriceLine,
  ProcurementQuestion,
  ProcurementRequirement,
} from '../../../../types/procurement'
import { Block } from '../detail/fields'
import RequirementsList from './RequirementsList'
import PriceAppendix from './PriceAppendix'
import BuyerQuestions from './BuyerQuestions'
import SubmissionCheck from './SubmissionCheck'

interface Props {
  notice: NoticeWithRelations
  documents: ProcurementDocument[]
  requirements: ProcurementRequirement[]
  questions: ProcurementQuestion[]
  priceLines: ProcurementPriceLine[]
  bids: ProcurementBid[]
  events: ProcurementEvent[]
  managers: ProcurementManagerProfile[]
  settings: PricingSettings | null
  onRequirementsChanged: () => void
  onQuestionsChanged: () => void
  onPriceLinesChanged: () => void
  onEventsChanged: () => void
}

export default function BidWorkshop(props: Props) {
  const { notice, documents, requirements, questions, priceLines, bids, events, managers, settings } = props
  const currentBid = bids.find((b) => b.is_current) ?? bids[0] ?? null

  return (
    <Block id="verkstad" num="6b" title="Anbudsverkstad" hint="Underlag och filer för anbudet. Anbudet lämnas alltid på köparens plattform.">
      <div className="divide-y divide-slate-800">
        <div className="p-4">
          <RequirementsList noticeId={notice.id} requirements={requirements} documents={documents} managers={managers} onChanged={props.onRequirementsChanged} />
        </div>
        <div className="p-4">
          <PriceAppendix notice={notice} lines={priceLines} settings={settings} currentBid={currentBid} onChanged={props.onPriceLinesChanged} />
        </div>
        <div className="p-4">
          <BuyerQuestions notice={notice} questions={questions} onChanged={props.onQuestionsChanged} />
        </div>
        <div className="p-4">
          <SubmissionCheck
            notice={notice}
            requirements={requirements}
            documents={documents}
            priceLines={priceLines}
            currentBid={currentBid}
            events={events}
            onEventsChanged={props.onEventsChanged}
          />
        </div>
      </div>
    </Block>
  )
}
