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