import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  User,
} from 'firebase/auth';
import { ArrowRight, Check, Copy, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import nairobiSkylineImg from '../assets/images/nairobi_financial_skyline_1794653899519.jpg';
import { BrandLogo } from './BrandLogo';
import {
  auth,
  FIREBASE_PROJECT_ID,
  googleProvider,
  SalaryMode,
  SCHEMA_LIMITS,
} from '../firebase';

export interface ProfileDraftInput {
  fullName: string;
  company: string;
  workId: string;
  salaryAmount: number;
  salaryType: SalaryMode;
}

interface AuthScreenProps {
  authenticatedUserNeedingOnboarding: User | null;
  initialDraft?: Partial<ProfileDraftInput>;
  onCompleteOnboarding: (draft: ProfileDraftInput) => Promise<void>;
  onEmailSignupPendingDraft: (user: User, draft: ProfileDraftInput) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AuthScreen({
  authenticatedUserNeedingOnboarding,
  initialDraft,
  onCompleteOnboarding,
  onEmailSignupPendingDraft,
  onSignOut,
}: AuthScreenProps) {
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [fullName, setFullName] = useState(
    initialDraft?.fullName || authenticatedUserNeedingOnboarding?.displayName || ''
  );
  const [company, setCompany] = useState(initialDraft?.company || '');
  const [workId, setWorkId] = useState(initialDraft?.workId || '');
  const [email, setEmail] = useState(authenticatedUserNeedingOnboarding?.email || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [salaryAmountStr, setSalaryAmountStr] = useState(
    initialDraft?.salaryAmount ? String(initialDraft.salaryAmount) : ''
  );
  const [salaryType, setSalaryType] = useState<SalaryMode>(
    initialDraft?.salaryType || 'gross'
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerDisabledNotice, setProviderDisabledNotice] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const consoleAuthUrl = `https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/authentication/providers`;

  const validateDraftFields = (): ProfileDraftInput | null => {
    const trimmedName = fullName.trim();
    const trimmedCompany = company.trim();
    const trimmedWorkId = workId.trim();
    const parsedSalary = Number(salaryAmountStr.replace(/,/g, ''));

    if (!trimmedName) {
      setErrorMsg('Please enter your full name.');
      return null;
    }
    if (!trimmedCompany) {
      setErrorMsg('Please enter the company or organization you work at.');
      return null;
    }
    if (!trimmedWorkId) {
      setErrorMsg('Please enter your Work ID.');
      return null;
    }
    if (!SCHEMA_LIMITS.WORK_ID_REGEX.test(trimmedWorkId)) {
      setErrorMsg(
        'Work ID may only include letters, numbers, spaces, hyphens, slashes, or periods.'
      );
      return null;
    }
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setErrorMsg('Please enter a valid monthly salary in KES greater than 0.');
      return null;
    }
    if (parsedSalary > SCHEMA_LIMITS.SALARY_MAX) {
      setErrorMsg('Monthly salary exceeds the maximum supported value.');
      return null;
    }

    return {
      fullName: trimmedName.slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
      company: trimmedCompany.slice(0, SCHEMA_LIMITS.COMPANY_MAX),
      workId: trimmedWorkId.slice(0, SCHEMA_LIMITS.WORK_ID_MAX),
      salaryAmount: Math.round(parsedSalary * 100) / 100,
      salaryType,
    };
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const draft = validateDraftFields();
    if (!draft) return;

    setSubmitting(true);
    try {
      await onCompleteOnboarding(draft);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setProviderDisabledNotice(false);

    const cleanEmail = email.trim();
    if (!cleanEmail || !SCHEMA_LIMITS.EMAIL_REGEX.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (authTab === 'register') {
      const draft = validateDraftFields();
      if (!draft) return;

      setSubmitting(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // Non-fatal if verification email rate-limited
        }
        await onEmailSignupPendingDraft(cred.user, draft);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/operation-not-allowed') {
          setProviderDisabledNotice(true);
          setErrorMsg(
            'Email/Password authentication is not yet enabled in your Firebase project console.'
          );
        } else if (code === 'auth/email-already-in-use') {
          setErrorMsg('An account with this email already exists. Switch to Sign In above.');
        } else if (code === 'auth/weak-password') {
          setErrorMsg('Please choose a stronger password (at least 6 characters).');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Unable to create account.');
        }
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code || '';
        if (code === 'auth/operation-not-allowed') {
          setProviderDisabledNotice(true);
          setErrorMsg(
            'Email/Password authentication is not yet enabled in your Firebase project console.'
          );
        } else if (
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/user-not-found'
        ) {
          setErrorMsg('Invalid email or password. Please check your credentials.');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
        }
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const parsedSalary = Number(salaryAmountStr.replace(/,/g, ''));
      const maybeDraft: ProfileDraftInput | null =
        fullName.trim() &&
        company.trim() &&
        workId.trim() &&
        SCHEMA_LIMITS.WORK_ID_REGEX.test(workId.trim()) &&
        Number.isFinite(parsedSalary) &&
        parsedSalary > 0
          ? {
              fullName: fullName.trim().slice(0, SCHEMA_LIMITS.FULL_NAME_MAX),
              company: company.trim().slice(0, SCHEMA_LIMITS.COMPANY_MAX),
              workId: workId.trim().slice(0, SCHEMA_LIMITS.WORK_ID_MAX),
              salaryAmount: Math.round(parsedSalary * 100) / 100,
              salaryType,
            }
          : null;

      const cred = await signInWithPopup(auth, googleProvider);
      if (maybeDraft) {
        await onEmailSignupPendingDraft(cred.user, maybeDraft);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user') {
        setErrorMsg(err instanceof Error ? err.message : 'Google sign-in could not complete.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyConsoleUrl = async () => {
    try {
      await navigator.clipboard.writeText(consoleAuthUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Ignore clipboard restriction
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <a href="#top" className="whitespace-nowrap shrink-0">
            <BrandLogo size="md" />
          </a>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">KRA PAYE & SHIF Engine</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="whitespace-nowrap shrink-0">2021–2026 KNBS Inflation</span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="whitespace-nowrap shrink-0">Sustainability Index</span>
          </nav>
          <div className="shrink-0">
            {authenticatedUserNeedingOnboarding ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign Out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthTab(authTab === 'register' ? 'login' : 'register')}
                className="px-4 py-2 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {authTab === 'register' ? 'Returning User Sign In' : 'Create New Profile'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main 1440px Two-Column Split */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left Editorial Column */}
        <section className="lg:col-span-5 relative rounded-2xl overflow-hidden min-h-[380px] lg:min-h-[640px] flex flex-col justify-end bg-slate-900">
          {!imgFailed ? (
            <img
              src={nairobiSkylineImg}
              alt="Nairobi Upper Hill and CBD financial skyline at golden hour"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-slate-950/20" />

          <div className="relative z-10 p-8 lg:p-10 space-y-6 text-white">
            <p className="text-xs font-medium text-emerald-300 tracking-wide">
              Kenya Purchasing Power Intelligence · 2021–2026
            </p>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight text-white max-w-md">
              Know what your Kenyan salary really buys across time.
            </h1>
            <p className="text-sm text-slate-200 leading-relaxed max-w-md">
              Calculate exact net take-home pay after KRA PAYE, SHIF, NSSF, and the Affordable
              Housing Levy—then measure your real money value against cumulative inflation from
              2021 through 2026.
            </p>

            <div className="pt-5 border-t border-white/15 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xl font-bold font-mono tabular-nums text-white">+33.5%</p>
                <p className="text-xs text-slate-300 mt-0.5">Cumulative CPI (2021–26)</p>
              </div>
              <div>
                <p className="text-xl font-bold font-mono tabular-nums text-white">2.75%</p>
                <p className="text-xs text-slate-300 mt-0.5">Statutory SHIF Rate</p>
              </div>
              <div>
                <p className="text-xl font-bold font-mono tabular-nums text-white">1.50%</p>
                <p className="text-xs text-slate-300 mt-0.5">Housing Levy Deduction</p>
              </div>
            </div>
          </div>
        </section>

        {/* Right Form Column */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 flex flex-col justify-center">
          {authenticatedUserNeedingOnboarding ? (
            <div className="max-w-xl w-full mx-auto space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-medium text-emerald-700">
                  Signed in as {authenticatedUserNeedingOnboarding.email}
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  Save your employment & salary details
                </h2>
                <p className="text-sm text-slate-600">
                  Enter these once—your salary profile is saved securely so every time you log in,
                  your dashboard loads automatically.
                </p>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={SCHEMA_LIMITS.FULL_NAME_MAX}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Wanjiku Mwangi"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Company / Employer
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={SCHEMA_LIMITS.COMPANY_MAX}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Kenya Commercial Bank"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Work ID
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={SCHEMA_LIMITS.WORK_ID_MAX}
                      value={workId}
                      onChange={(e) => setWorkId(e.target.value)}
                      placeholder="e.g. KCB-2026-418"
                      className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Current Monthly Salary (KES)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={SCHEMA_LIMITS.SALARY_MAX}
                      step="any"
                      required
                      value={salaryAmountStr}
                      onChange={(e) => setSalaryAmountStr(e.target.value)}
                      placeholder="e.g. 120000"
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Salary Type Entered
                  </span>
                  <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSalaryType('gross')}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        salaryType === 'gross'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Gross Salary (Before Tax)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalaryType('net')}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        salaryType === 'net'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Net Salary (Take-Home)
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  {submitting ? 'Saving Profile...' : 'Save Salary Profile & Open Dashboard'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="max-w-xl w-full mx-auto space-y-6">
              {/* Segmented Auth Mode Switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                    {authTab === 'register' ? 'Create your salary profile' : 'Welcome back'}
                  </h2>
                  <p className="text-sm text-slate-600 mt-1">
                    {authTab === 'register'
                      ? 'Save your employment and salary details once for instant access every time you sign in.'
                      : 'Sign in to load your saved Kenyan salary breakdown and purchasing power dashboard.'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('register');
                      setErrorMsg(null);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      authTab === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('login');
                      setErrorMsg(null);
                    }}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      authTab === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
                  <p className="text-sm font-medium text-red-800">{errorMsg}</p>
                  {providerDisabledNotice && (
                    <div className="pt-2 border-t border-red-200/80 space-y-2.5 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">
                        How to enable Email/Password in Firebase Console (takes 30 seconds):
                      </p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-700">
                        <li>Open your project’s Firebase Authentication Sign-in Providers page.</li>
                        <li>
                          Click <strong>Email/Password</strong>, toggle <strong>Enable</strong>, and
                          click <strong>Save</strong>.
                        </li>
                        <li>Return here and submit again—or sign in with Google below right now.</li>
                      </ol>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <a
                          href={consoleAuthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0"
                        >
                          Open Firebase Auth Console
                        </a>
                        <button
                          type="button"
                          onClick={handleCopyConsoleUrl}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {copiedUrl ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              Copied Console URL
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Console Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleEmailAuthSubmit} className="space-y-4">
                {authTab === 'register' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={SCHEMA_LIMITS.FULL_NAME_MAX}
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Brian Otieno"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Company You Work At
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={SCHEMA_LIMITS.COMPANY_MAX}
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="e.g. Safaricom PLC"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Work ID
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={SCHEMA_LIMITS.WORK_ID_MAX}
                          value={workId}
                          onChange={(e) => setWorkId(e.target.value)}
                          placeholder="e.g. SAF-8821"
                          className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Current Monthly Salary (KES)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={SCHEMA_LIMITS.SALARY_MAX}
                          step="any"
                          required
                          value={salaryAmountStr}
                          onChange={(e) => setSalaryAmountStr(e.target.value)}
                          placeholder="e.g. 100000"
                          className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Is this Gross or Net Monthly Salary?
                      </span>
                      <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setSalaryType('gross')}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            salaryType === 'gross'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Gross Salary (Pre-Tax)
                        </button>
                        <button
                          type="button"
                          onClick={() => setSalaryType('net')}
                          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            salaryType === 'net'
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Net Salary (After Tax)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={authTab === 'login' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={SCHEMA_LIMITS.EMAIL_MAX}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.co.ke"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                    />
                  </div>
                  <div className={authTab === 'login' ? 'sm:col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 pr-10 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {submitting
                    ? 'Authenticating...'
                    : authTab === 'register'
                      ? 'Create Account & Save Salary'
                      : 'Sign In to My Dashboard'}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="grow border-t border-slate-200" />
                <span className="shrink-0 mx-3 text-xs text-slate-500">or instant verified sign-in</span>
                <div className="grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.88c2.27-2.09 3.54-5.17 3.54-8.8z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-2.98c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Salary figures and employee PII are encrypted in transit and isolated under
                  owner-only Firestore security rules.
                </span>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
