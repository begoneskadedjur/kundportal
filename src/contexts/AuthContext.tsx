// src/contexts/AuthContext.tsx - UPPDATERAD

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
  const navigate = useNavigate()

  // Denna useEffect hanterar navigation baserat på auth state
  useEffect(() => {
    // Navigera endast om vi har en användare och profile, men inte är på login-sidan
    if (user && profile && !loading) {
      const currentPath = window.location.pathname
      const isOnLoginPage = currentPath === '/login'
      const isOnHomePage = currentPath === '/'
      
      // Navigera endast om vi är på login eller home-sidan
      if (isOnLoginPage || isOnHomePage) {
        console.log('🧭 User authenticated, navigating based on role:', profile.is_admin ? 'admin' : 'customer')
        
        if (profile.is_admin) {
          navigate('/admin')
        } else {
          navigate('/portal')
        }
      }
    }
  }, [user, profile, loading, navigate])

  useEffect(() => {
    console.log('🔐 AuthContext: Initializing...')
    
    // Hämta session vid start
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('📊 Initial session check:', session ? '✅ Found' : '❌ No session')
      
      setUser(session?.user ?? null)
      if (session?.user) {
        console.log('👤 User found, fetching profile for:', session.user.id)
        fetchProfile(session.user.id)
      } else {
        console.log('❌ No user found, stopping loading')
        setLoading(false)
      }
    })

    // Lyssna på auth-ändringar
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session ? '✅ Session exists' : '❌ No session')
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out, redirecting to login')
        setProfile(null)
        navigate('/login')
      }
    })

    return () => {
      console.log('🧹 AuthContext cleanup')
      subscription.unsubscribe()
    }
  }, [navigate])

  const fetchProfile = async (userId: string) => {
    console.log('📋 Fetching profile for user:', userId)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      console.log('📋 Profile query result:', data ? '✅ Found' : '❌ Not found', error ? `Error: ${error.message}` : '')

      if (error) {
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
      
      // Uppdatera last_login
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        
    } catch (error) {
      console.error('💥 Error in fetchProfile:', error)
      toast.error('Kunde inte hämta profilinformation')
    } finally {
      console.log('✅ Profile fetch completed, stopping loading')
      setLoading(false)
    }
  }

  // --- START PÅ ÄNDRINGAR ---
  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email)
    
    // FIX: Sätt loading till true för att signalera att en inloggning påbörjats.
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ Sign in successful - navigation will happen automatically via useEffect')
      toast.success('Inloggning lyckades!')
      
      // Laddningstillståndet avslutas i fetchProfile's finally-block efter att
      // onAuthStateChange har kört klart.
      
    } catch (error: any) {
      console.error('💥 Sign in error:', error)
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Felaktigt e-postadress eller lösenord')
      } else {
        toast.error(error.message || 'Inloggning misslyckades')
      }
      
      // FIX: Sätt loading till false vid fel så att användaren kan försöka igen.
      setLoading(false)

      throw error
    }
  }
  // --- SLUT PÅ ÄNDRINGAR ---

  const signOut = async () => {
    console.log('👋 Signing out user')
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      setProfile(null)
      console.log('✅ Sign out successful')
      toast.success('Du har loggats ut')
    } catch (error: any) {
      console.error('💥 Sign out error:', error)
      toast.error('Utloggning misslyckades')
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.is_admin ?? false,
    isCustomer: !profile?.is_admin && !!profile?.customer_id,
  }

  console.log('📊 Current auth state:', {
    user: !!user,
    profile: !!profile,
    loading,
    isAdmin: value.isAdmin,
    isCustomer: value.isCustomer,
    currentPath: window.location.pathname,
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