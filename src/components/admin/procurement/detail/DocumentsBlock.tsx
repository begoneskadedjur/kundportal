// src/components/admin/procurement/detail/DocumentsBlock.tsx
// Block 2: källposter med länkar och upphandlingens dokument. Uppladdning
// startar AI-extraktionen på servern; sidan pollar listan medan något läses.

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { ExternalLink, Upload } from 'lucide-react'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import { DOC_TYPE_LABEL, type ProcurementDocType, type ProcurementDocument } from '../../../../types/procurement'
import { EmptyState, LinkButton, StatusDot } from '../ui'
import { fmtDate, fmtDateTime, tableCls, type Tone } from '../uiFormat'
import { Block, SubHeading, selectCls } from './fields'
import { errMsg, useConfirm } from './helpers'

const ACCEPT = '.pdf,.xlsx,.xls,.docx,.doc,.zip'
const ACCEPT_RE = /\.(pdf|xlsx|xls|docx|doc|zip)$/i

const AI_STATUS: Record<ProcurementDocument['ai_status'], { label: string; tone: Tone }> = {
  pending: { label: 'Väntar på AI', tone: 'warn' },
  running: { label: 'AI läser', tone: 'info' },
  done: { label: 'Läst av AI', tone: 'good' },
  failed: { label: 'AI misslyckades', tone: 'bad' },
  skipped: { label: 'Ej AI-läst', tone: 'muted' },
}

const SOURCE_LABEL: Record<string, string> = {
  mercell: 'Mercell',
  ted: 'TED',
  kommers: 'Kommers',
  uhm: 'Upphandlingsmyndigheten',
  email: 'E-post',
  manual: 'Manuell',
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} kB`
}

interface Props {
  notice: NoticeWithRelations
  documents: ProcurementDocument[]
  onDocumentsChanged: () => void
}

export default function DocumentsBlock({ notice, documents, onDocumentsChanged }: Props) {
  const [docType, setDocType] = useState<ProcurementDocType>('tender_documents')
  const [uploading, setUploading] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [rerunning, setRerunning] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const { confirm, node: confirmNode } = useConfirm()

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files)
    const ok = list.filter((f) => ACCEPT_RE.test(f.name))
    if (ok.length < list.length) toast.error('Bara PDF, Excel, Word och zip kan laddas upp')
    for (const f of ok) {
      setUploading(f.name)
      try {
        await ProcurementService.uploadDocument(notice.id, f, docType)
        toast.success(`${f.name} uppladdad`)
      } catch (e) {
        toast.error(errMsg(e, `Kunde inte ladda upp ${f.name}`))
      }
    }
    setUploading(null)
    onDocumentsChanged()
  }

  const open = async (doc: ProcurementDocument) => {
    // Öppna fliken direkt så att popup-spärren inte slår till efter await
    const win = window.open('', '_blank')
    try {
      const url = await ProcurementService.getDocumentUrl(doc.storage_path)
      if (win) win.location.href = url
      else window.location.href = url
    } catch (e) {
      win?.close()
      toast.error(errMsg(e, 'Kunde inte öppna filen'))
    }
  }

  const rerun = async (doc: ProcurementDocument) => {
    setRerunning((s) => new Set(s).add(doc.id))
    onDocumentsChanged()
    try {
      await ProcurementService.extractDocument(doc.id)
      toast.success('AI-läsningen är klar')
    } catch (e) {
      toast.error(errMsg(e, 'AI-läsningen misslyckades'))
    } finally {
      setRerunning((s) => {
        const n = new Set(s)
        n.delete(doc.id)
        return n
      })
      onDocumentsChanged()
    }
  }

  const changeType = async (doc: ProcurementDocument, t: ProcurementDocType) => {
    try {
      await ProcurementService.setDocumentType(doc.id, t)
      onDocumentsChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte ändra typen'))
    }
  }

  const remove = (doc: ProcurementDocument) =>
    confirm('Ta bort dokument', `Ta bort ${doc.file_name}? Filen raderas från lagringen.`, async () => {
      try {
        await ProcurementService.deleteDocument(doc)
        toast.success('Dokumentet borttaget')
        onDocumentsChanged()
      } catch (e) {
        toast.error(errMsg(e, 'Kunde inte ta bort dokumentet'))
      }
    })

  const sources = notice.sources ?? []

  return (
    <Block id="kallor" num="2" title="Källor och dokument">
      <div className="p-4 space-y-5">
        <div>
          <SubHeading>Källposter</SubHeading>
          {sources.length === 0 && !notice.platform_url && !notice.document_url ? (
            <p className="text-[12px] text-slate-500">Inga källposter.</p>
          ) : (
            <ul className="space-y-1">
              {sources.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                  <span className="text-slate-200 w-28 shrink-0">{SOURCE_LABEL[s.source] ?? s.source}</span>
                  <span className="text-slate-500 tabular-nums">
                    {s.source_id}
                    {s.source_sub ? `, ${s.source_sub}` : ''}
                  </span>
                  <span className="text-[11px] text-slate-600 tabular-nums">hämtad {fmtDate(s.fetched_at)}</span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#20c58f] hover:underline">
                      Öppna <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </li>
              ))}
              {notice.platform_url && (
                <li className="flex items-baseline gap-x-3 text-[12.5px]">
                  <span className="text-slate-200 w-28 shrink-0">Köparens plattform</span>
                  <a href={notice.platform_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#20c58f] hover:underline break-all">
                    {notice.platform_url.replace(/^https?:\/\//, '').slice(0, 60)} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </li>
              )}
              {notice.document_url && (
                <li className="flex items-baseline gap-x-3 text-[12.5px]">
                  <span className="text-slate-200 w-28 shrink-0">Dokument</span>
                  <a href={notice.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#20c58f] hover:underline break-all">
                    {notice.document_url.replace(/^https?:\/\//, '').slice(0, 60)} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        <div>
          <SubHeading>Ladda upp</SubHeading>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-stretch">
            <select className={`${selectCls} sm:w-56`} value={docType} onChange={(e) => setDocType(e.target.value as ProcurementDocType)} aria-label="Dokumenttyp">
              {(Object.keys(DOC_TYPE_LABEL) as ProcurementDocType[]).map((t) => (
                <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
              ))}
            </select>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click()
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                if (e.dataTransfer.files.length > 0) void upload(e.dataTransfer.files)
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-dashed text-[12px] cursor-pointer transition-colors ${
                dragOver ? 'border-[#20c58f] text-slate-200 bg-[#20c58f]/5' : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? `Laddar upp ${uploading}` : 'Dra filer hit eller klicka för att välja (PDF, xlsx, docx, zip)'}
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) void upload(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-[11px] text-slate-600 mt-1">
            AI läser underlaget och fyller tomma fält: volymer, kriterier, prismodell, frågor senast, kravlista och förslag på frågor. Befintliga värden skrivs inte över.
          </p>
        </div>

        <div>
          <SubHeading>Dokument ({documents.length})</SubHeading>
          {documents.length === 0 ? (
            <EmptyState title="Inga dokument ännu" hint="Ladda upp förfrågningsunderlaget för att få kravlista och volymer." />
          ) : (
            <div className="overflow-x-auto -mx-4">
              <table className={tableCls.table}>
                <thead className={tableCls.thead}>
                  <tr>
                    <th className={tableCls.th}>Fil</th>
                    <th className={tableCls.th}>Typ</th>
                    <th className={tableCls.th}>AI</th>
                    <th className={tableCls.th}>Uppladdad</th>
                    <th className={tableCls.thRight} />
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => {
                    const st = rerunning.has(d.id) ? AI_STATUS.running : AI_STATUS[d.ai_status]
                    return (
                      <tr key={d.id} className={tableCls.tr}>
                        <td className={`${tableCls.td} max-w-[260px]`}>
                          <button type="button" onClick={() => void open(d)} className="text-left text-slate-200 hover:text-[#20c58f] break-words">
                            {d.file_name}
                          </button>
                          <div className="text-[11px] text-slate-600">
                            {fmtSize(d.size_bytes)}
                            {d.origin === 'email' ? ', via e-post' : ''}
                          </div>
                          {d.ai_summary && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{d.ai_summary}</div>}
                        </td>
                        <td className={tableCls.td}>
                          <select
                            className={`${selectCls} min-w-[150px]`}
                            value={d.doc_type}
                            onChange={(e) => void changeType(d, e.target.value as ProcurementDocType)}
                            aria-label="Ändra dokumenttyp"
                          >
                            {(Object.keys(DOC_TYPE_LABEL) as ProcurementDocType[]).map((t) => (
                              <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>
                            ))}
                          </select>
                        </td>
                        <td className={`${tableCls.td} whitespace-nowrap`}>
                          <span title={d.ai_error ?? undefined}>
                            <StatusDot tone={st.tone}>{st.label}</StatusDot>
                          </span>
                          {d.ai_status === 'failed' && d.ai_error && <div className="text-[11px] text-red-400/80 max-w-[180px] truncate">{d.ai_error}</div>}
                        </td>
                        <td className={`${tableCls.td} whitespace-nowrap text-slate-500`}>{fmtDateTime(d.created_at)}</td>
                        <td className={tableCls.tdRight}>
                          <div className="flex justify-end gap-3">
                            <LinkButton
                              onClick={() => void rerun(d)}
                              disabled={rerunning.has(d.id) || d.ai_status === 'running'}
                              title="Kör AI-läsningen igen"
                            >
                              Kör om
                            </LinkButton>
                            <LinkButton tone="danger" onClick={() => remove(d)}>
                              Ta bort
                            </LinkButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {confirmNode}
    </Block>
  )
}
