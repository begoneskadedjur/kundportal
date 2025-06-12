import { useAuth } from './hooks/useAuth'
import Login from './components/auth/Login'
import Dashboard from './components/Dashboard'
import AdminDashboard from './components/AdminDashboard'

function App() {
  const { user, loading } = useAuth()

  // Check if admin
  const isAdmin = user?.email === 'christian.k@begone.se'

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

  // Check URL for admin access
  const isAdminPath = window.location.pathname === '/admin'

  if (isAdminPath && isAdmin) {
    return <AdminDashboard />
  } else if (isAdminPath && !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Du har inte behörighet att komma åt admin-panelen.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg"
          >
            Tillbaka till Dashboard
          </button>
        </div>
      </div>
    )
  }

  return <Dashboard />
}

export default App