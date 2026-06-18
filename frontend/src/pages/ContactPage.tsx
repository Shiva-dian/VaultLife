import React, { useState } from 'react';
import Navbar from '../components/Navbar';

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ name:'', email:'', phone:'', subject:'general', message:'' });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => { setSent(true); setSending(false); }, 1200);
  };

  const SUBJECTS = [
    ['general','General Inquiry'],['billing','Subscription & Billing'],
    ['vault','Vault / Data Issue'],['nominee','Nominee Alert Support'],
    ['security','Security Concern'],['dpdp','DPDP / Data Deletion Request'],
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="bg-gradient-to-r from-blue-900 to-blue-700 py-16 text-center text-white">
        <h1 className="font-display text-4xl font-bold mb-3">Contact & Support</h1>
        <p className="text-blue-200/70 text-lg">We're here to help. Our team typically responds within 2 business hours.</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Info panel */}
          <div className="md:col-span-2 space-y-5">
            <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-2xl p-6 text-white">
              <h3 className="font-display text-xl font-bold mb-2">We're Here For You</h3>
              <p className="text-blue-200/60 text-sm mb-6 leading-relaxed">Have questions about your vault, subscription, or need emergency support? Reach out to our dedicated team.</p>
              {[
                { icon:'📞', title:'Phone Support', val:'1800-123-VAULT', sub:'Mon–Sat, 9AM–7PM IST' },
                { icon:'📧', title:'Email', val:'support@vaultlife.in', sub:'Response within 2 hours' },
                { icon:'💬', title:'Live Chat', val:'Available in-app', sub:'9AM–9PM daily' },
                { icon:'📍', title:'Office', val:'14th Floor, DLF Cybercity', sub:'Chennai — 600 032' },
              ].map(item=>(
                <div key={item.title} className="flex items-start gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-base flex-shrink-0">{item.icon}</div>
                  <div>
                    <div className="text-blue-200/60 text-[10px] font-bold uppercase tracking-wide">{item.title}</div>
                    <div className="text-white text-sm font-semibold">{item.val}</div>
                    <div className="text-white/40 text-xs">{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="font-semibold text-red-800 mb-1 flex items-center gap-2"><span>🚨</span> Emergency Helpline</div>
              <div className="text-2xl font-black text-red-700">1800-000-SAFE</div>
              <div className="text-red-500/70 text-xs mt-1">24×7 · For nominee alert assistance</div>
            </div>
          </div>

          {/* Contact form */}
          <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            {sent ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                <h3 className="font-display text-xl font-bold text-slate-800 mb-2">Message Sent!</h3>
                <p className="text-slate-500 text-sm">We'll get back to you within 2 business hours.</p>
                <button onClick={() => setSent(false)} className="mt-6 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">Send Another</button>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-slate-800 text-lg mb-1">Send Us a Message</h3>
                <p className="text-slate-400 text-sm mb-6">Our support team responds within 2 business hours.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {label:'Full Name',key:'name',type:'text',placeholder:'Your name'},
                      {label:'Email',key:'email',type:'email',placeholder:'your@email.com'},
                      {label:'Mobile Number',key:'phone',type:'tel',placeholder:'+91 98765 43210'},
                    ].map(f=>(
                      <div key={f.key} className={f.key==='name'?'col-span-2':''}>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{f.label}</label>
                        <input type={f.type} value={(form as any)[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                          placeholder={f.placeholder}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all"/>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Subject</label>
                      <select value={form.subject} onChange={e=>setForm(p=>({...p,subject:e.target.value}))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400">
                        {SUBJECTS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Message</label>
                      <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white resize-none h-28 transition-all"
                        placeholder="Describe your query in detail..."/>
                    </div>
                  </div>
                  <button type="submit" disabled={sending}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm disabled:opacity-50 transition-colors">
                    {sending ? 'Sending...' : 'Send Message →'}
                  </button>
                  <p className="text-[11px] text-slate-400 text-center">🔒 Encrypted in transit. We never share your information.</p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
