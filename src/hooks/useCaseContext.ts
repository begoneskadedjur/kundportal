// src/hooks/useCaseContext.ts
// Hook for fetching case context data for communication modal

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { CaseType } from '../types/communication';
import { PrivateCasesRow, BusinessCasesRow, STATUS_CONFIG, ClickUpStatus } from '../types/database';

// Unified case context interface
export interface CaseContext {
  id: string;
  caseType: CaseType;
  title: string;
  status: ClickUpStatus;
  statusColor: string;

  // Contact info
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;

  // Address (formatted)
  address: string | null;
  addressLat: number | null;
  addressLng: number | null;

  // Pest type
  pestType: string | null;
  otherPestType: string | null;

  // Scheduling
  startDate: string | null;
  dueDate: string | null;

  // Description
  description: string | null;

  // Report & Documentation
  rapport: string | null;

  // Price
  price: number | null;

  // Assignees
  primaryAssigneeName: string | null;
  secondaryAssigneeName: string | null;
  tertiaryAssigneeName: string | null;

  // Original clickup task id for navigation
  clickupTaskId: string | null;
}

interface UseCaseContextResult {
  caseContext: CaseContext | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Helper to format address from JSONB
const formatAddress = (address: any): string | null => {
  if (!address) return null;

  if (typeof address === 'object' && address.formatted_address) {
    return address.formatted_address;
  }

  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch {
      return address;
    }
  }

  return null;
};

// Helper to extract coordinates
const extractCoordinates = (address: any): { lat: number | null; lng: number | null } => {
  if (!address) return { lat: null, lng: null };

  let addressObj = address;
  if (typeof address === 'string') {
    try {
      addressObj = JSON.parse(address);
    } catch {
      return { lat: null, lng: null };
    }
  }

  if (addressObj.location && typeof addressObj.location.lat === 'number') {
    return {
      lat: addressObj.location.lat,
      lng: addressObj.location.lng
    };
  }

  return { lat: null, lng: null };
};

// Transform private case to CaseContext
const transformPrivateCase = (data: PrivateCasesRow): CaseContext => {
  const coords = extractCoordinates(data.adress);
  const statusConfig = STATUS_CONFIG[data.status as ClickUpStatus];

  return {
    id: data.id,
    caseType: 'private',
    title: data.title,
    status: data.status as ClickUpStatus,
    statusColor: statusConfig?.color || '#87909e',
    contactPerson: data.kontaktperson,
    contactPhone: data.telefon_kontaktperson,
    contactEmail: data.e_post_kontaktperson,
    address: formatAddress(data.adress),
    addressLat: coords.lat,
    addressLng: coords.lng,
    pestType: data.skadedjur,
    otherPestType: data.annat_skadedjur,
    startDate: data.start_date,
    dueDate: data.due_date,
    description: data.description,
    rapport: data.rapport,
    price: data.pris,
    primaryAssigneeName: data.primary_assignee_name,
    secondaryAssigneeName: data.secondary_assignee_name,
    tertiaryAssigneeName: data.tertiary_assignee_name,
    clickupTaskId: data.clickup_task_id
  };
};

// Transform business case to CaseContext
const transformBusinessCase = (data: BusinessCasesRow): CaseContext => {
  const coords = extractCoordinates(data.adress);
  const statusConfig = STATUS_CONFIG[data.status as ClickUpStatus];

  return {
    id: data.id,
    caseType: 'business',
    title: data.title,
    status: data.status as ClickUpStatus,
    statusColor: statusConfig?.color || '#87909e',
    contactPerson: data.kontaktperson,
    contactPhone: data.telefon_kontaktperson,
    contactEmail: data.e_post_kontaktperson,
    address: formatAddress(data.adress),
    addressLat: coords.lat,
    addressLng: coords.lng,
    pestType: data.skadedjur,
    otherPestType: data.annat_skadedjur,
    startDate: data.start_date,
    dueDate: data.due_date,
    description: data.description,
    rapport: data.rapport,
    price: data.pris,
    primaryAssigneeName: data.primary_assignee_name,
    secondaryAssigneeName: data.secondary_assignee_name,
    tertiaryAssigneeName: data.tertiary_assignee_name,
    clickupTaskId: data.clickup_task_id
  };
};

export function useCaseContext(
  caseId: string | null,
  caseType: CaseType | null
): UseCaseContextResult {
  const [caseContext, setCaseContext] = useState<CaseContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCaseContext = useCallback(async () => {
    if (!caseId || !caseType) {
      setCaseContext(null);
      return;
    }

    // Contract cases are not yet supported
    if (caseType === 'contract') {
      setError('Avtalsärenden stöds inte ännu');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const tableName = caseType === 'private' ? 'private_cases' : 'business_cases';

      const { data, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', caseId)
        .single();

      if (fetchError) {
        console.error('Error fetching case context:', fetchError);
        setError('Kunde inte hämta ärendedata');
        setCaseContext(null);
        return;
      }

      if (!data) {
        setError('Ärendet hittades inte');
        setCaseContext(null);
        return;
      }

      const context = caseType === 'private'
        ? transformPrivateCase(data as PrivateCasesRow)
        : transformBusinessCase(data as BusinessCasesRow);

      setCaseContext(context);
    } catch (err) {
      console.error('Unexpected error fetching case context:', err);
      setError('Ett oväntat fel uppstod');
      setCaseContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, caseType]);

  useEffect(() => {
    fetchCaseContext();
  }, [fetchCaseContext]);

  const refresh = useCallback(() => {
    fetchCaseContext();
  }, [fetchCaseContext]);

  return {
    caseContext,
    isLoading,
    error,
    refresh
  };
}
