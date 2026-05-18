import { createContext, useContext, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

type ImpersonationState = {
  isImpersonating: boolean
  impersonatedCustomerId: string | null
  impersonatedCustomerName: string | null
  startImpersonation: (customerId: string, customerName: string) => void
  stopImpersonation: () => void
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  impersonatedCustomerId: null,
  impersonatedCustomerName: null,
  startImpersonation: () => {},
  stopImpersonation: () => {}
})

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [impersonatedCustomerId, setImpersonatedCustomerId] = useState<string | null>(null)
  const [impersonatedCustomerName, setImpersonatedCustomerName] = useState<string | null>(null)

  const startImpersonation = (customerId: string, customerName: string) => {
    if (!profile?.is_admin) return
    setImpersonatedCustomerId(customerId)
    setImpersonatedCustomerName(customerName)
    navigate('/customer')
  }

  const stopImpersonation = () => {
    setImpersonatedCustomerId(null)
    setImpersonatedCustomerName(null)
    navigate('/admin/anvandarkonton-kund')
  }

  return (
    <ImpersonationContext.Provider value={{
      isImpersonating: impersonatedCustomerId !== null,
      impersonatedCustomerId,
      impersonatedCustomerName,
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
