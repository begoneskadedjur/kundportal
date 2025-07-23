// src/contexts/AuthContext.tsx - SLUTGILTIG VERSION FÖR STRIKT BEHÖRIGHETSSTYRNING

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

type Profile = {
  id: string; email: string; is_admin: boolean; is_active: boolean;
  customer_id: string | null; user_id: string; technician_id?: string | null;
  role?: 'admin' | 'customer' | 'technician'; display_name?: string | null;
  technicians?: { name: string; role: string; email: string; } | null;
};

type AuthContextType = {
  user: User | null; profile: Profile | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  // ✅ STRIKT DEFINIERADE ROLLER
  isAdmin: boolean;
  isCustomer: boolean;
  isTechnician: boolean;
};

// Skapar kontexten
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase.from('profiles').select(`*, technicians(*)`).eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!profileData) throw new Error('Ingen profil hittades.');
      if (!profileData.is_active) {
        toast.error('Ditt konto är inaktiverat.', { id: 'inactive-account' });
        return supabase.auth.signOut();
      }

      setProfile(profileData);

      // Omdirigering efter lyckad inloggning
      const onAuthPage = ['/', '/login', '/set-password', '/forgot-password'].includes(location.pathname);
      if (onAuthPage) {
        let targetPath = '/login'; // Fallback
        switch (profileData.role) {
          case 'admin':
            targetPath = '/koordinator/dashboard'; // Admins/Koordinatorer startar här
            break;
          case 'technician':
            targetPath = '/technician/dashboard';
            break;
          case 'customer':
            targetPath = '/customer';
            break;
        }
        console.log(`User role is '${profileData.role}'. Navigating to ${targetPath}`);
        navigate(targetPath, { replace: true });
      }
    } catch (error: any) {
      console.error('💥 Profile fetch error:', error.message);
      toast.error('Kunde inte hämta profil.', { id: 'profile-fetch-error' });
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        navigate('/login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [initialized, navigate]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      if (!data.user) throw new Error('Ingen användare returnerades efter inloggning.');
      toast.success('Inloggning lyckades!', { id: 'login-success' });
      return { success: true };
    } catch (error: any) {
      const message = error.message === 'Invalid login credentials' ? 'Felaktiga inloggningsuppgifter' : 'Ett fel uppstod.';
      toast.error(message, { id: 'login-error' });
      return { success: false, error: message };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success('Du har loggats ut.', { id: 'logout-success' });
  };
  
  // ✅ ENKEL OCH TYDLIG ROLDEFINITION
  const isAdmin = profile?.role === 'admin';
  const isTechnician = profile?.role === 'technician';
  const isCustomer = profile?.role === 'customer';

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin,
    isCustomer,
    isTechnician,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook för att använda kontexten
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}