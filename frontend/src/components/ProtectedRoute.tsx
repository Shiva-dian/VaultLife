import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/30 border border-blue-400/40
                          flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse">
            🔒
          </div>
          <div className="text-white font-semibold font-display text-lg mb-1">VaultLife</div>
          <div className="flex gap-1 justify-center mt-3">
            {[0,1,2].map(i => (
              <div key={i} className={`w-2 h-2 rounded-full bg-blue-400 animate-bounce`}
                   style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return isAuthenticated
    ? <>{children}</>
    : <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute;
