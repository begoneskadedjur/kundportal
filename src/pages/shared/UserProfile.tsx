// src/pages/shared/UserProfile.tsx
// Mitt konto för personalen (admin, koordinator, tekniker och säljare) under
// /<roll>/mitt-konto, och fristående på /profile (tvingat lösenordsbyte vid första
// inloggningen, gäller alla roller). Kundernas organisationsportal har en egen
// variant (UserProfileModal) som inte påverkas här.
//
// Grupperna, i den här ordningen: Profil, Visning, Appen på hemskärmen, Säkerhet, Konto.
// Vid tvingat lösenordsbyte ligger Säkerhet först och Profil är låst tills det är gjort.
// I nya arbetsvyn döljs sidans egen rubrik, sidhuvudet säger redan Mitt konto.

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth, VIEW_LABELS, type ActiveView } from '../../contexts/AuthContext'
import { useTheme, type ThemePreference } from '../../contexts/ThemeContext'
import { useNyArbetsvy, useHarTeknikerVisning } from '../../hooks/useNyArbetsvy'
import { Icon, type IconName } from '../../components/icons/Icon'
import { PwaInstallSection } from '../../components/shared/PwaInstallSection'
import VisningInstallningar from '../../components/technician/ny/VisningInstallningar'
import { useNySidhuvud } from '../../components/technician/ny/layout/NySidhuvud'
import { Genomgang, type GenomgangSteg } from '../../components/technician/ny/hjalp/Genomgang'

interface UserProfileProps {
  /**
   * true när sidan är monterad inuti en rollayout (/admin/mitt-konto etc.)
   * och redan har sidofält/header - då döljs egna tillbaka/logga ut-knappar.
   * false för fristående /profile (tvingat lösenordsbyte vid första inloggning).
   */
  embedded?: boolean
}

// --- Stil, samma som nya arbetsvyn (NyMer, besokUi) ---

const KNAPP_BAS = 'min-h-[48px] px-4 inline-flex items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]'
const KNAPP_PRIMAR = `${KNAPP_BAS} bg-[#20c58f] text-[#04281c] hover:bg-[#1bb07f]`
const KNAPP_SEKUNDAR = `${KNAPP_BAS} border border-slate-600 bg-slate-900 text-white hover:bg-slate-800`
const FALT = 'w-full h-12 px-3 rounded-xl bg-slate-950/40 border border-slate-700 text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/60 focus:border-[#20c58f] disabled:opacity-60'
const ETIKETT = 'block text-sm font-medium text-slate-300 mb-1.5'

const ROLLNAMN: Record<string, string> = {
  verksamhetschef: 'Verksamhetschef',
  regionchef: 'Regionchef',
  platsansvarig: 'Platsansvarig',
  admin: 'Administratör',
  koordinator: 'Koordinator',
  technician: 'Tekniker',
  säljare: 'Säljare',
  customer: 'Kund',
}
const rollnamn = (r: string) => ROLLNAMN[r] || r

const TEMAN: { varde: ThemePreference; text: string; ikon: IconName }[] = [
  { varde: 'dark', text: 'Mörkt', ikon: 'allman.tema' },
  { varde: 'light', text: 'Ljust', ikon: 'konto.sol' },
  { varde: 'system', text: 'Som enheten', ikon: 'konto.system' },
]

const LOSENKRAV: { text: string; ok: (p: string) => boolean }[] = [
  { text: 'Minst 8 tecken', ok: p => p.length >= 8 },
  { text: 'Minst en stor bokstav', ok: p => /[A-Z]/.test(p) },
  { text: 'Minst en liten bokstav', ok: p => /[a-z]/.test(p) },
  { text: 'Minst en siffra', ok: p => /[0-9]/.test(p) },
]

const GENOMGANG: GenomgangSteg[] = [
  { rubrik: 'Visning', text: 'Här stänger du av hjälptexterna och genomgångarna när du kan sidorna, och väljer tema. Valen sparas på ditt konto.', mal: 'konto-visning' },
  { rubrik: 'Appen på hemskärmen', text: 'Lägg portalen på telefonens hemskärm, så öppnas den som en app.', mal: 'konto-app' },
  { rubrik: 'Säkerhet', text: 'Byt lösenord här. Du behöver ditt nuvarande lösenord.', mal: 'konto-sakerhet' },
]

// --- Byggstenar ---

function Grupp({ id, titel, mal, children }: { id: string; titel: string; mal?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-genomgang={mal}>
      <h2 id={id} className="px-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{titel}</h2>
      <div className="rounded-2xl bg-slate-900 border border-slate-700/60 p-1">{children}</div>
    </section>
  )
}

function Losenfalt({ id, etikett, varde, setVarde, platshallare, autoComplete, describedBy }: {
  id: string
  etikett: string
  varde: string
  setVarde: (v: string) => void
  platshallare: string
  autoComplete: string
  describedBy?: string
}) {
  const [syns, setSyns] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={ETIKETT}>{etikett}</label>
      <div className="relative">
        <input
          id={id}
          type={syns ? 'text' : 'password'}
          value={varde}
          onChange={e => setVarde(e.target.value)}
          placeholder={platshallare}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          required
          className={`${FALT} pr-12`}
        />
        <button
          type="button"
          onClick={() => setSyns(s => !s)}
          aria-label={syns ? 'Dölj lösenordet' : 'Visa lösenordet'}
          aria-pressed={syns}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
        >
          <Icon name={syns ? 'dok.dolj' : 'konto.oga'} size={20} />
        </button>
      </div>
    </div>
  )
}

function TemaVal() {
  const { preference, setTheme } = useTheme()
  return (
    <div className="px-3 py-3">
      <p id="tema-rubrik" className="text-[15px] font-medium text-white">Tema</p>
      <p id="tema-text" className="text-sm text-slate-400 mt-0.5">Som enheten följer telefonens eller datorns inställning för mörkt och ljust.</p>
      <div role="radiogroup" aria-labelledby="tema-rubrik" aria-describedby="tema-text" className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-slate-700 p-1">
        {TEMAN.map(t => {
          const vald = preference === t.varde
          return (
            <button
              key={t.varde}
              type="button"
              role="radio"
              aria-checked={vald}
              onClick={() => setTheme(t.varde)}
              className={`min-h-[48px] px-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${vald ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <Icon name={t.ikon} size={20} className={vald ? 'text-[#20c58f]' : ''} />
              {t.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function InfoRad({ ikon, etikett, children }: { ikon: IconName; etikett: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-3 py-3">
      <Icon name={ikon} size={24} className="text-slate-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{etikett}</p>
        <div className="text-[15px] text-white break-words">{children}</div>
      </div>
    </div>
  )
}

// --- Sidan ---

export default function UserProfile({ embedded = false }: UserProfileProps) {
  const navigate = useNavigate()
  const { user, profile, availableViews, signOut, patchProfile } = useAuth()
  const { aktiv: nyAktiv } = useNyArbetsvy()
  const harTeknikerVisning = useHarTeknikerVisning()
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // Profildata, och det som är sparat (för att veta om något är ändrat)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sparat, setSparat] = useState({ namn: '', epost: '', telefon: '' })
  const [organizationName, setOrganizationName] = useState('')
  const [roleType, setRoleType] = useState('')

  // Lösenordsdata
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Flagga för första inloggning
  const [isFirstLogin, setIsFirstLogin] = useState(false)
  const [mustChangePassword, setMustChangePassword] = useState(false)

  // Visa mig hur i nya arbetsvyns sidhuvud
  const [visaMig, setVisaMig] = useState(false)
  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  useNySidhuvud({ underrubrik: nyAktiv ? 'Dina uppgifter, visningen och lösenordet' : undefined, onVisaMig: nyAktiv ? oppnaVisaMig : undefined })

  useEffect(() => {
    loadUserData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const loadUserData = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()

      // Första inloggningen (temporärt lösenord)
      const firstLogin = userData?.user?.user_metadata?.temp_password === true ||
                        userData?.user?.user_metadata?.must_change_password === true

      setIsFirstLogin(firstLogin)
      setMustChangePassword(firstLogin)

      // Profilen hämtas på user_id: id och user_id är inte samma för alla kundprofiler
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      const namn = profileData?.display_name || userData?.user?.user_metadata?.name || ''
      const epost = user.email || ''
      const telefon = userData?.user?.user_metadata?.phone || ''
      setEmail(epost)
      setDisplayName(namn)
      setPhone(telefon)
      setSparat({ namn, epost, telefon })

      // Organisation och roll om användaren tillhör en multisite-organisation
      if (profileData?.organization_id) {
        const { data: orgData } = await supabase
          .from('customers')
          .select('company_name')
          .eq('organization_id', profileData.organization_id)
          .eq('site_type', 'huvudkontor')
          .single()

        if (orgData) setOrganizationName(orgData.company_name)

        const { data: roleData } = await supabase
          .from('multisite_user_roles')
          .select('role_type')
          .eq('user_id', user.id)
          .eq('organization_id', profileData.organization_id)
          .single()

        if (roleData) setRoleType(rollnamn(roleData.role_type))
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      toast.error('Kunde inte ladda användardata')
    } finally {
      setLoading(false)
    }
  }

  const validatePassword = (password: string) => {
    if (password.length < 8) return 'Lösenordet måste vara minst 8 tecken'
    if (!/[A-Z]/.test(password)) return 'Lösenordet måste innehålla minst en stor bokstav'
    if (!/[a-z]/.test(password)) return 'Lösenordet måste innehålla minst en liten bokstav'
    if (!/[0-9]/.test(password)) return 'Lösenordet måste innehålla minst en siffra'
    return null
  }

  const andrat = displayName !== sparat.namn || email !== sparat.epost || phone !== sparat.telefon

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!displayName || !email) {
      toast.error('Namn och e-post är obligatoriska')
      return
    }

    setSavingProfile(true)
    try {
      const { error: authError } = await supabase.auth.updateUser({
        email: email,
        data: { name: displayName, phone: phone },
      })
      if (authError) throw authError

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          email: email,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user?.id ?? '')
      if (profileError) throw profileError

      patchProfile({ display_name: displayName })
      setSparat({ namn: displayName, epost: email, telefon: phone })
      toast.success('Profil uppdaterad!')

      if (email !== user?.email) {
        toast('En bekräftelse har skickats till din nya e-postadress', { duration: 5000 })
      }
    } catch (error: unknown) {
      console.error('Error updating profile:', error)
      toast.error(error instanceof Error && error.message ? error.message : 'Kunde inte uppdatera profil')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()

    const passwordError = validatePassword(newPassword)
    if (passwordError) {
      toast.error(passwordError)
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Lösenorden matchar inte')
      return
    }
    // Vid första inloggning behövs inte nuvarande lösenord
    if (!isFirstLogin && !currentPassword) {
      toast.error('Ange ditt nuvarande lösenord')
      return
    }

    setSavingPassword(true)
    try {
      if (!isFirstLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword,
        })
        if (signInError) throw new Error('Felaktigt nuvarande lösenord')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      if (isFirstLogin) {
        await supabase.auth.updateUser({
          data: { temp_password: false, must_change_password: false },
        })
        setIsFirstLogin(false)
        setMustChangePassword(false)
      }

      toast.success('Lösenord uppdaterat!')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      if (isFirstLogin) {
        const dashboardPath = profile?.role === 'admin' ? '/admin/dashboard' :
                            profile?.role === 'koordinator' ? '/koordinator/dashboard' :
                            profile?.role === 'technician' ? '/technician/dashboard' :
                            profile?.role === 'säljare' ? '/saljare/dashboard' :
                            '/customer/dashboard'
        navigate(dashboardPath)
      }
    } catch (error: unknown) {
      console.error('Error updating password:', error)
      toast.error(error instanceof Error && error.message ? error.message : 'Kunde inte uppdatera lösenord')
    } finally {
      setSavingPassword(false)
    }
  }

  const loggaUt = async () => {
    await signOut()
    navigate('/login')
  }

  // Rollerna personen har: vyerna för personalen, annars profilens roll
  const roller = useMemo(() => {
    if (availableViews.length > 0) return availableViews.map((v: ActiveView) => VIEW_LABELS[v])
    return profile?.role ? [rollnamn(profile.role)] : []
  }, [availableViews, profile?.role])

  const initialer = (displayName || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
  const medlemSedan = user?.created_at ? new Date(user.created_at).toLocaleDateString('sv-SE') : 'Okänt'

  if (loading) {
    return (
      <div className={embedded ? 'py-16 flex items-center justify-center' : 'min-h-screen bg-slate-950 flex items-center justify-center'} role="status" aria-label="Laddar">
        <Icon name="allman.laddar" size={32} className="animate-spin text-[#20c58f]" />
      </div>
    )
  }

  const losenRubrik = mustChangePassword ? 'Skapa ditt lösenord' : 'Byt lösenord'

  const sakerhet = (
    <Grupp id="grupp-sakerhet" titel="Säkerhet" mal="konto-sakerhet">
      <form onSubmit={handleUpdatePassword} className={`p-3 space-y-4 ${mustChangePassword ? 'rounded-xl ring-2 ring-amber-500/70' : ''}`}>
        <div className="flex items-start gap-3">
          <Icon name="allman.las" size={24} className="text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-[15px] font-medium text-white">{losenRubrik}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {mustChangePassword ? 'Obligatoriskt innan du kan fortsätta.' : 'Du behöver ditt nuvarande lösenord. Nästa gång loggar du in med det nya.'}
            </p>
          </div>
        </div>

        {!isFirstLogin && (
          <Losenfalt id="losen-nuvarande" etikett="Nuvarande lösenord" varde={currentPassword} setVarde={setCurrentPassword} platshallare="••••••••" autoComplete="current-password" />
        )}
        <Losenfalt id="losen-nytt" etikett="Nytt lösenord" varde={newPassword} setVarde={setNewPassword} platshallare="Minst 8 tecken" autoComplete="new-password" describedBy="losen-krav" />
        <Losenfalt id="losen-bekrafta" etikett="Bekräfta nytt lösenord" varde={confirmPassword} setVarde={setConfirmPassword} platshallare="Upprepa lösenordet" autoComplete="new-password" />

        <div id="losen-krav">
          <p className="text-sm font-medium text-slate-300 mb-1.5">Lösenordskrav:</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {LOSENKRAV.map(k => {
              const ok = k.ok(newPassword)
              return (
                <li key={k.text} className={`flex items-center gap-2 text-sm ${ok ? 'text-[#20c58f]' : 'text-slate-400'}`}>
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-[#20c58f]' : 'bg-slate-600'}`} />
                  {k.text}
                  <span className="sr-only">{ok ? ', uppfyllt' : ', inte uppfyllt'}</span>
                </li>
              )
            })}
            {confirmPassword.length > 0 && (
              <li className={`flex items-center gap-2 text-sm ${confirmPassword === newPassword ? 'text-[#20c58f]' : 'text-amber-500'}`}>
                <span aria-hidden="true" className={`w-2 h-2 rounded-full flex-shrink-0 ${confirmPassword === newPassword ? 'bg-[#20c58f]' : 'bg-amber-500'}`} />
                {confirmPassword === newPassword ? 'Lösenorden är lika' : 'Lösenorden är inte lika än'}
              </li>
            )}
          </ul>
        </div>

        <button type="submit" disabled={savingPassword} className={`${mustChangePassword ? KNAPP_PRIMAR : KNAPP_SEKUNDAR} w-full sm:w-auto`}>
          <Icon name={savingPassword ? 'allman.laddar' : 'allman.las'} size={20} className={savingPassword ? 'animate-spin' : ''} />
          {savingPassword ? 'Uppdaterar...' : mustChangePassword ? 'Skapa nytt lösenord' : 'Byt lösenord'}
        </button>
      </form>
    </Grupp>
  )

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-950'}>
      <div className="max-w-2xl mx-auto px-4 py-4 lg:py-6 space-y-6">
        {!embedded && !mustChangePassword && (
          <div>
            <button type="button" onClick={() => navigate(-1)} className={`${KNAPP_SEKUNDAR} !px-3`}>
              <Icon name="allman.chevron-vanster" size={20} />
              Tillbaka
            </button>
          </div>
        )}

        {!nyAktiv && (
          <header>
            <h1 className="text-[22px] font-bold leading-tight text-white">Mitt konto</h1>
            <p className="mt-1 text-[15px] text-slate-400">Dina uppgifter, visningen och lösenordet.</p>
          </header>
        )}

        {mustChangePassword && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <Icon name="rapport.avvikelse" size={24} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-[15px] font-semibold text-amber-500">Byt lösenord för att fortsätta</p>
              <p className="mt-0.5 text-sm text-slate-300">
                Du använder ett temporärt lösenord. Av säkerhetsskäl måste du skapa ett eget lösenord innan du kan fortsätta.
              </p>
            </div>
          </div>
        )}

        {mustChangePassword && sakerhet}

        {/* Profil */}
        <Grupp id="grupp-profil" titel="Profil">
          <form onSubmit={handleUpdateProfile} className="p-3 space-y-4">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="w-12 h-12 flex-shrink-0 rounded-full bg-[#20c58f]/15 text-[#20c58f] text-base font-semibold flex items-center justify-center">
                {initialer}
              </span>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-white truncate">{sparat.namn || 'Namn saknas'}</p>
                <p className="text-sm text-slate-400 truncate">{[roleType || roller.join(', '), organizationName].filter(Boolean).join(', ')}</p>
              </div>
            </div>

            <div>
              <label htmlFor="profil-namn" className={ETIKETT}>Namn</label>
              <input id="profil-namn" type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="För- och efternamn" autoComplete="name" required disabled={mustChangePassword} className={FALT} />
            </div>
            <div>
              <label htmlFor="profil-epost" className={ETIKETT}>E-postadress</label>
              <input id="profil-epost" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="din.email@exempel.se" autoComplete="email" inputMode="email" required disabled={mustChangePassword} className={FALT} />
              {email !== sparat.epost && (
                <p className="mt-1.5 text-sm text-slate-400">När du sparar skickas en bekräftelse till den nya adressen.</p>
              )}
            </div>
            <div>
              <label htmlFor="profil-telefon" className={ETIKETT}>Telefonnummer</label>
              <input id="profil-telefon" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+46 70 123 45 67" autoComplete="tel" inputMode="tel" disabled={mustChangePassword} className={FALT} />
            </div>

            {(organizationName || roleType) && (
              <dl className="grid gap-2 rounded-xl border border-slate-700/60 p-3 text-[15px]">
                {organizationName && (
                  <div className="flex justify-between gap-4"><dt className="text-slate-400">Organisation</dt><dd className="text-white text-right">{organizationName}</dd></div>
                )}
                {roleType && (
                  <div className="flex justify-between gap-4"><dt className="text-slate-400">Roll</dt><dd className="text-white text-right">{roleType}</dd></div>
                )}
              </dl>
            )}

            <button type="submit" disabled={savingProfile || mustChangePassword || !andrat} className={`${KNAPP_PRIMAR} w-full sm:w-auto`}>
              <Icon name={savingProfile ? 'allman.laddar' : 'allman.bock'} size={20} className={savingProfile ? 'animate-spin' : ''} />
              {savingProfile ? 'Sparar...' : 'Spara ändringar'}
            </button>
            {!andrat && !mustChangePassword && (
              <p className="text-sm text-slate-500">Ändra ett fält så kan du spara.</p>
            )}
          </form>
        </Grupp>

        {/* Visning */}
        <Grupp id="grupp-visning" titel="Visning" mal="konto-visning">
          <TemaVal />
          {harTeknikerVisning && (
            <div className="border-t border-slate-700/60">
              <VisningInstallningar />
            </div>
          )}
          <p className="flex items-start gap-2 px-3 pb-3 pt-1 text-sm text-slate-400">
            <Icon name="kund.info" size={16} className="mt-0.5 flex-shrink-0" />
            Valen sparas på ditt konto, inte bara i telefonen.
          </p>
        </Grupp>

        {/* Appen på hemskärmen */}
        <Grupp id="grupp-app" titel="Appen på hemskärmen" mal="konto-app">
          <PwaInstallSection />
        </Grupp>

        {!mustChangePassword && sakerhet}

        {/* Konto */}
        <Grupp id="grupp-konto" titel="Konto">
          <div className="divide-y divide-slate-700/60">
            {roller.length > 0 && (
              <InfoRad ikon="rapport.person" etikett={roller.length > 1 ? 'Roller' : 'Roll'}>
                {roller.join(', ')}
                {roller.length > 1 && <p className="text-sm text-slate-400">Du byter vy med växlaren i menyn.</p>}
              </InfoRad>
            )}
            <InfoRad ikon="allman.kalender" etikett="Medlem sedan">{medlemSedan}</InfoRad>
            <InfoRad ikon="konto.kort" etikett="Konto-ID">
              <span className="font-mono text-sm text-slate-300 break-all">{user?.id}</span>
            </InfoRad>
            <div className="p-1">
              <button type="button" onClick={loggaUt} className="w-full flex items-center gap-3 px-3 min-h-[52px] rounded-xl text-[15px] font-medium text-red-400 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] text-left">
                <Icon name="allman.logga-ut" size={24} className="flex-shrink-0" />
                Logga ut
              </button>
            </div>
          </div>
        </Grupp>
      </div>

      {nyAktiv && !mustChangePassword && (
        <Genomgang id="ny-mitt-konto" steg={GENOMGANG} tvinga={visaMig} onStang={() => setVisaMig(false)} />
      )}
    </div>
  )
}
