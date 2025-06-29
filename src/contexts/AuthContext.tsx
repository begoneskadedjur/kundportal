// src/contexts/AuthContext.tsx - FIXED VERSION för siduppdateringsproblemet + AUTO-ACCEPTERING

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  customer_id: string | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCustomer: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false); // NYTT: Förhindra dubbel-initialisering

  const navigate = useNavigate();
  const location = useLocation();

  // FIX 1: Säkrare initialization som körs bara en gång
  useEffect(() => {
    let isMounted = true; // Förhindra state updates efter unmount
    let authSubscription: any = null;

    const initializeAuth = async () => {
      if (initialized) return; // Förhindra dubbel-körning
      
      console.log('🔧 Initializing auth...');
      
      try {
        // 1. Försök hämta befintlig session
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession?.user && isMounted) {
          console.log('👤 Existing session found, loading profile...');
          setUser(existingSession.user);
          await fetchProfile(existingSession.user.id, existingSession.user);
        } else if (isMounted) {
          console.log('🚫 No existing session');
          setLoading(false);
        }

        // 2. Sätt upp auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!isMounted) return; // Ignorera om komponenten är unmounted
            
            console.log('🔄 Auth state change:', event);
            
            // Hantera olika auth events
            switch (event) {
              case 'SIGNED_IN':
                if (session?.user) {
                  setUser(session.user);
                  await fetchProfile(session.user.id, session.user);
                }
                break;
                
              case 'SIGNED_OUT':
                console.log('👋 User signed out');
                setUser(null);
                setProfile(null);
                setLoading(false);
                if (location.pathname !== '/login') {
                  navigate('/login', { replace: true });
                }
                break;
                
              case 'TOKEN_REFRESHED':
                console.log('🔄 Token refreshed');
                // Inget att göra, sessionen är redan uppdaterad
                break;
                
              default:
                // För andra events, kontrollera bara session status
                if (!session && isMounted) {
                  setUser(null);
                  setProfile(null);
                  setLoading(false);
                }
            }
          }
        );

        authSubscription = subscription;
        setInitialized(true);
        
      } catch (error) {
        console.error('💥 Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
          // Försök inte navigera här, låt ProtectedRoute hantera det
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      console.log('🧹 AuthContext cleanup');
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []); // Tom dependency array - körs bara en gång

  // NYTT: Auto-acceptering av inbjudan vid första inloggningen
  const acceptInvitationAutomatically = async (customerId: string, email: string, userId: string) => {
    try {
      console.log('🎫 Auto-accepting invitation for customer:', customerId);
      
      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          customerId, 
          email,
          userId // Skicka med user ID från auth
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Invitation auto-accepted:', result.message);
        
        // Visa diskret notifiering om det var första gången
        if (result.message !== 'Inbjudan redan accepterad') {
          toast.success('Välkommen! Ditt konto är nu aktiverat.', {
            duration: 4000,
            icon: '🎉'
          });
        }
      } else {
        const error = await response.json();
        console.log('ℹ️ Auto-accept info:', error.error);
        // Ingen toast för fel här - det är inte kritiskt för inloggningen
      }
    } catch (error) {
      console.error('Auto-accept failed (non-critical):', error);
      // Misslyckas inte hela inloggningen om detta går fel
    }
  };

  // FIX 2: Förbättrad fetchProfile med bättre error handling + AUTO-ACCEPTERING
  const fetchProfile = async (userId: string, authUser: User) => {
    try {
      console.log('📋 Fetching profile for user:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      if (!profileData.is_active) {
        toast.error('Ditt konto är inaktiverat.');
        await signOut();
        return;
      }
      
      console.log('✅ Profile loaded:', profileData);
      setProfile(profileData);

      // NYTT: Auto-acceptera inbjudan om användaren är kund och har customer_id
      if (!profileData.is_admin && profileData.customer_id && authUser.email) {
        await acceptInvitationAutomatically(
          profileData.customer_id, 
          authUser.email, 
          userId
        );
      }

      // FIX 3: Säkrare navigation som bara sker när användaren är på login/root
      const currentPath = location.pathname;
      if (currentPath === '/login' || currentPath === '/' || currentPath === '') {
        const targetPath = profileData.is_admin ? '/admin' : '/portal';
        console.log(`🧭 Navigating from ${currentPath} to ${targetPath}...`);
        
        // Använd setTimeout för att undvika navigation under rendering
        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 0);
      }

    } catch (error: any) {
      console.error('💥 Profile fetch error:', error);
      toast.error('Kunde inte hämta profilinformation.');
      
      // Om profile fetch misslyckas, logga ut för säkerhets skull
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  // FIX 4: Förbättrad signIn med bättre error handling
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success('Inloggning lyckades!');
      // Auth state change listener kommer att hantera resten
      
    } catch (error: any) {
      console.error('💥 Sign in error:', error);
      toast.error(error.message || 'Inloggning misslyckades');
      setLoading(false);
      throw error;
    }
  };

  // FIX 5: Förbättrad signOut med cleanup
  const signOut = async () => {
    try {
      console.log('👋 Signing out...');
      
      // Rensa local state först
      setUser(null);
      setProfile(null);
      
      // Sedan logga ut från Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Navigera till login
      navigate('/login', { replace: true });
      toast.success('Du har loggats ut');
      
    } catch (error) {
      console.error('💥 Sign out error:', error);
      // Även om utloggning misslyckas, rensa local state och navigera
      navigate('/login', { replace: true });
    }
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.is_admin ?? false,
    isCustomer: !profile?.is_admin && !!profile?.customer_id,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}