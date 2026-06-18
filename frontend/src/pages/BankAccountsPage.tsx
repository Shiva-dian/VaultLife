import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { vaultApi } from '../services/api';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import { FormInput, FormSelect } from '../components/FormInput';
import ProfilePage from './ProfilePage';

// ── Types ─────────────────────────────────────────────────────────
interface BankAccount {
  id: string; bank_name: string; account_type: string;
  account_number_last4: string|null; account_holder: string|null;
  branch: string|null; ifsc_code: string|null; balance: number;
  interest_rate: number|null; maturity_date: string|null;
  currency: string; notes: string|null;
}

// ── Constants — defined OUTSIDE component ─────────────────────────
const ACCOUNT_TYPES: [string,string][] = [
  ['savings','Savings'],['current','Current'],['salary','Salary A/C'],
  ['fixed_deposit','Fixed Deposit'],['recurring_deposit','Recurring Deposit'],
  ['ppf','PPF'],['nps','NPS'],['other','Other'],
];
const AT_LABELS: Record<string,string> = Object.fromEntries(ACCOUNT_TYPES);
const AT_ICONS: Record<string,string> = {
  savings:'💰', current:'🏢', salary:'💼', fixed_deposit:'🔒',
  recurring_deposit:'📅', ppf:'🏛️', nps:'🎯', other:'🏦',
};
const CATEGORY_FILTERS = [
  { id:'all', label:'All Accounts' },
  { id:'savings', label:'Savings' },
  { id:'fixed_deposit', label:'Fixed Deposits' },
  { id:'recurring_deposit', label:'Recurring' },
  { id:'ppf', label:'PPF / NPS' },
];
const BANK_GRADIENTS = [
  'from-blue-700 to-blue-500','from-indigo-700 to-indigo-500',
  'from-slate-700 to-slate-500','from-sky-700 to-sky-500',
  'from-violet-700 to-violet-500','from-cyan-700 to-cyan-500',
];
const FD_TYPES = ['fixed_deposit','recurring_deposit','ppf','nps'];

const fmt = (n: number) =>
  `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d: string|null) =>
  d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';

const EMPTY_FORM = {
  bank_name:'', account_type:'savings', account_number_last4:'',
  account_holder:'', branch:'', ifsc_code:'', balance:'',
  interest_rate:'', maturity_date:'', notes:'',
};

// ── Component ─────────────────────────────────────────────────────
const BankAccountsPage: React.FC = () => {
  const [accounts, setAccounts]   = useState<BankAccount[]>([]);
  const [filter, setFilter]       = useState('all');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [form, setForm]           = useState<Record<string,string>>({...EMPTY_FORM});
  const [formError, setFormError] = useState('');
  const [toast, setToast]         = useState<{type:'success'|'error';msg:string}|null>(null);
  const [expandedId, setExpandedId] = useState<string|null>(null);
  const [showProfile, setShowProfile] = useState(false);

  const toast$ = (type:'success'|'error', msg:string) => {
    setToast({type, msg}); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await vaultApi.getBankAccounts();
      setAccounts(r.data.data.accounts);
    } catch { toast$('error','Failed to load accounts.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived values ────────────────────────────────────────────
  const filtered = filter === 'all' ? accounts
    : filter === 'ppf' ? accounts.filter(a => ['ppf','nps'].includes(a.account_type))
    : accounts.filter(a => a.account_type === filter);

  const total    = accounts.reduce((s,a) => s + Number(a.balance), 0);
  const savings  = accounts.filter(a => ['savings','current','salary'].includes(a.account_type)).reduce((s,a) => s+Number(a.balance),0);
  const term     = accounts.filter(a => ['fixed_deposit','recurring_deposit'].includes(a.account_type)).reduce((s,a) => s+Number(a.balance),0);
  const retirement = accounts.filter(a => ['ppf','nps'].includes(a.account_type)).reduce((s,a) => s+Number(a.balance),0);

  // ── Modal helpers ─────────────────────────────────────────────
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const openAdd = () => {
    setForm({...EMPTY_FORM}); setEditingId(null); setFormError(''); setShowModal(true);
  };
  const openEdit = (a: BankAccount) => {
    setForm({
      bank_name: a.bank_name, account_type: a.account_type,
      account_number_last4: a.account_number_last4 || '',
      account_holder: a.account_holder || '', branch: a.branch || '',
      ifsc_code: a.ifsc_code || '', balance: String(a.balance),
      interest_rate: a.interest_rate != null ? String(a.interest_rate) : '',
      maturity_date: a.maturity_date ? a.maturity_date.split('T')[0] : '',
      notes: a.notes || '',
    });
    setEditingId(a.id); setFormError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.bank_name.trim()) { setFormError('Bank name is required.'); return; }
    if (form.balance === '') { setFormError('Balance is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const p = {
        bankName: form.bank_name.trim(), accountType: form.account_type,
        accountNumberLast4: form.account_number_last4 || undefined,
        accountHolder: form.account_holder || undefined,
        branch: form.branch || undefined,
        ifscCode: form.ifsc_code || undefined,
        balance: parseFloat(form.balance),
        interestRate: form.interest_rate ? parseFloat(form.interest_rate) : undefined,
        maturityDate: form.maturity_date || undefined,
        notes: form.notes || undefined,
      };
      if (editingId) { await vaultApi.updateBankAccount(editingId, p); toast$('success','Account updated.'); }
      else           { await vaultApi.addBankAccount(p); toast$('success','Account added.'); }
      setShowModal(false); await load();
    } catch(e: any) { setFormError(e.response?.data?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this account?')) return;
    try { await vaultApi.deleteBankAccount(id); toast$('success','Removed.'); load(); }
    catch { toast$('error','Failed.'); }
  };

  const needsFDFields = FD_TYPES.includes(form.account_type);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg animate-fade-in
          ${toast.type==='success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Module header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-blue-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-blue-200">Home</Link><span>›</span>
                <Link to="/dashboard" className="hover:text-blue-200">Dashboard</Link><span>›</span>
                <span className="text-blue-200">Bank Accounts</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">Bank Accounts & Savings</h1>
              <p className="text-blue-200/60 text-sm mt-0.5">
                {accounts.length > 0
                  ? `${accounts.length} account${accounts.length > 1 ? 's' : ''} · Total ${fmt(total)}`
                  : 'Track all your savings and deposits'}
              </p>
            </div>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm flex-shrink-0">
              + Add Account
            </button>
          </div>
          <ModuleTabs />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Summary */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label:'Total Balance',        value: fmt(total),      icon:'💰', sub:`${accounts.length} accounts` },
              { label:'Savings & Current',    value: fmt(savings),    icon:'🏦', sub:'Liquid funds' },
              { label:'Fixed & Recurring',    value: fmt(term),       icon:'🔒', sub:'Term deposits' },
              { label:'Retirement Corpus',    value: fmt(retirement), icon:'🎯', sub:'PPF + NPS' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <div className="font-display text-xl font-bold text-slate-800">{s.value}</div>
                <div className="text-slate-400 text-xs mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-sm">
          <div className="flex gap-1 overflow-x-auto">
            {CATEGORY_FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
                  ${filter === f.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                {f.label}
                <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full
                  ${filter === f.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {f.id === 'all' ? accounts.length
                    : f.id === 'ppf' ? accounts.filter(a => ['ppf','nps'].includes(a.account_type)).length
                    : accounts.filter(a => a.account_type === f.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="h-44 rounded-2xl bg-slate-200 animate-pulse"/>)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-4">🏦</div>
            <h3 className="font-semibold text-slate-700 text-lg mb-2">
              {filter === 'all' ? 'No bank accounts added yet' : `No ${CATEGORY_FILTERS.find(f=>f.id===filter)?.label} accounts`}
            </h3>
            <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto">
              Add your savings, fixed deposits, recurring deposits, PPF and NPS accounts.
            </p>
            <button onClick={openAdd}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              + Add First Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((a, i) => {
              const isExp = expandedId === a.id;
              return (
                <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                  <div className={`bg-gradient-to-r ${BANK_GRADIENTS[i % BANK_GRADIENTS.length]} p-5 text-white relative overflow-hidden`}>
                    <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-white/10"/>
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{AT_ICONS[a.account_type]}</span>
                          <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">
                            {AT_LABELS[a.account_type]}
                          </span>
                        </div>
                        <div className="font-bold text-base">{a.bank_name}</div>
                        {a.account_number_last4 && (
                          <div className="text-white/50 text-xs font-mono mt-0.5">••••{a.account_number_last4}</div>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(a)}
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs flex items-center justify-center">✏️</button>
                        <button onClick={() => handleDelete(a.id)}
                          className="w-7 h-7 rounded-lg bg-white/20 hover:bg-red-400/60 text-white text-xs flex items-center justify-center">🗑️</button>
                      </div>
                    </div>
                    <div className="font-display text-2xl font-black mt-3">{fmt(a.balance)}</div>
                    {a.interest_rate && (
                      <div className="text-white/60 text-xs mt-1">
                        {a.interest_rate}% p.a.{a.maturity_date ? ` · Matures ${fmtDate(a.maturity_date)}` : ''}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    {isExp && (
                      <div className="space-y-1.5 mb-3 animate-fade-in">
                        {a.account_holder && <div className="flex justify-between text-xs"><span className="text-slate-400">Account Holder</span><span className="font-medium text-slate-700">{a.account_holder}</span></div>}
                        {a.branch && <div className="flex justify-between text-xs"><span className="text-slate-400">Branch</span><span className="font-medium text-slate-700">{a.branch}</span></div>}
                        {a.ifsc_code && <div className="flex justify-between text-xs"><span className="text-slate-400">IFSC</span><span className="font-mono font-medium text-slate-700">{a.ifsc_code}</span></div>}
                        {a.notes && <div className="text-xs text-slate-400 italic">"{a.notes}"</div>}
                      </div>
                    )}
                    <button onClick={() => setExpandedId(isExp ? null : a.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium w-full text-left">
                      {isExp ? '▲ Less details' : '▼ More details'}
                    </button>
                  </div>
                </div>
              );
            })}
            <button onClick={openAdd}
              className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 transition-all min-h-[180px] bg-white">
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Add Account</span>
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfilePage onClose={() => setShowProfile(false)}/>}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-white shadow-2xl flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-white font-semibold">🏦 {editingId ? 'Edit' : 'Add'} Bank Account</div>
                <div className="text-blue-300/70 text-xs">Fields marked * are required</div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {formError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  ⚠️ {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Bank Name *" value={form.bank_name}
                  onChange={set('bank_name')} placeholder="e.g. HDFC Bank, SBI, ICICI"
                  col={2} required accentColor="blue"/>

                <FormSelect label="Account Type" value={form.account_type}
                  onChange={set('account_type')} options={ACCOUNT_TYPES} accentColor="blue"/>

                <FormInput label="Balance (₹) *" value={form.balance}
                  onChange={set('balance')} placeholder="e.g. 250000"
                  type="number" required accentColor="blue"/>

                <FormInput label="Last 4 Digits" value={form.account_number_last4}
                  onChange={e => setForm(f => ({ ...f, account_number_last4: e.target.value.replace(/\D/g,'').slice(0,4) }))}
                  placeholder="4521" maxLength={4} inputMode="numeric" accentColor="blue"/>

                <FormInput label="Account Holder" value={form.account_holder}
                  onChange={set('account_holder')} placeholder="Name on account" accentColor="blue"/>

                <FormInput label="IFSC Code" value={form.ifsc_code}
                  onChange={e => setForm(f => ({ ...f, ifsc_code: e.target.value.toUpperCase() }))}
                  placeholder="HDFC0001234" accentColor="blue"/>

                <FormInput label="Branch" value={form.branch}
                  onChange={set('branch')} placeholder="e.g. Anna Nagar, Chennai"
                  col={2} accentColor="blue"/>

                {needsFDFields && (
                  <>
                    <FormInput label="Interest Rate %" value={form.interest_rate}
                      onChange={set('interest_rate')} placeholder="e.g. 7.5"
                      type="number" accentColor="blue"/>
                    <FormInput label="Maturity Date" value={form.maturity_date}
                      onChange={set('maturity_date')} type="date" accentColor="blue"/>
                  </>
                )}

                <FormInput label="Notes" value={form.notes}
                  onChange={set('notes')} placeholder="Optional notes" col={2} accentColor="blue"/>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">
                {saving ? 'Saving...' : editingId ? 'Update Account' : 'Add Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BankAccountsPage;
