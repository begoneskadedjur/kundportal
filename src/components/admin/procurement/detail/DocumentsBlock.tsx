// src/components/admin/procurement/detail/DocumentsBlock.tsx
// Steget Underlag: dokumenten (beslut 3, docs/upphandlingsportal-ux-plan.md).
//   - "Hämta underlaget" öppnar rätt dokumentsida hos plattformen i en ny
//     flik (src/shared/procurementPlatform.ts). Ingen inloggad automatik och
//     ingen skrapning: man loggar in själv, laddar ner och släpper filen här.
//   - Släppytan tar en zip eller lösa filer. Zip packas upp i webbläsaren
//     (jszip), varje fil sparas i bucket procurement-documents och läses av
//     AI (api/procurement/extract-document) en i taget, med förlopp per fil.
//     Filer över 50 MB och filtyper som inte kan läsas listas som överhoppade.
//   - Dokumentlistan med typ, AI-status, Kör om och Ta bort, och källposterna.

import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import { DOC_TYPE_LABEL, type ProcurementDocType, type ProcurementDocument } from '../../../../types/procurement'
import { documentLinkFor } from '../../../../shared/procurementPlatform'
import { SKIP_REASON_LABEL, baseName, guessDocType, isZipName, mimeOf, sortFiles, type SkippedFile } from '../../../../shared/procurementFiles'
import { EmptyState, IconButton, StatusDot } from '../ui'
import { fmtDate, fmtDateTime, tableCls, type Tone } from '../uiFormat'
import { Block, SubHeading, selectCls } from './fields'
import { errMsg, useConfirm } from './helpers'

const ACCEPT = '.zip,.pdf,.xlsx,.xls,.xlsm,.docx,.txt,.csv'

const AI_STATUS: Record<ProcurementDocument['ai_status'], { label: string; tone: Tone }> = {
  pending: { label: 'Väntar på AI', tone: 'warn' },
  running: { label: 'AI läser', tone: 'warn' },
  done: { label: 'Läst', tone: 'good' },
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

type JobState = 'waiting' | 'uploading' | 'reading' | 'done' | 'failed'

interface Job {
  key: string
  name: string
  size: number
  from: string | null
  state: JobState
  error?: string
}

const JOB_LABEL: Record<JobState, { label: string; tone: Tone }> = {
  waiting: { label: 'Väntar', tone: 'muted' },
  uploading: { label: 'Laddas upp', tone: 'warn' },
  reading: { label: 'AI läser', tone: 'warn' },
  done: { label: 'Klar', tone: 'good' },
  failed: { label: 'Misslyckades', tone: 'bad' },
}

interface Props {
  notice: NoticeWithRelations
  documents: ProcurementDocument[]
  onDocumentsChanged: () => void
  /** RFI-läget: Word och PDF läses som frågeformulär, inga krav eller fält fylls i */
  rfi?: boolean
}

export default function DocumentsBlock({ notice, documents, onDocumentsChanged, rfi = false }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [skipped, setSkipped] = useState<SkippedFile[]>([])
  const [running, setRunning] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [rerunning, setRerunning] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const { confirm, node: confirmNode } = useConfirm()

  const link = documentLinkFor(notice)

  const openPlatform = () => {
    if (!link) return
    window.open(link.url, '_blank', 'noopener,noreferrer')
    toast(
      link.kind === 'document'
        ? `Dokumentsidan på ${link.platformLabel} öppnas i en ny flik. Logga in, ladda ner zip-filen och släpp den här.`
        : `Annonsen på ${link.platformLabel} öppnas i en ny flik. Följ länken till underlaget där, ladda ner det och släpp filerna här.`,
      { duration: 7000 }
    )
  }

  const setJob = (key: string, patch: Partial<Job>) => setJobs((js) => js.map((j) => (j.key === key ? { ...j, ...patch } : j)))

  /** Packar upp zip, sorterar bort det som inte går att läsa och laddar upp resten en i taget */
  const handle = async (input: FileList | File[]) => {
    if (running) {
      toast.error('Vänta tills filerna som läses nu är klara')
      return
    }
    const top = sortFiles(Array.from(input))
    const files: Array<{ file: File; from: string | null }> = []
    const skip: SkippedFile[] = [...top.skipped]

    for (const f of top.accepted) {
      if (!isZipName(f.name)) {
        files.push({ file: f, from: null })
        continue
      }
      try {
        const { default: JSZip } = await import('jszip')
        const zip = await JSZip.loadAsync(f)
        const entries = Object.values(zip.files).map((e) => ({
          name: e.name,
          dir: e.dir,
          // Okomprimerad storlek; jszip exponerar den bara internt
          size: (e as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 1,
          entry: e,
        }))
        const inner = sortFiles(entries, { insideZip: true })
        skip.push(...inner.skipped)
        for (const e of inner.accepted) {
          const blob = await e.entry.async('blob')
          const name = baseName(e.name)
          if (blob.size > 50 * 1024 * 1024) {
            skip.push({ name, size: blob.size, reason: 'too_large' })
            continue
          }
          files.push({ file: new File([blob], name, { type: mimeOf(name) }), from: f.name })
        }
      } catch (e) {
        toast.error(errMsg(e, `Kunde inte packa upp ${f.name}`))
      }
    }

    setSkipped(skip)
    if (files.length === 0) {
      if (skip.length > 0) toast.error('Inga filer kunde läsas. Se listan över överhoppade filer.')
      return
    }

    const batch = files.map((f, i) => ({ key: `${Date.now()}-${i}`, name: f.file.name, size: f.file.size, from: f.from, state: 'waiting' as JobState }))
    setJobs(batch)
    setRunning(true)
    let ok = 0
    for (let i = 0; i < files.length; i++) {
      const { key } = batch[i]
      const file = files[i].file
      setJob(key, { state: 'uploading' })
      try {
        // Uppladdningen skapar raden; AI-läsningen pågår tills anropet returnerar
        const upload = ProcurementService.uploadDocument(notice.id, file, guessDocType(file.name), 'await')
        setTimeout(() => setJobs((js) => js.map((j) => (j.key === key && j.state === 'uploading' ? { ...j, state: 'reading' } : j))), 800)
        await upload
        setJob(key, { state: 'done' })
        ok++
      } catch (e) {
        setJob(key, { state: 'failed', error: errMsg(e, 'okänt fel') })
      }
      onDocumentsChanged()
    }
    setRunning(false)
    if (ok === files.length) toast.success(ok === 1 ? 'Filen är sparad och läst' : `${ok} filer sparade och lästa`)
    else toast.error(`${files.length - ok} av ${files.length} filer gick inte att läsa. Se listan.`)
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
    <Block
      icon="upphandling.underlag"
      title={`Dokument (${documents.length})`}
      framed={false}
      action={
        link ? (
          <button
            type="button"
            onClick={openPlatform}
            className="inline-flex items-center gap-1.5 h-9 min-h-[44px] sm:min-h-0 px-3 rounded-lg border border-slate-700 text-[13px] text-slate-200 hover:border-[#20c58f] hover:text-[#20c58f] transition-colors"
            title={link.kind === 'document' ? `Öppnar dokumentsidan på ${link.platformLabel}` : `Öppnar annonsen på ${link.platformLabel}`}
          >
            <Icon name="rapport.lank" size={16} />
            Hämta underlaget
          </button>
        ) : undefined
      }
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileRef.current?.click()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length > 0) void handle(e.dataTransfer.files)
        }}
        aria-label="Släpp zip-filen eller dokumenten här, eller välj filer"
        className={`flex flex-col items-center justify-center gap-1.5 px-4 py-5 rounded-[10px] border-[1.5px] border-dashed text-center cursor-pointer transition-colors ${
          dragOver ? 'border-[#20c58f] bg-[#20c58f]/5 text-slate-200' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
        }`}
      >
        <Icon name="upphandling.inlamning" size={24} />
        <span className="text-[13px]">{running ? 'Läser filerna, en i taget ...' : 'Släpp zip-filen eller dokumenten här, eller klicka för att välja'}</span>
        <span className="text-[12px] text-slate-500">Zip packas upp. Varje fil sparas och läses av AI. Högst 50 MB per fil.</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) void handle(e.target.files)
          e.target.value = ''
        }}
      />

      {(jobs.length > 0 || skipped.length > 0) && (
        <div className="mt-3 rounded-[10px] border border-slate-800 bg-slate-900/40 divide-y divide-slate-800">
          {jobs.map((j) => (
            <div key={j.key} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
              <div className="min-w-0 flex-1">
                <div className="text-slate-200 truncate">{j.name}</div>
                <div className="text-[11.5px] text-slate-500 truncate">
                  {fmtSize(j.size)}
                  {j.from ? `, ur ${j.from}` : ''}
                  {j.error ? `. ${j.error}` : ''}
                </div>
              </div>
              <StatusDot tone={JOB_LABEL[j.state].tone}>{JOB_LABEL[j.state].label}</StatusDot>
            </div>
          ))}
          {skipped.map((s, i) => (
            <div key={`s-${i}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
              <div className="min-w-0 flex-1">
                <div className="text-slate-400 truncate">{s.name}</div>
                <div className="text-[11.5px] text-slate-500">{SKIP_REASON_LABEL[s.reason]}</div>
              </div>
              <StatusDot tone="muted">Överhoppad</StatusDot>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3">
        {documents.length === 0 ? (
          <div className="rounded-[10px] border border-slate-800">
            <EmptyState
              title="Inga dokument ännu"
              hint={rfi ? 'Släpp köparens frågeformulär ovan, så läses frågorna in.' : 'Hämta underlaget och släpp filerna ovan, så skapar AI kravlista, volymer och frågor.'}
            />
          </div>
        ) : (
          <div className="rounded-[10px] border border-slate-800 bg-slate-900/40 overflow-x-auto">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Fil</th>
                  <th className={tableCls.th}>Typ</th>
                  <th className={tableCls.th}>AI</th>
                  <th className={tableCls.thRight} />
                </tr>
              </thead>
              <tbody>
                {documents.map((d) => {
                  const st = rerunning.has(d.id) ? AI_STATUS.running : AI_STATUS[d.ai_status]
                  return (
                    <tr key={d.id} id={`dok-${d.id}`} className={`${tableCls.tr} scroll-mt-24`}>
                      <td className={`${tableCls.td} max-w-[280px]`}>
                        <button type="button" onClick={() => void open(d)} className="text-left text-slate-200 hover:text-[#20c58f] break-words">
                          {d.file_name}
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {[fmtSize(d.size_bytes), d.origin === 'email' ? 'via e-post' : null, fmtDateTime(d.created_at)].filter(Boolean).join(', ')}
                        </div>
                        {d.ai_summary && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{d.ai_summary}</div>}
                      </td>
                      <td className={tableCls.td}>
                        <select
                          className={`${selectCls} min-w-[150px]`}
                          value={d.doc_type}
                          onChange={(e) => void changeType(d, e.target.value as ProcurementDocType)}
                          aria-label={`Dokumenttyp för ${d.file_name}`}
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
                        {d.ai_status === 'failed' && d.ai_error && <div className="text-[11px] text-red-400/80 max-w-[200px] truncate">{d.ai_error}</div>}
                      </td>
                      <td className={tableCls.tdRight}>
                        <div className="flex justify-end">
                          <IconButton
                            icon={<Icon name="allman.aterstall" size={20} />}
                            label={`Kör AI-läsningen igen för ${d.file_name}`}
                            onClick={() => void rerun(d)}
                            disabled={rerunning.has(d.id) || d.ai_status === 'running'}
                          />
                          <IconButton icon={<Icon name="allman.radera" size={20} />} label={`Ta bort ${d.file_name}`} onClick={() => remove(d)} tone="danger" />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] text-slate-500 mt-2">
          {rfi
            ? 'RFI-läge: Word och PDF läses som frågeformulär. Inga krav, volymer eller frågor till köparen skapas.'
            : 'AI fyller bara tomma fält: volymer, kriterier, prismodell, frågor senast, kravlista och förslag på frågor. Befintliga värden skrivs inte över.'}
        </p>
      </div>

      {(sources.length > 0 || notice.platform_url || notice.document_url) && (
        <div className="mt-5">
          <SubHeading>Källposter</SubHeading>
          <ul className="space-y-1">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-3 text-[12.5px]">
                <span className="text-slate-200 w-28 shrink-0">{SOURCE_LABEL[s.source] ?? s.source}</span>
                <span className="text-slate-500 tabular-nums">
                  {s.source_id}
                  {s.source_sub ? `, ${s.source_sub}` : ''}
                </span>
                <span className="text-[11px] text-slate-500 tabular-nums">hämtad {fmtDate(s.fetched_at)}</span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 min-h-[32px] text-[12px] text-[#20c58f] hover:underline">
                    Öppna <Icon name="rapport.oppna" className="w-3 h-3" />
                  </a>
                )}
              </li>
            ))}
            {notice.document_url && (
              <li className="flex items-baseline gap-x-3 text-[12.5px]">
                <span className="text-slate-200 w-28 shrink-0">Dokument</span>
                <a href={notice.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-[#20c58f] hover:underline break-all">
                  {notice.document_url.replace(/^https?:\/\//, '').slice(0, 60)} <Icon name="rapport.oppna" className="w-3 h-3 shrink-0" />
                </a>
              </li>
            )}
          </ul>
          {!link && <p className="text-[12px] text-slate-500 mt-1">Ingen länk till underlaget finns. Sök upp upphandlingen hos köparens plattform.</p>}
        </div>
      )}
      {confirmNode}
    </Block>
  )
}
