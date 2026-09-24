// src/pages/procurement/ProcurementLogin.tsx
// Inloggning till den fristående upphandlingsportalen (upphandling.begone.se).
// Samma Supabase-auth som kundportalen. Efter inloggning skickar
// ProcurementApp vidare till startsidan; skalet släpper bara in admin och
// upphandlingsansvariga.

import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/shared/LoadingSpinner'
import Button from '../../components/ui/Button'
import { ProcurementBrand } from './ProcurementBrand'

export default function ProcurementLogin() {
  const { signIn, profile, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile) return <Navigate to="/" replace />

  if (loading && !submitting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password || submitting) return
    setSubmitting(true)
    await signIn(email, password)
    setSubmitting(false)
  }

  const inputCls =
    'w-full pl-9 pr-3 py-2 text-sm bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 focus:border-[#20c58f] disabled:opacity-50'

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <ProcurementBrand size="lg" />
            <p className="mt-4 text-[13px] text-slate-400 leading-relaxed">
              Offentliga upphandlingar inom skadedjursbekämpning: bevakning, marknad, avtalsklocka och anbudsarbete.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 border border-slate-800 rounded-xl p-5 bg-slate-900/40">
            <div>
              <label htmlFor="proc-email" className="block text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">E-postadress</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="proc-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className={inputCls}
                  placeholder="namn@begone.se"
                />
              </div>
            </div>
            <div>
              <label htmlFor="proc-password" className="block text-[11px] uppercase tracking-[0.14em] text-slate-500 mb-1.5">Lösenord</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  id="proc-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={inputCls}
                  placeholder="Ditt lösenord"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" fullWidth loading={submitting}>
              {submitting ? 'Loggar in...' : 'Logga in'}
            </Button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-[12px] text-slate-400 hover:text-[#20c58f]">Glömt lösenord?</Link>
            </div>
          </form>

          <p className="mt-6 text-[11.5px] text-slate-500 leading-relaxed">
            Samma konto som i BeGones kundportal. Åtkomst för administratörer och upphandlingsansvariga.
          </p>
        </div>
      </div>
    </div>
  )
}
