// 📁 src/types/billing.ts

/**
 * Huvudinterfacet för ett faktureringsärende.
 * Inkluderar fält från både privat- och företagstabellerna.
 */
export interface BillingCase {
  id: string;
  case_number?: string;
  title?: string;
  type: 'private' | 'business';
  pris: number;
  completed_date: string;
  primary_assignee_name: string;
  primary_assignee_email?: string;
  skadedjur: string;
  adress?: any;
  description?: string;
  rapport?: string;
  // Företagsspecifika fält
  markning_faktura?: string;
  kontaktperson?: string;
  e_post_faktura?: string;
  e_post_kontaktperson?: string;
  telefon_kontaktperson?: string;
  bestallare?: string;
  org_nr?: string;
  // Privatperson-specifika fält
  personnummer?: string;
  r_fastighetsbeteckning?: string;
  billing_status: 'pending' | 'sent' | 'paid' | 'skip';
  billing_updated_at?: string;
}

/**
 * Interfacet för de fält som kan redigeras i modalen.
 */
export interface EditableFields {
  kontaktperson: string;
  telefon_kontaktperson: string;
  e_post_kontaktperson: string;
  markning_faktura: string;
  e_post_faktura: string;
  bestallare: string;
  org_nr: string;
  personnummer: string;
  r_fastighetsbeteckning: string;
}

export type BillingStatus = 'all' | 'pending' | 'sent' | 'paid' | 'skip';
export type SortField = 'completed_date' | 'pris' | 'primary_assignee_name' | 'billing_status';
export type SortDirection = 'asc' | 'desc';