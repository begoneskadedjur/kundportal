import Modal from '../../../ui/Modal';
import WorkScheduleEditor from './WorkScheduleEditor';
import { technicianManagementService, type Technician, type WorkSchedule } from '../../../../services/technicianManagementService';

interface WorkScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  technician: Technician;
}

// Standard-schema om teknikern av någon anledning saknar ett
const defaultSchedule: WorkSchedule = {
  monday: { start: '08:00', end: '17:00', active: true },
  tuesday: { start: '08:00', end: '17:00', active: true },
  wednesday: { start: '08:00', end: '17:00', active: true },
  thursday: { start: '08:00', end: '17:00', active: true },
  friday: { start: '08:00', end: '17:00', active: true },
  saturday: { start: '00:00', end: '00:00', active: false },
  sunday: { start: '00:00', end: '00:00', active: false },
};

export default function WorkScheduleModal({ isOpen, onClose, onSuccess, technician }: WorkScheduleModalProps) {
  
  const handleSave = async (newSchedule: WorkSchedule) => {
    try {
      await technicianManagementService.updateWorkSchedule(technician.id, newSchedule);
      onSuccess(); // Stäng modal och ladda om data
    } catch (error) {
      console.error("Failed to save work schedule", error);
      // Visa ett felmeddelande för användaren
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Arbetstider för ${technician.name}`}>
        <WorkScheduleEditor
          initialSchedule={technician.work_schedule || defaultSchedule}
          onSave={handleSave}
          onCancel={onClose}
        />
    </Modal>
  );
}