// src/components/admin/TechnicianDropdown.tsx - Återanvändbar tekniker-dropdown
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type Technician = {
  id: string
  name: string
  email: string
  role: string
  is_active: boolean
}

interface TechnicianDropdownProps {
  value?: string | null
  onChange: (value: string) => void
  placeholder?: string
  includeUnassigned?: boolean
  onlyActive?: boolean
  className?: string
  label?: string
  required?: boolean
}

export default function TechnicianDropdown({
  value,
  onChange,
  placeholder = "Välj tekniker...",
  includeUnassigned = true,
  onlyActive = true,
  className = "",
  label,
  required = false
}: TechnicianDropdownProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTechnicians()
  }, [onlyActive])

  const fetchTechnicians = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('technicians')
        .select('id, name, email, role, is_active')
        .order('name', { ascending: true })
      
      if (onlyActive) {
        query = query.eq('is_active', true)
      }
      
      const { data, error } = await query
      
      if (error) throw error
      setTechnicians(data || [])
    } catch (error) {
      console.error('Error fetching technicians:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTechnicianByEmail = (email: string) => {
    return technicians.find(t => t.email === email)
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-2">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      
      <select
        value={value || ''}
        onChange={handleChange}
        disabled={loading}
        required={required}
        className={`w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white 
          focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-50 ${className}`}
      >
        {loading ? (
          <option value="">Laddar tekniker...</option>
        ) : (
          <>
            {includeUnassigned && (
              <option value="">{placeholder}</option>
            )}
            
            {technicians.map(technician => (
              <option key={technician.id} value={technician.email}>
                {technician.name} - {technician.role}
              </option>
            ))}
          </>
        )}
      </select>
      
      {value && !loading && (
        <div className="mt-1 text-xs text-slate-400">
          {(() => {
            const tech = getTechnicianByEmail(value)
            return tech ? `${tech.role} • ${tech.email}` : 'Tekniker hittades inte'
          })()}
        </div>
      )}
    </div>
  )
}