// 📁 src/types/billing.ts

/**
 * Huvudinterfacet för ett faktureringsärende.
 * Inkluderar alla fält från både privat- och företagstabellerna.
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
```---
### Steg 2: Skapa komponenterna i den nya mappen

Skapa en mapp `src/components/admin/billing/` och lägg följande tre filer där.

#### Fil 1: `BillingActions.tsx`

**Skapa fil:** `src/components/admin/billing/BillingActions.tsx`
```typescript
// 📁 src/components/admin/billing/BillingActions.tsx
import React from 'react'
import { Edit, Save, AlertCircle } from 'lucide-react'
import Button from '../../ui/Button'
import LoadingSpinner from '../../shared/LoadingSpinner'

interface Props {
  isEditing: boolean;
  isSaving: boolean;
  missingFieldsCount: number;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const BillingActions: React.FC<Props> = ({
  isEditing,
  isSaving,
  missingFieldsCount,
  onStartEdit,
  onSave,
  onCancel,
}) => {
  return (
    <div className="flex items-center gap-2">
      {missingFieldsCount > 0 && !isEditing && (
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg" title={`Det saknas ${missingFieldsCount} obligatoriska fält`}>
          <AlertCircle className="w-4 h-4 text-orange-400" />
          <span className="text-sm text-orange-400 hidden sm:inline">
            {missingFieldsCount} saknas
          </span>
        </div>
      )}
      
      {!isEditing ? (
        <Button variant="secondary" size="sm" onClick={onStartEdit} className="flex items-center gap-2">
          <Edit className="w-4 h-4" />
          Redigera
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
            Avbryt
          </Button>
          <Button variant="primary" size="sm" onClick={onSave} disabled={isSaving} className="flex items-center gap-2">
            {isSaving ? <LoadingSpinner /> : <Save className="w-4 h-4" />}
            Spara
          </Button>
        </div>
      )}
    </div>
  );
};