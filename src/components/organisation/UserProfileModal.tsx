import React, { useState, useEffect } from 'react'
import { X, User, Phone, Mail, Shield, Lock, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

interface UserProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

function getRoleLabel(role: string | null | undefined): string {
  const map: Record<string, string> = {
    verksamhetschef: 'Verksamhetschef',
    regionchef: 'Regionchef',
    platsansvarig: 'Platsansvarig'
  }
  return role ? (map[role] || role) : ''
}

function validatePassword(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /\d/.test(pw)
  }
}

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { profile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [multisiteRole, setMultisiteRole] = useState<string | null>(null)
  const [lastSignIn, setLastSignIn] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!isOpen || !profile?.user_id) return
    setDisplayName(profile.display_name || '')
    setNewPassword('')
    setConfirmPassword('')

    // Hämta phone + last_sign_in_at + multisite_role
    supabase
      .from('profiles')
      .select('phone, last_sign_in_at')
      .eq('user_id', profile.user_id)
      .single()
      .then(({ data }) => {
        setPhone(data?.phone || '')
        setLastSignIn(data?.last_sign_in_at || null)
      })

    supabase
      .from('multisite_user_roles')
      .select('role_type')
      .eq('user_id', profile.user_id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setMultisiteRole(data?.role_type || null))
  }, [isOpen, profile?.user_id])

  const handleSaveProfile = async () => {
    if (!profile?.user_id) return
    setSavingProfile(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() || null, phone: phone.trim() || null })
        .eq('user_id', profile.user_id)
      if (error) throw error
      toast.success('Profil sparad')
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte spara profil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    const v = validatePassword(newPassword)
    if (!v.length || !v.upper || !v.lower || !v.digit) {
      toast.error('Lösenordet uppfyller inte kraven')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Lösenorden matchar inte')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success('Lösenord uppdaterat')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      toast.error(err.message || 'Kunde inte uppdatera lösenord')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!isOpen) return null

  const pwValid = validatePassword(newPassword)
  const pwMatch = newPassword.length > 0 && newPassword === confirmPassword
  const pwReady = pwValid.length && pwValid.upper && pwValid.lower && pwValid.digit && pwMatch

  const formattedLastSignIn = lastSignIn
    ? new Date(lastSignIn).toLocaleString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#20c58f]/15 flex items-center justify-center">
              <span className="text-[#20c58f] text-sm font-bold">
                {(displayName || profile?.email || '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white text-sm font-semibold leading-tight">{displayName || profile?.email}</p>
              {multisiteRole && (
                <p className="text-xs text-slate-400 leading-tight">{getRoleLabel(multisiteRole)}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <div className="p-4 space-y-4">

            {/* Profilinfo */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <User className="w-4 h-4 text-slate-400" />
                Profilinformation
              </h3>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Namn</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Förnamn Efternamn"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  Telefon
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+46 70 000 00 00"
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  E-post
                </label>
                <div className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-400">
                  {profile?.email}
                </div>
                <p className="text-xs text-slate-500 mt-1">Kontakta support för att ändra e-postadress.</p>
              </div>

              {multisiteRole && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Shield className="w-3 h-3" />
                    Roll
                  </label>
                  <div className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-400">
                    {getRoleLabel(multisiteRole)}
                  </div>
                </div>
              )}

              <div className="pt-1">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="w-full py-1.5 bg-[#20c58f] hover:bg-[#1aad7d] disabled:opacity-50 text-slate-900 text-sm font-semibold rounded-lg transition-colors"
                >
                  {savingProfile ? 'Sparar...' : 'Spara profil'}
                </button>
              </div>
            </div>

            {/* Byt lösenord */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-slate-400" />
                Byt lösenord
              </h3>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Nytt lösenord</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minst 8 tecken"
                    className="w-full px-3 py-1.5 pr-9 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1 block">Bekräfta lösenord</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Upprepa lösenordet"
                    className="w-full px-3 py-1.5 pr-9 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#20c58f] focus:border-[#20c58f]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {newPassword.length > 0 && (
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { ok: pwValid.length, label: 'Minst 8 tecken' },
                    { ok: pwValid.upper, label: 'Versal (A–Z)' },
                    { ok: pwValid.lower, label: 'Gemen (a–z)' },
                    { ok: pwValid.digit, label: 'Siffra (0–9)' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      {r.ok
                        ? <Check className="w-3 h-3 text-[#20c58f]" />
                        : <AlertCircle className="w-3 h-3 text-slate-500" />}
                      <span className={`text-xs ${r.ok ? 'text-[#20c58f]' : 'text-slate-500'}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}

              {confirmPassword.length > 0 && (
                <p className={`text-xs flex items-center gap-1 ${pwMatch ? 'text-[#20c58f]' : 'text-red-400'}`}>
                  {pwMatch
                    ? <><Check className="w-3 h-3" /> Lösenorden matchar</>
                    : <><AlertCircle className="w-3 h-3" /> Lösenorden matchar inte</>}
                </p>
              )}

              <div className="pt-1">
                <button
                  onClick={handleSavePassword}
                  disabled={savingPassword || !pwReady}
                  className="w-full py-1.5 bg-[#20c58f] hover:bg-[#1aad7d] disabled:opacity-40 disabled:cursor-not-allowed text-slate-900 text-sm font-semibold rounded-lg transition-colors"
                >
                  {savingPassword ? 'Uppdaterar...' : 'Uppdatera lösenord'}
                </button>
              </div>
            </div>

            {/* Kontoinformation */}
            {formattedLastSignIn && (
              <div className="p-3 bg-slate-800/20 border border-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500">Senast inloggad: <span className="text-slate-400">{formattedLastSignIn}</span></p>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
