import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LeftPanel from '../components/LeftPanel';
import Input from '../components/Input';
import OTPInput from '../components/OTPInput';
import Alert from '../components/Alert';
import StepIndicator from '../components/StepIndicator';
import PasswordStrength from '../components/PasswordStrength';
import { authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

type MainStep  = 'credentials' | 'otp';
type FpStep    = 'request' | 'verify' | 'reset' | 'done';

const OTP_TIMER = 120;
const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

const LoginPage: React.FC = () => {
  const navigate  = useNavigate();
  const { login, isAuthenticated } = useAuth();

  /* ── Login state ── */
  const [step, setStep]           = useState<MainStep>('credentials');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]   = useState('');
  const [userId, setUserId]       = useState('');
  const [otpChannel, setOtpChannel] = useState<'email'|'sms'>('email');
  const [masked, setMasked]       = useState('');
  const [otp, setOtp]             = useState('');
  const [devOtp, setDevOtp]       = useState('');
  const [errors, setErrors]       = useState<Record<string,string>>({});
  const [alert, setAlert]         = useState<{type:'error'|'success'|'info';msg:string}|null>(null);
  const [loading, setLoading]     = useState(false);
  const [timer, setTimer]         = useState(OTP_TIMER);
  const [canResend, setCanResend] = useState(false);

  /* ── Forgot password state ── */
  const [showFP, setShowFP]       = useState(false);
  const [fpStep, setFpStep]       = useState<FpStep>('request');
  const [fpId, setFpId]           = useState('');
  const [fpUserId, setFpUserId]   = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpOtp, setFpOtp]         = useState('');
  const [fpDevOtp, setFpDevOtp]   = useState('');
  const [fpMasked, setFpMasked]   = useState('');
  const [fpChannel, setFpChannel] = useState('');
  const [newPass, setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [fpAlert, setFpAlert]     = useState<{type:'error'|'success'|'info';msg:string}|null>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpTimer, setFpTimer]     = useState(OTP_TIMER);
  const [fpCanResend, setFpCanResend] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard'); }, [isAuthenticated, navigate]);

  /* OTP countdown - login */
  useEffect(() => {
    if (step !== 'otp') return;
    setTimer(OTP_TIMER); setCanResend(false);
    const iv = setInterval(() => setTimer(t => { if(t<=1){clearInterval(iv);setCanResend(true);return 0;} return t-1; }), 1000);
    return () => clearInterval(iv);
  }, [step]);

  /* OTP countdown - forgot */
  useEffect(() => {
    if (!showFP || fpStep !== 'verify') return;
    setFpTimer(OTP_TIMER); setFpCanResend(false);
    const iv = setInterval(() => setFpTimer(t => { if(t<=1){clearInterval(iv);setFpCanResend(true);return 0;} return t-1; }), 1000);
    return () => clearInterval(iv);
  }, [showFP, fpStep]);

  /* ── Login: Step 1 ── */
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string,string> = {};
    if (!identifier.trim()) errs.identifier = 'Email or phone is required.';
    if (!password) errs.password = 'Password is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true); setAlert(null);
    try {
      const res = await authApi.login({ identifier: identifier.trim(), password });
      const d = res.data.data;
      setUserId(d.userId); setOtpChannel(d.otpChannel); setMasked(d.maskedIdentifier);
      if (d.devOtp) setDevOtp(d.devOtp);
      setStep('otp'); setAlert({ type:'info', msg: res.data.message });
    } catch(err: any) {
      setAlert({ type:'error', msg: err.response?.data?.message || 'Login failed.' });
    } finally { setLoading(false); }
  };

  /* ── Login: Step 2 ── */
  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) { setAlert({ type:'error', msg: 'Enter all 6 digits.' }); return; }
    setLoading(true); setAlert(null);
    try {
      const res = await authApi.verifyLoginOTP({ userId, otp });
      login(res.data.data.user, res.data.data.accessToken);
      setAlert({ type:'success', msg: 'Login successful! Redirecting...' });
      setTimeout(() => navigate('/dashboard'), 700);
    } catch(err: any) {
      setAlert({ type:'error', msg: err.response?.data?.message || 'Invalid OTP.' });
      setOtp('');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (!canResend) return;
    try {
      await authApi.resendOTP({ userId, purpose:'login' });
      setAlert({ type:'info', msg:'New OTP sent.' }); setTimer(OTP_TIMER); setCanResend(false); setOtp('');
    } catch { setAlert({ type:'error', msg:'Failed to resend.' }); }
  };

  /* ── Forgot: Step 1 request ── */
  const handleFpRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fpId.trim()) { setFpAlert({ type:'error', msg:'Email or phone is required.' }); return; }
    setFpLoading(true); setFpAlert(null);
    try {
      const res = await authApi.forgotPassword({ identifier: fpId.trim() });
      const d = res.data.data;
      if (!d.found) { setFpAlert({ type:'info', msg: res.data.message }); setFpLoading(false); return; }
      setFpUserId(d.userId); setFpMasked(d.maskedIdentifier); setFpChannel(d.otpChannel);
      if (d.devOtp) setFpDevOtp(d.devOtp);
      setFpStep('verify'); setFpAlert({ type:'info', msg: res.data.message });
    } catch(err: any) {
      setFpAlert({ type:'error', msg: err.response?.data?.message || 'Failed to send OTP.' });
    } finally { setFpLoading(false); }
  };

  /* ── Forgot: Step 2 verify OTP ── */
  const handleFpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fpOtp.length < 6) { setFpAlert({ type:'error', msg:'Enter the complete 6-digit OTP.' }); return; }
    setFpLoading(true); setFpAlert(null);
    try {
      const res = await authApi.verifyForgotOTP({ userId: fpUserId, otp: fpOtp });
      setFpResetToken(res.data.data.resetToken);
      setFpStep('reset'); setFpAlert(null);
    } catch(err: any) {
      setFpAlert({ type:'error', msg: err.response?.data?.message || 'Invalid OTP.' });
      setFpOtp('');
    } finally { setFpLoading(false); }
  };

  /* ── Forgot: Step 3 reset password ── */
  const handleFpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) { setFpAlert({ type:'error', msg:'Password must be at least 8 characters.' }); return; }
    if (!/(?=.*[A-Z])(?=.*[0-9])/.test(newPass)) { setFpAlert({ type:'error', msg:'Must include uppercase and a number.' }); return; }
    if (newPass !== confirmPass) { setFpAlert({ type:'error', msg:'Passwords do not match.' }); return; }
    setFpLoading(true); setFpAlert(null);
    try {
      await authApi.resetPassword({ userId: fpUserId, resetToken: fpResetToken, newPassword: newPass });
      setFpStep('done');
    } catch(err: any) {
      setFpAlert({ type:'error', msg: err.response?.data?.message || 'Reset failed.' });
    } finally { setFpLoading(false); }
  };

  const closeFP = () => { setShowFP(false); setFpStep('request'); setFpId(''); setFpOtp(''); setFpDevOtp(''); setFpAlert(null); };
  const Spin = () => <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%]">
        <LeftPanel mode="login" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50/30 p-6 sm:p-10 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <span className="text-2xl">🔒</span>
          <span className="font-display text-2xl font-bold text-blue-900">Vault<span className="text-blue-500">Life</span></span>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="auth-card p-8">
            <StepIndicator steps={['Credentials','Verify OTP']} current={step==='credentials'?0:1} />

            {/* ── STEP 1 ── */}
            {step === 'credentials' && (
              <div className="animate-fade-in">
                <div className="text-center mb-7">
                  <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Welcome Back</h2>
                  <p className="text-slate-500 text-sm">Sign in to access your secure vault</p>
                </div>
                {alert && <div className="mb-5"><Alert type={alert.type} message={alert.msg} onClose={()=>setAlert(null)}/></div>}
                <form onSubmit={handleCredentials} noValidate className="space-y-4">
                  <Input label="Email or Mobile Number" type="text" placeholder="name@email.com or 9876543210"
                    value={identifier} onChange={e=>{setIdentifier(e.target.value);setErrors(r=>({...r,identifier:''}));}}
                    error={errors.identifier} icon={<span>📧</span>} autoComplete="username" autoFocus/>
                  <Input label="Password" type="password" placeholder="Enter your password"
                    value={password} onChange={e=>{setPassword(e.target.value);setErrors(r=>({...r,password:''}));}}
                    error={errors.password} icon={<span>🔑</span>} autoComplete="current-password"/>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" className="rounded border-blue-300 text-blue-600 w-3.5 h-3.5"/>
                      <span className="text-slate-500">Remember me</span>
                    </label>
                    <button type="button" onClick={()=>setShowFP(true)} className="btn-link">Forgot password?</button>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2">
                    {loading ? <><Spin/> Verifying...</> : 'Continue →'}
                  </button>
                </form>
                <div className="mt-4 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs text-slate-500 mb-2 font-medium">Receive OTP via:</p>
                  <div className="flex gap-2">
                    {(['email','sms'] as const).map(ch=>(
                      <button key={ch} type="button" onClick={()=>setOtpChannel(ch)}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${otpChannel===ch?'bg-blue-600 text-white shadow-sm':'bg-white text-slate-500 border border-blue-200 hover:border-blue-400'}`}>
                        {ch==='email'?'📧 Email':'📱 SMS'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 'otp' && (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-3xl mx-auto mb-3">
                    {otpChannel==='email'?'📧':'📱'}
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">Verify Your Identity</h2>
                  <p className="text-slate-500 text-sm">OTP sent to <span className="font-semibold text-blue-700">{masked}</span></p>
                </div>
                {alert && <div className="mb-4"><Alert type={alert.type} message={alert.msg} onClose={()=>setAlert(null)}/></div>}
                {devOtp && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300">
                    <p className="text-xs font-bold text-amber-700 mb-2">🛠️ DEV MODE OTP</p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-2xl font-bold text-amber-800 tracking-widest">{devOtp}</span>
                      <button type="button" onClick={()=>setOtp(devOtp)} className="text-xs px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg font-semibold">Auto-fill ↓</button>
                    </div>
                  </div>
                )}
                <form onSubmit={handleOTPVerify} className="space-y-5">
                  <div>
                    <label className="field-label text-center block mb-3">Enter 6-Digit OTP</label>
                    <OTPInput value={otp} onChange={v=>{setOtp(v);setAlert(null);}} hasError={alert?.type==='error'} autoFocus disabled={loading}/>
                  </div>
                  <div className="text-center">
                    {!canResend
                      ? <p className="text-xs text-slate-400">Resend in <span className="font-mono font-semibold text-blue-600">{fmt(timer)}</span></p>
                      : <button type="button" onClick={handleResend} className="btn-link text-xs">Resend OTP</button>}
                  </div>
                  <button type="submit" disabled={loading||otp.length<6} className="btn-primary flex items-center justify-center gap-2">
                    {loading?<><Spin/>Verifying...</>:'🔓 Verify & Sign In'}
                  </button>
                  <button type="button" onClick={()=>{setStep('credentials');setAlert(null);setOtp('');}} className="btn-secondary text-sm">← Back</button>
                </form>
              </div>
            )}
          </div>

          <p className="text-center text-sm text-slate-500 mt-6">
            New to VaultLife? <Link to="/register" className="btn-link font-semibold">Create an account →</Link>
          </p>
          <div className="flex items-center justify-center gap-4 mt-4">
            {['AES-256 Encrypted','DPDP Compliant','Zero-Knowledge'].map(t=>(
              <div key={t} className="flex items-center gap-1 text-[10px] text-slate-400"><span className="text-blue-400">✓</span> {t}</div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════
          FORGOT PASSWORD MODAL
      ══════════════════════════════════════ */}
      {showFP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-4 flex items-center justify-between">
              <div>
                <div className="text-white font-semibold">Reset Password</div>
                <div className="text-blue-300/70 text-xs">
                  {fpStep==='request'?'Step 1 of 3: Enter your email/phone':
                   fpStep==='verify' ?'Step 2 of 3: Verify OTP':
                   fpStep==='reset'  ?'Step 3 of 3: Set new password':'Done'}
                </div>
              </div>
              <button onClick={closeFP} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-sm">✕</button>
            </div>

            {/* Step dots */}
            <div className="flex px-6 pt-4 gap-2">
              {['request','verify','reset'].map((s,i)=>(
                <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                  (['request','verify','reset','done'].indexOf(fpStep))>i?'bg-blue-600':
                  fpStep===s?'bg-blue-400':'bg-slate-200'}`}/>
              ))}
            </div>

            <div className="p-6">
              {fpAlert && <div className="mb-4"><Alert type={fpAlert.type} message={fpAlert.msg} onClose={()=>setFpAlert(null)}/></div>}

              {/* ── FP Step 1: Request ── */}
              {fpStep==='request' && (
                <form onSubmit={handleFpRequest} className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2">🔐</div>
                    <p className="text-sm text-slate-500">Enter the email address or phone number associated with your account.</p>
                  </div>
                  <Input label="Email or Mobile Number" type="text" placeholder="name@email.com or 9876543210"
                    value={fpId} onChange={e=>setFpId(e.target.value)} icon={<span>📧</span>} autoFocus/>
                  <button type="submit" disabled={fpLoading} className="btn-primary flex items-center justify-center gap-2">
                    {fpLoading?<><Spin/>Sending OTP...</>:'Send OTP →'}
                  </button>
                </form>
              )}

              {/* ── FP Step 2: Verify OTP ── */}
              {fpStep==='verify' && (
                <form onSubmit={handleFpVerify} className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2">{fpChannel==='email'?'📧':'📱'}</div>
                    <p className="text-sm text-slate-500">OTP sent to <span className="font-semibold text-blue-700">{fpMasked}</span></p>
                  </div>
                  {fpDevOtp && (
                    <div className="p-3 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300">
                      <p className="text-xs font-bold text-amber-700 mb-1">🛠️ DEV OTP</p>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xl font-bold text-amber-800 tracking-widest">{fpDevOtp}</span>
                        <button type="button" onClick={()=>setFpOtp(fpDevOtp)} className="text-xs px-3 py-1 bg-amber-200 text-amber-800 rounded-lg font-semibold">Auto-fill</button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="field-label text-center block mb-3">Enter 6-Digit OTP</label>
                    <OTPInput value={fpOtp} onChange={v=>{setFpOtp(v);setFpAlert(null);}} hasError={fpAlert?.type==='error'} autoFocus disabled={fpLoading}/>
                  </div>
                  <div className="text-center">
                    {!fpCanResend
                      ? <p className="text-xs text-slate-400">Resend in <span className="font-mono font-semibold text-blue-600">{fmt(fpTimer)}</span></p>
                      : <button type="button" onClick={async()=>{const r=await authApi.forgotPassword({identifier:fpId.trim()});if(r.data.data?.devOtp)setFpDevOtp(r.data.data.devOtp);setFpTimer(OTP_TIMER);setFpCanResend(false);setFpOtp('');}} className="btn-link text-xs">Resend OTP</button>}
                  </div>
                  <button type="submit" disabled={fpLoading||fpOtp.length<6} className="btn-primary flex items-center justify-center gap-2">
                    {fpLoading?<><Spin/>Verifying...</>:'Verify OTP →'}
                  </button>
                  <button type="button" onClick={()=>setFpStep('request')} className="btn-secondary text-sm">← Back</button>
                </form>
              )}

              {/* ── FP Step 3: New Password ── */}
              {fpStep==='reset' && (
                <form onSubmit={handleFpReset} className="space-y-4">
                  <div className="text-center mb-2">
                    <div className="text-3xl mb-2">🔑</div>
                    <p className="text-sm text-slate-500">Set your new password below.</p>
                  </div>
                  <div>
                    <Input label="New Password" type="password" placeholder="Min 8 chars, uppercase + number"
                      value={newPass} onChange={e=>setNewPass(e.target.value)} icon={<span>🔒</span>} autoFocus/>
                    <PasswordStrength password={newPass}/>
                  </div>
                  <Input label="Confirm New Password" type="password" placeholder="Re-enter new password"
                    value={confirmPass} onChange={e=>setConfirmPass(e.target.value)} icon={<span>🔒</span>}/>
                  <button type="submit" disabled={fpLoading} className="btn-primary flex items-center justify-center gap-2">
                    {fpLoading?<><Spin/>Resetting...</>:'Reset Password ✓'}
                  </button>
                </form>
              )}

              {/* ── FP Done ── */}
              {fpStep==='done' && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-3xl mx-auto mb-4">✅</div>
                  <h3 className="font-display text-xl font-bold text-slate-800 mb-2">Password Reset!</h3>
                  <p className="text-slate-500 text-sm mb-6">Your password has been updated. You can now sign in with your new password.</p>
                  <button onClick={closeFP} className="btn-primary">Sign In Now →</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
