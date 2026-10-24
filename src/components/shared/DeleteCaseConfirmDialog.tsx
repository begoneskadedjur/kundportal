// src/components/shared/DeleteCaseConfirmDialog.tsx
import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { deleteCase, ORSAKER_TA_BORT, type DeleteableCaseType } from '../../services/caseDeleteService';
import Select from '../ui/Select';
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
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Anledningen sparas på ärendet (close_reason), samma som stängningen i Mina ärenden
  const [anledning, setAnledning] = useState('');
  const [anteckning, setAnteckning] = useState('');
  const kravAnteckning = anledning === 'ovrigt';
  const kanTaBort = !!anledning && (!kravAnteckning || !!anteckning.trim());

  const handleDelete = async () => {
    if (!profile || !kanTaBort) return;
    setDeleting(true);
    setError(null);

    const result = await deleteCase(
      caseId,
      caseType,
      profile.id,
      profile.full_name || profile.email || 'Okänd användare',
      {
        reason: anledning,
        notes: anteckning.trim() || null,
        technicianId: profile.technician_id || null,
        technicianName: (profile as { display_name?: string | null }).display_name || null,
      }
    );

    if (result.success) {
      toast.success('Ärendet har tagits bort');
      onDeleted();
      onClose();
    } else {
      setError(result.error || 'Kunde inte ta bort ärendet');
      toast.error(result.error || 'Kunde inte ta bort ärendet');
    }

    setDeleting(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ta bort ärende"
      size="sm"
      preventClose={deleting}
    >
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-white font-medium">{caseTitle}</p>
            <p className="text-sm text-slate-400 mt-1">
              Ärendet markeras som borttaget och döljs från alla vyer. All data behålls.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-400 mb-1 block">
            Anledning <span className="text-red-400">*</span>
          </label>
          <Select
            value={anledning}
            onChange={setAnledning}
            placeholder="Välj anledning..."
            options={ORSAKER_TA_BORT.map(r => ({ value: r.value, label: r.label }))}
          />
        </div>
        {anledning && (
          <div>
            <label className="text-xs font-medium text-slate-400 mb-1 block">
              Kommentar {kravAnteckning ? <span className="text-red-400">*</span> : <span className="text-slate-500">(valfritt)</span>}
            </label>
            <textarea
              value={anteckning}
              onChange={e => setAnteckning(e.target.value)}
              rows={2}
              placeholder={kravAnteckning ? 'Beskriv varför ärendet tas bort' : 'Till exempel vad kunden sa'}
              className="w-full px-3 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-[#20c58f] resize-none"
            />
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 p-3 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1 border-t border-slate-700/50">
          <Button variant="secondary" onClick={onClose} disabled={deleting} className="flex-1">
            Avbryt
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={deleting || !kanTaBort}
            loading={deleting}
            className="flex-1 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Tar bort...' : 'Ta bort'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
