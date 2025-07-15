// src/components/admin/technicians/analysis_cards/MentorshipProfileCard.tsx
import React from 'react';
import type { AIMentorshipProfile } from '../../../../services/aiAnalysisService';
import Card from '../../../ui/Card';
import { Users, Award, BookOpen } from 'lucide-react';

const MentorshipProfileCard: React.FC<{ profile: AIMentorshipProfile }> = ({ profile }) => {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Users className="w-6 h-6 text-teal-400" />
        <h3 className="text-xl font-semibold text-white">Mentorskapsprofil</h3>
      </div>
      <div className="text-center p-4 rounded-lg bg-teal-500/10 mb-6">
        <p className="text-lg font-bold text-teal-300">{profile.profile}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profile.should_mentor && (
          <div>
            <h4 className="font-semibold text-white flex items-center gap-2 mb-2"><Award className="w-5 h-5 text-yellow-400" /> Kan Lära Ut:</h4>
            <ul className="list-disc list-inside text-slate-300 space-y-1 text-sm">
              {profile.mentoring_areas.map((area) => <li key={area}>{area}</li>)}
            </ul>
          </div>
        )}
        {profile.needs_mentoring && (
          <div>
            <h4 className="font-semibold text-white flex items-center gap-2 mb-2"><BookOpen className="w-5 h-5 text-blue-400" /> Behöver Lära Sig:</h4>
            <ul className="list-disc list-inside text-slate-300 space-y-1 text-sm">
              {profile.learning_focus.map((focus) => <li key={focus}>{focus}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
};

export default MentorshipProfileCard;