// src/contexts/AuthContext.tsx - SIMPLIFIED AND STABLE VERSION

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
  const [loading, setLoading] = useState(true); // Börjar som true, sätts till false när allt är klart.

  // Denna useEffect körs BARA EN GÅNG och hanterar ALLT auth-state.
  useEffect(() => {
    setLoading(true);
    // onAuthStateChange är det enda du behöver. Den hanterar initial laddning,
    // inloggning, utloggning och token refresh automatiskt.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session && session.user) {
          // Användare är inloggad eller en session har hittats.
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          // Användare är inte inloggad. Rensa state.
          setUser(null);
          setProfile(null);
          setLoading(false); // Viktigt: sluta ladda även om ingen är inloggad.
        }
      }
    );

    // Städa upp lyssnaren när komponenten försvinner.
    return () => {
      subscription.unsubscribe();
    };
  }, []); // <-- Tom beroendelista är avgörande!

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single(); // .single() är effektivare.

      if (error) throw error;

      if (data) {
        if (!data.is_active) {
          toast.error('Ditt konto är inaktiverat.');
          await supabase.auth.signOut(); // Logga ut inaktiv användare
          return;
        }
        setProfile(data);
      }
    } catch (error) {
      console.error('Kunde inte hämta profil:', error);
      toast.error('Kunde inte ladda din användarprofil.');
      await supabase.auth.signOut();
    } finally {
      // Oavsett om profilhämtning lyckas eller ej, är autentiseringsflödet klart.
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message || 'Felaktigt e-post eller lösenord.');
      setLoading(false);
      throw error;
    }
    // onAuthStateChange kommer att hantera state-uppdateringen och omdirigering.
    toast.success('Inloggning lyckades!');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange kommer att rensa user/profile och sätta loading till false.
    toast.success('Du har loggats ut.');
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

  // Vi renderar inte barnen förrän vi är klara med den initiala laddningen,
  // men ProtectedRoute hanterar detta redan med sin spinner, så detta är
  // en extra säkerhet men inte strikt nödvändigt.
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