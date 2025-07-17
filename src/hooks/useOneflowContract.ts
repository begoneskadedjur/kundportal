// src/hooks/useOneflowContract.ts - Custom hook för Oneflow kontrakt-hantering
import { useState } from 'react'
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
}

export function useOneflowContract(): UseOneflowContractReturn {
  const [isCreating, setIsCreating] = useState(false)
  const [createdContract, setCreatedContract] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createContract = async (params: CreateContractParams) => {
    const { templateId, contractData, recipient, sendForSigning, partyType } = params

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
      console.log('🚀 Skapar Oneflow kontrakt med data:', {
        templateId,
        contractData,
        recipient,
        sendForSigning,
        partyType
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
          partyType 
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
      
      // Success meddelande
      const successMsg = sendForSigning 
        ? '✅ Kontrakt skapat och skickat för signering!' 
        : '✅ Kontrakt skapat som utkast!'
      toast.success(successMsg)
      
      return result.contract
      
    } catch (err: any) {
      const errorMsg = `Fel vid skapande av kontrakt: ${err.message}`
      console.error('❌', errorMsg, err)
      setError(errorMsg)
      toast.error(errorMsg)
      throw err
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
    resetContract
  }
}