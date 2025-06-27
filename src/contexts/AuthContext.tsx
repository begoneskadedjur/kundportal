// src/contexts/AuthContext.tsx - FIXED: Korrekt navigering
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

type Profile = {
  id: string
  email: string
  is_admin: boolean
  is_active: boolean
  customer_id: string | null
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isCustomer: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [shouldNavigateAfterProfile, setShouldNavigateAfterProfile] = useState(false)
  const navigate = useNavigate()

  // Navigera när profile är redo efter inloggning
  useEffect(() => {
    if (shouldNavigateAfterProfile && profile && !loading) {
      console.log('🧭 Navigating after profile loaded:', profile.is_admin ? 'admin' : 'customer')
      setShouldNavigateAfterProfile(false)
      
      if (profile.is_admin) {
        navigate('/admin')
      } else {
        navigate('/portal')
      }
    }
  }, [profile, loading, shouldNavigateAfterProfile, navigate])

  useEffect(() => {
    console.log('🔐 AuthContext: Initializing...')
    
    // Kontrollera Supabase connection
    console.log('🔗 Supabase URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing')
    console.log('🔑 Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing')

    // Sätt en timeout för att undvika oändlig loading
    const loadingTimeout = setTimeout(() => {
      if (loading) {
        console.warn('⏰ Loading timeout reached, forcing stop')
        setLoading(false)
      }
    }, 5000) // 5 sekunder timeout

    // Hämta session vid start
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('📊 Initial session check:', session ? '✅ Found' : '❌ No session', error ? `Error: ${error.message}` : '')
      
      // Clear timeout since we got a response
      clearTimeout(loadingTimeout)
      
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('👤 User found, fetching profile for:', session.user.id)
        fetchProfile(session.user.id, false) // false = inte efter inloggning
      } else {
        console.log('❌ No user found, stopping loading')
        setLoading(false)
      }
    }).catch(error => {
      console.error('💥 Session check failed:', error)
      clearTimeout(loadingTimeout)
      setLoading(false)
    })

    // Lyssna på auth-ändringar
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session ? '✅ Session exists' : '❌ No session')
      
      setUser(session?.user ?? null)
      
      if (session?.user && event === 'SIGNED_IN') {
        console.log('🔑 User signed in, fetching profile with navigation flag')
        await fetchProfile(session.user.id, true) // true = efter inloggning, ska navigera
      } else if (session?.user && event !== 'SIGNED_IN') {
        await fetchProfile(session.user.id, false) // false = inte efter inloggning
      } else {
        setProfile(null)
        setLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out, redirecting to login')
        setProfile(null)
        setShouldNavigateAfterProfile(false)
        navigate('/login')
      }
    })

    return () => {
      console.log('🧹 AuthContext cleanup')
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [navigate])

  const fetchProfile = async (userId: string, shouldNavigate: boolean = false) => {
    console.log('📋 Fetching profile for user:', userId, shouldNavigate ? '(will navigate after)' : '(no navigation)')
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      console.log('📋 Profile query result:', data ? '✅ Found' : '❌ Not found', error ? `Error: ${error.message}` : '')

      if (error) {
        // Om profilen inte finns, logga ut användaren
        if (error.code === 'PGRST116') {
          console.warn('👤 Profile not found, signing out user')
          await signOut()
          return
        }
        console.error('💥 Profile fetch error:', error)
        throw error
      }
      
      if (!data.is_active) {
        console.warn('🚫 User account is inactive')
        toast.error('Ditt konto är inaktiverat. Kontakta administratören.')
        await signOut()
        return
      }

      console.log('✅ Profile loaded:', { 
        email: data.email, 
        is_admin: data.is_admin, 
        customer_id: data.customer_id 
      })
      
      setProfile(data)
      
      // Sätt navigation flag om vi ska navigera efter profile är laddat
      if (shouldNavigate) {
        console.log('🧭 Setting navigation flag - will navigate after profile is set')
        setShouldNavigateAfterProfile(true)
      }
      
      // Uppdatera last_login
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        
    } catch (error) {
      console.error('💥 Error in fetchProfile:', error)
      toast.error('Kunde inte hämta profilinformation')
      // Försök inte igen, bara logga ut användaren
      await signOut()
    } finally {
      console.log('✅ Profile fetch completed, stopping loading')
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      console.log('✅ Sign in successful - navigation will happen after profile is loaded')
      toast.success('Inloggning lyckades!')
      
      // Navigering sker automatiskt via onAuthStateChange + useEffect när profile är redo
    } catch (error: any) {
      console.error('💥 Sign in error:', error)
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Felaktigt e-postadress eller lösenord')
      } else {
        toast.error(error.message || 'Inloggning misslyckades')
      }
      throw error
    }
  }

  const signOut = async () => {
    console.log('👋 Signing out user')
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setProfile(null)
      setUser(null)
      setLoading(false)
      setShouldNavigateAfterProfile(false)
      console.log('✅ Sign out successful')
      toast.success('Du har loggats ut')
    } catch (error: any) {
      console.error('💥 Sign out error:', error)
      toast.error('Utloggning misslyckades')
      // Även om signOut misslyckas, rensa state lokalt
      setProfile(null)
      setUser(null)
      setLoading(false)
      setShouldNavigateAfterProfile(false)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.is_admin ?? false,
    isCustomer: !profile?.is_admin && !!profile?.customer_id
  }

  console.log('📊 Current auth state:', {
    user: !!user,
    profile: !!profile,
    loading,
    isAdmin: value.isAdmin,
    isCustomer: value.isCustomer,
    shouldNavigate: shouldNavigateAfterProfile
  })

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}