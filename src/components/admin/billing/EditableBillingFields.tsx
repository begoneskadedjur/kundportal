// 📁 src/components/admin/billing/EditableBillingFields.tsx - KOMPRIMERAD LAYOUT + KLICKBARA LÄNKAR
import React from 'react'
import { User, Building2, DollarSign, Mail, Phone } from 'lucide-react'
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
  const renderField = (
    label: string,
    field: keyof EditableFields,
    required: boolean,
    type: 'text' | 'email' | 'tel' = 'text',
    placeholder?: string
  ) => {
    const value = editableFields[field];

    if (isEditing) {
      return (
        <Input
          label={label}
          type={type}
          id={field}
          value={value || ''}
          onChange={(e) => onFieldChange(field, e.target.value)}
          placeholder={placeholder || label}
          required={required}
        />
      );
    }

    const renderClickableLink = () => {
      if (!value) {
        return <span className="italic text-orange-400">{required ? 'Saknas' : 'Ej angivet'}</span>;
      }
      if (type === 'tel') {
        return <a href={`tel:${value}`} className="text-blue-400 hover:underline flex items-center gap-1.5"><Phone size={14} />{value}</a>;
      }
      if (type === 'email') {
        return <a href={`mailto:${value}`} className="text-blue-400 hover:underline flex items-center gap-1.5"><Mail size={14} />{value}</a>;
      }
      return <span className="text-white">{value}</span>;
    };

    return (
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">{label}</label>
        <div className="p-2.5 min-h-[46px] flex items-center">
            {renderClickableLink()}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          {case_.type === 'private' ? <User className="w-5 h-5 text-purple-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
          {case_.type === 'private' ? 'Kunduppgifter' : 'Företagsuppgifter'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {renderField('Kontaktperson', 'kontaktperson', true)}
          {case_.type === 'business' && renderField('Beställare', 'bestallare', true)}
          {renderField('Telefon', 'telefon_kontaktperson', true, 'tel')}
          {renderField('Email', 'e_post_kontaktperson', true, 'email')}
          {case_.type === 'business' && renderField('Organisationsnummer', 'org_nr', true, 'text', 'XXXXXX-XXXX')}
          {case_.type === 'private' && renderField('Personnummer', 'personnummer', false, 'text', 'YYYYMMDD-XXXX')}
          {case_.type === 'private' && renderField('Fastighetsbeteckning', 'r_fastighetsbeteckning', false)}
        </div>
      </div>

      {case_.type === 'business' && (
        <div className="bg-slate-800/50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-400" />
            Faktureringsinformation
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {renderField('Faktura email', 'e_post_faktura', true, 'email')}
            {renderField('Fakturamärkning', 'markning_faktura', false, 'text', 'Referens/projekt nr')}
          </div>
        </div>
      )}
    </div>
  );
};