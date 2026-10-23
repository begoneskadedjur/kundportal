// src/components/coordinator/bokaIn/KorOmSignering.tsx
// Kör signeringen igen för ett signerat avtal där kunden inte lades upp.
//
// API:
//   <KorOmSignering contractId={uuid} onKlar={(customerId) => void} />
//
// 1. Provkörning (api/oneflow/reprocess-signed, dryRun) direkt: diagnosen visar
//    vad som saknas eller är fel (fält, nuvarande värde, var det rättas) och
//    rapporten visar vad som görs vid en riktig körning.
// 2. Uppgifter som rättas i portalen (kundnamn, kontaktens e-post, org.nr,
//    kontaktperson, telefon, adress) fylls i och sparas på avtalsraden, sedan
//    provkörs det igen.
// 3. "Kör signeringen igen" kör på riktigt. onKlar får kundens id (null om
//    kunden fortfarande inte kunde läggas upp).
// Inga anrop mot Oneflow: behandlingen läser och skriver bara portalens databas.
import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../icons/Icon'
import Button from '../../ui/Button'
import {
  korOmSignering,
  sparaSigneringsUppgifter,
  type SigneringsFalt,
  type SigneringsKorning,
} from '../../../services/bokaInService'

interface KorOmSigneringProps {
  contractId: string
  onKlar: (customerId: string | null) => void
}

type FaltNamn = keyof SigneringsFalt

const NIVA_FARG: Record<'hinder' | 'varning' | 'info', string> = {
  hinder: 'bg-red-400',
  varning: 'bg-amber-400',
  info: 'bg-slate-400',
}

export default function KorOmSignering({ contractId, onKlar }: KorOmSigneringProps) {
  const [provkorning, setProvkorning] = useState<SigneringsKorning | null>(null)
  const [laddar, setLaddar] = useState(true)
  const [kor, setKor] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [falt, setFalt] = useState<SigneringsFalt>({})

  const provkor = useCallback(async () => {
    setLaddar(true)
    setFel(null)
    try {
      const r = await korOmSignering(contractId, true)
      setProvkorning(r)
      // Fälten som går att rätta i portalen, med nuvarande värde
      const nya: SigneringsFalt = {}
      for (const p of r.diagnos.items) {
        if (p.field && p.fixIn === 'portal') nya[p.field as FaltNamn] = p.current ?? ''
      }
      setFalt(nya)
    } catch (err) {
      setFel(err instanceof Error ? err.message : String(err))
    } finally {
      setLaddar(false)
    }
  }, [contractId])

  useEffect(() => { provkor() }, [provkor])

  const spara = async () => {
    setSparar(true)
    try {
      await sparaSigneringsUppgifter(contractId, falt)
      toast.success('Uppgifterna sparade på avtalet')
      await provkor()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSparar(false)
    }
  }

  const korPaRiktigt = async () => {
    setKor(true)
    try {
      const r = await korOmSignering(contractId, false)
      if (r.customerId) {
        toast.success(r.customerCreated ? 'Kunden är upplagd' : 'Avtalet är kopplat till kunden')
      } else {
        toast.error('Kunden kunde inte läggas upp. Se vad som saknas.')
      }
      setProvkorning(r)
      onKlar(r.customerId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Signeringen kunde inte köras')
    } finally {
      setKor(false)
    }
  }

  if (laddar && !provkorning) {
    return <p className="text-xs text-slate-400 py-2">Provkör signeringen...</p>
  }
  if (fel) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-400">{fel}</p>
        <Button type="button" variant="secondary" size="sm" onClick={provkor}>Försök igen</Button>
      </div>
    )
  }
  if (!provkorning) return null

  const diagnos = provkorning.diagnos
  const rattbara = diagnos.items.filter(p => p.field && p.fixIn === 'portal')
  const unika = Array.from(new Map(rattbara.map(p => [p.field, p])).values())
  const andrat = unika.some(p => (falt[p.field as FaltNamn] ?? '') !== (p.current ?? ''))

  return (
    <div className="space-y-3">
      {/* Vad som saknas */}
      <div className="space-y-1.5">
        {diagnos.items.length === 0 && (
          <p className="text-xs text-slate-400">Inget saknas. Kunden läggs upp när signeringen körs igen.</p>
        )}
        {diagnos.items.map((p, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${NIVA_FARG[p.level]}`} />
            <div className="min-w-0">
              <span className="text-slate-200 font-medium">{p.label}</span>
              {p.current && <span className="text-slate-400">: {p.current}</span>}
              <p className="text-slate-400">{p.problem}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Fyll i det som går att rätta i portalen */}
      {unika.length > 0 && (
        <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl space-y-2">
          <p className="text-xs font-medium text-slate-400">Fyll i på avtalet</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {unika.map(p => (
              <label key={p.field} className="block">
                <span className="block text-xs font-medium text-slate-400 mb-1">{p.label === 'Befintlig kund' ? 'Uppgift' : p.label}</span>
                <input
                  value={falt[p.field as FaltNamn] ?? ''}
                  onChange={e => setFalt(prev => ({ ...prev, [p.field as FaltNamn]: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" size="sm" onClick={spara} loading={sparar} disabled={!andrat || sparar}>
              Spara och provkör igen
            </Button>
          </div>
        </div>
      )}

      {/* Provkörningens rapport */}
      <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
        <p className="text-xs font-medium text-slate-400 mb-1.5 flex items-center gap-1.5">
          <Icon name="allman.historik" className="w-3.5 h-3.5" /> Provkörning: det här görs om du kör igen
        </p>
        {provkorning.skipped ? (
          <p className="text-xs text-slate-400">{provkorning.skipped}</p>
        ) : (
          <ul className="space-y-0.5">
            {provkorning.actions.length === 0 && <li className="text-xs text-slate-400">Inget att göra.</li>}
            {provkorning.actions.map((a, i) => (
              <li key={i} className="text-xs text-slate-300">{a.replace(/^\[provkörning\]\s*/, '')}</li>
            ))}
          </ul>
        )}
        {provkorning.notes.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {provkorning.notes.map((n, i) => (
              <li key={i} className="text-xs text-amber-300">{n}</li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 mt-2">Inget sparas förrän du kör. Inga ändringar görs i Oneflow.</p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={korPaRiktigt}
          loading={kor}
          disabled={kor || !diagnos.canCreateCustomer || !!provkorning.skipped}
          title={!diagnos.canCreateCustomer ? 'Fyll i det som saknas först' : undefined}
        >
          Kör signeringen igen
        </Button>
      </div>
    </div>
  )
}
