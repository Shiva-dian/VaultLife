import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const EmergencyPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [step, setStep] = useState(0);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <div className="bg-gradient-to-br from-red-900 via-red-800 to-blue-900 py-20 text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(239,68,68,0.2),transparent)]"/>
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="w-20 h-20 rounded-3xl bg-red-500/25 border border-red-400/40 flex items-center justify-center text-4xl mx-auto mb-6">🚨</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">Emergency Nominee Alert</h1>
          <p className="text-white/70 text-lg leading-relaxed mb-8">
            When something unexpected happens, your family should never be left searching for policies or accounts.
            One tap. All nominees notified. Every asset detailed. Instantly.
          </p>
          <Link to={isAuthenticated ? '/dashboard' : '/register'}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-red-900 font-bold text-sm hover:bg-red-50 transition-all shadow-xl">
            {isAuthenticated ? 'Go to My Vault →' : 'Set Up Emergency Contacts →'}
          </Link>
        </div>
      </div>

      {/* How it works */}
      <div className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="font-display text-3xl font-bold text-slate-900 text-center mb-12">How Emergency Alert Works</h2>
        <div className="space-y-4">
          {[
            { icon:'👤', title:'Trusted person triggers alert', desc:'Any family member or trusted contact can initiate the Emergency Notification from the VaultLife app or website.' },
            { icon:'🔐', title:'Multi-step OTP verification', desc:'To prevent accidental or unauthorised triggering, the system requires OTP verification on the registered mobile number + secondary confirmation.' },
            { icon:'📧', title:'Instant encrypted emails to all nominees', desc:'All registered nominees receive a secure, time-limited email containing your complete vault summary — every policy, bank account, investment and property detail.' },
            { icon:'📱', title:'SMS confirmation sent', desc:'Each nominee also receives an SMS with a reference number and instructions to access the detailed email.' },
            { icon:'📋', title:'Audit trail recorded', desc:'Every emergency event is permanently logged with timestamp, initiator details and IP address for legal and audit purposes.' },
          ].map((item, i) => (
            <div key={i} className="flex gap-5 p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">{item.icon}</div>
              <div>
                <div className="font-semibold text-slate-800 mb-1">Step {i+1}: {item.title}</div>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* What nominees receive */}
      <div className="bg-slate-900 py-16 text-white">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-center mb-10">What Your Nominees Receive</h2>
          <div className="bg-white/8 border border-white/15 rounded-2xl p-6 space-y-4">
            <div className="text-white/50 text-xs font-medium">EMERGENCY NOTIFICATION EMAIL PREVIEW</div>
            {[
              { section:'Health Insurance', items:['Star Health Family Floater · Sum ₹10L · Policy# STR-2024-88341','HDFC Ergo Super Top-Up · Sum ₹25L · Deductible ₹5L'] },
              { section:'Life Insurance', items:['LIC Jeevan Anand · Sum ₹20L · Policy# LIC-JA-7728349','HDFC Life Click2Protect Term · Sum ₹1Cr'] },
              { section:'Bank Accounts', items:['HDFC Bank Savings ••4521 · ₹8,42,300','SBI Fixed Deposit · ₹5,00,000 matures Jun 2025'] },
              { section:'Investments', items:['Zerodha DEMAT ••2948 · ₹12,80,000','Groww Mutual Funds · ₹9,40,000'] },
            ].map(section=>(
              <div key={section.section}>
                <div className="text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">{section.section}</div>
                {section.items.map(item=><div key={item} className="text-white/70 text-sm py-1 border-b border-white/5">{item}</div>)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 bg-white text-center">
        <h2 className="font-display text-3xl font-bold text-slate-900 mb-4">Don't Wait for an Emergency</h2>
        <p className="text-slate-500 mb-8 max-w-xl mx-auto">Set up your vault and nominees today. It takes less than 5 minutes and ensures your family is always protected.</p>
        <Link to={isAuthenticated ? '/dashboard' : '/register'}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-all shadow-lg">
          {isAuthenticated ? 'Manage My Nominees →' : 'Set Up My Vault →'}
        </Link>
      </div>
    </div>
  );
};

export default EmergencyPage;
