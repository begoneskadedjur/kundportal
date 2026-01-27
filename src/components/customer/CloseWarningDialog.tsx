// src/components/customer/CloseWarningDialog.tsx - Soft block vid stängning utan bekräftelse

import React from 'react'
import { AlertTriangle, X, ArrowLeft } from 'lucide-react'
import Button from '../ui/Button'

interface CloseWarningDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirmClose: () => void
  onGoBack: () => void
}

const CloseWarningDialog: React.FC<CloseWarningDialogProps> = ({
  isOpen,
  onClose,
  onConfirmClose,
  onGoBack
}) => {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 bg-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                Vill du stänga utan att bekräfta?
              </h3>
              <button
                onClick={onClose}
                className="ml-auto p-1 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-slate-300 mb-4">
              Teknikern har gjort en bedömning som indikerar en kritisk situation.
              Denna bedömning kräver er uppmärksamhet och bekräftelse.
            </p>
            <p className="text-sm text-slate-400">
              Genom att bekräfta visar ni att ni har tagit del av informationen,
              vilket hjälper oss att säkerställa kvaliteten på våra tjänster.
            </p>
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={onConfirmClose}
              className="flex-1 justify-center text-slate-400 hover:text-white"
            >
              Stäng ändå
            </Button>
            <Button
              onClick={onGoBack}
              className="flex-1 justify-center bg-amber-500 hover:bg-amber-600 text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Tillbaka till ärendet
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

export default CloseWarningDialog
