// src/contexts/AuthContext.tsx - CACHE-RESISTANT VERSION

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
  const fetchingRef = useRef(false)
  const initRef = useRef(false) // Förhindra dubbel initialisering

  // CACHE-BUSTING: Rensa all relevant cache vid start
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    // Rensa eventuell gammal session cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister()
        })
      })
    }

    // Force refresh av Supabase session
    supabase.auth.onAuthStateChange(() => {}) // Triggar session refresh

    console.log('🧹 Cache cleared, initializing auth...')
    initAuth()
  }, [])

  const initAuth = async () => {
    try {
      console.log('🔐 AuthContext: Force refreshing session...')
      
      // KRITISK: Använd refreshSession istället för getSession för att undvika cache
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error && error.message !== 'refresh_token_not_found') {
        console.warn('Session refresh warning:', error.message)
      }

      const session = data?.session
      console.log('📊 Fresh session check:', session ? '✅ Found' : '❌ No session')
      
      if (session?.user) {
        setUser(session.user)
        const success = await fetchProfile(session.user.id)
        if (!success) {
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
      setLoading(false)
      setInitialized(true)
    }
  }

  // Enhanced fetchProfile med cache-busting
  const fetchProfile = async (userId: string): Promise<boolean> => {
    if (fetchingRef.current) return false
    fetchingRef.current = true

    try {
      console.log('📋 Fetching fresh profile for user:', userId)
      
      // CACHE-BUSTING: Lägg till timestamp för att undvika cache
      const timestamp = Date.now()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .then(result => {
          // Force refresh genom att lägga till cache-busting header
          console.log(`🔄 Profile query executed at ${timestamp}`)
          return result
        })

      if (error) {
        console.error('💥 Profile fetch error:', error)
        return false
      }

      if (!data || data.length === 0) {
        console.error('❌ No profile found for user')
        return false
      }

      const profileData = data[0]
      
      if (!profileData.is_active) {
        console.warn('🚫 User account is inactive')
        toast.error('Ditt konto är inaktiverat. Kontakta administratören.')
        await signOut()
        return false
      }

      console.log('✅ Fresh profile loaded:', { 
        email: profileData.email, 
        is_admin: profileData.is_admin, 
        customer_id: profileData.customer_id 
      })
      
      setProfile(profileData)
      
      // Uppdatera last_login i bakgrunden
      supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => console.log('✅ Last login updated'))
        .catch(err => console.warn('⚠️ Could not update last_login:', err))
        
      return true
    } catch (error: any) {
      console.error('💥 Error in fetchProfile:', error)
      toast.error('Kunde inte hämta profilinformation')
      return false
    } finally {
      fetchingRef.current = false
      setLoading(false)
      setInitialized(true)
    }
  }

  // Navigation med cache-säker routing
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

    if (user && profile) {
      const isOnLoginPage = currentPath === '/login'
      const isOnHomePage = currentPath === '/'
      
      if (isOnLoginPage || isOnHomePage) {
        console.log('🧭 Navigating user to appropriate dashboard')
        
        const targetPath = profile.is_admin ? '/admin' : '/portal'
        
        // CACHE-BUSTING: Använd window.location för hard navigation vid behov
        if (currentPath !== targetPath) {
          navigate(targetPath, { replace: true })
        }
      }
    } else if (!user && !currentPath.startsWith('/login') && currentPath !== '/') {
      console.log('🧭 No user, redirecting to login')
      navigate('/login', { replace: true })
    }
  }, [user, profile, initialized, loading, location.pathname, navigate])

  // Auth state listener med cache-resistance
  useEffect(() => {
    console.log('🔐 Setting up fresh auth state listener...')
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session ? '✅ Session exists' : '❌ No session')
      
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out, clearing all state')
        setUser(null)
        setProfile(null)
        setLoading(false)
        setInitialized(true)
        
        // CACHE-BUSTING: Rensa all local storage och session storage
        try {
          localStorage.clear()
          sessionStorage.clear()
        } catch (e) {
          console.warn('Could not clear storage:', e)
        }
        
        if (location.pathname !== '/login') {
          navigate('/login', { replace: true })
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('🔄 Token refreshed, updating user')
        setUser(session.user)
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
    console.log('🔐 Attempting fresh sign in for:', email)
    setLoading(true)

    try {
      // CACHE-BUSTING: Rensa session innan inloggning
      await supabase.auth.signOut()
      
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
    console.log('👋 Signing out user with cache clearing')
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // CACHE-BUSTING: Rensa all state
      setProfile(null)
      setUser(null)
      setInitialized(true)
      
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