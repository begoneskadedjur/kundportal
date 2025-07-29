// src/pages/customer/Cases.tsx (din befintliga)
import { PageHeader } from '../../components/shared';

export default function Cases() {
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <PageHeader 
          title="Ärenden"
          backPath="/customer"
        />
        <div className="text-center py-12">
          <p className="text-slate-400">Detaljvy för ärenden - kommer snart</p>
        </div>
      </div>
    </div>
  )
}