import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    // Testa Supabase-anslutningen
    const testConnection = async () => {
      try {
        const { data, error } = await supabase.from('test').select('*').limit(1)
        if (error) {
          console.log('Supabase connection test:', error.message)
        }
        setConnected(true)
        console.log('Supabase connected successfully!')
      } catch (error) {
        console.error('Supabase connection failed:', error)
        setConnected(false)
      }
    }

    testConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          Begone Kundportal
        </h1>
        
        <div className="mb-4">
          <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            connected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {connected ? '✅ Supabase ansluten' : '❌ Supabase ej ansluten'}
          </span>
        </div>

        <div className="text-center">
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => setCount((count) => count + 1)}
          >
            Count is {count}
          </button>
        </div>
      </div>
    </div>
  )
}

export default App