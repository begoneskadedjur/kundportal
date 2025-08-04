import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../ui/Button';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  iconColor?: string;
  showBackButton?: boolean;
  backPath?: string;
  showLogoutButton?: boolean;
  customBackAction?: () => void;
  rightContent?: React.ReactNode;
}

export function PageHeader({ 
  title, 
  subtitle,
  icon: Icon,
  iconColor = "text-blue-400",
  showBackButton = true, 
  backPath,
  showLogoutButton = true,
  customBackAction,
  rightContent
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
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {Icon && (
            <div className="flex-shrink-0">
              <Icon className={`h-6 w-6 ${iconColor}`} />
            </div>
          )}
          
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-white truncate">{title}</h1>
            {subtitle && (
              <p className="text-sm text-slate-300 truncate mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {rightContent}
        {showLogoutButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-400 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Logga ut
          </Button>
        )}
      </div>
    </div>
  );
}