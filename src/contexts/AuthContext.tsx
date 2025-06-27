// src/contexts/AuthContext.tsx - SUPERROBUST VERSION SOM LÖSER ALLA F5-PROBLEM

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
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
  const [initialized, setInitialized] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const fetchingRef = useRef(false) // Förhindra dubbla anrop

  // KRITISK FIX: Timeout för fetchProfile för att förhindra oändlig väntan
  const fetchProfile = async (userId: string): Promise<boolean> => {
    if (fetchingRef.current) {
      console.log('📋 Profile fetch already in progress, skipping...')
      return false
    }

    fetchingRef.current = true
    console.log('📋 Fetching profile for user:', userId)
    
    try {
      // Timeout efter 10 sekunder
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .abortSignal(controller.signal)
        .single()

      clearTimeout(timeoutId)

      if (error) {
        if (error.name === 'AbortError') {
          throw new Error('Profile fetch timeout')
        }
        throw error
      }
      
      if (!data.is_active) {
        console.warn('🚫 User account is inactive')
        toast.error('Ditt konto är inaktiverat. Kontakta administratören.')
        await signOut()
        return false
      }

      console.log('✅ Profile loaded:', { 
        email: data.email, 
        is_admin: data.is_admin, 
        customer_id: data.customer_id 
      })
      
      setProfile(data)
      
      // Uppdatera last_login i bakgrunden (låt inte detta blockera)
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => console.log('✅ Last login updated'))
        .catch(err => console.warn('⚠️ Could not update last_login:', err))
        
      return true
    } catch (error: any) {
      console.error('💥 Error in fetchProfile:', error)
      if (error.message !== 'Profile fetch timeout') {
        toast.error('Kunde inte hämta profilinformation')
      }
      return false
    } finally {
      fetchingRef.current = false
      setLoading(false)
      setInitialized(true)
    }
  }

  // Navigation med säkerhetskontroller
  useEffect(() => {
    if (!initialized || loading) return

    const currentPath = location.pathname
    console.log('🧭 Navigation check:', { 
      user: !!user, 
      profile: !!profile, 
      currentPath,
      initialized,
      loading 
    })

    // Om vi har både user och profile, navigera endast från specifika sidor
    if (user && profile) {
      const isOnLoginPage = currentPath === '/login'
      const isOnHomePage = currentPath === '/'
      
      if (isOnLoginPage || isOnHomePage) {
        console.log('🧭 Navigating user to appropriate dashboard')
        
        if (profile.is_admin) {
          navigate('/admin', { replace: true })
        } else {
          navigate('/portal', { replace: true })
        }
      }
    }
    // Om vi inte har user, navigera endast från skyddade sidor
    else if (!user && !currentPath.startsWith('/login') && currentPath !== '/') {
      console.log('🧭 No user, redirecting to login')
      navigate('/login', { replace: true })
    }
  }, [user, profile, initialized, loading, location.pathname, navigate])

  // Initial auth check
  useEffect(() => {
    let mounted = true
    
    const initAuth = async () => {
      console.log('🔐 AuthContext: Initializing...')
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          throw error
        }

        if (!mounted) return

        console.log('📊 Initial session check:', session ? '✅ Found' : '❌ No session')
        
        if (session?.user) {
          setUser(session.user)
          const success = await fetchProfile(session.user.id)
          if (!success && mounted) {
            // Fallback om profile-fetch misslyckas
            setUser(null)
            setLoading(false)
            setInitialized(true)
          }
        } else {
          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('💥 Auth initialization error:', error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    initAuth()

    return () => {
      mounted = false
    }
  }, [])

  // Auth state listener
  useEffect(() => {
    console.log('🔐 Setting up auth state listener...')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session ? '✅ Session exists' : '❌ No session')
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out')
        setUser(null)
        setProfile(null)
        setLoading(false)
        setInitialized(true)
        // Navigera endast om vi inte redan är på login
        if (location.pathname !== '/login') {
          navigate('/login', { replace: true })
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed')
        setUser(session.user)
        // Behåll befintlig profile, uppdatera inte
      } else {
        setUser(session?.user ?? null)
        if (!session?.user) {
          setProfile(null)
          setLoading(false)
          setInitialized(true)
        }
      }
    })

    return () => {
      console.log('🧹 AuthContext cleanup')
      subscription.unsubscribe()
    }
  }, [location.pathname, navigate])

  const signIn = async (email: string, password: string) => {
    console.log('🔐 Attempting sign in for:', email)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      console.log('✅ Sign in successful')
      toast.success('Inloggning lyckades!')
      
    } catch (error: any) {
      console.error('💥 Sign in error:', error)
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Felaktigt e-postadress eller lösenord')
      } else {
        toast.error(error.message || 'Inloggning misslyckades')
      }
      
      setLoading(false)
      throw error
    }
  }

  const signOut = async () => {
    console.log('👋 Signing out user')
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
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

  // Debug logging med throttling
  useEffect(() => {
    const logState = () => {
      console.log('📊 Auth state:', {
        user: !!user,
        profile: !!profile,
        loading,
        initialized,
        isAdmin: value.isAdmin,
        isCustomer: value.isCustomer,
        currentPath: location.pathname,
      })
    }

    logState()
  }, [user, profile, loading, initialized, value.isAdmin, value.isCustomer, location.pathname])

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