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

type Step = 'details' | 'otp' | 'success';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  otpChannel: 'email' | 'sms';
}

interface OTPState {
  userId: string;
  maskedIdentifier: string;
  otp: string;
}

const STEPS = ['Your Details', 'Verify OTP', 'All Done!'];
const OTP_TIMER = 120;

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState<FormState>({
    fullName: '', email: '', phone: '', password: '',
    confirmPassword: '', otpChannel: 'email',
  });
  const [otpState, setOtpState] = useState<OTPState>({ userId: '', maskedIdentifier: '', otp: '' });
  const [devOtp, setDevOtp] = useState<string>(''); // shown in dev mode
  const [errors, setErrors] = useState<Partial<FormState & { otp: string }>>({});
  const [alert, setAlert] = useState<{ type: 'error'|'success'|'info'; msg: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(OTP_TIMER);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => { if (isAuthenticated) navigate('/dashboard'); }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (step !== 'otp') return;
    setOtpTimer(OTP_TIMER);
    setCanResend(false);
    const interval = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const set = (field: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    if ((errors as any)[field]) setErrors(e => ({ ...e, [field]: '' }));
    setAlert(null);
  };

  // ── Validate Step 1 ─────────────────────────────────────────────
  const validateDetails = (): boolean => {
    const e: Partial<FormState> = {};
    if (!form.fullName.trim() || form.fullName.trim().length < 2)
      e.fullName = 'Full name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = 'Please enter a valid email address.';
    if (!/^[6-9]\d{9}$/.test(form.phone))
      e.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (form.password.length < 8)
      e.password = 'Password must be at least 8 characters.';
    else if (!/(?=.*[A-Z])(?=.*[0-9])/.test(form.password))
      e.password = 'Include at least one uppercase letter and number.';
    if (form.password !== form.confirmPassword)
      e.confirmPassword = 'Passwords do not match.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Step 1: Submit registration details ─────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setIsLoading(true);
    setAlert(null);
    try {
      const res = await authApi.register({
        fullName: form.fullName.trim(),
        email: form.email.toLowerCase(),
        phone: form.phone,
        password: form.password,
        otpChannel: form.otpChannel,
      });
      const { userId, maskedIdentifier, otpChannel: actualChannel, devOtp: serverDevOtp } = res.data.data;
      setOtpState(s => ({ ...s, userId, maskedIdentifier }));
      // Update otpChannel in form to actual channel used (may differ if SMS fell back to email)
      if (actualChannel) setForm(f => ({ ...f, otpChannel: actualChannel }));
      if (serverDevOtp) setDevOtp(serverDevOtp);
      setStep('otp');
      setAlert({ type: 'info', msg: res.data.message });
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setAlert({ type: 'error', msg });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2: Verify OTP ──────────────────────────────────────────
  const handleOTPVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpState.otp.length < 6) {
      setErrors({ otp: 'Please enter the complete 6-digit OTP.' });
      return;
    }

    setIsLoading(true);
    setAlert(null);
    try {
      const res = await authApi.verifyRegistration({
        userId: otpState.userId,
        otp: otpState.otp,
        otpChannel: form.otpChannel,
      });
      const { accessToken, user } = res.data.data;
      login(user, accessToken);
      setStep('success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Invalid OTP.';
      setAlert({ type: 'error', msg });
      setOtpState(s => ({ ...s, otp: '' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    try {
      await authApi.resendOTP({ userId: otpState.userId, purpose: 'registration' });
      setAlert({ type: 'info', msg: `New OTP sent to your ${form.otpChannel}.` });
      setOtpTimer(OTP_TIMER);
      setCanResend(false);
      setOtpState(s => ({ ...s, otp: '' }));
    } catch {
      setAlert({ type: 'error', msg: 'Failed to resend OTP.' });
    }
  };

  const formatTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const stepIndex = step === 'details' ? 0 : step === 'otp' ? 1 : 2;

  return (
    <div className="min-h-screen flex">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[52%]">
        <LeftPanel mode="register" />
      </div>

      {/* ── Right Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center
                      bg-gradient-to-br from-blue-50 via-white to-blue-50/30
                      p-6 sm:p-10 overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <span className="text-2xl">🔒</span>
          <span className="font-display text-2xl font-bold text-blue-900">
            Vault<span className="text-blue-500">Life</span>
          </span>
        </div>

        <div className="w-full max-w-[440px]">
          <div className="auth-card p-8">
            <StepIndicator steps={STEPS} current={stepIndex} />

            {/* ── STEP 1: Registration Details ── */}
            {step === 'details' && (
              <div className="animate-fade-in">
                <div className="text-center mb-7">
                  <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">
                    Create Your Vault
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Protect your family's financial future
                  </p>
                </div>

                {alert && <div className="mb-5"><Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

                <form onSubmit={handleRegister} noValidate className="space-y-4">
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Ramesh Krishnamurthy"
                    value={form.fullName}
                    onChange={e => set('fullName', e.target.value)}
                    error={errors.fullName}
                    icon={<span>👤</span>}
                    autoComplete="name"
                    autoFocus
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Email Address"
                      type="email"
                      placeholder="you@email.com"
                      value={form.email}
                      onChange={e => set('email', e.target.value)}
                      error={errors.email}
                      icon={<span>📧</span>}
                      autoComplete="email"
                    />
                    <div>
                      <label className="field-label">Mobile Number</label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 text-slate-500 text-xs font-semibold pointer-events-none">+91</div>
                        <input
                          type="tel"
                          placeholder="98765 43210"
                          value={form.phone}
                          onChange={e => { set('phone', e.target.value.replace(/\D/g, '').slice(0, 10)); }}
                          className={`input-base pl-10 ${errors.phone ? 'error' : ''}`}
                          inputMode="numeric"
                          autoComplete="tel"
                        />
                      </div>
                      {errors.phone && <p className="mt-1.5 text-xs text-red-500">⚠ {errors.phone}</p>}
                    </div>
                  </div>

                  <div>
                    <Input
                      label="Password"
                      type="password"
                      placeholder="Min. 8 chars with uppercase & number"
                      value={form.password}
                      onChange={e => set('password', e.target.value)}
                      error={errors.password}
                      icon={<span>🔒</span>}
                      autoComplete="new-password"
                    />
                    <PasswordStrength password={form.password} />
                  </div>

                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={e => set('confirmPassword', e.target.value)}
                    error={errors.confirmPassword}
                    icon={<span>🔒</span>}
                    autoComplete="new-password"
                  />

                  {/* OTP channel */}
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Verify account via:</p>
                    <div className="flex gap-2">
                      {(['email', 'sms'] as const).map(ch => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => set('otpChannel', ch)}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all
                            ${form.otpChannel === ch
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-white text-slate-500 border border-blue-200 hover:border-blue-400'}`}
                        >
                          {ch === 'email' ? '📧 Email OTP' : '📱 SMS OTP'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary mt-1 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Creating account...
                      </>
                    ) : 'Create Account →'}
                  </button>
                </form>

                <p className="text-[11px] text-slate-400 text-center mt-4 leading-relaxed">
                  By registering, you agree to VaultLife's{' '}
                  <span className="text-blue-500 cursor-pointer hover:underline">Privacy Policy</span>
                  {' & '}
                  <span className="text-blue-500 cursor-pointer hover:underline">Terms of Use</span>
                </p>
              </div>
            )}

            {/* ── STEP 2: OTP Verification ── */}
            {step === 'otp' && (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center
                                  text-3xl mx-auto mb-3">
                    {form.otpChannel === 'email' ? '📧' : '📱'}
                  </div>
                  <h2 className="font-display text-2xl font-bold text-slate-800 mb-1">
                    Verify Your Account
                  </h2>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    We sent a 6-digit OTP to<br />
                    <span className="font-semibold text-blue-700">{otpState.maskedIdentifier}</span>
                  </p>
                </div>

                {alert && <div className="mb-5"><Alert type={alert.type} message={alert.msg} onClose={() => setAlert(null)} /></div>}

                {/* DEV MODE: show OTP inline */}
                {devOtp && (
                  <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border-2 border-dashed border-amber-300">
                    <p className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                      🛠️ DEV MODE — OTP (remove in production)
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-2xl font-bold text-amber-800 tracking-widest">{devOtp}</span>
                      <button
                        type="button"
                        onClick={() => setOtpState(s => ({ ...s, otp: devOtp }))}
                        className="text-xs px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-800 rounded-lg font-semibold transition-colors"
                      >
                        Auto-fill ↓
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleOTPVerify} className="space-y-5">
                  <div>
                    <label className="field-label text-center block mb-3">Enter 6-Digit OTP</label>
                    <OTPInput
                      value={otpState.otp}
                      onChange={val => { setOtpState(s => ({ ...s, otp: val })); setErrors({}); setAlert(null); }}
                      hasError={!!errors.otp || alert?.type === 'error'}
                      autoFocus
                      disabled={isLoading}
                    />
                    {errors.otp && <p className="text-xs text-red-500 text-center mt-2">⚠ {errors.otp}</p>}
                  </div>

                  <div className="text-center">
                    {!canResend ? (
                      <p className="text-xs text-slate-400">
                        Resend OTP in{' '}
                        <span className="font-mono font-semibold text-blue-600">{formatTimer(otpTimer)}</span>
                      </p>
                    ) : (
                      <button type="button" onClick={handleResendOTP} className="btn-link text-xs">
                        Didn't receive it? Resend OTP
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || otpState.otp.length < 6}
                    className="btn-primary flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Activating vault...
                      </>
                    ) : '✅ Verify & Activate'}
                  </button>

                  <button type="button" onClick={() => { setStep('details'); setAlert(null); }} className="btn-secondary text-sm">
                    ← Back to Details
                  </button>
                </form>
              </div>
            )}

            {/* ── STEP 3: Success ── */}
            {step === 'success' && (
              <div className="animate-fade-in text-center py-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700
                                flex items-center justify-center text-4xl mx-auto mb-5 shadow-blue-glow">
                  🎉
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-800 mb-2">
                  Vault Activated!
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed mb-2">
                  Welcome to VaultLife, <strong className="text-blue-700">{form.fullName.split(' ')[0]}</strong>!<br />
                  Your secure financial vault is ready.
                </p>

                <div className="bg-blue-50 rounded-xl p-4 mb-6 text-left space-y-2">
                  {[
                    '🔐 Store your insurance policies',
                    '🏦 Add your bank accounts',
                    '📈 Track your investments',
                    '👥 Add nominees for emergencies',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
                      <span>{item.slice(0,2)}</span>
                      <span>{item.slice(3)}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary"
                >
                  Enter My Vault →
                </button>
              </div>
            )}
          </div>

          {step !== 'success' && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Already have a vault?{' '}
              <Link to="/login" className="btn-link font-semibold">Sign in →</Link>
            </p>
          )}

          <div className="flex items-center justify-center gap-4 mt-6">
            {['AES-256 Encrypted', 'DPDP Compliant', 'Zero-Knowledge'].map(tag => (
              <div key={tag} className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="text-blue-400">✓</span> {tag}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
