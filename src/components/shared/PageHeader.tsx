import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Button>
        )}
        <h1 className="text-2xl font-bold text-white">{title}</h1>
      </div>
      
      {showLogoutButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logga ut
        </Button>
      )}
    </div>
  );
}