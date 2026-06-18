import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const PricingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: 'Solo Vault', tagline: 'For individuals managing their own financial portfolio',
      monthly: 99, annually: 999,
      color: 'border-blue-200', headerBg: 'bg-blue-700', popular: false,
      features: [
        { label: 'Subscriber accounts', value: '1' },
        { label: 'Insurance policies', value: 'Unlimited' },
        { label: 'Bank accounts', value: '5' },
        { label: 'Investments tracked', value: 'Unlimited' },
        { label: 'Nominees', value: '3' },
        { label: 'Premium reminders', value: 'Email + SMS' },
        { label: 'Emergency alert', value: '✓', yes: true },
        { label: 'Land & property vault', value: '—', no: true },
        { label: 'WhatsApp reminders', value: '—', no: true },
        { label: 'Priority support', value: '—', no: true },
        { label: 'Relationship manager', value: '—', no: true },
      ],
    },
    {
      name: 'Family Vault', tagline: 'Complete protection for your entire household',
      monthly: 299, annually: 1999,
      color: 'border-blue-600 ring-2 ring-blue-500/30', headerBg: 'bg-gradient-to-r from-blue-800 to-blue-600', popular: true,
      features: [
        { label: 'Subscriber accounts', value: 'Up to 6' },
        { label: 'Insurance policies', value: 'Unlimited' },
        { label: 'Bank accounts', value: 'Unlimited' },
        { label: 'Investments tracked', value: 'Unlimited' },
        { label: 'Nominees', value: '10 per member' },
        { label: 'Premium reminders', value: 'Email + SMS + WhatsApp' },
        { label: 'Emergency alert', value: '✓ All members', yes: true },
        { label: 'Land & property vault', value: '✓', yes: true },
        { label: 'WhatsApp reminders', value: '✓', yes: true },
        { label: 'Priority 24×7 support', value: '✓', yes: true },
        { label: 'Dedicated relationship manager', value: '✓', yes: true },
      ],
    },
  ];

  const compareRows = [
    'Subscriber accounts', 'Insurance policies', 'Bank accounts', 'Nominees',
    'Emergency alert', 'Land & property vault', 'WhatsApp reminders',
    'Priority support', 'Relationship manager',
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Header */}
      <div className="bg-gradient-to-br from-blue-900 to-blue-700 py-20 text-white text-center">
        <div className="inline-block px-4 py-1.5 rounded-full bg-white/15 border border-white/25 text-xs font-bold mb-5">
          SIMPLE, TRANSPARENT PRICING
        </div>
        <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">Choose Your VaultLife Plan</h1>
        <p className="text-blue-200/70 text-lg mb-8 max-w-xl mx-auto">14-day free trial. No credit card required. Cancel anytime.</p>

        {/* Toggle */}
        <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full p-1">
          <button onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${!annual ? 'bg-white text-blue-900 shadow' : 'text-white/70'}`}>
            Monthly
          </button>
          <button onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${annual ? 'bg-white text-blue-900 shadow' : 'text-white/70'}`}>
            Annual
            <span className="bg-emerald-400 text-white text-[10px] font-black px-2 py-0.5 rounded-full">Save 17%</span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-4xl mx-auto px-6 -mt-10 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          {plans.map(plan => (
            <div key={plan.name} className={`bg-white rounded-3xl border-2 ${plan.color} overflow-hidden shadow-xl`}>
              {plan.popular && (
                <div className="bg-blue-600 text-white text-xs font-black text-center py-2 tracking-widest">
                  ★ MOST POPULAR
                </div>
              )}
              <div className={`${plan.headerBg} p-7 text-white`}>
                <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-1">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-5xl font-black">₹{annual ? plan.annually.toLocaleString('en-IN') : plan.monthly}</span>
                  <span className="text-white/60 text-sm">{annual ? '/year' : '/month'}</span>
                </div>
                {annual && (
                  <div className="text-emerald-300 text-xs font-semibold">
                    ₹{Math.round(plan.annually/12)}/month · Save ₹{(plan.monthly*12 - plan.annually).toLocaleString('en-IN')}
                  </div>
                )}
                <p className="text-white/60 text-sm mt-3 leading-relaxed">{plan.tagline}</p>
              </div>
              <div className="p-6">
                <ul className="space-y-3 mb-6">
                  {plan.features.map(f => (
                    <li key={f.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{f.label}</span>
                      <span className={`font-semibold ${f.yes ? 'text-emerald-600' : f.no ? 'text-slate-300' : 'text-slate-800'}`}>
                        {f.value}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link to={isAuthenticated ? '/dashboard' : '/register'}
                  className={`block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-all
                    ${plan.popular ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                  Start {plan.name} Free →
                </Link>
                <p className="text-center text-xs text-slate-400 mt-3">14-day free trial · No credit card needed</p>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="mt-16 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-800 text-white grid grid-cols-3 px-6 py-4">
            <span className="text-sm font-semibold text-slate-300">Feature</span>
            <span className="text-sm font-semibold text-center">Solo Vault</span>
            <span className="text-sm font-semibold text-center text-yellow-300">Family Vault ★</span>
          </div>
          {compareRows.map((row, i) => {
            const sVal = plans[0].features.find(f=>f.label===row);
            const fVal = plans[1].features.find(f=>f.label===row);
            return (
              <div key={row} className={`grid grid-cols-3 px-6 py-3 items-center ${i%2===0?'bg-white':'bg-slate-50'} border-b border-slate-100`}>
                <span className="text-sm text-slate-700">{row}</span>
                <span className={`text-sm text-center font-medium ${sVal?.no?'text-slate-300':sVal?.yes?'text-emerald-600':'text-slate-800'}`}>{sVal?.value||'—'}</span>
                <span className={`text-sm text-center font-medium ${fVal?.no?'text-slate-300':fVal?.yes?'text-emerald-600':'text-slate-800'}`}>{fVal?.value||'—'}</span>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-16 text-center">
          <h3 className="font-display text-2xl font-bold text-slate-900 mb-8">Any Questions?</h3>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            {[
              {q:'Can I switch plans?', a:'Yes, upgrade or downgrade anytime. Changes take effect on the next billing cycle.'},
              {q:'What happens to my data if I cancel?', a:'Data retained for 30 days post-cancellation. You can export everything before cancelling under DPDP rights.'},
              {q:'How many devices can I use?', a:'Up to 3 simultaneous sessions on any plan — web, iOS and Android.'},
              {q:'Are there any hidden fees?', a:'None whatsoever. No setup fees, no exit charges. Just the plan price, nothing more.'},
            ].map(faq=>(
              <div key={faq.q} className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <div className="font-semibold text-slate-800 text-sm mb-1">{faq.q}</div>
                <div className="text-slate-500 text-sm leading-relaxed">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
