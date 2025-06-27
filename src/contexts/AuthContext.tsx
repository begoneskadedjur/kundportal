// src/contexts/AuthContext.tsx - FINAL CORRECTED VERSION

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

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 Auth state change:', event);
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id); // Notera: Vi tar bort authUser-parametern, den behövs inte.
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      console.log('🧹 AuthContext cleanup');
      subscription.unsubscribe();
    };
  }, []); // Korrekt tom beroendelista

  const fetchProfile = async (userId: string) => {
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

      const currentPath = location.pathname;
      if (currentPath === '/login' || currentPath === '/') {
        const targetPath = profileData.is_admin ? '/admin' : '/portal';
        console.log(`🧭 Navigating to ${targetPath}...`);
        navigate(targetPath, { replace: true });
      }

    } catch (error: any) {
      console.error('💥 Profile fetch error:', error);
      toast.error('Kunde inte hämta profilinformation. Loggar ut.');
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      // Raden `await supabase.auth.signOut()` är nu borttagen.
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      toast.success('Inloggning lyckades!');
      // `onAuthStateChange` kommer nu att hantera resten utan störningar.
      
    } catch (error: any) {
      console.error('💥 Sign in error:', error);
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Felaktigt e-postadress eller lösenord');
      } else {
        toast.error(error.message || 'Inloggning misslyckades');
      }
      
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
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