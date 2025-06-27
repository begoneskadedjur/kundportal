// src/contexts/AuthContext.tsx - REPAIRED AND STABILIZED VERSION

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
  const [loading, setLoading] = useState(true); // Börjar alltid som true

  const navigate = useNavigate();
  const location = useLocation();

  // FIX 1: DEN ENDA useEffect som behövs för att hantera auth-state.
  // Beroendelistan är nu tom `[]`, vilket är AVGÖRANDE.
  // Denna kod körs nu BARA EN GÅNG när appen startar.
  useEffect(() => {
    // onAuthStateChange hanterar allt: initial sidladdning, inloggning, utloggning.
    // Vi behöver inte längre den separata `initAuth`-funktionen.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event);
        if (session?.user) {
          // Om en session finns, sätt användaren och hämta profilen.
          // Detta hanterar både F5-refresh och ny inloggning.
          setUser(session.user);
          await fetchProfile(session.user.id, session.user);
        } else {
          // Om ingen session finns, rensa allt och sluta ladda.
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Städa upp lyssnaren när komponenten avmonteras.
    return () => {
      console.log('🧹 AuthContext cleanup');
      subscription.unsubscribe();
    };
  }, []); // <-- KRITISK ÄNDRING: Tom beroendelista!

  // FIX 2: Förenklad fetchProfile som nu också hanterar navigation.
  const fetchProfile = async (userId: string, authUser: User) => {
    try {
      console.log('📋 Fetching profile for user:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single(); // .single() är effektivare än .limit(1)

      if (error) throw error;
      
      if (!profileData.is_active) {
        toast.error('Ditt konto är inaktiverat.');
        await signOut(); // Logga ut direkt
        return;
      }
      
      console.log('✅ Profile loaded:', profileData);
      setProfile(profileData);

      // FIX 3: Flyttat navigationslogiken HIT.
      // Den körs nu BARA när en profil har laddats framgångsrikt.
      const currentPath = location.pathname;
      if (currentPath === '/login' || currentPath === '/') {
        const targetPath = profileData.is_admin ? '/admin' : '/portal';
        console.log(`🧭 Navigating to ${targetPath}...`);
        navigate(targetPath, { replace: true });
      }

    } catch (error: any) {
      console.error('💥 Profile fetch error:', error);
      toast.error('Kunde inte hämta profilinformation. Loggar ut.');
      await supabase.auth.signOut(); // Logga ut om profilen misslyckas
    } finally {
      // Oavsett resultat, när detta flöde är klart, slutar vi ladda.
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success('Inloggning lyckades!');
      // `onAuthStateChange` kommer automatiskt att plocka upp 'SIGNED_IN'-händelsen
      // och köra `fetchProfile`, som i sin tur hanterar navigationen.
      
    } catch (error: any) {
      toast.error(error.message || 'Inloggning misslyckades');
      setLoading(false); // Sluta ladda vid fel
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // `onAuthStateChange` kommer att rensa state.
    setUser(null);
    setProfile(null);
    navigate('/login', { replace: true });
    toast.success('Du har loggats ut');
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