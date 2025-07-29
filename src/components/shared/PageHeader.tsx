import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PageHeaderProps {
  title: string;
  showBackButton?: boolean;
  backPath?: string;
  showLogoutButton?: boolean;
  customBackAction?: () => void;
}

export function PageHeader({ 
  title, 
  showBackButton = true, 
  backPath,
  showLogoutButton = true,
  customBackAction 
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleBack = () => {
    if (customBackAction) {
      customBackAction();
    } else if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <div className="flex items-center gap-4">
        {showBackButton && (
          <button
            onClick={handleBack}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors duration-200 text-slate-300 hover:text-white"
            aria-label="Gå tillbaka"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>
      
      {showLogoutButton && (
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
        >
          <LogOut className="h-4 w-4" />
          <span>Logga ut</span>
        </button>
      )}
    </div>
  );
}