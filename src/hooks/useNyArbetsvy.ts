// src/hooks/useNyArbetsvy.ts
//
// Ny arbetsvy för tekniker (profiles.ny_arbetsvy, migration 20261022_ny_arbetsvy).
// Avstängd för alla som standard. Den nya vyn gäller BARA när profilen har
// flaggan OCH användaren är i teknikervyn (activeView === 'technician'), aldrig
// i admin-, koordinator- eller säljarvyn, även om personen har flera vyer.
//
// Databasen spärrar (trigger a_guard_ny_arbetsvy): tekniker_far_byta får bara
// administratör ändra, och ny_arbetsvy får personen själv bara ändra när
// tekniker_far_byta är på. Hjälpinställningarna får personen alltid ändra.

import { useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth, type Profile } from '../contexts/AuthContext'

export function useNyArbetsvy(): { aktiv: boolean; farByta: boolean } {
  const { profile, activeView } = useAuth()
  return {
    aktiv: profile?.ny_arbetsvy === true && activeView === 'technician',
    farByta: profile?.tekniker_far_byta === true,
  }
}

type ProfilFalt = Pick<Profile, 'ny_arbetsvy' | 'visa_hjalptexter' | 'visa_genomgangar' | 'sedda_genomgangar'>

export function useHjalpInstallningar(): {
  visaHjalptexter: boolean
  visaGenomgangar: boolean
  setVisaHjalptexter(v: boolean): Promise<void>
  setVisaGenomgangar(v: boolean): Promise<void>
  harSettGenomgang(id: string): boolean
  markeraGenomgangSedd(id: string): Promise<void>
  aterstallGenomgangar(): Promise<void>
  setNyArbetsvy(v: boolean): Promise<void>
} {
  const { profile, patchProfile } = useAuth()
  const userId = profile?.user_id
  const visaHjalptexter = profile?.visa_hjalptexter !== false
  const visaGenomgangar = profile?.visa_genomgangar !== false
  const seddaRad = profile?.sedda_genomgangar
  const sedda = useMemo(() => seddaRad ?? [], [seddaRad])

  // Optimistisk uppdatering: profilen ändras direkt, återställs om skrivningen misslyckas
  const spara = useCallback(async (falt: Partial<ProfilFalt>, felText: string, tidigare: Partial<ProfilFalt>) => {
    if (!userId) {
      toast.error('Ingen inloggad profil')
      throw new Error('Ingen inloggad profil')
    }
    patchProfile(falt)
    const { error } = await supabase
      .from('profiles')
      .update(falt as never)
      .eq('user_id', userId)
    if (error) {
      patchProfile(tidigare)
      console.error(felText, error)
      toast.error(felText)
      throw error
    }
  }, [userId, patchProfile])

  const setVisaHjalptexter = useCallback(async (v: boolean) => {
    await spara({ visa_hjalptexter: v }, 'Kunde inte spara inställningen för hjälptexter', { visa_hjalptexter: visaHjalptexter })
  }, [spara, visaHjalptexter])

  const setVisaGenomgangar = useCallback(async (v: boolean) => {
    await spara({ visa_genomgangar: v }, 'Kunde inte spara inställningen för genomgångar', { visa_genomgangar: visaGenomgangar })
  }, [spara, visaGenomgangar])

  const harSettGenomgang = useCallback((id: string) => sedda.includes(id), [sedda])

  const markeraGenomgangSedd = useCallback(async (id: string) => {
    if (sedda.includes(id)) return
    await spara({ sedda_genomgangar: [...sedda, id] }, 'Kunde inte spara att genomgången är sedd', { sedda_genomgangar: sedda })
  }, [spara, sedda])

  const aterstallGenomgangar = useCallback(async () => {
    await spara({ sedda_genomgangar: [] }, 'Kunde inte återställa genomgångarna', { sedda_genomgangar: sedda })
  }, [spara, sedda])

  const setNyArbetsvy = useCallback(async (v: boolean) => {
    if (profile?.tekniker_far_byta !== true) {
      toast.error('Du har inte behörighet att byta vy själv')
      throw new Error('tekniker_far_byta saknas')
    }
    await spara({ ny_arbetsvy: v }, 'Kunde inte byta arbetsvy', { ny_arbetsvy: profile?.ny_arbetsvy === true })
  }, [spara, profile?.tekniker_far_byta, profile?.ny_arbetsvy])

  return {
    visaHjalptexter,
    visaGenomgangar,
    setVisaHjalptexter,
    setVisaGenomgangar,
    harSettGenomgang,
    markeraGenomgangSedd,
    aterstallGenomgangar,
    setNyArbetsvy,
  }
}
