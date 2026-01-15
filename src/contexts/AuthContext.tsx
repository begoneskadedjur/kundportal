// src/contexts/AuthContext.tsx - KORRIGERAD

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  isKoordinator: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Använd ref för att alltid ha senaste navigate-funktionen i callbacks
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

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

      // ✅ KRITISK: Sätt loading till false INNAN navigering så att
      // dashboard-komponenter har tillgång till user och profile direkt
      setLoading(false);

      const onAuthPage = ['/', '/login', '/set-password', '/forgot-password'].includes(location.pathname);
      if (onAuthPage) {
        let targetPath = '/login';
        switch (profileData.role) {
          case 'admin':
            targetPath = '/admin/dashboard';
            break;
          case 'koordinator':
            targetPath = '/koordinator/dashboard';
            break;
          case 'technician':
            targetPath = '/technician/dashboard';
            break;
          case 'customer':
            // Check if this is a multisite user (customer_id is null but has multisite role)
            if (profileData.customer_id) {
              // Regular customer with customer_id
              targetPath = '/customer';
            } else {
              // Check if user has multisite role
              try {
                const { data: multisiteRole } = await supabase
                  .from('multisite_user_roles')
                  .select('role_type')
                  .eq('user_id', userId)
                  .eq('is_active', true)
                  .maybeSingle();

                targetPath = multisiteRole ? '/organisation' : '/customer';
                console.log(`AuthContext: Customer with customer_id: ${profileData.customer_id}, multisite_role: ${multisiteRole?.role_type}. Going to: ${targetPath}`);
              } catch (error) {
                console.error('Error checking multisite role:', error);
                // Fallback to customer portal if multisite check fails
                targetPath = '/customer';
              }
            }
            break;
        }
        console.log(`User role is '${profileData.role}'. Navigating to ${targetPath}`);

        // Navigera efter att loading är satt till false
        navigate(targetPath, { replace: true });
      }
    } catch (error: any) {
      console.error('💥 Profile fetch error:', error.message);
      toast.error('Kunde inte hämta profil.', { id: 'profile-fetch-error' });
      setLoading(false);
      await supabase.auth.signOut();
      throw error;
    }
  };

  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    // Initial session-hämtning
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Lyssnare för auth-händelser
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        setUser(session.user);
        // fetchProfile anropas redan i signIn-funktionen, så vi undviker dubbla anrop här.
        // Vi säkerställer bara att user-objektet är satt.
      } else if (event === 'SIGNED_OUT') {
        console.log('🚪 User signed out - redirecting to login');
        setUser(null);
        setProfile(null);
        setLoading(false);
        // Använd navigateRef för att alltid ha senaste referensen
        navigateRef.current('/login', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  // ✅ KRITISK FIX: `navigate` borttagen från dependencies - vi använder ref istället
  }, [initialized]);

  const signIn = async (email: string, password: string) => {
    setLoading(true); // Visa laddning under inloggningsprocessen
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      if (!data.user) throw new Error('Ingen användare returnerades efter inloggning.');

      // Sätt user INNAN fetchProfile för att säkerställa att useAuth har rätt värde
      setUser(data.user);

      await fetchProfile(data.user.id);

      toast.success('Inloggning lyckades!', { id: 'login-success' });
      return { success: true };
    } catch (error: any) {
      const message = error.message === 'Invalid login credentials' ? 'Felaktiga inloggningsuppgifter' : 'Ett fel uppstod.';
      toast.error(message, { id: 'login-error' });
      setLoading(false); // Stoppa laddning vid fel
      return { success: false, error: message };
    }
  };

  const signOut = async () => {
    // Rensa state först för omedelbar feedback
    setUser(null);
    setProfile(null);
    setLoading(false);

    // Sedan logga ut från Supabase
    await supabase.auth.signOut();
    toast.success('Du har loggats ut.', { id: 'logout-success' });

    // Navigera direkt till login - inte förlita oss på onAuthStateChange
    navigate('/login', { replace: true });
  };
  
  const isAdmin = profile?.role === 'admin';
  const isTechnician = profile?.role === 'technician';
  const isCustomer = profile?.role === 'customer';
  const isKoordinator = profile?.role === 'koordinator';

  const value = {
    user,
    profile,
    loading,
    signIn,
    signOut,
    isAdmin,
    isCustomer,
    isTechnician,
    isKoordinator,
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