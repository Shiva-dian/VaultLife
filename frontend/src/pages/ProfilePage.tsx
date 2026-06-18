import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { vaultApi, nomineesApi } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────
interface UserProfile {
  id: string; full_name: string; email: string; phone: string;
  username: string | null; avatar_url: string | null;
  preferred_otp_channel: string; email_verified: boolean;
  phone_verified: boolean; last_login_at: string; created_at: string;
}
interface Nominee {
  id: string; full_name: string; relationship: string;
  email: string | null; phone: string | null; date_of_birth: string | null;
  address: string | null; share_percent: number; is_primary: boolean; notes: string | null;
}

const RELATIONSHIPS = ['spouse','son','daughter','father','mother','brother','sister','friend','other'];
const REL_LABELS: Record<string,string> = {
  spouse:'Spouse', son:'Son', daughter:'Daughter', father:'Father',
  mother:'Mother', brother:'Brother', sister:'Sister', friend:'Friend', other:'Other'
};
const REL_COLORS: Record<string,string> = {
  spouse:'bg-pink-100 text-pink-700', son:'bg-blue-100 text-blue-700',
  daughter:'bg-purple-100 text-purple-700', father:'bg-slate-100 text-slate-700',
  mother:'bg-rose-100 text-rose-700', brother:'bg-cyan-100 text-cyan-700',
  sister:'bg-fuchsia-100 text-fuchsia-700', friend:'bg-green-100 text-green-700',
  other:'bg-gray-100 text-gray-700',
};

const emptyNominee = { full_name:'', relationship:'spouse', email:'', phone:'', date_of_birth:'', address:'', share_percent:'', is_primary:false, notes:'', aadhaar_last4:'', pan_number:'' };

interface ProfilePageProps { onClose: () => void; }

const ProfilePage: React.FC<ProfilePageProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [nominees, setNominees]   = useState<Nominee[]>([]);
  const [tab, setTab]             = useState<'profile'|'nominees'>('profile');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{type:'success'|'error'; msg:string}|null>(null);

  // Profile edit
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name:'', username:'', aadhaar_last4:'', pan_number:'', date_of_birth:'', occupation:'' });

  // Nominee modal
  const [showNomineeModal, setShowNomineeModal] = useState(false);
  const [editingNominee, setEditingNominee]     = useState<Nominee|null>(null);
  const [nomineeForm, setNomineeForm]           = useState<any>(emptyNominee);
  const [nomineeError, setNomineeError]         = useState('');
  const [nomineeInfo, setNomineeInfo]           = useState<any>(null); // totalShare etc

  const showToast = (type: 'success'|'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, nomineesRes] = await Promise.all([
        vaultApi.getProfile(),
        nomineesApi.getAll(),
      ]);
      setProfile(profileRes.data.data.user);
      const u = profileRes.data.data.user;
      setProfileForm({ 
        full_name: u.full_name, username: u.username || '',
        aadhaar_last4: u.aadhaar_last4 || '', pan_number: u.pan_number || '',
        date_of_birth: u.date_of_birth ? u.date_of_birth.split('T')[0] : '',
        occupation: u.occupation || '',
      });
      setNominees(nomineesRes.data.data.nominees);
      setNomineeInfo(nomineesRes.data.data);
    } catch (err) {
      showToast('error', 'Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Save profile ──────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileForm.full_name.trim()) { showToast('error', 'Name cannot be empty.'); return; }
    setSaving(true);
    try {
      const res = await vaultApi.updateProfile({ 
        fullName: profileForm.full_name, 
        username: profileForm.username || undefined,
        aadhaarLast4: profileForm.aadhaar_last4 || undefined,
        panNumber: profileForm.pan_number || undefined,
        dateOfBirth: profileForm.date_of_birth || undefined,
        occupation: profileForm.occupation || undefined,
      });
      setProfile(prev => prev ? { ...prev, ...res.data.data.user } : null);
      setEditProfile(false);
      showToast('success', 'Profile updated successfully.');
    } catch {
      showToast('error', 'Failed to update profile.');
    } finally { setSaving(false); }
  };

  // ── Open nominee modal ────────────────────────────────────────
  const openAddNominee = () => {
    setEditingNominee(null);
    setNomineeForm(emptyNominee);
    setNomineeError('');
    setShowNomineeModal(true);
  };
  const openEditNominee = (n: Nominee) => {
    setEditingNominee(n);
    setNomineeForm({
      full_name: n.full_name, relationship: n.relationship,
      email: n.email||'', phone: n.phone||'',
      date_of_birth: n.date_of_birth ? n.date_of_birth.split('T')[0] : '',
      address: n.address||'', share_percent: String(n.share_percent),
      is_primary: n.is_primary, notes: n.notes||'',
    });
    setNomineeError('');
    setShowNomineeModal(true);
  };

  // ── Save nominee ──────────────────────────────────────────────
  const handleSaveNominee = async () => {
    if (!nomineeForm.full_name.trim()) { setNomineeError('Full name is required.'); return; }
    const share = parseFloat(nomineeForm.share_percent || '0');
    if (share < 0 || share > 100) { setNomineeError('Share % must be between 0–100.'); return; }

    setSaving(true);
    setNomineeError('');
    try {
      const payload = {
        fullName: nomineeForm.full_name.trim(), relationship: nomineeForm.relationship,
        email: nomineeForm.email || undefined, phone: nomineeForm.phone || undefined,
        dateOfBirth: nomineeForm.date_of_birth || undefined, address: nomineeForm.address || undefined,
        sharePercent: share, isPrimary: nomineeForm.is_primary, notes: nomineeForm.notes || undefined,
      };
      if (editingNominee) {
        await nomineesApi.update(editingNominee.id, payload);
        showToast('success', 'Nominee updated.');
      } else {
        await nomineesApi.add(payload);
        showToast('success', 'Nominee added.');
      }
      setShowNomineeModal(false);
      await loadData();
    } catch (err: any) {
      setNomineeError(err.response?.data?.message || 'Failed to save nominee.');
    } finally { setSaving(false); }
  };

  const handleDeleteNominee = async (id: string) => {
    if (!window.confirm('Remove this nominee?')) return;
    try {
      await nomineesApi.remove(id);
      showToast('success', 'Nominee removed.');
      await loadData();
    } catch { showToast('error', 'Failed to remove nominee.'); }
  };

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-in panel */}
      <div className="relative w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-slide-right">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/30
                            flex items-center justify-center text-xl font-bold text-white">
              {profile?.full_name?.charAt(0).toUpperCase() || user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-semibold text-base">{profile?.full_name || user?.name}</div>
              <div className="text-blue-200 text-xs">{profile?.email || user?.email}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20
                                               flex items-center justify-center text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 flex-shrink-0">
          {(['profile','nominees'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-all
                ${tab === t ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-700'}`}>
              {t === 'profile' ? '👤 My Profile' : `👥 Nominees ${nominees.length > 0 ? `(${nominees.length})` : ''}`}
            </button>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2
            ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span> {toast.msg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{animationDelay:`${i*150}ms`}} />)}
              </div>
            </div>
          ) : (

            // ── PROFILE TAB ──────────────────────────────────────────
            tab === 'profile' ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 text-base">Account Details</h3>
                  {!editProfile ? (
                    <button onClick={() => setEditProfile(true)}
                      className="px-4 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200 transition-colors">
                      ✏️ Edit Profile
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditProfile(false)} className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200">Cancel</button>
                      <button onClick={handleSaveProfile} disabled={saving}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-50">
                        {saving ? 'Saving...' : '✓ Save'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:'Full Name', key:'full_name', editable:true },
                    { label:'Username', key:'username', editable:true },
                    { label:'Email Address', key:'email', editable:false },
                    { label:'Phone Number', key:'phone', editable:false },
                    { label:'Aadhaar (Last 4 Digits)', key:'aadhaar_last4', editable:true },
                    { label:'PAN Number', key:'pan_number', editable:true },
                    { label:'Date of Birth', key:'date_of_birth', editable:true },
                    { label:'Occupation', key:'occupation', editable:true },
                  ].map(({ label, key, editable }) => (
                    <div key={key} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
                      <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wide">{label}</div>
                      {editProfile && editable ? (
                        <input
                          className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200"
                          value={(profileForm as any)[key] || ''}
                          onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                          placeholder={label}
                        />
                      ) : (
                        <div className="text-sm font-semibold text-slate-800">
                          {(profile as any)?.[key] || <span className="text-slate-400 font-normal italic">Not set</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Verification badges */}
                <div className="flex gap-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border
                    ${profile?.email_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    <span>{profile?.email_verified ? '✅' : '⏳'}</span> Email {profile?.email_verified ? 'Verified' : 'Pending'}
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border
                    ${profile?.phone_verified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    <span>{profile?.phone_verified ? '✅' : '⏳'}</span> Phone {profile?.phone_verified ? 'Verified' : 'Pending'}
                  </div>
                </div>

                {/* Account meta */}
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-2.5">
                  <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Account Info</h4>
                  {[
                    { label:'Member Since', value: fmtDate(profile?.created_at||'') },
                    { label:'Last Login', value: profile?.last_login_at ? fmtDate(profile.last_login_at) : 'First login' },
                    { label:'OTP Channel', value: profile?.preferred_otp_channel?.toUpperCase() },
                    { label:'Account Status', value: 'Active ✅' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-xs text-slate-500">{label}</span>
                      <span className="text-xs font-semibold text-slate-700">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

            // ── NOMINEES TAB ─────────────────────────────────────────
            ) : (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">Nominee Details</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {nominees.length}/10 nominees · {nomineeInfo?.totalSharePercent || 0}% share allocated
                    </p>
                  </div>
                  {nominees.length < 10 && (
                    <button onClick={openAddNominee}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm">
                      + Add Nominee
                    </button>
                  )}
                </div>

                {/* Share bar */}
                {nominees.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-500">Share Distribution</span>
                      <span className={`font-semibold ${(nomineeInfo?.totalSharePercent||0) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {nomineeInfo?.totalSharePercent || 0}% / 100%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${(nomineeInfo?.totalSharePercent||0) === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                           style={{ width: `${Math.min(nomineeInfo?.totalSharePercent||0, 100)}%` }} />
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {nominees.length === 0 ? (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center text-3xl mx-auto mb-4">👥</div>
                    <h4 className="font-semibold text-slate-700 mb-1">No nominees added yet</h4>
                    <p className="text-sm text-slate-400 mb-4 leading-relaxed">
                      Add up to 10 nominees who will be notified in case of an emergency.
                      They will receive all your vault details instantly.
                    </p>
                    <button onClick={openAddNominee}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                      + Add First Nominee
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {nominees.map((n, i) => (
                      <div key={n.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-4 p-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {n.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-800 text-sm">{n.full_name}</span>
                              {n.is_primary && (
                                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">PRIMARY</span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${REL_COLORS[n.relationship]}`}>
                                {REL_LABELS[n.relationship]}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
                              {n.email && <span>📧 {n.email}</span>}
                              {n.phone && <span>📱 {n.phone}</span>}
                              {n.date_of_birth && <span>🎂 {fmtDate(n.date_of_birth)}</span>}
                            </div>
                            {n.notes && <p className="text-xs text-slate-400 mt-1 italic">"{n.notes}"</p>}
                          </div>
                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-base font-bold text-blue-700">{n.share_percent}%</div>
                              <div className="text-[10px] text-slate-400">Share</div>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => openEditNominee(n)}
                                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors text-xs">
                                ✏️
                              </button>
                              <button onClick={() => handleDeleteNominee(n.id)}
                                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors text-xs">
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Nominee Modal ── */}
      {showNomineeModal && (
        <div className="absolute inset-0 bg-black/50 z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between rounded-t-2xl">
              <h3 className="font-semibold text-slate-800">{editingNominee ? 'Edit Nominee' : 'Add Nominee'}</h3>
              <button onClick={() => setShowNomineeModal(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {nomineeError && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
                  ⚠️ {nomineeError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {/* Aadhaar info banner */}
                <div className="col-span-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                  <strong>⚠️ Aadhaar Required:</strong> Please enter the last 4 digits of the nominee's Aadhaar card for KYC compliance under DPDP Act 2023.
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Full Name *</label>
                  <input value={nomineeForm.full_name} onChange={e => setNomineeForm((f:any) => ({...f, full_name:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. Priya Krishnamurthy" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Relationship *</label>
                  <select value={nomineeForm.relationship} onChange={e => setNomineeForm((f:any) => ({...f, relationship:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400">
                    {RELATIONSHIPS.map(r => <option key={r} value={r}>{REL_LABELS[r]}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Share %</label>
                  <input type="number" min="0" max="100" step="0.01"
                    value={nomineeForm.share_percent} onChange={e => setNomineeForm((f:any) => ({...f, share_percent:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    placeholder="e.g. 50" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Email</label>
                  <input type="email" value={nomineeForm.email} onChange={e => setNomineeForm((f:any) => ({...f, email:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400"
                    placeholder="nominee@email.com" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Phone</label>
                  <input type="tel" value={nomineeForm.phone} onChange={e => setNomineeForm((f:any) => ({...f, phone:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400"
                    placeholder="+91 98765 43210" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Date of Birth</label>
                  <input type="date" value={nomineeForm.date_of_birth} onChange={e => setNomineeForm((f:any) => ({...f, date_of_birth:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400" />
                </div>

                <div>
                  <label className="flex items-center gap-2 cursor-pointer mt-6">
                    <input type="checkbox" checked={nomineeForm.is_primary} onChange={e => setNomineeForm((f:any) => ({...f, is_primary:e.target.checked}))}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-medium text-slate-700">Set as Primary Nominee</span>
                  </label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Address</label>
                  <textarea value={nomineeForm.address} onChange={e => setNomineeForm((f:any) => ({...f, address:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 resize-none h-20"
                    placeholder="Full residential address" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Aadhaar Last 4 Digits <span className="text-red-500">*</span></label>
                  <input maxLength={4} value={nomineeForm.aadhaar_last4||''} onChange={e => setNomineeForm((f:any) => ({...f, aadhaar_last4:e.target.value.replace(/\D/g,'').slice(0,4)}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. 4521" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">PAN Number</label>
                  <input maxLength={10} value={nomineeForm.pan_number||''} onChange={e => setNomineeForm((f:any) => ({...f, pan_number:e.target.value.toUpperCase()}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 font-mono"
                    placeholder="e.g. ABCDE1234F" />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                  <input value={nomineeForm.notes} onChange={e => setNomineeForm((f:any) => ({...f, notes:e.target.value}))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400"
                    placeholder="Any additional information" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowNomineeModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleSaveNominee} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                  {saving ? 'Saving...' : editingNominee ? 'Update Nominee' : 'Add Nominee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
