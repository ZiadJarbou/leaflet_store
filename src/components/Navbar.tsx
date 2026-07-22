import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, openAuthModal } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const location    = useLocation();
  const userInitial = user ? user.name.charAt(0).toUpperCase() : '';

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <nav className="nav">
      <div className="container">
        <div className="nav-inner">
          <Link className="brand" to="/" aria-label="LeafletAI home">
            <img src="/leafletai_logo.png" alt="LeafletAI" className="brand-logo-img" />
          </Link>

          <div className="menu" role="navigation" aria-label="Primary navigation">
            <Link to="/why"      className={location.pathname === '/why'      ? 'menu-active' : ''}>Why</Link>
            <Link to="/features" className={location.pathname === '/features' ? 'menu-active' : ''}>Features</Link>
            <Link to="/pricing"  className={location.pathname === '/pricing'  ? 'menu-active' : ''}>Pricing</Link>
            <Link to="/faq"      className={location.pathname === '/faq'      ? 'menu-active' : ''}>FAQ</Link>
            <Link to="/help"     className={location.pathname === '/help'     ? 'menu-active' : ''}>Help</Link>
            {user && (
              <Link
                to="/my-leaflets"
                className={`nav-my-leaflets${location.pathname === '/my-leaflets' ? ' active' : ''}`}
              >My Leaflets</Link>
            )}
          </div>

          <div className="nav-cta">
            <Link className="btn primary" to="/create-leaflet">Create leaflet</Link>

            {user ? (
              <div className="user-menu" ref={dropdownRef}>
                <button
                  className="user-avatar"
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(o => !o); }}
                  aria-haspopup="true"
                  aria-expanded={dropdownOpen}
                >
                  {userInitial}
                </button>
                <div className={`user-dropdown${dropdownOpen ? ' show' : ''}`}>
                  <div className="dropdown-header">{user.name}</div>
                  <Link to="/dashboard">monitoring Dashboard</Link>
                  <Link to="/settings">settings Settings</Link>
                  <div className="dropdown-divider"></div>
                  <a href="#" className="danger" onClick={async (e) => { e.preventDefault(); await logout(); setDropdownOpen(false); }}>🚪 Log out</a>
                </div>
              </div>
            ) : (
              <button className="btn ghost" onClick={() => openAuthModal('login')}>Login</button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
