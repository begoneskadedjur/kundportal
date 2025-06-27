// src/contexts/AuthContext.tsx - FINAL, DECOUPLED VERSION

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Typerna är oförändrade
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
  signIn: (email: string, password:string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isCustomer: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        // VIKTIGT: Sätt loading till false EFTER att allt är klart
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Tom dependency array är korrekt

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        if (!data.is_active) {
          toast.error('Ditt konto är inaktiverat.');
          await supabase.auth.signOut();
          return;
        }
        setProfile(data);
      }
    } catch (error) {
      console.error('Kunde inte hämta profil:', error);
      toast.error('Profilfel. Loggar ut.');
      await supabase.auth.signOut();
    }
    // `setLoading` hanteras nu i onAuthStateChange
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false); // Sluta ladda vid fel
      toast.error('Felaktigt e-post eller lösenord.');
      throw error;
    }
    // onAuthStateChange hanterar resten
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
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