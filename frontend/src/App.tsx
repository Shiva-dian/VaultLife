import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage      from './pages/LandingPage';
import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import DashboardPage    from './pages/DashboardPage';
import BankAccountsPage from './pages/BankAccountsPage';
import StocksPage       from './pages/StocksPage';
import PoliciesPage     from './pages/PoliciesPage';
import RealEstatePage   from './pages/RealEstatePage';
import LiabilitiesPage  from './pages/LiabilitiesPage';
import PricingPage      from './pages/PricingPage';
import EmergencyPage    from './pages/EmergencyPage';
import ContactPage      from './pages/ContactPage';
import PolicyDashboard from './pages/PolicyDashboard';

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/"            element={<LandingPage />} />
        <Route path="/pricing"     element={<PricingPage />} />
        <Route path="/emergency"   element={<EmergencyPage />} />
        <Route path="/contact"     element={<ContactPage />} />
        <Route path="/login"       element={<LoginPage />} />
        <Route path="/register"    element={<RegisterPage />} />
        <Route path="/dashboard"     element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/bank-accounts" element={<ProtectedRoute><BankAccountsPage /></ProtectedRoute>} />
        <Route path="/stocks"        element={<ProtectedRoute><StocksPage /></ProtectedRoute>} />
        <Route path="/policies"      element={<ProtectedRoute><PoliciesPage /></ProtectedRoute>} />
        <Route path="/real-estate"   element={<ProtectedRoute><RealEstatePage /></ProtectedRoute>} />
        <Route path="/liabilities"   element={<ProtectedRoute><LiabilitiesPage /></ProtectedRoute>} />
        <Route path="/policy-dashboard" element={<ProtectedRoute><PolicyDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);
export default App;
