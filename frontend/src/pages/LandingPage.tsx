import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const features = [
    { icon:'🔐', title:'Zero-Knowledge Vault', desc:'AES-256 encryption ensures even our servers cannot read your data. Your vault belongs only to you and your nominees.' },
    { icon:'🛡️', title:'Insurance Policy Tracker', desc:'Track health, life, car, home and term policies. Get automated alerts before renewal dates so you never miss a premium.' },
    { icon:'🏦', title:'Bank & Investment Hub', desc:'Consolidate all savings accounts, FDs, stocks, mutual funds and retirement accounts under one encrypted dashboard.' },
    { icon:'🚨', title:'Emergency Nominee Alert', desc:'In an unfortunate event, your nominees receive an instant, secure summary of every policy and account you hold.' },
    { icon:'👥', title:'Up to 10 Nominees', desc:'Register up to 10 family members as nominees. Assign share percentages and link specific assets to each person.' },
    { icon:'⚖️', title:'DPDP Act 2023 Compliant', desc:"Fully compliant with India's Digital Personal Data Protection Act. Your right to access, correct and delete data is protected." },
  ];

  const howItWorks = [
    { step:'01', title:'Create Your Vault', desc:'Register in under 2 minutes. Verify via OTP sent to your email or mobile. Your encrypted vault is instantly provisioned.' },
    { step:'02', title:'Add Your Assets', desc:'Enter your insurance policies, bank accounts, investments and real estate. All data is encrypted before storage.' },
    { step:'03', title:'Register Nominees', desc:"Add up to 10 family members as nominees with Aadhaar verification. Assign share percentages so everyone knows their entitlement." },
    { step:'04', title:'Stay Protected', desc:'Receive premium renewal reminders. In any emergency, one tap notifies all nominees with your complete vault summary.' },
  ];

  const stats = [
    { value:'1 Cr+', label:'Insurance policies tracked' },
    { value:'₹50K Cr', label:'Assets secured on platform' },
    { value:'4.9/5', label:'User satisfaction score' },
    { value:'99.9%', label:'Platform uptime SLA' },
  ];

  const plans = [
    {
      name:'Solo Vault', price:'₹99', period:'/month', annual:'₹999/year',
      color:'from-blue-700 to-blue-500', textAccent:'text-blue-200',
      features:['1 subscriber','Unlimited policies','5 bank accounts','3 nominees','Email + SMS reminders','Emergency alert'],
      cta:'Get Started', ctaStyle:'bg-white text-blue-700 hover:bg-blue-50', popular:false,
    },
    {
      name:'Family Vault', price:'₹299', period:'/month', annual:'₹1,999/year',
      color:'from-slate-800 to-blue-900', textAccent:'text-blue-300',
      features:['Up to 6 members','Unlimited everything','10 nominees each','WhatsApp reminders','Land & property vault','Priority 24×7 support','Relationship manager'],
      cta:'Start Family Plan', ctaStyle:'bg-blue-500 text-white hover:bg-blue-400', popular:true,
    },
  ];

  const faqs = [
    { q:'How is my data secured?', a:'All vault data is encrypted with AES-256-GCM at rest and TLS 1.3 in transit. We implement zero-knowledge architecture — even our own team cannot view your vault contents.' },
    { q:'What happens in an emergency?', a:'Any trusted contact can trigger the Emergency Alert. After multi-step OTP verification, all registered nominees instantly receive a secure email with your complete vault summary including policy numbers, insurer contacts and claim procedures.' },
    { q:'Is Aadhaar mandatory?', a:'Aadhaar last-4 digits are required for user and nominee verification as per KYC norms. We store only the last 4 digits — never the full Aadhaar number.' },
    { q:'Can I cancel anytime?', a:'Yes. Cancel anytime from your account settings. Your data is retained for 30 days post-cancellation. You can export everything under your DPDP Act rights before cancelling.' },
    { q:'What insurance types can I track?', a:'Health, life, term, car, bike, home, travel and any custom insurance type. Includes premium frequency tracking, renewal dates and insurer contact details.' },
    { q:'Is there a free trial?', a:'All new accounts start with a 14-day free trial of the Solo Vault plan. No credit card required to sign up.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar transparent={!scrolled} />

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_60%_-10%,rgba(59,130,246,0.25),transparent)]"/>
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.03)1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03)1px,transparent 1px)',backgroundSize:'50px 50px'}}/>
        <div className="absolute top-1/4 right-12 w-3 h-3 rounded-full bg-blue-400/50 animate-bounce" style={{animationDuration:'3s'}}/>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 rounded-full bg-blue-300/40 animate-bounce" style={{animationDuration:'4s',animationDelay:'1s'}}/>
        <div className="absolute bottom-1/4 left-1/4 w-4 h-4 rounded-full bg-blue-500/30 animate-bounce" style={{animationDuration:'5s',animationDelay:'0.5s'}}/>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-32 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/20 border border-blue-400/30">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
                <span className="text-blue-200 text-xs font-semibold tracking-wide">India's Most Trusted Financial Vault</span>
              </div>
              <h1 className="font-display text-4xl sm:text-5xl xl:text-6xl font-bold text-white leading-[1.08] tracking-tight">
                One Secure Vault<br/>
                for <span className="text-blue-300">Every Asset</span><br/>
                You Own.
              </h1>
              <p className="text-blue-200/70 text-lg leading-relaxed max-w-lg">
                Store all your insurance policies, bank accounts, investments and property documents under AES-256 encryption — and let your family access everything instantly in an emergency.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to={isAuthenticated ? '/dashboard' : '/register'}
                  className="px-8 py-4 rounded-2xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-0.5">
                  {isAuthenticated ? 'Go to Dashboard →' : 'Create Free Vault →'}
                </Link>
                <Link to="/pricing"
                  className="px-8 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/20 transition-all">
                  View Plans
                </Link>
              </div>
              <div className="flex flex-wrap gap-6 pt-2">
                {['AES-256 Encrypted','DPDP Compliant','Zero-Knowledge','14-day Free Trial'].map(tag=>(
                  <div key={tag} className="flex items-center gap-1.5 text-blue-300/70 text-xs">
                    <span className="text-emerald-400">✓</span> {tag}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero vault card */}
            <div className="relative animate-slide-up delay-200">
              <div className="bg-white/8 backdrop-blur border border-white/15 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="text-blue-300/60 text-xs font-medium tracking-widest uppercase mb-0.5">Your Secure Vault</div>
                    <div className="font-display text-3xl font-bold text-white">₹1,26,52,500</div>
                    <div className="text-emerald-400 text-sm font-semibold mt-1">↑ +14.2% this year</div>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/25 border border-blue-400/30 flex items-center justify-center text-2xl">🔒</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    {icon:'🏦',label:'Bank Savings',val:'₹28.5L'},
                    {icon:'📈',label:'Investments',val:'₹42.8L'},
                    {icon:'🛡️',label:'Insurance Cover',val:'₹1.5Cr'},
                    {icon:'🏠',label:'Real Estate',val:'₹55.2L'},
                  ].map(item=>(
                    <div key={item.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-white/50 text-[10px]">{item.label}</span>
                      </div>
                      <div className="text-white font-bold text-sm font-mono">{item.val}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-4 space-y-2.5">
                  {[
                    {icon:'⏰',text:'Star Health renewal in 8 days',color:'text-amber-400'},
                    {icon:'✅',text:'3 nominees verified & active',color:'text-emerald-400'},
                    {icon:'🔐',text:'AES-256 · Zero-knowledge active',color:'text-blue-300'},
                  ].map(a=>(
                    <div key={a.text} className="flex items-center gap-2.5 text-xs">
                      <span className={a.color}>{a.icon}</span>
                      <span className="text-white/60">{a.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                ✓ All data encrypted
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L60 50C120 40 240 20 360 16.7C480 13.3 600 26.7 720 30C840 33.3 960 26.7 1080 23.3C1200 20 1320 20 1380 20L1440 20V60H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS
      ════════════════════════════════════════ */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map(s=>(
              <div key={s.label}>
                <div className="font-display text-4xl font-bold text-blue-900 mb-1">{s.value}</div>
                <div className="text-slate-500 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PROBLEM STATEMENT
      ════════════════════════════════════════ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-bold mb-6 border border-red-200">
            ⚠️ The Problem We Solve
          </div>
          <h2 className="font-display text-4xl font-bold text-slate-900 mb-6 leading-tight">
            Every year, thousands of crores in<br className="hidden sm:block"/>
            <span className="text-red-600"> insurance go unclaimed in India.</span>
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed mb-8 max-w-3xl mx-auto">
            When a family member passes away or becomes incapacitated, their loved ones often have no idea which insurance policies existed, which banks held accounts, or what investments were made. <strong className="text-slate-800">VaultLife solves this completely.</strong>
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left mt-10">
            {[
              {icon:'😰',title:'Before VaultLife',items:['Family unaware of policies','Policy numbers unknown','Bank accounts go dormant','Investments never redeemed'],bg:'bg-red-50',border:'border-red-200',iconBg:'bg-red-100'},
              {icon:'🔒',title:'With VaultLife',items:['All policies in one vault','Instant nominee notification','Bank details securely stored','Every investment documented'],bg:'bg-blue-50',border:'border-blue-200',iconBg:'bg-blue-100'},
              {icon:'✅',title:'The Result',items:['100% claim awareness','Zero unclaimed policies','Family protected always','Financial legacy preserved'],bg:'bg-emerald-50',border:'border-emerald-200',iconBg:'bg-emerald-100'},
            ].map(col=>(
              <div key={col.title} className={`${col.bg} border ${col.border} rounded-2xl p-5`}>
                <div className={`w-10 h-10 ${col.iconBg} rounded-xl flex items-center justify-center text-xl mb-3`}>{col.icon}</div>
                <div className="font-semibold text-slate-800 mb-3">{col.title}</div>
                <ul className="space-y-1.5">
                  {col.items.map(i=><li key={i} className="text-slate-600 text-sm flex items-start gap-1.5"><span>•</span>{i}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4 border border-blue-200">
              PLATFORM FEATURES
            </div>
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-4">Everything Your Family Needs,<br/>Locked Until They Need It</h2>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">Complete financial documentation and protection in one zero-knowledge encrypted platform.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f,i)=>(
              <div key={f.title} className="group p-6 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all bg-white hover:-translate-y-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center text-2xl mb-4 transition-colors">{f.icon}</div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════ */}
      <section className="py-24 bg-gradient-to-br from-blue-950 to-blue-900">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold mb-4 border border-blue-400/30">
              HOW IT WORKS
            </div>
            <h2 className="font-display text-4xl font-bold text-white mb-4">Set Up in Minutes,<br/>Protected for Life</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step,i)=>(
              <div key={step.step} className="relative">
                {i < howItWorks.length-1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-white/10 -translate-x-6 z-0"/>
                )}
                <div className="relative z-10 bg-white/8 border border-white/15 rounded-2xl p-6 h-full">
                  <div className="font-display text-5xl font-black text-blue-500/30 mb-3">{step.step}</div>
                  <h3 className="font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-all shadow-xl">
              {isAuthenticated ? 'Go to My Vault →' : 'Start Your Vault Free →'}
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          PRICING PREVIEW
      ════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4 border border-blue-200">SIMPLE PRICING</div>
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-3">Choose Your Vault</h2>
            <p className="text-slate-500">14-day free trial on all plans. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map(plan=>(
              <div key={plan.name} className={`relative rounded-3xl overflow-hidden bg-gradient-to-br ${plan.color} p-6 text-white`}>
                {plan.popular && (
                  <div className="absolute top-4 right-4 bg-white text-blue-700 text-[10px] font-black px-3 py-1 rounded-full">MOST POPULAR</div>
                )}
                <div className={`text-xs font-bold ${plan.textAccent} uppercase tracking-widest mb-2`}>{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-5xl font-black">{plan.price}</span>
                  <span className="text-white/60 text-sm">{plan.period}</span>
                </div>
                <div className="text-white/50 text-xs mb-6">{plan.annual} · Save 17%</div>
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map(f=>(
                    <li key={f} className="flex items-center gap-2 text-sm text-white/80">
                      <span className="text-emerald-400">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link to={isAuthenticated ? '/dashboard' : '/register'}
                  className={`block w-full text-center py-3 rounded-xl font-bold text-sm transition-all ${plan.ctaStyle}`}>
                  {plan.cta} →
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/pricing" className="text-blue-600 hover:text-blue-800 text-sm font-medium">View full pricing comparison →</Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FAQ
      ════════════════════════════════════════ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-display text-4xl font-bold text-slate-900 mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {faqs.map(faq=>(
              <div key={faq.q} className="bg-white rounded-2xl p-6 border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2">{faq.q}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA BANNER
      ════════════════════════════════════════ */}
      <section className="py-20 bg-gradient-to-r from-blue-900 to-blue-700">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl font-bold text-white mb-4">Start Protecting Your Family Today</h2>
          <p className="text-blue-200 mb-8 text-lg">Set up your vault in 2 minutes. 14-day free trial. No credit card needed.</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to={isAuthenticated ? '/dashboard' : '/register'}
              className="px-10 py-4 rounded-2xl bg-white text-blue-900 font-bold hover:bg-blue-50 transition-all shadow-xl text-sm">
              {isAuthenticated ? 'Open My Vault →' : 'Create Free Account →'}
            </Link>
            <Link to="/contact" className="px-10 py-4 rounded-2xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-all text-sm">
              Talk to Us
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════ */}
      <footer className="bg-blue-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🔒</span>
                <span className="font-display font-bold text-xl">Vault<span className="text-blue-300">Life</span></span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">India's most trusted financial documentation and emergency notification platform.</p>
              <div className="flex gap-3 mt-4">
                {['📧','📱','🐦'].map((s,i)=>(
                  <div key={i} className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-base hover:bg-white/20 cursor-pointer transition-colors">{s}</div>
                ))}
              </div>
            </div>
            {[
              { title:'Product', links:['Dashboard','Policies','Emergency Alert','Pricing'] },
              { title:'Legal', links:['Privacy Policy','Terms of Use','DPDP Compliance','Cookie Policy'] },
              { title:'Support', links:['Contact Us','Help Center','System Status','API Docs'] },
            ].map(col=>(
              <div key={col.title}>
                <div className="font-semibold text-white mb-4 text-sm">{col.title}</div>
                <ul className="space-y-2.5">
                  {col.links.map(l=>(
                    <li key={l}><span className="text-white/40 text-sm hover:text-white/70 cursor-pointer transition-colors">{l}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-white/30">
            <span>© 2025 VaultLife. All rights reserved. A product of Dian Technology Solutions.</span>
            <div className="flex gap-4">
              <span>AES-256 Encrypted</span><span>·</span>
              <span>DPDP Act 2023 Compliant</span><span>·</span>
              <span>ISO 27001 Certified</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
