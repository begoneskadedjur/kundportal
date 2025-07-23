// src/pages/auth/Login.tsx - SLUTGILTIG OCH STABIL VERSION

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, Link, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Bug } from 'lucide-react';

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

  // ✅ KÄRNAN I FIXEN: Detta är den nya, stabila logiken.
  // Om autentiseringen INTE laddar och en profil redan finns, betyder det
  // att en inloggad användare felaktigt har hamnat på loginsidan.
  if (!authLoading && profile) {
    let targetPath = '/customer'; // Fallback
    if (profile.role === 'admin') targetPath = '/koordinator/dashboard';
    else if (profile.role === 'technician') targetPath = '/technician/dashboard';
    
    // Omdirigera omedelbart för att bryta loopen.
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
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center relative">
              <Bug className="w-10 h-10 text-slate-950" />
              <div className="absolute inset-0 rounded-full border-2 border-red-500 transform rotate-45"></div>
              <div className="absolute w-full h-0.5 bg-red-500 top-1/2 transform -translate-y-1/2 rotate-45"></div>
            </div>
            <h1 className="text-4xl font-bold">
              <span className="text-gradient">BeGone</span>
            </h1>
          </div>
        </div>

        {/* Login Form */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-2xl font-semibold text-center mb-6">
            Logga in
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              type="email"
              label="E-postadress"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={isSubmitting}
            />
            <Input
              type="password"
              label="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
            />
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
              className="text-sm text-green-400 hover:text-green-300 transition-colors"
            >
              Glömt lösenord?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Har du fått en inbjudan?{' '}
          <Link 
            to="/set-password" 
            className="text-green-400 hover:text-green-300 ml-1 transition-colors"
          >
            Sätt ditt lösenord här
          </Link>
        </p>
      </div>
    </div>
  );
}