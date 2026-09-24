// src/pages/procurement/ProcurementAccountPage.tsx
// Mitt konto i den fristående upphandlingsportalen: vem man är, varför man har
// åtkomst, dagligt sammandrag på eller av, byte av lösenord och tema.

import { useEffect, useState, type FormEvent } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProcurementService } from '../../services/procurementService'
import { Section } from '../../components/admin/procurement/ui'
import { ThemeToggle } from '../../components/shared/ThemeToggle'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Button from '../../components/ui/Button'

export default function ProcurementAccountPage() {
  const { profile, user } = useAuth()
  const [digest, setDigest] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  useEffect(() => {
    ProcurementService.getDigestEnabled()
      .then(setDigest)
      .catch(() => setDigest(true))
  }, [])

  const toggleDigest = async () => {
    if (digest == null) return
    setSaving(true)
    try {
      await ProcurementService.setDigestEnabled(!digest)
      setDigest(!digest)
      toast.success(!digest ? 'Du får det dagliga sammandraget' : 'Sammandraget är avstängt för dig')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara inställningen')
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) {
      toast.error('Lösenordet måste ha minst åtta tecken')
      return
    }
    if (pw !== pw2) {
      toast.error('Lösenorden är inte lika')
      return
    }
    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setPwSaving(false)
    if (error) {
      toast.error('Kunde inte byta lösenord')
      return
    }
    setPw('')
    setPw2('')
    toast.success('Lösenordet är bytt')
  }

  const isAdmin = profile?.is_admin === true || profile?.role === 'admin' || (profile?.extra_roles ?? []).includes('admin')
  const access = [isAdmin ? 'Administratör' : null, profile?.is_procurement_manager ? 'Upphandlingsansvarig' : null].filter(Boolean).join(' och ')
  const inputCls =
    'w-full px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f]'

  return (
    <div className="space-y-8">
      <Section title="Mitt konto">
        <dl className="divide-y divide-slate-800 text-[13px]">
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">Namn</dt>
            <dd className="text-slate-200 text-right">{profile?.display_name || profile?.technicians?.name || '–'}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">E-post</dt>
            <dd className="text-slate-200 text-right break-all">{profile?.email ?? user?.email ?? '–'}</dd>
          </div>
          <div className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">Åtkomst</dt>
            <dd className="text-slate-200 text-right">{access || '–'}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-2.5">
            <dt className="text-slate-500">Tema</dt>
            <dd><ThemeToggle /></dd>
          </div>
        </dl>
      </Section>

      <Section title="Sammandrag">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] text-slate-200">Dagligt sammandrag via e-post</div>
            <div className="text-[11.5px] text-slate-500">Vardagar 07:45: nya träffar, deadlines inom sju dagar, avtal in i bearbetningsfönstret och nya signaler.</div>
          </div>
          {digest == null ? (
            <LoadingSpinner />
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={digest}
              aria-label="Dagligt sammandrag"
              disabled={saving}
              onClick={() => void toggleDigest()}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${digest ? 'bg-[#20c58f]' : 'bg-slate-700'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-[#fff] shadow transition-transform ${digest ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          )}
        </div>
      </Section>

      <Section title="Byt lösenord">
        <form onSubmit={changePassword} className="px-4 py-3 space-y-3 max-w-sm">
          <div>
            <label htmlFor="acc-pw" className="block text-xs font-medium text-slate-400 mb-1">Nytt lösenord</label>
            <input id="acc-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="acc-pw2" className="block text-xs font-medium text-slate-400 mb-1">Upprepa lösenordet</label>
            <input id="acc-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} />
          </div>
          <Button type="submit" variant="primary" size="sm" loading={pwSaving} disabled={!pw || !pw2}>
            Byt lösenord
          </Button>
        </form>
      </Section>
    </div>
  )
}
