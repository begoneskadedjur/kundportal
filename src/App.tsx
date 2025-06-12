import { useState, useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import Login from './components/auth/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

function App() {
  const { user, loading } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')

  // Simple admin check - just check email
  const isAdmin = user?.email === 'christian.k@begone.se'

  // Handle URL changes
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname
      if (path === '/admin') {
        setCurrentPage('admin')
      } else {
        setCurrentPage('dashboard')
      }
    }

    // Check initial route
    handleRouteChange()

    // Listen for URL changes (back/forward buttons)
    window.addEventListener('popstate', handleRouteChange)
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [])

  // Navigate to admin (programmatically)
  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin')
    setCurrentPage('admin')
  }

  // Navigate to dashboard (programmatically)  
  const navigateToDashboard = () => {
    window.history.pushState({}, '', '/')
    setCurrentPage('dashboard')
  }

  if (loading) {
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

  // Show admin dashboard if on /admin route and user is admin
  if (currentPage === 'admin' && isAdmin) {
    return <AdminDashboard />
  } 
  
  // Show access denied if on /admin route but not admin
  if (currentPage === 'admin' && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="mb-4">Du har inte behörighet att komma åt admin-panelen.</p>
          <button 
            onClick={navigateToDashboard}
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg"
          >
            Tillbaka till Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Default: show regular dashboard
  return (
    <div>
      {/* Add admin link for admin users */}
      {isAdmin && currentPage === 'dashboard' && (
        <div className="fixed top-4 right-4 z-50">
          <button
            onClick={navigateToAdmin}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            🔧 Admin Panel
          </button>
        </div>
      )}
      
      {/* Debug info */}
      <div className="fixed bottom-4 left-4 bg-black text-white p-2 text-xs rounded z-50">
        User: {user?.email} | Admin: {isAdmin ? 'Yes' : 'No'} | Path: {currentPage}
      </div>
      
      <Dashboard />
    </div>
  )
}

export default App