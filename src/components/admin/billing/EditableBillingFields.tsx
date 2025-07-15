// 📁 src/components/admin/billing/EditableBillingFields.tsx
import React from 'react'
import { User, Building2, DollarSign } from 'lucide-react'
import Input from '../../ui/Input'
import type { BillingCase, EditableFields } from '../../../types/billing'

interface Props {
  case_: BillingCase;
  isEditing: boolean;
  onFieldChange: (field: keyof EditableFields, value: string) => void;
  editableFields: EditableFields;
}

export const EditableBillingFields: React.FC<Props> = ({
  case_,
  isEditing,
  onFieldChange,
  editableFields,
}) => {
  const renderField = (label: string, field: keyof EditableFields, required: boolean, type: 'text' | 'email' | 'tel' = 'text', placeholder?: string) => {
    if (isEditing) {
      return (
        <Input
          label={label}
          type={type}
          id={field}
          value={editableFields[field]}
          onChange={(e) => onFieldChange(field, e.target.value)}
          placeholder={placeholder || label}
          required={required}
        />
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
        <p className={`text-white p-2.5 min-h-[46px] ${!editableFields[field] && required ? 'italic text-orange-400' : 'text-white'}`}>
          {String(editableFields[field]) || (required ? 'Saknas' : 'Ej angivet')}
        </p>
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-2 gap-x-6 gap-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          {case_.type === 'private' ? <User className="w-5 h-5 text-purple-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
          {case_.type === 'private' ? 'Kunduppgifter' : 'Företagsuppgifter'}
        </h3>
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
          {renderField('Kontaktperson', 'kontaktperson', true)}
          {renderField('Telefon', 'telefon_kontaktperson', true, 'tel')}
          {renderField('Email', 'e_post_kontaktperson', true, 'email')}
          {case_.type === 'business' ? (
            <>
              {renderField('Organisationsnummer', 'org_nr', true, 'text', 'XXXXXX-XXXX')}
              {renderField('Beställare', 'bestallare', true)}
            </>
          ) : (
            <>
              {renderField('Personnummer', 'personnummer', false, 'text', 'YYYYMMDD-XXXX')}
              {renderField('Fastighetsbeteckning', 'r_fastighetsbeteckning', false)}
            </>
          )}
        </div>
      </div>

      {case_.type === 'business' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Faktureringsinformation
          </h3>
          <div className="bg-slate-800/50 rounded-lg p-4 space-y-4">
            {renderField('Faktura email', 'e_post_faktura', true, 'email')}
            {renderField('Fakturamärkning', 'markning_faktura', false, 'text', 'Referens/projekt nr')}
          </div>
        </div>
      )}
    </div>
  );
};