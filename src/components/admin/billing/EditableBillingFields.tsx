// 📁 src/components/admin/billing/EditableBillingFields.tsx - KOMPRIMERAD LAYOUT
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
      // Redigeringsläget är oförändrat och använder din befintliga Input-komponent
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

    // 🎯 NYTT: Visningsläge med flexbox för att komprimera layouten
    const renderContactInfo = () => {
      if (!value) {
        return <span className="italic text-orange-400">{required ? 'Saknas' : 'Ej angivet'}</span>;
      }
      const iconClasses = "text-blue-400 hover:text-blue-300 transition-colors cursor-pointer";
      return (
        <div className="flex items-center gap-3">
          <span className="text-white">{value}</span>
          {type === 'tel' && (
            <a href={`tel:${value}`} title={`Ring ${value}`} onClick={e => e.stopPropagation()}>
              <Phone size={16} className={iconClasses} />
            </a>
          )}
          {type === 'email' && (
            <a href={`mailto:${value}`} title={`Maila ${value}`} onClick={e => e.stopPropagation()}>
              <Mail size={16} className={iconClasses} />
            </a>
          )}
        </div>
      );
    };

    return (
      <div className="flex justify-between items-center py-3 border-b border-slate-800 last:border-b-0">
        <label className="text-sm text-slate-400">{label}</label>
        <div className="text-right">
          {renderContactInfo()}
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
        {/* All fältdata renderas nu med den nya, kompakta layouten */}
        <div className="space-y-2">
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
          <div className="space-y-2">
              {renderField('Faktura email', 'e_post_faktura', true, 'email')}
              {renderField('Fakturamärkning', 'markning_faktura', false, 'text', 'Referens/projekt nr')}
          </div>
        </div>
      )}
    </div>
  );
};