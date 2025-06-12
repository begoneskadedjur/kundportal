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

  // Debug: Log user information
  useEffect(() => {
    console.log('🔍 User changed:', user)
    console.log('🔍 User email:', user?.email)
    console.log('🔍 User ID:', user?.id)
  }, [user])

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
    console.log('🔍 Checking admin status for user:', user?.id)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user?.id)
        .single()

      console.log('🔍 Admin check result:', { data, error })

      if (error) {
        console.error('❌ Error checking admin status:', error)
        setIsAdmin(false)
      } else {
        const adminStatus = data?.is_admin || false
        console.log('🔍 Setting admin status to:', adminStatus)
        setIsAdmin(adminStatus)
      }
    } catch (error) {
      console.error('❌ Admin check failed:', error)
      setIsAdmin(false)
    } finally {
      setAdminLoading(false)
    }
  }

  // Debug: Log current state
  useEffect(() => {
    console.log('🔍 Current state:', {
      user: !!user,
      isAdmin,
      adminLoading,
      pathname: window.location.pathname
    })
  }, [user, isAdmin, adminLoading])

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
  console.log('🔍 Is admin path:', isAdminPath)
  console.log('🔍 User is admin:', isAdmin)

  // Show admin dashboard if on /admin route and user is admin
  if (isAdminPath && isAdmin) {
    console.log('✅ Showing admin dashboard')
    return <AdminDashboard />
  } 
  
  // Show access denied if on /admin route but not admin
  if (isAdminPath && !isAdmin) {
    console.log('🚫 Access denied to admin')
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">Du har inte behörighet att komma åt admin-panelen.</p>
          <p className="text-sm text-slate-400 mb-4">
            Debug: User ID: {user?.id}, Is Admin: {isAdmin ? 'Yes' : 'No'}
          </p>
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
  console.log('📊 Showing regular dashboard, admin button:', isAdmin)
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
      
      {/* Temporary debug info */}
      <div className="fixed bottom-4 left-4 bg-black text-white p-2 text-xs rounded z-50">
        User: {user?.email} | Admin: {isAdmin ? 'Yes' : 'No'} | Path: {window.location.pathname}
      </div>
      
      <Dashboard />
    </div>
  )
}

export default App