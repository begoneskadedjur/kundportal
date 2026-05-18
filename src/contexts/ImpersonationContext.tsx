import { createContext, useContext, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

type MultisiteRoleType = 'verksamhetschef' | 'regionchef' | 'platsansvarig'

export type ImpersonationTarget =
  | { type: 'customer'; customerId: string; customerName: string }
  | { type: 'multisite'; organizationId: string; roleType: MultisiteRoleType; siteIds: string[] | null; displayName: string }

type ImpersonationState = {
  isImpersonating: boolean
  // Customer portal
  impersonatedCustomerId: string | null
  impersonatedCustomerName: string | null
  // Multisite portal
  impersonatedOrganizationId: string | null
  impersonatedRoleType: MultisiteRoleType | null
  impersonatedSiteIds: string[] | null
  impersonatedDisplayName: string | null
  startImpersonation: (target: ImpersonationTarget) => void
  stopImpersonation: () => void
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  impersonatedCustomerId: null,
  impersonatedCustomerName: null,
  impersonatedOrganizationId: null,
  impersonatedRoleType: null,
  impersonatedSiteIds: null,
  impersonatedDisplayName: null,
  startImpersonation: () => {},
  stopImpersonation: () => {}
})

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [target, setTarget] = useState<ImpersonationTarget | null>(null)

  const startImpersonation = (t: ImpersonationTarget) => {
    if (!profile?.is_admin) return
    setTarget(t)
    navigate(t.type === 'customer' ? '/customer' : '/organisation')
  }

  const stopImpersonation = () => {
    setTarget(null)
    navigate('/admin/anvandarkonton-kund')
  }

  const isImpersonating = target !== null

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating,
      impersonatedCustomerId: target?.type === 'customer' ? target.customerId : null,
      impersonatedCustomerName: target?.type === 'customer' ? target.customerName : null,
      impersonatedOrganizationId: target?.type === 'multisite' ? target.organizationId : null,
      impersonatedRoleType: target?.type === 'multisite' ? target.roleType : null,
      impersonatedSiteIds: target?.type === 'multisite' ? target.siteIds : null,
      impersonatedDisplayName: target?.type === 'multisite' ? target.displayName : null,
      startImpersonation,
      stopImpersonation
    }}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  return useContext(ImpersonationContext)
}
