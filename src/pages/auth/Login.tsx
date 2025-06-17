// src/pages/auth/Login.tsx
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Bug } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await signIn(email, password)
    } catch (error) {
      // Felmeddelanden hanteras i AuthContext
    } finally {
      setLoading(false)
    }
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
            />

            <Input
              type="password"
              label="Lösenord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <Button
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
            >
              Logga in
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
          Har du fått en inbjudan? 
          <Link 
            to="/set-password" 
            className="text-green-400 hover:text-green-300 ml-1 transition-colors"
          >
            Sätt ditt lösenord här
          </Link>
        </p>
      </div>
    </div>
  )
}