// src/contexts/AuthContext.tsx - KORRIGERAD VERSION

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// Typer (oförändrade)
type Profile = {
  id: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  customer_id: string | null;
  user_id: string;
  technician_id?: string | null;
  role?: 'admin' | 'customer' | 'technician';
  display_name?: string | null;
  technicians?: {
    name: string;
    role: string; 
    email: string;
  } | null;
};

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCustomer: boolean;
  isTechnician: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  technician: {
    id: string | null;
    name: string | null;
    email: string | null;
  } | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const autoAcceptInvitation = async (customerId: string, email: string, userId: string) => {
    try {
      console.log('🎫 Auto-accepting invitation for customer:', customerId);
      const response = await fetch('/api/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, email, userId })
      });
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Invitation auto-accepted:', result.message);
        if (result.message !== 'Inbjudan redan accepterad') {
          toast.success('Välkommen! Ditt konto är nu aktiverat.', { duration: 4000, icon: '🎉' });
        }
        return true;
      } else {
        const error = await response.json();
        console.log('ℹ️ Auto-accept info:', error.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Auto-accept failed (non-critical):', error);
      return false;
    }
  };

  const fetchProfile = async (userId: string, authUser?: User) => {
    // ✅ DEN KRITISKA ÄNDRINGEN: Denna rad är borttagen!
    // Vi sätter inte längre loading till true här, eftersom detta skapar en race condition.
    // setLoading(true); 

    try {
      console.log('📋 Fetching profile for user:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select(`*, technicians(name, role, email)`)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Profile fetch error:', error);
        throw new Error(`Kunde inte hämta profil: ${error.message}`);
      }
      
      if (!profileData) {
        throw new Error('Ingen profil hittades för användaren');
      }

      if (!profileData.is_active) {
        toast.error('Ditt konto är inaktiverat. Kontakta support.');
        await signOut();
        return;
      }
      
      console.log('✅ Profile loaded:', {
        id: profileData.id,
        email: profileData.email,
        is_admin: profileData.is_admin,
        customer_id: profileData.customer_id,
        technician_id: profileData.technician_id,
        role: profileData.role,
      });
      
      setProfile(profileData);

      if (!profileData.is_admin && profileData.customer_id) {
        const userEmail = authUser?.email || user?.email || profileData.email;
        if (userEmail) {
          await autoAcceptInvitation(profileData.customer_id, userEmail, userId);
        }
      }

      const currentPath = location.pathname;
      const shouldNavigate = ['/', '/login', '/auth/login', '/portal'].includes(currentPath);
      
      if (shouldNavigate) {
        let targetPath = '/customer';
        if (profileData.is_admin) {
          targetPath = '/admin';
        } else if (profileData.role === 'technician' && profileData.technician_id) {
          targetPath = '/technician/dashboard';
        }
        
        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 100);
      }

    } catch (error: any) {
      console.error('💥 Profile fetch error:', error);
      toast.error(error.message || 'Kunde inte hämta profilinformation');
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
    } finally {
      // Vi sätter fortfarande loading till false för att säkerställa att appen blir interaktiv
      // efter den allra första laddningen.
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      if (initialized) return;
      
      console.log('🔧 Initializing AuthContext...');
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }
        
        if (session?.user && isMounted) {
          console.log('👤 Found existing session for:', session.user.email);
          setUser(session.user);
          await fetchProfile(session.user.id, session.user);
        } else if (isMounted) {
          console.log('🚫 No existing session found');
          setLoading(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!isMounted) return;
            console.log('🔄 Auth state change:', event, session?.user?.email || 'no user');
            
            try {
              switch (event) {
                case 'SIGNED_IN':
                  if (session?.user) {
                    console.log('✅ User signed in:', session.user.email);
                    setUser(session.user);
                    await fetchProfile(session.user.id, session.user);
                  }
                  break;
                case 'SIGNED_OUT':
                  console.log('👋 User signed out');
                  setUser(null);
                  setProfile(null);
                  setLoading(false);
                  
                  const currentPath = location.pathname;
                  if (!currentPath.includes('/login') && currentPath !== '/') {
                    navigate('/login', { replace: true });
                  }
                  break;
                case 'TOKEN_REFRESHED':
                  console.log('🔄 Token refreshed for:', session?.user?.email);
                  break;
                case 'USER_UPDATED':
                  console.log('👤 User updated:', session?.user?.email);
                  if (session?.user) {
                    setUser(session.user);
                  }
                  break;
                default:
                  console.log('ℹ️ Unhandled auth event:', event);
                  if (!session && isMounted) {
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                  }
              }
            } catch (error) {
              console.error('Error handling auth state change:', error);
              setLoading(false);
            }
          }
        );

        authSubscription = subscription;
        setInitialized(true);
        
      } catch (error) {
        console.error('💥 Auth initialization error:', error);
        if (isMounted) {
          setLoading(false);
          toast.error('Problem med autentisering. Försök ladda om sidan.');
        }
      }
    };

    initializeAuth();

    return () => {
      console.log('🧹 AuthContext cleanup');
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      console.log('🔐 Attempting sign in for:', email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error) {
        let errorMessage = error.message;
        if (error.message === 'Invalid login credentials') {
          errorMessage = 'Felaktiga inloggningsuppgifter';
        } else if (error.message === 'Email not confirmed') {
          errorMessage = 'E-postadressen är inte bekräftad';
        }
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }
      
      if (!data.user) {
        const errorMessage = 'Ingen användare returnerades';
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      console.log('✅ Sign in successful for:', data.user.email);
      toast.success('Inloggning lyckades!');
      return { success: true };
      
    } catch (error: any) {
      const errorMessage = error.message || 'Ett oväntat fel uppstod';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('👋 Signing out user...');
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
      }
      
      navigate('/login', { replace: true });
      toast.success('Du har loggats ut');
      
    } catch (error) {
      console.error('💥 Sign out error:', error);
      navigate('/login', { replace: true });
      toast.error('Problem vid utloggning, men du har loggats ut');
    }
  };

  const technicianData = profile?.role === 'technician' && profile?.technician_id ? {
    id: profile.technician_id,
    name: profile.technicians?.name || profile.display_name || null,
    email: profile.technicians?.email || profile.email || null
  } : null;

  useEffect(() => {
    console.log('🐛 AuthContext State:', {
      user: user?.email || 'null',
      profile: profile ? `${profile.email} (${profile.role || (profile.is_admin ? 'admin' : 'customer')})` : 'null',
      technician: technicianData ? `${technicianData.name} (${technicianData.id})` : 'null',
      loading,
      initialized,
      currentPath: location.pathname
    });
  }, [user, profile, technicianData, loading, initialized, location.pathname]);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin: profile?.is_admin ?? false,
    isCustomer: !profile?.is_admin && !!profile?.customer_id && profile?.role !== 'technician',
    isTechnician: profile?.role === 'technician' && !!profile?.technician_id,
    technician: technicianData,
    fetchProfile: (userId: string) => fetchProfile(userId)
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