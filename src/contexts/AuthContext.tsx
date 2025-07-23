// src/contexts/AuthContext.tsx - SLUTGILTIG, RENAD VERSION

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';

// Typer (uppdaterade med koordinator-roll)
type Profile = {
  id: string; email: string; is_admin: boolean; is_active: boolean;
  customer_id: string | null; user_id: string; technician_id?: string | null;
  role?: 'admin' | 'customer' | 'technician' | 'koordinator'; display_name?: string | null;
  technicians?: { name: string; role: string; email: string; } | null;
};

type AuthContextType = {
  user: User | null; profile: Profile | null; loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCustomer: boolean;
  isTechnician: boolean;
  isKoordinator: boolean; // ✅ NYTT: Lägg till koordinator-check
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // fetchProfile är nu en intern funktion, endast använd inom denna kontext.
  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase.from('profiles').select(`*, technicians(*)`).eq('user_id', userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      if (!profileData) throw new Error('Ingen profil hittades.');
      if (!profileData.is_active) {
        toast.error('Ditt konto är inaktiverat.', { id: 'inactive-account' });
        await supabase.auth.signOut();
        return;
      }

      setProfile(profileData);

      const onAuthPage = ['/', '/login', '/set-password', '/forgot-password'].includes(location.pathname);
      if (onAuthPage) {
        let targetPath = '/login';
        switch (profileData.role) {
          case 'admin':
            targetPath = '/admin/dashboard';
            break;
          case 'koordinator':
            targetPath = '/koordinator/dashboard'; // ✅ NYTT: Koordinator-navigation
            break;
          case 'technician':
            targetPath = '/technician/dashboard';
            break;
          case 'customer':
            targetPath = '/customer';
            break;
        }
        console.log(`User role is '${profileData.role}'. Navigating to ${targetPath}`);
        
        // ✅ FÖRBÄTTRING: Använd setTimeout för att säkerställa att navigationen fungerar
        setTimeout(() => {
          navigate(targetPath, { replace: true });
        }, 100);
      }
    } catch (error: any) {
      console.error('💥 Profile fetch error:', error.message);
      toast.error('Kunde inte hämta profil.', { id: 'profile-fetch-error' });
      await supabase.auth.signOut();
      throw error; // ✅ NYTT: Kasta felet så signIn kan fånga det
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

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
  }, [initialized, navigate, location.pathname]); // ✅ ÄNDRAT: Lägg till location.pathname som dependency

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      if (!data.user) throw new Error('Ingen användare returnerades efter inloggning.');
      
      // ✅ KRITISK FIX: Vänta på att profilen laddas innan vi returnerar success
      await fetchProfile(data.user.id);
      
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
  
  const isAdmin = profile?.role === 'admin';
  const isTechnician = profile?.role === 'technician';
  const isCustomer = profile?.role === 'customer';
  const isKoordinator = profile?.role === 'koordinator'; // ✅ NYTT: Koordinator-check

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin,
    isCustomer,
    isTechnician,
    isKoordinator, // ✅ NYTT: Exportera koordinator-check
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}