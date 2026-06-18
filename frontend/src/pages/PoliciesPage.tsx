import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import ModuleTabs from '../components/ModuleTabs';
import { policiesApi } from '../services/api';

interface Policy {
  id: string; policy_name: string; insurer_name: string; policy_number: string | null;
  category: string; sum_insured: number | null; premium_amount: number;
  premium_frequency: string; start_date: string | null; expiry_date: string;
  renewal_date: string | null; next_premium_due: string | null;
  vehicle_reg_number: string | null; vehicle_make_model: string | null;
  property_address: string | null; nominee_name: string | null;
  agent_name: string | null; agent_phone: string | null;
  insurer_helpline: string | null; notes: string | null;
  computed_status: string; days_to_expiry: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All Policies', icon: '📋' },
  { id: 'health', label: 'Health', icon: '🏥' },
  { id: 'life', label: 'Life', icon: '💙' },
  { id: 'car', label: 'Car', icon: '🚗' },
  { id: 'home', label: 'Home', icon: '🏠' },
  { id: 'term', label: 'Term', icon: '📄' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'bike', label: 'Bike', icon: '🏍️' },
  { id: 'other', label: 'Other', icon: '🔖' },
];

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', half_yearly: 'Half Yearly',
  annual: 'Annual', single: 'Single Premium',
};

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Active' },
  expiring_soon: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'Expiring Soon' },
  expired: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Expired' },
  pending: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400', label: 'Pending' },
};

const CAT_COLORS: Record<string, string> = {
  health: 'from-emerald-600 to-emerald-400', life: 'from-blue-700 to-blue-500',
  car: 'from-violet-700 to-violet-500', home: 'from-amber-600 to-amber-400',
  term: 'from-slate-700 to-slate-500', travel: 'from-sky-600 to-sky-400',
  bike: 'from-orange-600 to-orange-400', other: 'from-gray-600 to-gray-400',
};

const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const emptyForm = {
  policyName: '', insurerName: '', policyNumber: '', category: 'health',
  sumInsured: '', premiumAmount: '', premiumFrequency: 'annual',
  startDate: '', expiryDate: '', renewalDate: '', nextPremiumDue: '',
  vehicleRegNumber: '', vehicleMakeModel: '', propertyAddress: '',
  nomineeName: '', agentName: '', agentPhone: '', insurerHelpline: '', notes: '',
};

const PoliciesPage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [counts, setCounts] = useState({ total: 0, active: 0, expiringSoon: 0, expired: 0 });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showNotifBanner, setShowNotifBanner] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toast$ = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await policiesApi.getAll(activeFilter !== 'all' ? activeFilter : undefined);
      setPolicies(res.data.data.policies);
      setCounts(res.data.data.counts);
      setNotifications(res.data.data.notifications || []);
    } catch { toast$('error', 'Failed to load policies.'); }
    finally { setLoading(false); }
  }, [activeFilter]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ ...emptyForm, category: activeFilter !== 'all' ? activeFilter : 'health' });
    setEditingId(null); setFormError(''); setShowModal(true);
  };

  const openEdit = (p: Policy) => {
    setForm({
      policyName: p.policy_name, insurerName: p.insurer_name,
      policyNumber: p.policy_number || '', category: p.category,
      sumInsured: p.sum_insured != null ? String(p.sum_insured) : '',
      premiumAmount: String(p.premium_amount), premiumFrequency: p.premium_frequency,
      startDate: p.start_date ? p.start_date.split('T')[0] : '',
      expiryDate: p.expiry_date.split('T')[0],
      renewalDate: p.renewal_date ? p.renewal_date.split('T')[0] : '',
      nextPremiumDue: p.next_premium_due ? p.next_premium_due.split('T')[0] : '',
      vehicleRegNumber: p.vehicle_reg_number || '', vehicleMakeModel: p.vehicle_make_model || '',
      propertyAddress: p.property_address || '', nomineeName: p.nominee_name || '',
      agentName: p.agent_name || '', agentPhone: p.agent_phone || '',
      insurerHelpline: p.insurer_helpline || '', notes: p.notes || '',
    });
    setEditingId(p.id); setFormError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.policyName.trim()) { setFormError('Policy name is required.'); return; }
    if (!form.insurerName.trim()) { setFormError('Insurer name is required.'); return; }
    if (!form.premiumAmount) { setFormError('Premium amount is required.'); return; }
    if (!form.expiryDate) { setFormError('Expiry date is required.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        policyName: form.policyName.trim(), insurerName: form.insurerName.trim(),
        policyNumber: form.policyNumber || undefined, category: form.category,
        sumInsured: form.sumInsured ? parseFloat(form.sumInsured) : undefined,
        premiumAmount: parseFloat(form.premiumAmount),
        premiumFrequency: form.premiumFrequency,
        startDate: form.startDate || undefined, expiryDate: form.expiryDate,
        renewalDate: form.renewalDate || undefined, nextPremiumDue: form.nextPremiumDue || undefined,
        vehicleRegNumber: form.vehicleRegNumber || undefined, vehicleMakeModel: form.vehicleMakeModel || undefined,
        propertyAddress: form.propertyAddress || undefined, nomineeName: form.nomineeName || undefined,
        agentName: form.agentName || undefined, agentPhone: form.agentPhone || undefined,
        insurerHelpline: form.insurerHelpline || undefined, notes: form.notes || undefined,
      };
      if (editingId) { await policiesApi.update(editingId, payload); toast$('success', 'Policy updated.'); }
      else { await policiesApi.add(payload); toast$('success', 'Policy added.'); }
      setShowModal(false); await load();
    } catch (e: any) { setFormError(e.response?.data?.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this policy?')) return;
    try { await policiesApi.remove(id); toast$('success', 'Policy removed.'); load(); }
    catch { toast$('error', 'Failed to remove.'); }
  };

  const F = ({ label, value, onChange, placeholder = '', type = 'text', required = false, col = 1 }: any) => (
    <div className={col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all" />
    </div>
  );

  const needsVehicle = ['car', 'bike'].includes(form.category);
  const needsProperty = form.category === 'home';

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Navbar */}
      <Navbar />
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg animate-fade-in
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}
      {/* Module header bar — same design as Dashboard */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-1.5 text-blue-300/70 text-xs mb-2">
                <Link to="/" className="hover:text-blue-200 transition-colors">Home</Link>
                <span>›</span>
                <span className="text-blue-200">Policies</span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">Policy Vault</h1>
              <p className="text-blue-200/60 text-sm mt-0.5">Track all your insurance policies, renewals and expiry dates</p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <Link to="/policy-dashboard"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-800 text-white border border-blue-700 font-bold text-sm hover:bg-blue-950 transition-colors shadow-sm flex-shrink-0">
                ✨ AI Policy Dashboard
              </Link>
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-white text-blue-900 font-bold text-sm hover:bg-blue-50 transition-colors shadow-sm flex-shrink-0">
                + Add Policy
              </button>
            </div>
          </div>
          <ModuleTabs />

        </div>
      </div>


      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5 bg-slate-50 min-h-screen">

        {/* Expiry Notification Banner */}
        {showNotifBanner && notifications.length > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-0.5">⚠️</div>
                <div>
                  <h3 className="font-semibold text-amber-800 text-sm mb-1">
                    {notifications.length} {notifications.length === 1 ? 'policy is' : 'policies are'} expiring soon
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {notifications.map(n => (
                      <span key={n.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
                          ${n.daysToExpiry <= 0 ? 'bg-red-100 text-red-700 border-red-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                        {CATEGORIES.find(c => c.id === n.category)?.icon} {n.policyName}
                        <span className="opacity-70">·</span>
                        {n.daysToExpiry <= 0 ? 'Expired' : `${n.daysToExpiry}d left`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowNotifBanner(false)} className="text-amber-500 hover:text-amber-700 text-lg flex-shrink-0">✕</button>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Policies', value: counts.total, icon: '📋', color: 'blue' },
            { label: 'Active', value: counts.active, icon: '✅', color: 'emerald' },
            { label: 'Expiring Soon', value: counts.expiringSoon, icon: '⏰', color: 'amber' },
            { label: 'Expired', value: counts.expired, icon: '❌', color: 'red' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-xs font-medium">{s.label}</span>
                <span className="text-lg">{s.icon}</span>
              </div>
              <div className="font-display text-3xl font-bold text-slate-800">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Category Filter Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-1.5">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setActiveFilter(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0
                  ${activeFilter === cat.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                <span>{cat.icon}</span> {cat.label}
                {cat.id !== 'all' && counts.total > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === cat.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {policies.filter(p => p.category === cat.id).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Policies Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-slate-200 animate-pulse" />)}
          </div>
        ) : policies.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
            <div className="text-5xl mb-4">{CATEGORIES.find(c => c.id === activeFilter)?.icon || '🛡️'}</div>
            <h3 className="font-semibold text-slate-700 text-lg mb-2">
              {activeFilter === 'all' ? 'No policies added yet' : `No ${CATEGORIES.find(c => c.id === activeFilter)?.label} policies yet`}
            </h3>
            <p className="text-slate-400 text-sm mb-5 max-w-sm mx-auto leading-relaxed">
              {activeFilter === 'all'
                ? 'Add your health, life, car, home and other insurance policies to track their renewal dates and status.'
                : `Add your ${CATEGORIES.find(c => c.id === activeFilter)?.label.toLowerCase()} insurance policies to track expiry and get renewal reminders.`}
            </p>
            <button onClick={openAdd}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
              + Add First Policy
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {policies.map(p => {
              const sc = STATUS_CONFIG[p.computed_status] || STATUS_CONFIG.active;
              const catData = CATEGORIES.find(c => c.id === p.category);
              const isExpanded = expandedId === p.id;
              return (
                <div key={p.id}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
                    ${p.computed_status === 'expiring_soon' ? 'border-amber-300 ring-1 ring-amber-200' : p.computed_status === 'expired' ? 'border-red-300' : 'border-slate-200'}`}>
                  {/* Card header with gradient */}
                  <div className={`bg-gradient-to-r ${CAT_COLORS[p.category] || 'from-slate-600 to-slate-400'} p-4 text-white`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{catData?.icon}</span>
                        <div>
                          <div className="font-semibold text-sm leading-tight">{p.policy_name}</div>
                          <div className="text-white/70 text-xs">{p.insurer_name}</div>
                        </div>
                      </div>
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Premium</div>
                        <div className="text-sm font-bold text-slate-800">{fmt(p.premium_amount)}</div>
                        <div className="text-[10px] text-slate-400">{FREQ_LABELS[p.premium_frequency]}</div>
                      </div>
                      {p.sum_insured && (
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Sum Insured</div>
                          <div className="text-sm font-bold text-slate-800">{fmt(p.sum_insured)}</div>
                        </div>
                      )}
                    </div>

                    {/* Expiry bar */}
                    <div className={`rounded-xl p-3 ${sc.bg} border ${sc.border}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-600">Expiry Date</span>
                        <span className={`text-xs font-bold ${sc.text}`}>{fmtDate(p.expiry_date)}</span>
                      </div>
                      {p.days_to_expiry >= 0 ? (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                            <span>Time remaining</span>
                            <span className={`font-semibold ${sc.text}`}>{p.days_to_expiry} days</span>
                          </div>
                          <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${p.computed_status === 'expiring_soon' ? 'bg-amber-500' : p.computed_status === 'expired' ? 'bg-red-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(100, Math.max(2, (p.days_to_expiry / 365) * 100))}%` }} />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-red-600 font-semibold mt-1">Expired {Math.abs(p.days_to_expiry)} days ago</div>
                      )}
                    </div>

                    {/* Expandable extra details */}
                    {isExpanded && (
                      <div className="space-y-2 pt-1 border-t border-slate-100 animate-fade-in">
                        {p.policy_number && <div className="flex justify-between text-xs"><span className="text-slate-400">Policy No.</span><span className="font-mono font-medium text-slate-700">{p.policy_number}</span></div>}
                        {p.renewal_date && <div className="flex justify-between text-xs"><span className="text-slate-400">Renewal</span><span className="font-medium text-slate-700">{fmtDate(p.renewal_date)}</span></div>}
                        {p.next_premium_due && <div className="flex justify-between text-xs"><span className="text-slate-400">Next Premium</span><span className="font-medium text-slate-700">{fmtDate(p.next_premium_due)}</span></div>}
                        {p.vehicle_reg_number && <div className="flex justify-between text-xs"><span className="text-slate-400">Reg. No.</span><span className="font-mono font-medium text-slate-700">{p.vehicle_reg_number}</span></div>}
                        {p.vehicle_make_model && <div className="flex justify-between text-xs"><span className="text-slate-400">Vehicle</span><span className="font-medium text-slate-700">{p.vehicle_make_model}</span></div>}
                        {p.nominee_name && <div className="flex justify-between text-xs"><span className="text-slate-400">Nominee</span><span className="font-medium text-slate-700">{p.nominee_name}</span></div>}
                        {p.insurer_helpline && <div className="flex justify-between text-xs"><span className="text-slate-400">Helpline</span><span className="font-medium text-blue-600">{p.insurer_helpline}</span></div>}
                        {p.agent_name && <div className="flex justify-between text-xs"><span className="text-slate-400">Agent</span><span className="font-medium text-slate-700">{p.agent_name}{p.agent_phone ? ` · ${p.agent_phone}` : ''}</span></div>}
                        {p.property_address && <div className="text-xs"><span className="text-slate-400 block">Property</span><span className="font-medium text-slate-700">{p.property_address}</span></div>}
                        {p.notes && <div className="text-xs"><span className="text-slate-400 block">Notes</span><span className="text-slate-600 italic">{p.notes}</span></div>}
                      </div>
                    )}

                    {/* Card footer */}
                    <div className="flex items-center justify-between pt-1">
                      <button onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {isExpanded ? '▲ Less' : '▼ More details'}
                      </button>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors">
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDelete(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold border border-red-200 transition-colors">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add more card */}
            <button onClick={openAdd}
              className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-500 transition-all min-h-[200px] bg-white">
              <span className="text-3xl">+</span>
              <span className="text-sm font-medium">Add Policy</span>
            </button>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════
          ADD / EDIT POLICY MODAL
      ═══════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
            {/* Modal header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-white font-semibold">{editingId ? 'Edit Policy' : 'Add Insurance Policy'}</div>
                <div className="text-blue-300/70 text-xs">All fields marked * are required</div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-colors">✕</button>
            </div>

            {/* Modal body — scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {formError && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  ⚠️ {formError}
                </div>
              )}

              <div className="space-y-4">
                {/* Category picker */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Category *</label>
                  <div className="grid grid-cols-4 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <button key={cat.id} type="button" onClick={() => setForm((f: any) => ({ ...f, category: cat.id }))}
                        className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs font-semibold transition-all
                          ${form.category === cat.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                        <span className="text-lg">{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <F label="Policy Name" required value={form.policyName} onChange={(e: any) => setForm((f: any) => ({ ...f, policyName: e.target.value }))} placeholder="e.g. Family Health Plan" col={2} />
                  <F label="Insurer / Company" required value={form.insurerName} onChange={(e: any) => setForm((f: any) => ({ ...f, insurerName: e.target.value }))} placeholder="e.g. Star Health Insurance" />
                  <F label="Policy Number" value={form.policyNumber} onChange={(e: any) => setForm((f: any) => ({ ...f, policyNumber: e.target.value }))} placeholder="e.g. POL-2024-12345" />

                  <F label="Premium Amount (₹)" required type="number" value={form.premiumAmount} onChange={(e: any) => setForm((f: any) => ({ ...f, premiumAmount: e.target.value }))} placeholder="e.g. 15000" />
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Frequency</label>
                    <select value={form.premiumFrequency} onChange={e => setForm((f: any) => ({ ...f, premiumFrequency: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>

                  <F label="Sum Insured (₹)" type="number" value={form.sumInsured} onChange={(e: any) => setForm((f: any) => ({ ...f, sumInsured: e.target.value }))} placeholder="e.g. 500000" />
                  <F label="Nominee Name" value={form.nomineeName} onChange={(e: any) => setForm((f: any) => ({ ...f, nomineeName: e.target.value }))} placeholder="e.g. Priya Krishnamurthy" />

                  <F label="Start Date" type="date" value={form.startDate} onChange={(e: any) => setForm((f: any) => ({ ...f, startDate: e.target.value }))} />
                  <F label="Expiry Date" required type="date" value={form.expiryDate} onChange={(e: any) => setForm((f: any) => ({ ...f, expiryDate: e.target.value }))} />
                  <F label="Renewal Date" type="date" value={form.renewalDate} onChange={(e: any) => setForm((f: any) => ({ ...f, renewalDate: e.target.value }))} />
                  <F label="Next Premium Due" type="date" value={form.nextPremiumDue} onChange={(e: any) => setForm((f: any) => ({ ...f, nextPremiumDue: e.target.value }))} />

                  {/* Vehicle-specific fields */}
                  {needsVehicle && (<>
                    <F label="Registration Number" value={form.vehicleRegNumber} onChange={(e: any) => setForm((f: any) => ({ ...f, vehicleRegNumber: e.target.value.toUpperCase() }))} placeholder="e.g. TN45AK0021" />
                    <F label="Vehicle Make / Model" value={form.vehicleMakeModel} onChange={(e: any) => setForm((f: any) => ({ ...f, vehicleMakeModel: e.target.value }))} placeholder="e.g. Maruti Swift VXi" />
                  </>)}

                  {/* Property-specific fields */}
                  {needsProperty && (
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Property Address</label>
                      <textarea value={form.propertyAddress} onChange={e => setForm((f: any) => ({ ...f, propertyAddress: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none h-16"
                        placeholder="Full property address" />
                    </div>
                  )}

                  <F label="Agent Name" value={form.agentName} onChange={(e: any) => setForm((f: any) => ({ ...f, agentName: e.target.value }))} placeholder="Insurance agent name" />
                  <F label="Agent Phone" type="tel" value={form.agentPhone} onChange={(e: any) => setForm((f: any) => ({ ...f, agentPhone: e.target.value }))} placeholder="+91 98765 43210" />
                  <F label="Insurer Helpline" value={form.insurerHelpline} onChange={(e: any) => setForm((f: any) => ({ ...f, insurerHelpline: e.target.value }))} placeholder="e.g. 1800-123-4567" col={2} />

                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                    <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none h-16"
                      placeholder="Any additional notes about this policy" />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0 bg-white">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                {saving ? 'Saving...' : editingId ? 'Update Policy' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PoliciesPage;
