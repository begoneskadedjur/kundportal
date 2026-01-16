// src/components/shared/DeleteCaseConfirmDialog.tsx
// Bekräftelsedialog för radering av ärenden

import { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2, MessageSquare, Image, Bell, FileText, Clock } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { getCaseDeleteInfo, deleteCase, type CaseDeleteInfo, type DeleteableCaseType } from '../../services/caseDeleteService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface DeleteCaseConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
  caseId: string;
  caseType: DeleteableCaseType;
  caseTitle: string;
}

export default function DeleteCaseConfirmDialog({
  isOpen,
  onClose,
  onDeleted,
  caseId,
  caseType,
  caseTitle
}: DeleteCaseConfirmDialogProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState<CaseDeleteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  // Hämta information om relaterad data när dialogen öppnas
  useEffect(() => {
    if (isOpen && caseId && caseType) {
      setLoading(true);
      setError(null);
      setConfirmText('');

      getCaseDeleteInfo(caseId, caseType)
        .then(info => {
          setDeleteInfo(info);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message || 'Kunde inte hämta ärende-information');
          setLoading(false);
        });
    }
  }, [isOpen, caseId, caseType]);

  // Hantera radering
  const handleDelete = async () => {
    if (!profile || !deleteInfo?.canDelete) return;

    setDeleting(true);
    setError(null);

    const result = await deleteCase(
      caseId,
      caseType,
      profile.id,
      profile.full_name || profile.email || 'Okänd användare'
    );

    if (result.success) {
      toast.success('Ärendet har raderats');
      onDeleted();
      onClose();
    } else {
      setError(result.error || 'Kunde inte radera ärendet');
      toast.error(result.error || 'Kunde inte radera ärendet');
    }

    setDeleting(false);
  };

  // Formatera ärendetyp för visning
  const getCaseTypeLabel = (type: DeleteableCaseType): string => {
    switch (type) {
      case 'private': return 'Privatperson';
      case 'business': return 'Företag';
      case 'contract': return 'Avtalskund';
    }
  };

  // Beräkna totalt antal relaterade poster
  const getTotalRelatedItems = (): number => {
    if (!deleteInfo) return 0;
    const { relatedData } = deleteInfo;
    return (
      relatedData.comments +
      relatedData.images +
      relatedData.notifications +
      relatedData.readReceipts +
      relatedData.visits +
      relatedData.billingLogs
    );
  };

  // Kontrollera om "RADERA" är korrekt skrivet
  const isConfirmValid = confirmText.toUpperCase() === 'RADERA';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Radera ärende"
      size="md"
      preventClose={deleting}
    >
      <div className="p-6">
        {/* Laddningsindikator */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        )}

        {/* Fel vid laddning */}
        {!loading && error && !deleteInfo && (
          <div className="bg-red-500/20 border border-red-500/40 p-4 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Huvudinnehåll */}
        {!loading && deleteInfo && (
          <div className="space-y-6">
            {/* Varningsikon och rubrik */}
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Är du säker på att du vill radera detta ärende?
                </h3>
                <p className="text-slate-400 mt-1">
                  Denna åtgärd kan inte ångras.
                </p>
              </div>
            </div>

            {/* Ärende-info */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-400">Ärende:</span>
              </div>
              <p className="text-white font-medium">{deleteInfo.caseTitle}</p>
              <p className="text-sm text-slate-500 mt-1">
                {getCaseTypeLabel(deleteInfo.caseType)}
                {deleteInfo.customerName && ` • ${deleteInfo.customerName}`}
              </p>
            </div>

            {/* Kan inte raderas - blockerad */}
            {!deleteInfo.canDelete && (
              <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">Kan inte radera</p>
                    <p className="text-amber-300 text-sm mt-1">
                      {deleteInfo.blockReason}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Relaterad data som kommer att raderas */}
            {deleteInfo.canDelete && getTotalRelatedItems() > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-400">
                  Följande data kommer att raderas permanent:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {deleteInfo.relatedData.comments > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/30 rounded px-3 py-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-slate-300">
                        {deleteInfo.relatedData.comments} kommentar{deleteInfo.relatedData.comments !== 1 ? 'er' : ''}
                      </span>
                    </div>
                  )}
                  {deleteInfo.relatedData.images > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/30 rounded px-3 py-2">
                      <Image className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm text-slate-300">
                        {deleteInfo.relatedData.images} bild{deleteInfo.relatedData.images !== 1 ? 'er' : ''}
                      </span>
                    </div>
                  )}
                  {deleteInfo.relatedData.notifications > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/30 rounded px-3 py-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <span className="text-sm text-slate-300">
                        {deleteInfo.relatedData.notifications} notifikation{deleteInfo.relatedData.notifications !== 1 ? 'er' : ''}
                      </span>
                    </div>
                  )}
                  {deleteInfo.relatedData.visits > 0 && (
                    <div className="flex items-center gap-2 bg-slate-800/30 rounded px-3 py-2">
                      <Clock className="w-4 h-4 text-green-400" />
                      <span className="text-sm text-slate-300">
                        {deleteInfo.relatedData.visits} besök
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bekräftelse-input */}
            {deleteInfo.canDelete && (
              <div className="space-y-2">
                <label className="block text-sm text-slate-400">
                  Skriv <span className="font-mono font-bold text-red-400">RADERA</span> för att bekräfta:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RADERA"
                  className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
                  disabled={deleting}
                  autoComplete="off"
                />
              </div>
            )}

            {/* Felmeddelande vid radering */}
            {error && deleteInfo.canDelete && (
              <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Knappar */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={deleting}
                className="flex-1"
              >
                Avbryt
              </Button>
              {deleteInfo.canDelete && (
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  disabled={!isConfirmValid || deleting}
                  loading={deleting}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Raderar...' : 'Radera permanent'}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
