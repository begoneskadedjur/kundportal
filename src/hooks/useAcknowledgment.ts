// src/hooks/useAcknowledgment.ts - Hook för hantering av läskvitton

import { useState, useEffect, useCallback } from 'react'
import { CaseAcknowledgment } from '../types/acknowledgment'
import { AcknowledgmentService } from '../services/acknowledgmentService'

interface UseAcknowledgmentOptions {
  caseId: string | undefined
  userId: string | undefined
  userEmail: string | undefined
  userName?: string | null
}

interface UseAcknowledgmentReturn {
  acknowledgment: CaseAcknowledgment | null
  loading: boolean
  error: Error | null
  hasAcknowledged: boolean
  acknowledge: (pestLevel: number | null, problemRating: number | null) => Promise<void>
  refetch: () => Promise<void>
}

export function useAcknowledgment({
  caseId,
  userId,
  userEmail,
  userName
}: UseAcknowledgmentOptions): UseAcknowledgmentReturn {
  const [acknowledgment, setAcknowledgment] = useState<CaseAcknowledgment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchAcknowledgment = useCallback(async () => {
    if (!caseId || !userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await AcknowledgmentService.getAcknowledgment(caseId, userId)
      setAcknowledgment(data)
    } catch (err) {
      console.error('Error fetching acknowledgment:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch acknowledgment'))
    } finally {
      setLoading(false)
    }
  }, [caseId, userId])

  useEffect(() => {
    fetchAcknowledgment()
  }, [fetchAcknowledgment])

  const acknowledge = useCallback(async (pestLevel: number | null, problemRating: number | null) => {
    if (!caseId || !userId || !userEmail) {
      throw new Error('Missing required data for acknowledgment')
    }

    try {
      const newAcknowledgment = await AcknowledgmentService.createAcknowledgment({
        case_id: caseId,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        pest_level_at_acknowledgment: pestLevel,
        problem_rating_at_acknowledgment: problemRating
      })
      setAcknowledgment(newAcknowledgment)
    } catch (err) {
      console.error('Error creating acknowledgment:', err)
      throw err
    }
  }, [caseId, userId, userEmail, userName])

  return {
    acknowledgment,
    loading,
    error,
    hasAcknowledged: acknowledgment !== null,
    acknowledge,
    refetch: fetchAcknowledgment
  }
}
