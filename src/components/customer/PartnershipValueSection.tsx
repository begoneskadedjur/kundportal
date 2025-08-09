// src/components/customer/PartnershipValueSection.tsx - BeGone Company Information
import React from 'react'
import { Shield, Award, CheckCircle, Globe, Phone, Mail, MapPin } from 'lucide-react'

const PartnershipValueSection: React.FC = () => {
  const certifications = [
    { icon: Shield, label: 'Certifierad skadedjursbekämpning' },
    { icon: Award, label: 'ISO 9001 & 14001 certifierad' },
    { icon: CheckCircle, label: 'Auktoriserad skadedjursbekämpare' }
  ]

  const values = [
    { number: '5000+', label: 'Nöjda kunder' },
    { number: '99%', label: 'Kundnöjdhet' },
    { number: '100%', label: 'Miljöcertifierad' }
  ]

  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-800/95 to-emerald-900/5 rounded-xl"></div>
      
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3Cpattern id='grid' width='60' height='60' patternUnits='userSpaceOnUse'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='white' stroke-width='1'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23grid)'/%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="relative rounded-xl border border-slate-700 p-8 lg:p-12">
        <div className="max-w-6xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              BeGone Skadedjur & Sanering AB
            </h2>
            <p className="text-lg text-emerald-400 font-medium mb-2">
              Er partner inom skadedjursbekämpning
            </p>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Vi levererar professionella skadedjurstjänster med fokus på kvalitet, 
              miljö och långsiktiga lösningar för företag i hela Sverige.
            </p>
          </div>

          {/* Value Props Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {values.map((value, index) => (
              <div 
                key={index}
                className="text-center p-6 bg-slate-900/30 rounded-lg border border-slate-700/50 hover:border-emerald-500/30 transition-all"
              >
                <div className="text-3xl font-bold text-white mb-2 font-mono">
                  {value.number}
                </div>
                <div className="text-sm text-slate-400">
                  {value.label}
                </div>
              </div>
            ))}
          </div>

          {/* Certifications */}
          <div className="mb-12">
            <h3 className="text-lg font-semibold text-white text-center mb-6">
              Certifieringar & Godkännanden
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              {certifications.map((cert, index) => {
                const Icon = cert.icon
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-2 bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50"
                  >
                    <Icon className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-slate-300">{cert.label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Contact Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Contact Details */}
            <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-700/50">
              <h4 className="text-sm font-medium text-emerald-400 mb-4 uppercase tracking-wider">
                Kontakt
              </h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <a href="tel:0102804410" className="text-white hover:text-emerald-400 transition-colors">
                    010 280 44 10
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <a href="mailto:info@begone.se" className="text-white hover:text-emerald-400 transition-colors">
                    info@begone.se
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-slate-500" />
                  <a href="https://begone.se" target="_blank" rel="noopener noreferrer" className="text-white hover:text-emerald-400 transition-colors">
                    www.begone.se
                  </a>
                </div>
              </div>
            </div>

            {/* Business Info */}
            <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-700/50">
              <h4 className="text-sm font-medium text-blue-400 mb-4 uppercase tracking-wider">
                Företagsinfo
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-slate-500">Organisationsnummer</span>
                  <p className="text-white font-mono">559378-9208</p>
                </div>
                <div>
                  <span className="text-slate-500">Öppettider</span>
                  <p className="text-white">
                    <span className="font-mono">08:00 - 17:00</span>
                    <span className="text-slate-400 ml-1">mån-fre</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-slate-900/30 rounded-lg p-6 border border-slate-700/50">
              <h4 className="text-sm font-medium text-purple-400 mb-4 uppercase tracking-wider">
                Snabblänkar
              </h4>
              <div className="space-y-2">
                <a href="#" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  → Om BeGone
                </a>
                <a href="#" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  → Våra tjänster
                </a>
                <a href="#" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  → Hållbarhet & Miljö
                </a>
                <a href="#" className="block text-sm text-slate-300 hover:text-white transition-colors">
                  → Karriär
                </a>
              </div>
            </div>
          </div>

          {/* Footer Message */}
          <div className="text-center pt-8 border-t border-slate-700/50">
            <p className="text-sm text-slate-400">
              Vi värdesätter ert förtroende och ser fram emot att fortsätta leverera 
              förstklassiga skadedjurstjänster till er verksamhet.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-emerald-400 font-medium">
                Alltid här för er
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PartnershipValueSection