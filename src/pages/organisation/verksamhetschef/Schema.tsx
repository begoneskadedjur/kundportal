// src/pages/organisation/verksamhetschef/Schema.tsx - Schema placeholder för verksamhetschef
import React from 'react'
import { useMultisite } from '../../../contexts/MultisiteContext'
import OrganisationLayout from '../../../components/organisation/OrganisationLayout'
import Card from '../../../components/ui/Card'
import { Calendar, Clock, MapPin } from 'lucide-react'

const VerksamhetschefSchema: React.FC = () => {
  const { organization } = useMultisite()

  return (
    <OrganisationLayout userRoleType="verksamhetschef">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900/20 to-indigo-900/20 rounded-2xl p-6 border border-purple-700/50">
          <h1 className="text-2xl font-bold text-white mb-2">
            Schema - {organization?.organization_name}
          </h1>
          <p className="text-purple-200">
            Översikt över schemalagda besök för alla enheter
          </p>
        </div>

        {/* Placeholder content */}
        <Card className="bg-slate-800/50 border-slate-700">
          <div className="p-12 text-center">
            <Calendar className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Schema kommer snart</h2>
            <p className="text-slate-400 max-w-md mx-auto">
              Schemaläggning hanteras av koordinatorn. Ärenden skapas på varje enhet och 
              skickas automatiskt till koordinatorn för bokning.
            </p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="bg-slate-700/30 rounded-lg p-4">
                <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">Kommande besök</p>
                <p className="text-xs text-slate-500 mt-1">Visas i översikten</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <MapPin className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">Per enhet</p>
                <p className="text-xs text-slate-500 mt-1">Filtrera efter plats</p>
              </div>
              <div className="bg-slate-700/30 rounded-lg p-4">
                <Calendar className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-slate-300">Kalendervy</p>
                <p className="text-xs text-slate-500 mt-1">Kommer snart</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </OrganisationLayout>
  )
}

export default VerksamhetschefSchema