// src/hooks/useOneflowContract.ts - UPPDATERAD MED ANVÄNDARKONTEXT
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext' // 🆕 ANVÄND AUTH CONTEXT
import toast from 'react-hot-toast'

interface ContractRecipient {
  name: string
  email: string
  company_name?: string
  organization_number?: string
}

interface ContractData {
  [key: string]: string
}

interface CreateContractParams {
  templateId: string
  contractData: ContractData
  recipient: ContractRecipient
  sendForSigning: boolean
  partyType: 'company' | 'individual'
  senderName?: string // 🆕 VALFRITT: Överstyr standard namn
}

interface UseOneflowContractReturn {
  // State
  isCreating: boolean
  createdContract: any | null
  error: string | null
  
  // Actions
  createContract: (params: CreateContractParams) => Promise<any>
  clearError: () => void
  resetContract: () => void
  
  // 🆕 ANVÄNDARINFO
  currentUser: any
  senderEmail: string | null
  senderName: string | null
}

export function useOneflowContract(): UseOneflowContractReturn {
  const { user, profile } = useAuth() // 🆕 HÄMTA ANVÄNDARINFO
  const [isCreating, setIsCreating] = useState(false)
  const [createdContract, setCreatedContract] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 🆕 BESTÄM AVSÄNDAREINFO
  const senderEmail = user?.email || null
  const senderName = profile?.display_name || 
                    user?.user_metadata?.full_name || 
                    'BeGone Medarbetare'

  const createContract = async (params: CreateContractParams) => {
    const { templateId, contractData, recipient, sendForSigning, partyType, senderName: customSenderName } = params

    // 🆕 VALIDERA ATT ANVÄNDAREN ÄR INLOGGAD
    if (!user?.email) {
      const errorMsg = 'Du måste vara inloggad för att skapa kontrakt'
      setError(errorMsg)
      toast.error(errorMsg)
      throw new Error(errorMsg)
    }

    // Validering
    if (!templateId || !recipient.email) {
      const errorMsg = 'Mall-ID och mottagarens e-post är obligatoriska'
      setError(errorMsg)
      toast.error(errorMsg)
      throw new Error(errorMsg)
    }

    setIsCreating(true)
    setError(null)

    try {
      const finalSenderName = customSenderName || senderName

      console.log('🚀 Skapar Oneflow kontrakt med data:', {
        templateId,
        contractData,
        recipient,
        sendForSigning,
        partyType,
        senderEmail: user.email,
        senderName: finalSenderName
      })

      const response = await fetch('/api/oneflow/create-contract', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          templateId, 
          contractData, 
          recipient, 
          sendForSigning, 
          partyType,
          // 🆕 SKICKA ANVÄNDARENS UPPGIFTER
          senderEmail: user.email,
          senderName: finalSenderName
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('❌ Oneflow API fel:', errorData)
        throw new Error(errorData.detail || errorData.message || 'Ett okänt serverfel inträffade')
      }
      
      const result = await response.json()
      console.log('✅ Kontrakt skapat framgångsrikt:', result)
      
      setCreatedContract(result.contract)
      
      // 🆕 PERSONALISERAT SUCCESS MEDDELANDE
      const successMsg = sendForSigning 
        ? `✅ Kontrakt skapat och skickat från ${user.email} för signering!` 
        : `✅ Kontrakt skapat som utkast av ${finalSenderName}!`
      
      toast.success(successMsg)
      
      return result.contract
      
    } catch (error: any) {
      console.error('❌ Fel vid skapande av kontrakt:', error)
      setError(error.message)
      toast.error(`❌ Fel: ${error.message}`)
      throw error
    } finally {
      setIsCreating(false)
    }
  }

  const clearError = () => {
    setError(null)
  }

  const resetContract = () => {
    setCreatedContract(null)
    setError(null)
  }

  return {
    // State
    isCreating,
    createdContract,
    error,
    
    // Actions
    createContract,
    clearError,
    resetContract,
    
    // 🆕 ANVÄNDARINFO
    currentUser: user,
    senderEmail,
    senderName
  }
}