import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  transparent?: boolean; // for landing page hero overlay
}

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

const Navbar: React.FC<NavbarProps> = ({ transparent = false }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showLang, setShowLang]     = useState(false);
  const [showUser, setShowUser]     = useState(false);
  const [activeLang, setActiveLang] = useState(LANGUAGES[0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLang(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setShowUser(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setShowUser(false);
  };

  const isActive = (path: string) => location.pathname === path;

  const NAV_LINKS = [
    { path: '/',          label: 'Home',       public: true  },
    { path: '/dashboard', label: 'Dashboard',  public: false },
    { path: '/policies',  label: 'Policies',   public: false },
    { path: '/pricing',   label: 'Pricing',    public: true  },
    { path: '/emergency', label: 'Emergency',  public: true  },
    { path: '/contact',   label: 'Contact',    public: true  },
  ];

  const visibleLinks = NAV_LINKS.filter(l => l.public || isAuthenticated);

  const baseNav = transparent
    ? 'fixed top-0 left-0 right-0 z-50 bg-transparent border-b border-white/10'
    : 'sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm';

  const logoColor = transparent ? 'text-white' : 'text-blue-900';
  const logoAccent = transparent ? 'text-blue-300' : 'text-blue-600';
  const linkColor = transparent ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-blue-700';
  const activeLinkColor = transparent ? 'text-white font-semibold' : 'text-blue-700 font-semibold';
  const mobileMenuBg = 'bg-blue-950';

  return (
    <nav className={baseNav}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between ${transparent ? '' : ''}`}>

        {/* ── Logo ── */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base
            ${transparent ? 'bg-white/15 border border-white/25' : 'bg-blue-600'}`}>
            🔒
          </div>
          <span className={`font-display text-xl font-bold tracking-tight ${logoColor}`}>
            Vault<span className={logoAccent}>Life</span>
          </span>
        </Link>

        {/* ── Center Nav Links (desktop) ── */}
        <div className="hidden md:flex items-center gap-1">
          {visibleLinks.map(link => (
            <Link key={link.path} to={link.path}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${isActive(link.path) ? activeLinkColor : linkColor}
                ${isActive(link.path) && !transparent ? 'bg-blue-50' : 'hover:bg-white/10'}`}>
              {link.label}
            </Link>
          ))}
        </div>

        {/* ── Right: Language + My Account ── */}
        <div className="hidden md:flex items-center gap-3">
          {/* Language switcher */}
          <div className="relative" ref={langRef}>
            <button onClick={() => setShowLang(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${transparent ? 'text-white/80 hover:text-white hover:bg-white/10 border border-white/20'
                              : 'text-slate-600 hover:text-blue-700 border border-slate-200 hover:border-blue-300 bg-white'}`}>
              <span>{activeLang.flag}</span>
              <span>{activeLang.code.toUpperCase()}</span>
              <svg className={`w-3 h-3 transition-transform ${showLang ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {showLang && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                {LANGUAGES.map(lang => (
                  <button key={lang.code} onClick={() => { setActiveLang(lang); setShowLang(false); }}
                    className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors
                      ${activeLang.code === lang.code ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                    {activeLang.code === lang.code && <span className="ml-auto text-blue-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* My Account / Profile */}
          {isAuthenticated ? (
            <div className="relative" ref={userRef}>
              <button onClick={() => setShowUser(v => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all
                  ${transparent ? 'bg-white/15 hover:bg-white/25 border border-white/25' : 'bg-blue-600 hover:bg-blue-700 border border-blue-600'}`}>
                <div className="w-6 h-6 rounded-full bg-white/25 flex items-center justify-center text-white font-bold text-xs">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-white text-sm font-medium hidden sm:block max-w-24 truncate">{user?.name?.split(' ')[0]}</span>
                <svg className={`w-3 h-3 text-white/70 transition-transform ${showUser ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                </svg>
              </button>
              {showUser && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="font-semibold text-slate-800 text-sm">{user?.name}</div>
                    <div className="text-slate-400 text-xs truncate">{user?.email}</div>
                  </div>
                  <Link to="/dashboard" onClick={() => setShowUser(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    📊 Dashboard
                  </Link>
                  <Link to="/policies" onClick={() => setShowUser(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                    🛡️ My Policies
                  </Link>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      🚪 Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                ${transparent
                  ? 'bg-white text-blue-900 hover:bg-blue-50 shadow-sm'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'}`}>
              My Account →
            </Link>
          )}
        </div>

        {/* ── Mobile hamburger ── */}
        <button onClick={() => setMobileOpen(v => !v)}
          className={`md:hidden p-2 rounded-lg transition-colors ${transparent ? 'text-white hover:bg-white/10' : 'text-slate-600 hover:bg-slate-100'}`}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={mobileOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'}/>
          </svg>
        </button>
      </div>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div className={`md:hidden ${mobileMenuBg} border-t border-white/10 py-4 px-4 space-y-1`}>
          {visibleLinks.map(link => (
            <Link key={link.path} to={link.path}
              className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all
                ${isActive(link.path) ? 'bg-blue-600 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
              {link.label}
            </Link>
          ))}
          <div className="border-t border-white/10 pt-3 mt-3 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {LANGUAGES.slice(0,3).map(lang => (
                <button key={lang.code} onClick={() => setActiveLang(lang)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all
                    ${activeLang.code === lang.code ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/60'}`}>
                  {lang.code.toUpperCase()}
                </button>
              ))}
            </div>
            {isAuthenticated ? (
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm font-medium border border-red-500/30">
                Sign Out
              </button>
            ) : (
              <Link to="/login" className="px-4 py-2 rounded-xl bg-white text-blue-900 text-sm font-semibold">
                My Account
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
