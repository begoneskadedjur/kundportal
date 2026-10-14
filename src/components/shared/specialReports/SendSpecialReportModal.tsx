// src/components/shared/specialReports/SendSpecialReportModal.tsx
// Skicka rapporten till kunden: mottagare (förifylld kontakt), ämne, meddelande
// med det som är nytt sedan senaste skickade versionen, förhandsgranskning,
// och versionslistan med nedladdning. Rapporten och dess versioner hör redan till ärendet.
// En skickad version låses; arbetet fortsätter i nästa version.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import { useAuth } from '../../../contexts/AuthContext'
import { SpecialReportService } from '../../../services/specialReportService'
import type { SpecialReportFull, SpecialReportVersion } from '../../../types/specialReport'
import {
  FALT,
  IKON_KNAPP,
  IKON_KNAPP_LATT,
  PRIMAR_KNAPP,
  SEKUNDAR_KNAPP,
  TEXTFALT,
  arEpost,
  datumAv,
  klarAttSkicka,
  laddaNed,
  oppnaINyFlik,
  uppraknad,
} from './specialReportUtils'

interface SendSpecialReportModalProps {
  isOpen: boolean
  onClose: () => void
  report: SpecialReportFull
  /** Körs efter lyckat utskick, föräldern laddar om rapporten */
  onSent: (version: SpecialReportVersion) => void
  /** Sparar det som väntar i redigeraren innan PDF:en byggs */
  beforeRender?: () => Promise<void>
}

function senasteSkickade(versions: SpecialReportVersion[]): SpecialReportVersion | null {
  return versions
    .filter(v => v.sent_at)
    .sort((a, b) => b.version - a.version)[0] ?? null
}

/** Rader om det som tillkommit sedan senaste skickade versionen */
function nyttSedan(report: SpecialReportFull, sedan: string | null): string[] {
  if (!sedan) return []
  const grans = new Date(sedan).getTime()
  const rader: string[] = []
  report.sections.forEach(s => {
    const namn = s.title.trim() || 'Utan rubrik'
    if (new Date(s.created_at).getTime() > grans) {
      rader.push(`${namn}: ny del`)
    }
    s.events
      .filter(e => new Date(e.created_at).getTime() > grans)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .forEach(e => rader.push(`${namn}: ${e.title.charAt(0).toLowerCase()}${e.title.slice(1)} (${e.event_date})`))
  })
  return rader
}

export default function SendSpecialReportModal({ isOpen, onClose, report, onSent, beforeRender }: SendSpecialReportModalProps) {
  const { profile } = useAuth()
  const forra = useMemo(() => senasteSkickade(report.versions), [report.versions])
  const nytt = useMemo(() => nyttSedan(report, forra?.sent_at ?? null), [report, forra])
  // Det som saknas enligt "Klar att skicka". Hindrar inte utskicket
  const saknas = useMemo(() => klarAttSkicka(report).filter(p => !p.klar).map(p => p.saknas), [report])

  const [mottagare, setMottagare] = useState<string[]>([])
  const [ny, setNy] = useState('')
  const [visaNyFalt, setVisaNyFalt] = useState(false)
  const [amne, setAmne] = useState('')
  const [meddelande, setMeddelande] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [hamtar, setHamtar] = useState<'forhand' | 'ladda' | null>(null)

  // Förifyll när modalen öppnas
  useEffect(() => {
    if (!isOpen) return
    setMottagare(report.contact_email ? [report.contact_email.trim()] : [])
    setNy('')
    setVisaNyFalt(!report.contact_email)
    setAmne(`Rapport: ${report.title}${report.case_number ? ` (${report.case_number})` : ''}`)
    const halsning = report.contact_name ? `Hej ${report.contact_name.split(' ')[0]},` : 'Hej,'
    const avsandare = profile?.display_name || profile?.email?.split('@')[0] || ''
    const brodtext = forra
      ? `Här kommer en uppdaterad rapport.${nytt.length ? ` Sedan förra versionen har vi lagt till:\n${nytt.slice(0, 8).map(r => `- ${r}`).join('\n')}${nytt.length > 8 ? `\n- och ${nytt.length - 8} till` : ''}` : ''}`
      : 'Här kommer rapporten.'
    setMeddelande(`${halsning}\n\n${brodtext}\n\nVänliga hälsningar\n${avsandare ? `${avsandare}, ` : ''}BeGone Skadedjur`)
    // Förifyllningen görs bara när modalen öppnas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const laggTill = () => {
    const v = ny.trim()
    if (!v) return
    if (!arEpost(v)) { toast.error('Ogiltig e-postadress'); return }
    if (mottagare.some(m => m.toLowerCase() === v.toLowerCase())) { setNy(''); return }
    setMottagare(prev => [...prev, v])
    setNy('')
  }

  const pdfNamn = `${report.title}, version ${report.current_version}.pdf`

  const forhandsgranska = async () => {
    setHamtar('forhand')
    try {
      // Fliken måste öppnas direkt i klicket, sparningen väntas in inuti
      await oppnaINyFlik(async () => {
        await beforeRender?.()
        return (await SpecialReportService.downloadPdf(report.id)).url
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta fram PDF:en')
    } finally {
      setHamtar(null)
    }
  }

  const laddaNedPdf = async () => {
    await beforeRender?.()
    setHamtar('ladda')
    try {
      const { url, filename } = await SpecialReportService.downloadPdf(report.id)
      await laddaNed(url, filename)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta fram PDF:en')
    } finally {
      setHamtar(null)
    }
  }

  const laddaNedVersion = async (v: SpecialReportVersion) => {
    try {
      const url = await SpecialReportService.getVersionPdfUrl(v.id)
      await laddaNed(url, `${report.title}, version ${v.version}.pdf`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte hämta versionen')
    }
  }

  const ogiltiga = mottagare.filter(m => !arEpost(m))
  const kanSkicka = mottagare.length > 0 && ogiltiga.length === 0 && amne.trim().length > 0 && !skickar

  const skicka = async () => {
    // En påbörjad adress i fältet räknas med
    const lista = [...mottagare]
    if (ny.trim()) {
      if (!arEpost(ny)) { toast.error('Ogiltig e-postadress'); return }
      lista.push(ny.trim())
    }
    if (lista.length === 0) { toast.error('Lägg till minst en mottagare'); return }
    await beforeRender?.()
    setSkickar(true)
    try {
      const version = await SpecialReportService.send(report.id, {
        recipients: lista,
        subject: amne.trim(),
        message: meddelande,
        saveToCase: false,
      })
      toast.success(`Version ${version.version} är skickad`)
      onSent(version)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte skicka rapporten')
    } finally {
      setSkickar(false)
    }
  }

  const versioner = [...report.versions].sort((a, b) => b.version - a.version)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Skicka rapporten till kunden"
      subtitle={`${report.title} · version ${report.current_version}`}
      size="full"
      usePortal
      mobilHelskarm
      preventClose={skickar}
      footer={
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          <button type="button" className={SEKUNDAR_KNAPP} onClick={laddaNedPdf} disabled={hamtar !== null} aria-label="Ladda ned PDF">
            {hamtar === 'ladda' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.ladda" size={20} />}
            <span className="hidden sm:inline">Ladda ned PDF</span>
          </button>
          <span className="flex-1" />
          <button type="button" className={SEKUNDAR_KNAPP} onClick={onClose} disabled={skickar}>Avbryt</button>
          <button type="button" className={PRIMAR_KNAPP} onClick={skicka} disabled={!kanSkicka && !ny.trim()}>
            {skickar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.skicka" size={20} />}
            Skicka version {report.current_version}
          </button>
        </div>
      }
    >
      <div className="flex flex-col lg:flex-row lg:min-h-full">
        {/* Vänster: mejlet */}
        <div className="flex-1 p-4 space-y-4">
          {saknas.length > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <span className="mt-1.5 h-[7px] w-[7px] flex-shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              <span>
                {saknas.length === 1 ? '1 sak saknas' : `${saknas.length} saker saknas`}: {uppraknad(saknas)}. Du kan ändå skicka rapporten.
              </span>
            </p>
          )}
          <div className="space-y-2">
            <p className="text-sm text-slate-300">Till</p>
            {mottagare.map(m => {
              const arKontakt = report.contact_email && m.toLowerCase() === report.contact_email.trim().toLowerCase()
              const initialer = (arKontakt && report.contact_name ? report.contact_name : m)
                .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(x => x[0]?.toUpperCase()).join('')
              return (
                <div key={m} className={`flex items-center gap-3 rounded-xl border bg-slate-800/30 px-3 py-2 ${arEpost(m) ? 'border-slate-700' : 'border-red-500'}`}>
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-200">{initialer}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{arKontakt && report.contact_name ? report.contact_name : m}</span>
                    <span className="block truncate text-xs text-slate-400">{arKontakt ? `${m} · kontakt på ärendet` : arEpost(m) ? m : 'Ogiltig e-postadress'}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Ta bort mottagare ${m}`}
                    onClick={() => setMottagare(prev => prev.filter(x => x !== m))}
                    className={IKON_KNAPP_LATT}
                  >
                    <Icon name="allman.stang" size={16} />
                  </button>
                </div>
              )
            })}
            {visaNyFalt ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  aria-label="E-postadress till ny mottagare"
                  placeholder="namn@foretag.se"
                  value={ny}
                  onChange={e => setNy(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); laggTill() } }}
                  className={FALT}
                  autoFocus={mottagare.length > 0}
                />
                <button type="button" className={SEKUNDAR_KNAPP} onClick={laggTill} disabled={!ny.trim()}>Lägg till</button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setVisaNyFalt(true)}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-[#20c58f] hover:bg-slate-800"
              >
                <Icon name="allman.plus" size={16} />
                Lägg till mottagare
              </button>
            )}
          </div>

          <label className="block">
            <span className="block text-sm text-slate-300 mb-1">Ämne</span>
            <input value={amne} onChange={e => setAmne(e.target.value)} className={FALT} />
          </label>

          <label className="block">
            <span className="block text-sm text-slate-300 mb-1">Meddelande</span>
            <textarea value={meddelande} onChange={e => setMeddelande(e.target.value)} rows={8} className={TEXTFALT} />
          </label>

          <div className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3">
            <span className="flex h-12 w-10 flex-shrink-0 items-end justify-center rounded-md bg-slate-100 pb-1.5 text-[10px] font-extrabold text-red-600">PDF</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-white">{pdfNamn}</span>
              <span className="block text-xs text-slate-400">Bifogas mejlet</span>
            </span>
            <button type="button" aria-label="Förhandsgranska PDF" className={IKON_KNAPP} onClick={forhandsgranska} disabled={hamtar !== null}>
              {hamtar === 'forhand' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon name="rapport.forhandsgranska" size={20} />}
            </button>
          </div>

          <p className="text-xs text-slate-500">Rapporten och alla skickade versioner finns kvar på ärendet.</p>
        </div>

        {/* Höger: versioner */}
        <aside className="lg:w-[300px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-slate-700/50 bg-slate-950/30 p-4 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">Versioner</h3>

          <div className="space-y-1.5 rounded-xl border-[1.5px] border-[#20c58f] bg-[#20c58f]/5 p-3">
            <p className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">Version {report.current_version}</span>
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="h-[7px] w-[7px] rounded-full bg-amber-400" />
                Skickas nu
              </span>
            </p>
            {forra ? (
              <>
                <p className="text-xs text-slate-400">Nytt sedan version {forra.version}:</p>
                {nytt.length ? (
                  <ul className="text-xs leading-relaxed text-slate-300">
                    {nytt.slice(0, 6).map(r => <li key={r}>{r}</li>)}
                    {nytt.length > 6 && <li>och {nytt.length - 6} till</li>}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-300">Inga nya händelser</p>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-400">Första versionen till kunden</p>
            )}
          </div>

          {versioner.map(v => (
            <div key={v.id} className="flex items-center gap-2.5 rounded-xl border border-slate-700/50 bg-slate-800/20 p-3">
              <span className="min-w-0 flex-1 space-y-0.5">
                <span className="block text-sm font-semibold text-white">Version {v.version}</span>
                <span className="flex items-center gap-1.5 text-xs text-[#20c58f]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#20c58f]" />
                  {v.sent_at ? `Skickad ${datumAv(v.sent_at)}` : 'Sparad'}
                </span>
                {v.sent_to.length > 0 && (
                  <span className="block truncate text-xs text-slate-500">
                    Till {v.sent_to.length === 1 ? v.sent_to[0] : `${v.sent_to.length} mottagare`}
                  </span>
                )}
              </span>
              <button type="button" aria-label={`Ladda ned version ${v.version}`} className={IKON_KNAPP} onClick={() => laddaNedVersion(v)}>
                <Icon name="rapport.ladda" size={20} />
              </button>
            </div>
          ))}

          <p className="text-xs leading-relaxed text-slate-500">
            En skickad version låses. Fortsätter du arbeta i rapporten blir det version {report.current_version + 1}, och kunden får den när du skickar igen.
          </p>
        </aside>
      </div>
    </Modal>
  )
}
