import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const SIDEBAR_LINKS = [
  { path: '/dashboard', icon: '📊', label: 'Dashboard' },
  { path: '/policies',  icon: '🛡️', label: 'Policies' },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children, title, subtitle, actions }) => {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar transparent={false} />

      {/* Page header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-blue-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-blue-200 transition-colors">Home</Link>
                <span>›</span>
                <span className="text-blue-200">{title}</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">{title}</h1>
              {subtitle && <p className="text-blue-200/70 text-sm mt-1">{subtitle}</p>}
            </div>
            {actions && <div className="flex-shrink-0">{actions}</div>}
          </div>

          {/* Module tabs */}
          <div className="flex gap-1 mt-5 border-t border-white/10 pt-4">
            {SIDEBAR_LINKS.map(link => (
              <Link key={link.path} to={link.path}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all
                  ${location.pathname === link.path
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-white/60 hover:text-white hover:bg-white/10'}`}>
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-base">🔒</span>
            <span className="font-display font-bold text-blue-900 text-sm">Vault<span className="text-blue-600">Life</span></span>
            <span className="text-slate-300 text-xs">·</span>
            <span className="text-slate-400 text-xs">AES-256 Encrypted · DPDP Compliant</span>
          </div>
          <div className="flex gap-4">
            {['Privacy Policy','Terms of Use','Contact Support'].map(l=>(
              <span key={l} className="text-slate-400 text-xs hover:text-blue-600 cursor-pointer transition-colors">{l}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
