import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, LayoutDashboard, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isOnDashboard = location.pathname === '/dashboard';

  return (
    <header className="header">
      <div className="header__left">
        <div className="header__logo" onClick={() => navigate('/')} role="button" tabIndex={0}>
          <div className="header__logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="header__logo-text">Regen</span>
        </div>
      </div>

      <div className="header__right">
        <button
          className={`btn btn-ghost header__nav-btn ${isOnDashboard ? 'header__nav-btn--active' : ''}`}
          onClick={() => navigate('/dashboard')}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>

        <div className="header__user">
          <div className="header__avatar">
            <User size={16} />
          </div>
          <span className="header__email">{user?.email}</span>
        </div>

        <button className="btn btn-ghost btn-icon header__sign-out" onClick={handleSignOut} title="Sign out">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
