// src/pages/auth/Login.tsx - SLUTGILTIG OCH STABIL VERSION

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { LogIn, User, Lock } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signIn, profile, loading: authLoading } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || isSubmitting) return;

    setIsSubmitting(true);
    await signIn(email, password);
    
    // Om inloggningen misslyckas, tillåt ett nytt försök.
    // Vid lyckad inloggning tar AuthContext över omdirigeringen.
    setIsSubmitting(false); 
  };

  // ✅ FIXAD NAVIGATION: Matchar nu AuthContext exakt
  if (!authLoading && profile) {
    let targetPath = '/customer'; // Fallback
    
    switch (profile.role) {
      case 'admin':
        targetPath = '/admin/dashboard'; // ✅ ÄNDRAT: Matchar AuthContext
        break;
      case 'koordinator':
        targetPath = '/koordinator/dashboard'; // ✅ NYTT: Koordinator-stöd
        break;
      case 'technician':
        targetPath = '/technician/dashboard';
        break;
      case 'customer':
        targetPath = '/customer';
        break;
    }
    
    // Omdirigera omedelbart för att bryta loopen
    return <Navigate to={targetPath} replace />;
  }
  
  // Visa laddningsskärm endast under den allra första sidladdningen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner text="Laddar..." />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url('/images/om_oss_begone_skadedjur.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95" />
      <div className="relative z-10 flex items-center justify-center p-4 min-h-screen">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
              <LogIn className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Välkommen tillbaka
            </h1>
            <p className="text-slate-400">
              Logga in på ditt BeGone-konto
            </p>
          </div>

          {/* Login Form */}
          <div className="glass rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                E-postadress
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="din@email.se"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                Lösenord
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="Ditt lösenord"
                />
              </div>
            </div>
            <Button
              type="submit"
              loading={isSubmitting}
              fullWidth
              size="lg"
            >
              {isSubmitting ? 'Loggar in...' : 'Logga in'}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link 
              to="/forgot-password"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              Glömt lösenord?
            </Link>
          </div>
          </div>

          <p className="text-center text-sm text-slate-400 mt-8">
            Har du fått en inbjudan?{' '}
            <Link 
              to="/set-password" 
              className="text-purple-400 hover:text-purple-300 ml-1 transition-colors"
            >
              Sätt ditt lösenord här
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}