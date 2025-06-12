import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { supabase } from './lib/supabase'
import Login from './components/auth/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

function App() {
  const { user, loading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminLoading, setAdminLoading] = useState(true)

  // Check if user is admin
  useEffect(() => {
    if (user) {
      checkAdminStatus()
    } else {
      setIsAdmin(false)
      setAdminLoading(false)
    }
  }, [user])

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      if (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } else {
        setIsAdmin(data?.is_admin || false)
      }
    } catch (error) {
      console.error('Admin check failed:', error)
      setIsAdmin(false)
    } finally {
      setAdminLoading(false)
    }
  }

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laddar...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  // Check URL for admin access
  const isAdminPath = window.location.pathname === '/admin'

  // Show admin dashboard if on /admin route and user is admin
  if (isAdminPath && isAdmin) {
    return <AdminDashboard />
  } 
  
  // Show access denied if on /admin route but not admin
  if (isAdminPath && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">Du har inte behörighet att komma åt admin-panelen.</p>
          <a 
            href="/"
            className="inline-block mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg"
          >
            Tillbaka till Dashboard
          </a>
        </div>
      </div>
    )
  }

  // Default: show regular dashboard with admin link if admin
  return (
    <div>
      {/* Add admin link for admin users */}
      {isAdmin && (
        <div className="fixed top-4 right-4 z-50">
          <a
            href="/admin"
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            🔧 Admin Panel
          </a>
        </div>
      )}
      <Dashboard />
    </div>
  )
}

export default App