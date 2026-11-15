import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, sendEmailVerification, signOut, User } from 'firebase/auth';
import {
  BarChart3,
  Calculator,
  Compass,
  Gauge,
  LogOut,
  MailCheck,
  Menu,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import { AuthScreen, ProfileDraftInput } from './components/AuthScreen';
import { BrandLogo } from './components/BrandLogo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { InflationAndBasketCharts } from './components/InflationAndBasketCharts';
import { ProfileSettingsSection } from './components/ProfileSettingsSection';
import { SalaryCalculatorSection } from './components/SalaryCalculatorSection';
import { SustainabilityAndAdvice } from './components/SustainabilityAndAdvice';
import { DEFAULT_SYSTEM_BASKET } from './data/basketOfGoods';
import {
  auth,
  clearUserBasket,
  createUserProfileAndPii,
  fetchUserBasket,
  fetchUserProfile,
  SalaryMode,
  saveUserBasket,
  updateUserFullProfile,
  updateUserSalaryOnly,
  UserBasketRecord,
  UserProfileRecord,
} from './firebase';
import {
  calculatePurchasingPowerSeries,
  computePayrollBreakdown,
  evaluateFinancialSustainability,
  formatKes,
} from './utils/kenyaTaxAndInflation';

const PENDING_DRAFT_STORAGE_KEY = 'thamanike_pending_profile_draft';

function readPendingDraft(uid: string): ProfileDraftInput | null {
  try {
    const raw = sessionStorage.getItem(`${PENDING_DRAFT_STORAGE_KEY}_${uid}`);
    if (!raw) return null;
    return JSON.parse(raw) as ProfileDraftInput;
  } catch {
    return null;
  }
}

function writePendingDraft(uid: string, draft: ProfileDraftInput | null) {
  try {
    if (!draft) {
      sessionStorage.removeItem(`${PENDING_DRAFT_STORAGE_KEY}_${uid}`);
    } else {
      sessionStorage.setItem(`${PENDING_DRAFT_STORAGE_KEY}_${uid}`, JSON.stringify(draft));
    }
  } catch {
    // Ignore storage quota restrictions
  }
}

function DashboardShell() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [hasCloudProfile, setHasCloudProfile] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<ProfileDraftInput | null>(null);

  const [activeAmount, setActiveAmount] = useState<number>(0);
  const [activeMode, setActiveMode] = useState<SalaryMode>('gross');

  const [basketRecord, setBasketRecord] = useState<
    Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'> | null
  >(DEFAULT_SYSTEM_BASKET);
  const [hasCloudBasket, setHasCloudBasket] = useState(false);

  const [activeSection, setActiveSection] = useState<string>('calculator');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [verifyingSync, setVerifyingSync] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setProfile(null);
        setHasCloudProfile(false);
        setBasketRecord(DEFAULT_SYSTEM_BASKET);
        setHasCloudBasket(false);
        setAuthReady(true);
        return;
      }

      setLoadingProfile(true);
      try {
        const existingProfile = await fetchUserProfile(user.uid);
        if (existingProfile) {
          setProfile(existingProfile);
          setHasCloudProfile(true);
          setActiveAmount(existingProfile.salaryAmount);
          setActiveMode(existingProfile.salaryType);
          writePendingDraft(user.uid, null);

          const existingBasket = await fetchUserBasket(user.uid);
          if (existingBasket) {
            setBasketRecord(existingBasket);
            setHasCloudBasket(true);
          } else {
            setBasketRecord(DEFAULT_SYSTEM_BASKET);
            setHasCloudBasket(false);
          }
        } else {
          setHasCloudProfile(false);
          const storedDraft = readPendingDraft(user.uid);
          if (storedDraft) {
            setPendingDraft(storedDraft);
            if (user.emailVerified && user.email) {
              const created = await createUserProfileAndPii(user.uid, user.email, storedDraft);
              setProfile(created);
              setHasCloudProfile(true);
              setActiveAmount(created.salaryAmount);
              setActiveMode(created.salaryType);
              writePendingDraft(user.uid, null);
            } else {
              setProfile({
                uid: user.uid,
                ...storedDraft,
              });
              setActiveAmount(storedDraft.salaryAmount);
              setActiveMode(storedDraft.salaryType);
            }
          } else {
            setProfile(null);
          }
        }
      } finally {
        setLoadingProfile(false);
        setAuthReady(true);
      }
    });

    return () => unsub();
  }, []);

  const handleEmailSignupPendingDraft = async (user: User, draft: ProfileDraftInput) => {
    writePendingDraft(user.uid, draft);
    setPendingDraft(draft);

    if (user.emailVerified && user.email) {
      const existing = await fetchUserProfile(user.uid);
      if (!existing) {
        const created = await createUserProfileAndPii(user.uid, user.email, draft);
        setProfile(created);
        setHasCloudProfile(true);
        setActiveAmount(created.salaryAmount);
        setActiveMode(created.salaryType);
      } else {
        setProfile(existing);
        setHasCloudProfile(true);
        setActiveAmount(existing.salaryAmount);
        setActiveMode(existing.salaryType);
      }
      writePendingDraft(user.uid, null);
    } else {
      setProfile({
        uid: user.uid,
        ...draft,
      });
      setHasCloudProfile(false);
      setActiveAmount(draft.salaryAmount);
      setActiveMode(draft.salaryType);
    }
  };

  const handleCompleteOnboarding = async (draft: ProfileDraftInput) => {
    if (!currentUser) return;
    if (currentUser.emailVerified && currentUser.email) {
      const created = await createUserProfileAndPii(currentUser.uid, currentUser.email, draft);
      setProfile(created);
      setHasCloudProfile(true);
      setActiveAmount(created.salaryAmount);
      setActiveMode(created.salaryType);
      writePendingDraft(currentUser.uid, null);
    } else {
      writePendingDraft(currentUser.uid, draft);
      setPendingDraft(draft);
      setProfile({
        uid: currentUser.uid,
        ...draft,
      });
      setHasCloudProfile(false);
      setActiveAmount(draft.salaryAmount);
      setActiveMode(draft.salaryType);
    }
  };

  const handleCheckEmailVerificationAndSync = async () => {
    if (!auth.currentUser || !profile) return;
    setVerifyingSync(true);
    setVerifyFeedback(null);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setCurrentUser({ ...auth.currentUser } as User);

      if (auth.currentUser.emailVerified && auth.currentUser.email) {
        const created = await createUserProfileAndPii(auth.currentUser.uid, auth.currentUser.email, {
          fullName: profile.fullName,
          company: profile.company,
          workId: profile.workId,
          salaryAmount: profile.salaryAmount,
          salaryType: profile.salaryType,
        });
        setProfile(created);
        setHasCloudProfile(true);
        writePendingDraft(auth.currentUser.uid, null);
        setVerifyFeedback('Email verified and salary profile synced permanently to cloud storage.');
      } else {
        setVerifyFeedback(
          'Your email is not marked verified yet. Click the link sent to your inbox, then press Sync Now.'
        );
      }
    } catch (err) {
      setVerifyFeedback(err instanceof Error ? err.message : 'Unable to refresh verification status.');
    } finally {
      setVerifyingSync(false);
    }
  };

  const handleSaveSalaryFromCalculator = async (amount: number, mode: SalaryMode) => {
    if (!currentUser || !profile) return;
    if (currentUser.emailVerified && hasCloudProfile) {
      await updateUserSalaryOnly(currentUser.uid, amount, mode);
    }
    const updatedProfile: UserProfileRecord = {
      ...profile,
      salaryAmount: amount,
      salaryType: mode,
    };
    setProfile(updatedProfile);
    if (!hasCloudProfile) {
      writePendingDraft(currentUser.uid, {
        fullName: updatedProfile.fullName,
        company: updatedProfile.company,
        workId: updatedProfile.workId,
        salaryAmount: updatedProfile.salaryAmount,
        salaryType: updatedProfile.salaryType,
      });
    }
  };

  const handleUpdateFullProfile = async (updated: {
    fullName: string;
    company: string;
    workId: string;
    salaryAmount: number;
    salaryType: SalaryMode;
  }) => {
    if (!currentUser) return;
    if (currentUser.emailVerified && hasCloudProfile) {
      const saved = await updateUserFullProfile(currentUser.uid, updated);
      setProfile(saved);
    } else if (currentUser.emailVerified && !hasCloudProfile && currentUser.email) {
      const created = await createUserProfileAndPii(currentUser.uid, currentUser.email, updated);
      setProfile(created);
      setHasCloudProfile(true);
      writePendingDraft(currentUser.uid, null);
    } else {
      const localRecord: UserProfileRecord = { uid: currentUser.uid, ...updated };
      setProfile(localRecord);
      writePendingDraft(currentUser.uid, updated);
    }
    setActiveAmount(updated.salaryAmount);
    setActiveMode(updated.salaryType);
  };

  const handleSaveBasket = async (
    payload: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'>
  ) => {
    if (currentUser && currentUser.emailVerified && hasCloudProfile) {
      const saved = await saveUserBasket(currentUser.uid, payload, hasCloudBasket);
      setBasketRecord(saved);
      setHasCloudBasket(true);
    } else {
      setBasketRecord(payload);
    }
  };

  const handleClearBasket = async () => {
    if (currentUser && currentUser.emailVerified && hasCloudProfile && hasCloudBasket) {
      await clearUserBasket(currentUser.uid);
      setHasCloudBasket(false);
    }
    setBasketRecord(DEFAULT_SYSTEM_BASKET);
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const payroll = useMemo(
    () => computePayrollBreakdown(activeAmount, activeMode),
    [activeAmount, activeMode]
  );

  const purchasingPowerSeries = useMemo(
    () => calculatePurchasingPowerSeries(payroll.netSalary),
    [payroll.netSalary]
  );

  const assessment = useMemo(() => {
    const val2026In2021 =
      purchasingPowerSeries[purchasingPowerSeries.length - 1]?.realValue2021Kes ?? 0;
    return evaluateFinancialSustainability(payroll.netSalary, val2026In2021);
  }, [payroll.netSalary, purchasingPowerSeries]);

  const jumpToSection = (id: string) => {
    setActiveSection(id);
    setMobileNavOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Loading Skeleton State
  if (!authReady || loadingProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="h-5 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-3.5 w-64 bg-slate-100 rounded animate-pulse" />
          <div className="pt-2 space-y-2.5">
            <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated OR Authenticated without saved profile
  if (!currentUser || !profile) {
    return (
      <AuthScreen
        authenticatedUserNeedingOnboarding={currentUser}
        initialDraft={pendingDraft || undefined}
        onCompleteOnboarding={handleCompleteOnboarding}
        onEmailSignupPendingDraft={handleEmailSignupPendingDraft}
        onSignOut={handleSignOut}
      />
    );
  }

  const canPersistToCloud = Boolean(currentUser.emailVerified && hasCloudProfile);

  const navItems = [
    { id: 'calculator', label: 'Salary & Tax Calculator', icon: Calculator },
    { id: 'graphs', label: 'Purchasing Power & Basket', icon: BarChart3 },
    { id: 'score', label: 'Sustainability Score', icon: Gauge },
    { id: 'advice', label: 'Financial Guidance', icon: Compass },
    { id: 'settings', label: 'Update Saved Salary', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar Navigation (260px Workspace Canvas) */}
      <aside className="hidden lg:flex lg:w-[264px] lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-6 py-4 border-b border-slate-200">
          <BrandLogo size="md" />
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => jumpToSection(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Employee Identity Summary & Sign Out */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-slate-900 truncate">{profile.fullName}</p>
            <p className="text-xs text-slate-500 truncate">
              {profile.company} · <span className="font-mono">{profile.workId}</span>
            </p>
            <p className="text-xs font-mono tabular-nums text-emerald-700 font-semibold pt-1">
              Saved: {formatKes(profile.salaryAmount)} ({profile.salaryType})
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] bg-white h-full flex flex-col justify-between p-5 z-10">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <BrandLogo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  aria-label="Close navigation"
                  className="p-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => jumpToSection(item.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg whitespace-nowrap cursor-pointer"
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 lg:pl-[264px] flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, 1 Primary Action on Right */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-500 truncate">
              <span className="font-semibold text-slate-900 whitespace-nowrap">Workspace</span>
              <span aria-hidden="true">/</span>
              <span className="truncate text-slate-700">{profile.company}</span>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="hidden sm:inline font-mono text-xs text-slate-500">
                {profile.workId}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => jumpToSection('settings')}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Change Saved Salary
          </button>
        </header>

        <main className="flex-1 max-w-[1220px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
          {/* Email Verification Cloud Sync Banner (only shown for unverified Email/Password signups) */}
          {!currentUser.emailVerified && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-sm">
                  <MailCheck className="w-4 h-4 shrink-0" />
                  <span>Verify your email to sync your salary profile across devices</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Zero-trust cloud rules require a verified email before persisting records to
                  Firestore. Check <strong>{currentUser.email}</strong> for your verification link,
                  then click Sync Now.
                </p>
                {verifyFeedback && (
                  <p className="text-xs font-medium text-slate-900 pt-1">{verifyFeedback}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (auth.currentUser) {
                      void sendEmailVerification(auth.currentUser);
                      setVerifyFeedback('Verification email re-sent.');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-white border border-amber-300 hover:bg-amber-100/50 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Resend Email
                </button>
                <button
                  type="button"
                  disabled={verifyingSync}
                  onClick={handleCheckEmailVerificationAndSync}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${verifyingSync ? 'animate-spin' : ''}`} />
                  {verifyingSync ? 'Checking...' : 'Sync Now'}
                </button>
              </div>
            </div>
          )}

          {/* Top KPI Strip */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-0 lg:divide-x lg:divide-slate-200">
            <div className="lg:pr-6">
              <p className="text-xs text-slate-500">Employee & ID</p>
              <p className="text-base font-bold text-slate-900 mt-1 truncate">{profile.fullName}</p>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {profile.company} · <span className="font-mono">{profile.workId}</span>
              </p>
            </div>

            <div className="lg:px-6">
              <p className="text-xs text-slate-500">Net Monthly Take-Home</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatKes(Math.round(payroll.netSalary))}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Gross: {formatKes(Math.round(payroll.grossSalary))}
              </p>
            </div>

            <div className="lg:px-6">
              <p className="text-xs text-slate-500">2026 Value in 2021 KES</p>
              <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatKes(
                  purchasingPowerSeries[purchasingPowerSeries.length - 1]?.realValue2021Kes ?? 0
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                -25.1% real CPI erosion since 2021
              </p>
            </div>

            <div className="lg:pl-6">
              <p className="text-xs text-slate-500">Sustainability Score</p>
              <p
                className={`text-xl font-bold font-mono tabular-nums mt-1 ${
                  assessment.tier === 'good'
                    ? 'text-green-600'
                    : assessment.tier === 'medium'
                      ? 'text-amber-600'
                      : 'text-red-600'
                }`}
              >
                {assessment.score} / 100
              </p>
              <p className="text-xs text-slate-600 mt-0.5 truncate">{assessment.statusLabel}</p>
            </div>
          </div>

          {/* 2. Gross-to-Net Salary Calculator & Tax Remissions Dropdown */}
          <SalaryCalculatorSection
            activeAmount={activeAmount}
            activeMode={activeMode}
            savedAmount={profile.salaryAmount}
            savedMode={profile.salaryType}
            payroll={payroll}
            canPersistToCloud={true}
            onChangeCalculator={(amt, mode) => {
              setActiveAmount(amt);
              setActiveMode(mode);
            }}
            onSaveSalaryToProfile={handleSaveSalaryFromCalculator}
          />

          {/* 3. Two Graphs: Purchasing Power (2021–2026) & Cost of a Basket of Goods */}
          <InflationAndBasketCharts
            purchasingPowerSeries={purchasingPowerSeries}
            netMonthlySalary={payroll.netSalary}
            basketRecord={basketRecord}
            hasCustomSavedBasket={hasCloudBasket}
            onSaveBasket={handleSaveBasket}
            onClearBasket={handleClearBasket}
          />

          {/* 4 & 5. Salary Score (0–100) + Financial Advice */}
          <SustainabilityAndAdvice
            assessment={assessment}
            netMonthlySalary={payroll.netSalary}
          />

          {/* Future Salary & Profile Update Section */}
          <ProfileSettingsSection
            profile={profile}
            email={currentUser.email}
            canPersistToCloud={canPersistToCloud}
            onUpdateProfile={handleUpdateFullProfile}
          />

          <footer className="py-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <span>ThamaniKE · Kenyan Salary & Purchasing Power Tracker (2021–2026)</span>
            <span>
              Statutory calculations reflect KRA PAYE, SHIF (2.75%), NSSF Tier I/II & AHL (1.5%).
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardShell />
    </ErrorBoundary>
  );
}
