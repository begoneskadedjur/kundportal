import React from 'react'

const PartnershipValueSection: React.FC = () => {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex flex-col lg:flex-row gap-8 items-start">

        {/* Vänster: Om BeGone */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Om BeGone</p>
          <p className="text-sm font-semibold text-white mb-1">BeGone Skadedjur & Sanering AB</p>
          <p className="text-sm text-slate-400 leading-relaxed">
            Professionell skadedjursbekämpning med fokus på kvalitet, miljö och långsiktiga
            lösningar för företag och offentlig sektor i hela Sverige.
          </p>

          {/* Certifieringar */}
          <div className="mt-4 flex flex-wrap gap-2">
            {/* ISO 14001 — miljöcertifiering */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M8 12c1-3 4-5 7-4" />
                <path d="M12 8c-3 1-5 4-4 7" />
                <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
              </svg>
              <span className="text-xs text-slate-300">ISO 14001</span>
            </div>

            {/* ISO 9001 — kvalitetsledning */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="3" width="14" height="18" rx="2" />
                <path d="M9 7h6M9 11h6M9 15h4" />
              </svg>
              <span className="text-xs text-slate-300">ISO 9001</span>
            </div>

            {/* Auktoriserad skadedjursbekämpare */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/50 border border-slate-700/50 rounded-lg">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.5 6.5H21l-5.5 4 2 6.5L12 15l-5.5 4 2-6.5L3 8.5h6.5z" />
              </svg>
              <span className="text-xs text-slate-300">Auktoriserad bekämpare</span>
            </div>
          </div>
        </div>

        {/* Höger: Kontakt */}
        <div className="flex-shrink-0 w-full lg:w-64">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Kontakt</p>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              <a href="tel:0102804410" className="text-slate-300 hover:text-white transition-colors">
                010 280 44 10
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <a href="mailto:info@begone.se" className="text-slate-300 hover:text-white transition-colors">
                info@begone.se
              </a>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              <a href="https://begone.se" target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-white transition-colors">
                www.begone.se
              </a>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-1 text-xs text-slate-500">
            <div className="flex justify-between">
              <span>Org.nr</span>
              <span className="font-mono text-slate-400">559378-9208</span>
            </div>
            <div className="flex justify-between">
              <span>Öppettider</span>
              <span className="text-slate-400">08:00–17:00 mån–fre</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PartnershipValueSection
