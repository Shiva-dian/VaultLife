import React from 'react';

interface LeftPanelProps {
  mode?: 'login' | 'register';
}

const LeftPanel: React.FC<LeftPanelProps> = ({ mode = 'login' }) => {
  const features = [
    { icon: '🔐', label: 'AES-256 Zero-Knowledge Encryption' },
    { icon: '🛡️', label: 'Emergency Nominee Alert System' },
    { icon: '🔔', label: 'Smart Premium Renewal Reminders' },
    { icon: '📊', label: 'Consolidated Net Worth Dashboard' },
    { icon: '⚖️', label: 'DPDP Act 2023 Compliant' },
  ];

  return (
    <div className="relative flex flex-col justify-between h-full overflow-hidden
                    bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 p-10 lg:p-12">

      {/* Grid background */}
      <div className="absolute inset-0 bg-grid-blue opacity-30" />

      {/* Radial glow */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full
                      bg-blue-500/20 blur-3xl -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full
                      bg-blue-400/15 blur-3xl translate-y-1/3 -translate-x-1/4" />

      {/* Floating decorative orbs */}
      <div className="absolute top-1/3 right-8 w-3 h-3 rounded-full bg-blue-300/60
                      animate-float delay-100" />
      <div className="absolute top-1/2 right-1/4 w-2 h-2 rounded-full bg-blue-200/50
                      animate-float delay-300" />
      <div className="absolute bottom-1/3 left-1/4 w-4 h-4 rounded-full bg-blue-400/30
                      animate-float delay-500" />

      {/* ── Logo ── */}
      <div className="relative z-10 animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/30 border border-blue-400/40
                          flex items-center justify-center text-xl">
            🔒
          </div>
          <span className="font-display text-3xl font-bold text-white tracking-tight">
            Vault<span className="text-blue-300">Life</span>
          </span>
        </div>
        <p className="text-blue-300/70 text-xs font-medium tracking-widest uppercase ml-13">
          India's Trusted Financial Vault
        </p>
      </div>

      {/* ── Hero Text ── */}
      <div className="relative z-10 my-auto py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                        bg-blue-500/20 border border-blue-400/30 mb-6">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse-slow" />
          <span className="text-blue-200 text-xs font-medium">
            {mode === 'login' ? 'Secure Sign-In' : 'Create Your Vault'}
          </span>
        </div>

        <h1 className="font-display text-4xl xl:text-5xl font-bold text-white
                       leading-tight mb-4 animate-slide-right delay-100 opacity-0-init">
          {mode === 'login' ? (
            <>Your Vault<br /><span className="text-blue-300">Awaits.</span></>
          ) : (
            <>One Vault for<br /><span className="text-blue-300">Every Asset.</span></>
          )}
        </h1>

        <p className="text-blue-200/70 text-sm leading-relaxed mb-8 max-w-xs
                      animate-slide-right delay-200 opacity-0-init">
          {mode === 'login'
            ? 'All your financial documents, insurance policies, and investments — safely encrypted and always accessible.'
            : 'Join thousands of families who trust VaultLife to protect and organise their financial legacy.'}
        </p>

        {/* Features list */}
        <ul className="space-y-3">
          {features.map((f, i) => (
            <li
              key={f.label}
              className={`flex items-center gap-3 animate-slide-right opacity-0-init`}
              style={{ animationDelay: `${(i + 3) * 100}ms`, animationFillMode: 'forwards' }}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/25
                              flex items-center justify-center text-sm flex-shrink-0">
                {f.icon}
              </div>
              <span className="text-blue-100/80 text-xs font-medium">{f.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Vault Card Preview ── */}
      <div className="relative z-10 animate-slide-up delay-600 opacity-0-init">
        <div className="glass-blue rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-blue-200/60 text-xs font-medium tracking-wider uppercase">
              Your Vault Summary
            </span>
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-400/50" />
              <div className="w-2 h-2 rounded-full bg-blue-300/50" />
              <div className="w-2 h-2 rounded-full bg-blue-200/50" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-white mb-3">
            ₹84,32,500
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Bank Accounts', value: '₹24.8L' },
              { label: 'Investments', value: '₹41.2L' },
              { label: 'Insurance Cover', value: '₹1.5Cr' },
              { label: 'Real Estate', value: '₹18.3L' },
            ].map((item) => (
              <div key={item.label}
                   className="bg-white/5 rounded-lg px-3 py-2">
                <div className="text-blue-200/50 text-[10px] mb-0.5">{item.label}</div>
                <div className="text-white text-sm font-semibold font-mono">{item.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-emerald-300/70 text-[10px] font-medium">
              AES-256 Encrypted · Zero-Knowledge Architecture
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeftPanel;
