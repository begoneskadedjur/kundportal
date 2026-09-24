// src/components/admin/procurement/detail/ManagementBlock.tsx
// Block 10: hantering. Status hos oss, ansvarig och anteckningar. Varje
// ändring loggas som händelse via updateNotice.

import toast from 'react-hot-toast'
import Select from '../../../ui/Select'
import type { NoticeWithRelations, ProcurementManagerProfile } from '../../../../services/procurementService'
import { OUR_STATUS_DOT, OUR_STATUS_LABEL, type ProcurementOurStatus } from '../../../../types/procurement'
import { StatusDot } from '../ui'
import { BlurText, Block, Label, type SaveNotice } from './fields'
import { errMsg, personName } from './helpers'

interface Props {
  notice: NoticeWithRelations
  managers: ProcurementManagerProfile[]
  onSave: SaveNotice
}

export default function ManagementBlock({ notice, managers, onSave }: Props) {
  const save = async (patch: Parameters<SaveNotice>[0], title: string) => {
    try {
      await onSave(patch, title)
      toast.success('Sparat')
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara'))
    }
  }

  const ownerOptions = [
    { value: '', label: 'Ingen ansvarig' },
    ...managers.map((m) => ({ value: m.user_id, label: m.display_name || m.email })),
  ]
  // Ansvarig som inte längre är upphandlingsansvarig ska ändå synas
  if (notice.owner_id && !managers.some((m) => m.user_id === notice.owner_id)) {
    ownerOptions.push({ value: notice.owner_id, label: 'Tidigare ansvarig' })
  }

  return (
    <Block id="hantering" num="10" title="Hantering">
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Select
              label="Status"
              value={notice.our_status}
              onChange={(v) => {
                if (v !== notice.our_status) void save({ our_status: v as ProcurementOurStatus }, `Status: ${OUR_STATUS_LABEL[v as ProcurementOurStatus]}`)
              }}
              options={(Object.keys(OUR_STATUS_LABEL) as ProcurementOurStatus[]).map((s) => ({ value: s, label: OUR_STATUS_LABEL[s] }))}
            />
            <div className="mt-1.5">
              <StatusDot dotClass={OUR_STATUS_DOT[notice.our_status]}>{OUR_STATUS_LABEL[notice.our_status]}</StatusDot>
            </div>
          </div>
          <div>
            <Select
              label="Ansvarig"
              value={notice.owner_id ?? ''}
              onChange={(v) => {
                if ((v || null) !== notice.owner_id) void save({ owner_id: v || null }, v ? `Ansvarig: ${personName(managers, v)}` : 'Ansvarig borttagen')
              }}
              options={ownerOptions}
            />
            {managers.length === 0 && <p className="text-[11px] text-slate-600 mt-1">Inga upphandlingsansvariga ännu. Sätt flaggan under Användarkonton (Personal).</p>}
          </div>
        </div>
        <div>
          <Label>Anteckningar</Label>
          <BlurText value={notice.notes} multiline rows={4} onCommit={(v) => void save({ notes: v }, 'Anteckningar ändrade')} placeholder="Interna anteckningar om upphandlingen" ariaLabel="Anteckningar" />
        </div>
      </div>
    </Block>
  )
}
