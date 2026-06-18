import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { liabilitiesApi } from '../services/api';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import { FormInput, FormSelect, FormTextarea, FormFile } from '../components/FormInput';

// ── Constants at MODULE level ────────────────────────────────────
const LIABILITY_TYPES: [string,string][] = [
  ['home_loan','Home Loan'],['personal_loan','Personal Loan'],
  ['vehicle_loan','Vehicle Loan'],['gold_loan','Gold Loan'],
  ['education_loan','Education Loan'],['credit_card','Credit Card'],
  ['borrowed_from_family','Borrowed — Family'],['lent_to_family','Lent — Family'],
  ['lent_to_friend','Lent — Friend'],['borrowed_from_friend','Borrowed — Friend'],
  ['business_loan','Business Loan'],['mortgage','Mortgage'],['other','Other'],
];
const FREQ_OPTS: [string,string][] = [
  ['monthly','Monthly'],['quarterly','Quarterly'],['half_yearly','Half Yearly'],
  ['annual','Annual'],['bullet','Bullet (End)'],['on_demand','On Demand'],
];
const TXN_MODES: [string,string][] = [
  ['bank_transfer','Bank Transfer'],['upi','UPI'],['cash','Cash'],
  ['cheque','Cheque'],['dd','Demand Draft'],['online','Online'],['other','Other'],
];
const LT_LABELS = Object.fromEntries(LIABILITY_TYPES);

// Gradient cards — borrowed = red/orange tones, lent = teal/green tones
const BORROW_GRADIENTS = [
  'from-red-700 to-red-500','from-orange-700 to-orange-500',
  'from-rose-700 to-rose-500','from-pink-700 to-pink-500',
  'from-red-800 to-orange-600','from-rose-800 to-rose-600',
];
const LENT_GRADIENTS = [
  'from-teal-700 to-teal-500','from-cyan-700 to-cyan-500',
  'from-emerald-700 to-emerald-500','from-green-700 to-green-500',
  'from-teal-800 to-cyan-600','from-emerald-800 to-teal-600',
];

const fmt = (n:number) => `₹${Number(n).toLocaleString('en-IN',{maximumFractionDigits:0})}`;
const fmtDate = (d:string|null) => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const getDaysLeft = (due:string|null) => due ? Math.ceil((new Date(due).getTime()-Date.now())/86400000) : null;

const EMPTY: Record<string,string> = {
  direction:'borrowed', liabilityType:'home_loan', label:'',
  counterpartyName:'', counterpartyPhone:'', counterpartyRelation:'',
  principalAmount:'', outstandingAmount:'', interestRate:'', emiAmount:'',
  startDate:'', dueDate:'', nextPaymentDate:'', repaymentFrequency:'monthly',
  loanDate:'', transactionMode:'bank_transfer', transactionRef:'',
  accountNumberMasked:'', loanPurpose:'', collateral:'', notes:'',
};

interface Liability {
  id:string; direction:string; liability_type:string; label:string;
  counterparty_name:string; counterparty_phone:string|null; counterparty_relation:string|null;
  principal_amount:number; outstanding_amount:number; interest_rate:number|null;
  emi_amount:number|null; start_date:string|null; due_date:string|null;
  next_payment_date:string|null; repayment_frequency:string|null;
  loan_date:string|null; transaction_mode:string|null; transaction_ref:string|null;
  account_number_masked:string|null; loan_purpose:string|null; collateral:string|null;
  is_settled:boolean; settled_date:string|null; notes:string|null;
}

// ── Component ─────────────────────────────────────────────────────
const LiabilitiesPage: React.FC = () => {
  const [items, setItems]         = useState<Liability[]>([]);
  const [filter, setFilter]       = useState<'all'|'borrowed'|'lent'|'settled'>('all');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState<Record<string,string>>({...EMPTY});
  const [formError, setFormError] = useState('');
  const [toast, setToast]         = useState<{type:'success'|'error';msg:string}|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [docFile, setDocFile]     = useState<File|null>(null);

  const toast$ = (type:'success'|'error', msg:string) => {
    setToast({type,msg}); setTimeout(()=>setToast(null),3000);
  };
  const set = (k:string) => (e:React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(f=>({...f,[k]:e.target.value}));
  const setDir = (v:string) => setForm(f=>({...f,direction:v}));

  const load = useCallback(async()=>{
    setLoading(true);
    try{ const r=await liabilitiesApi.getAll(); setItems(r.data.data.liabilities); }
    catch{ toast$('error','Failed to load.'); }
    finally{ setLoading(false); }
  },[]);
  useEffect(()=>{ load(); },[load]);

  const active   = items.filter(i=>!i.is_settled);
  const filtered = filter==='all'   ? items
    : filter==='settled' ? items.filter(i=>i.is_settled)
    : items.filter(i=>i.direction===filter&&!i.is_settled);

  const totalBorrowed = active.filter(i=>i.direction==='borrowed').reduce((s,i)=>s+Number(i.outstanding_amount),0);
  const totalLent     = active.filter(i=>i.direction==='lent').reduce((s,i)=>s+Number(i.outstanding_amount),0);
  const net = totalLent - totalBorrowed;

  // Separate indices for gradient cycling
  let borrowIdx = 0, lentIdx = 0;

  const openAdd = () => {
    setForm({...EMPTY}); setEditingId(null); setFormError(''); setDocFile(null); setShowModal(true);
  };
  const openEdit = (item:Liability) => {
    setForm({
      direction:item.direction, liabilityType:item.liability_type, label:item.label,
      counterpartyName:item.counterparty_name, counterpartyPhone:item.counterparty_phone||'',
      counterpartyRelation:item.counterparty_relation||'',
      principalAmount:String(item.principal_amount), outstandingAmount:String(item.outstanding_amount),
      interestRate:item.interest_rate!=null?String(item.interest_rate):'',
      emiAmount:item.emi_amount!=null?String(item.emi_amount):'',
      startDate:item.start_date?item.start_date.split('T')[0]:'',
      dueDate:item.due_date?item.due_date.split('T')[0]:'',
      nextPaymentDate:item.next_payment_date?item.next_payment_date.split('T')[0]:'',
      repaymentFrequency:item.repayment_frequency||'monthly',
      loanDate:item.loan_date?item.loan_date.split('T')[0]:'',
      transactionMode:item.transaction_mode||'bank_transfer',
      transactionRef:item.transaction_ref||'',
      accountNumberMasked:item.account_number_masked||'',
      loanPurpose:item.loan_purpose||'', collateral:item.collateral||'', notes:item.notes||'',
    });
    setEditingId(item.id); setFormError(''); setDocFile(null); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.label.trim())           { setFormError('Label is required.'); return; }
    if (!form.counterpartyName.trim()){ setFormError('Counterparty name is required.'); return; }
    if (!form.principalAmount||!form.outstandingAmount){ setFormError('Principal and outstanding amounts are required.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: any = {};
      Object.entries(form).forEach(([k,v])=>{ if(v!=='') payload[k]=v; });
      if(docFile){ payload.documentName=docFile.name; payload.documentUrl=`uploads/${docFile.name}`; }
      if(editingId){ await liabilitiesApi.update(editingId,payload); toast$('success','Updated.'); }
      else         { await liabilitiesApi.add(payload); toast$('success','Added.'); }
      setShowModal(false); await load();
    } catch(e:any){ setFormError(e.response?.data?.message||'Failed to save.'); }
    finally{ setSaving(false); }
  };

  const handleSettle = async (item:Liability) => {
    if (!confirm(`Mark "${item.label}" as settled?`)) return;
    try{
      await liabilitiesApi.update(item.id,{ isSettled:true, settledDate:new Date().toISOString().split('T')[0], outstandingAmount:0 });
      toast$('success','Marked as settled.'); load();
    } catch{ toast$('error','Failed.'); }
  };

  const handleDelete = async (id:string) => {
    if (!confirm('Remove this entry?')) return;
    try{ await liabilitiesApi.remove(id); toast$('success','Removed.'); load(); }
    catch{ toast$('error','Failed.'); }
  };

  const FILTER_TABS = [
    {id:'all',      label:'All',        count:items.length},
    {id:'borrowed', label:'I Owe',      count:active.filter(i=>i.direction==='borrowed').length},
    {id:'lent',     label:'Owed to Me', count:active.filter(i=>i.direction==='lent').length},
    {id:'settled',  label:'Settled',    count:items.filter(i=>i.is_settled).length},
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg animate-fade-in
          ${toast.type==='success'?'bg-emerald-600':'bg-red-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Module header */}
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-indigo-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-indigo-200">Home</Link><span>›</span>
                <Link to="/dashboard" className="hover:text-indigo-200">Dashboard</Link><span>›</span>
                <span className="text-indigo-200">Liabilities</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Liabilities</h1>
              <p className="text-indigo-200/60 text-sm mt-0.5">
                {items.length>0 ? `Owe ${fmt(totalBorrowed)} · Owed ${fmt(totalLent)} · Net ${net>=0?'+':''}${fmt(net)}` : 'Track money borrowed and lent'}
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-900 font-bold text-sm hover:bg-indigo-50 transition-colors shadow-sm flex-shrink-0">
              + Add Entry
            </button>
          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Summary cards */}
        {items.length>0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {label:'Total I Owe',    value:fmt(totalBorrowed), icon:'📤', color:'text-red-600',     sub:'Active borrowings'},
              {label:'Owed to Me',     value:fmt(totalLent),     icon:'📥', color:'text-teal-700',    sub:'Active receivables'},
              {label:'Net Position',   value:`${net>=0?'+':''}${fmt(net)}`, icon:'⚖️',
               color:net>=0?'text-teal-700':'text-red-600',                                           sub:'Lent minus Borrowed'},
              {label:'Settled',        value:String(items.filter(i=>i.is_settled).length), icon:'✅', color:'text-slate-700', sub:'Fully repaid'},
            ].map(s=>(
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <div className={`font-display text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_TABS.map(f=>(
              <button key={f.id} onClick={()=>setFilter(f.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
                  ${filter===f.id?'bg-indigo-600 text-white':'text-slate-500 hover:bg-slate-100'}`}>
                {f.label}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${filter===f.id?'bg-white/20':'bg-slate-100 text-slate-400'}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards grid — matches other module styles */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i=><div key={i} className="h-48 rounded-2xl bg-slate-200 animate-pulse"/>)}
          </div>
        ) : filtered.length===0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">⚖️</div>
            <h3 className="font-semibold text-slate-700 text-lg mb-2">
              {filter==='all'?'No liabilities yet':filter==='settled'?'No settled entries':'No entries here'}
            </h3>
            <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">
              Track home loans, personal loans, money lent to family/friends and other borrowings.
            </p>
            <button onClick={openAdd} className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors">
              + Add Entry
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((item)=>{
              const isBorrowed = item.direction==='borrowed';
              const isSettled  = item.is_settled;
              const gradients  = isBorrowed ? BORROW_GRADIENTS : LENT_GRADIENTS;
              const gradIdx    = isBorrowed ? (borrowIdx++ % BORROW_GRADIENTS.length) : (lentIdx++ % LENT_GRADIENTS.length);
              const gradient   = isSettled ? 'from-slate-600 to-slate-400' : gradients[gradIdx];
              const paid = item.principal_amount>0 ? ((item.principal_amount - item.outstanding_amount) / item.principal_amount) * 100 : 0;
              const daysLeft = getDaysLeft(item.due_date);
              const isExp = expandedId===item.id;

              return (
                <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  {/* Gradient header — same as Bank/Stock/RE cards */}
                  <div className={`bg-gradient-to-r ${gradient} p-5 text-white relative overflow-hidden`}>
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10"/>
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{isBorrowed?'📤':'📥'}</span>
                          <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
                            {isBorrowed?'I Owe':'Owed to Me'}
                            {isSettled?' · Settled':''}
                          </span>
                        </div>
                        <div className="font-bold text-base leading-tight">{item.label}</div>
                        <div className="text-white/60 text-xs mt-0.5">
                          {LT_LABELS[item.liability_type]} · {item.counterparty_name}
                          {item.counterparty_relation ? ` (${item.counterparty_relation})` : ''}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={()=>openEdit(item)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs flex items-center justify-center">✏️</button>
                        <button onClick={()=>handleDelete(item.id)} className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/60 text-white text-xs flex items-center justify-center">🗑️</button>
                      </div>
                    </div>

                    {/* Outstanding amount — prominent like balance on bank card */}
                    <div className="mt-3">
                      <div className="font-display text-2xl font-black">{fmt(item.outstanding_amount)}</div>
                      {item.principal_amount!==item.outstanding_amount && (
                        <div className="text-white/55 text-xs mt-0.5">of {fmt(item.principal_amount)} principal</div>
                      )}
                    </div>

                    {/* Repayment progress bar */}
                    {!isSettled && paid>0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] text-white/60 mb-1">
                          <span>Repaid {paid.toFixed(0)}%</span>
                          {item.emi_amount && <span>EMI {fmt(item.emi_amount)}</span>}
                        </div>
                        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white/70 rounded-full transition-all" style={{width:`${Math.min(paid,100)}%`}}/>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 space-y-2">
                    {/* Due date & transaction info row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {item.due_date && (
                        <div className="text-xs">
                          <span className="text-slate-400">Due: </span>
                          <span className={`font-semibold ${!isSettled && daysLeft!=null && daysLeft<0?'text-red-600':!isSettled&&daysLeft!=null&&daysLeft<30?'text-amber-600':'text-slate-700'}`}>
                            {fmtDate(item.due_date)}
                            {!isSettled && daysLeft!=null ? ` (${daysLeft<0?`${Math.abs(daysLeft)}d overdue`:`${daysLeft}d`})` : ''}
                          </span>
                        </div>
                      )}
                      {item.interest_rate && (
                        <div className="text-xs"><span className="text-slate-400">Rate: </span><span className="font-semibold text-slate-700">{item.interest_rate}% p.a.</span></div>
                      )}
                      {item.loan_date && (
                        <div className="text-xs"><span className="text-slate-400">Taken: </span><span className="font-semibold text-slate-700">{fmtDate(item.loan_date)}</span></div>
                      )}
                    </div>

                    {/* Expandable details */}
                    {isExp && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-100 animate-fade-in">
                        {item.transaction_mode && <div className="flex justify-between text-xs"><span className="text-slate-400">Mode</span><span className="font-medium text-slate-700 capitalize">{item.transaction_mode.replace(/_/g,' ')}</span></div>}
                        {item.transaction_ref && <div className="flex justify-between text-xs"><span className="text-slate-400">Ref / UTR</span><span className="font-mono font-medium text-slate-700">{item.transaction_ref}</span></div>}
                        {item.account_number_masked && <div className="flex justify-between text-xs"><span className="text-slate-400">Account</span><span className="font-mono font-medium text-slate-700">{item.account_number_masked}</span></div>}
                        {item.next_payment_date && !isSettled && <div className="flex justify-between text-xs"><span className="text-slate-400">Next EMI</span><span className="font-semibold text-blue-600">{fmtDate(item.next_payment_date)}</span></div>}
                        {item.collateral && <div className="text-xs"><span className="text-slate-400 block">Collateral</span><span className="text-slate-700">{item.collateral}</span></div>}
                        {item.loan_purpose && <div className="text-xs"><span className="text-slate-400 block">Purpose</span><span className="text-slate-700">{item.loan_purpose}</span></div>}
                        {item.notes && <div className="text-xs text-slate-400 italic">"{item.notes}"</div>}
                      </div>
                    )}

                    {/* Footer actions */}
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={()=>setExpandedId(isExp?null:item.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                        {isExp?'▲ Less':'▼ More details'}
                      </button>
                      {!isSettled && (
                        <button onClick={()=>handleSettle(item)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition-colors">
                          ✓ Mark Settled
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add more card */}
            <button onClick={openAdd}
              className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 transition-all min-h-[200px] bg-white">
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Add Entry</span>
            </button>
          </div>
        )}
      </div>

      {/* ── MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-white font-semibold">⚖️ {editingId?'Edit':'Add'} Liability</div>
                <div className="text-indigo-200/70 text-xs">Track borrowed or lent money</div>
              </div>
              <button onClick={()=>setShowModal(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {formError && <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">⚠️ {formError}</div>}
              {/* Direction toggle */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Direction *</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['borrowed','📤 I Borrowed (I Owe)'],['lent','📥 I Lent (Owed to Me)']] as [string,string][]).map(([v,l])=>(
                    <button key={v} type="button" onClick={()=>setDir(v)}
                      className={`py-3 rounded-xl text-sm font-semibold border transition-all
                        ${form.direction===v
                          ?v==='borrowed'?'bg-red-600 text-white border-red-600':'bg-teal-600 text-white border-teal-600'
                          :'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormSelect label="Liability Type" value={form.liabilityType} onChange={set('liabilityType')} options={LIABILITY_TYPES} col={2} accentColor="indigo"/>
                <FormInput label="Label / Description *" value={form.label} onChange={set('label')} placeholder="e.g. SBI Home Loan, Lent to Ravi" col={2} required accentColor="indigo"/>
                <FormInput label="Counterparty Name *" value={form.counterpartyName} onChange={set('counterpartyName')} placeholder="Bank / Person name" required accentColor="indigo"/>
                <FormInput label="Relation" value={form.counterpartyRelation} onChange={set('counterpartyRelation')} placeholder="e.g. Friend, SBI Bank" accentColor="indigo"/>
                <FormInput label="Phone" value={form.counterpartyPhone} onChange={set('counterpartyPhone')} type="tel" placeholder="+91 98765 43210" accentColor="indigo"/>
                <FormInput label="Account No. (Masked)" value={form.accountNumberMasked} onChange={set('accountNumberMasked')} placeholder="e.g. ••••4521" accentColor="indigo"/>
                <FormInput label="Principal Amount (₹) *" value={form.principalAmount} onChange={set('principalAmount')} type="number" placeholder="Original amount" required accentColor="indigo"/>
                <FormInput label="Outstanding (₹) *" value={form.outstandingAmount} onChange={set('outstandingAmount')} type="number" placeholder="Current balance" required accentColor="indigo"/>
                <FormInput label="Interest Rate (% p.a.)" value={form.interestRate} onChange={set('interestRate')} type="number" placeholder="e.g. 8.5" accentColor="indigo"/>
                <FormInput label="EMI Amount (₹)" value={form.emiAmount} onChange={set('emiAmount')} type="number" placeholder="Monthly EMI" accentColor="indigo"/>
                <FormInput label="Loan / Transaction Date" value={form.loanDate} onChange={set('loanDate')} type="date" accentColor="indigo" hint="Date money was given/received"/>
                <FormSelect label="Transaction Mode" value={form.transactionMode} onChange={set('transactionMode')} options={TXN_MODES} accentColor="indigo"/>
                <FormInput label="Transaction Ref / UTR" value={form.transactionRef} onChange={set('transactionRef')} placeholder="e.g. UTR123456789" col={2} accentColor="indigo"/>
                <FormInput label="Start Date" value={form.startDate} onChange={set('startDate')} type="date" accentColor="indigo"/>
                <FormInput label="Due / End Date" value={form.dueDate} onChange={set('dueDate')} type="date" accentColor="indigo"/>
                <FormInput label="Next Payment Date" value={form.nextPaymentDate} onChange={set('nextPaymentDate')} type="date" accentColor="indigo"/>
                <FormSelect label="Repayment Frequency" value={form.repaymentFrequency} onChange={set('repaymentFrequency')} options={FREQ_OPTS} accentColor="indigo"/>
                <FormInput label="Loan Purpose" value={form.loanPurpose} onChange={set('loanPurpose')} placeholder="e.g. Home purchase" col={2} accentColor="indigo"/>
                <FormInput label="Collateral / Security" value={form.collateral} onChange={set('collateral')} placeholder="e.g. Property at Anna Nagar" col={2} accentColor="indigo"/>
                <FormFile label="Supporting Document" col={2} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" fileName={docFile?.name} onChange={setDocFile} hint="Loan agreement, receipt or any document"/>
                <FormTextarea label="Notes" value={form.notes} onChange={set('notes') as any} placeholder="Any additional notes" col={2} accentColor="indigo" rows={2}/>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={()=>setShowModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving?'Saving...':editingId?'Update Entry':'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiabilitiesPage;
