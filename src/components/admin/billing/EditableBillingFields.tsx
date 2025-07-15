// 📁 src/components/admin/billing/EditableBillingFields.tsx - KOMPAKT DESIGN MED ADRESS
import React from 'react'
import { User, Building2, DollarSign, Mail, Phone, MapPin } from 'lucide-react'
import Input from '../../ui/Input'
import type { BillingCase, EditableFields } from '../../../types/billing'

interface Props {
  case_: BillingCase;
  isEditing: boolean;
  onFieldChange: (field: keyof EditableFields, value: string) => void;
  editableFields: EditableFields;
  formattedAddress: string; // 🆕 Adress från parent
}

export const EditableBillingFields: React.FC<Props> = ({
  case_,
  isEditing,
  onFieldChange,
  editableFields,
  formattedAddress
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

    // 🎯 KOMPAKT VISNINGSLÄGE med flexbox
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
      <div className="flex justify-between items-center py-2 border-b border-slate-800 last:border-b-0">
        <label className="text-sm text-slate-400 flex-shrink-0 w-32">{label}</label>
        <div className="text-right">
          {renderContactInfo()}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 🏢 KUNDUPPGIFTER/FÖRETAGSUPPGIFTER med adress integrerad */}
      <div className="bg-slate-800/50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          {case_.type === 'private' ? <User className="w-5 h-5 text-purple-400" /> : <Building2 className="w-5 h-5 text-blue-400" />}
          {case_.type === 'private' ? 'Kunduppgifter' : 'Företagsuppgifter'}
        </h3>
        
        {/* 🎯 GRID LAYOUT för kompakt visning */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* VÄNSTER KOLUMN - Kontaktinfo */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300 mb-3 border-b border-slate-700 pb-1">Kontaktinformation</h4>
            {renderField('Kontaktperson', 'kontaktperson', true)}
            {case_.type === 'business' && renderField('Beställare', 'bestallare', true)}
            {renderField('Telefon', 'telefon_kontaktperson', true, 'tel')}
            {renderField('Email', 'e_post_kontaktperson', true, 'email')}
          </div>

          {/* HÖGER KOLUMN - Adress + ID-nummer */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-300 mb-3 border-b border-slate-700 pb-1">Adress & Identifiering</h4>
            
            {/* 📍 ADRESS VISNING - inline med andra fält */}
            <div className="flex justify-between items-center py-2 border-b border-slate-800">
              <label className="text-sm text-slate-400 flex-shrink-0 w-32 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Adress
              </label>
              <div className="text-right max-w-48">
                <span className="text-white text-sm leading-relaxed">{formattedAddress}</span>
              </div>
            </div>

            {case_.type === 'business' && renderField('Org.nummer', 'org_nr', true, 'text', 'XXXXXX-XXXX')}
            {case_.type === 'private' && renderField('Personnummer', 'personnummer', false, 'text', 'YYYYMMDD-XXXX')}
            {case_.type === 'private' && renderField('Fastighetsbeteckning', 'r_fastighetsbeteckning', false)}
          </div>
        </div>
      </div>

      {/* 💳 FAKTURERINGSINFORMATION för företag */}
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