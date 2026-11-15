import React, { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { SalaryMode, SCHEMA_LIMITS, UserProfileRecord } from '../firebase';

interface ProfileSettingsSectionProps {
  profile: UserProfileRecord;
  email: string | null | undefined;
  canPersistToCloud: boolean;
  onUpdateProfile: (updated: {
    fullName: string;
    company: string;
    workId: string;
    salaryAmount: number;
    salaryType: SalaryMode;
  }) => Promise<void>;
}

export function ProfileSettingsSection({
  profile,
  email,
  canPersistToCloud,
  onUpdateProfile,
}: ProfileSettingsSectionProps) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [company, setCompany] = useState(profile.company);
  const [workId, setWorkId] = useState(profile.workId);
  const [salaryAmountStr, setSalaryAmountStr] = useState(String(profile.salaryAmount));
  const [salaryType, setSalaryType] = useState<SalaryMode>(profile.salaryType);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setFullName(profile.fullName);
    setCompany(profile.company);
    setWorkId(profile.workId);
    setSalaryAmountStr(String(profile.salaryAmount));
    setSalaryType(profile.salaryType);
  }, [
    profile.fullName,
    profile.company,
    profile.workId,
    profile.salaryAmount,
    profile.salaryType,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const parsedSalary = Number(salaryAmountStr);
    if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
      setErrorMsg('Please enter a valid monthly salary greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await onUpdateProfile({
        fullName,
        company,
        workId,
        salaryAmount: parsedSalary,
        salaryType,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="settings"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          Saved Employment & Compensation Record
        </p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          Update Salary & Work Profile
        </h2>
        <p className="text-sm text-slate-600">
          Changes saved here update your default salary automatically for every future login.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.FULL_NAME_MAX}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Work ID</label>
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.WORK_ID_MAX}
              value={workId}
              onChange={(e) => setWorkId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Account Email (Read-Only)
            </label>
            <input
              type="email"
              disabled
              value={email || ''}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Saved Monthly Salary (KES)
            </label>
            <input
              type="number"
              min="1"
              max={SCHEMA_LIMITS.SALARY_MAX}
              step="any"
              required
              value={salaryAmountStr}
              onChange={(e) => setSalaryAmountStr(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">Salary Basis</span>
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
                Gross Pay
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
                Net Pay
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving
              ? 'Updating...'
              : canPersistToCloud
                ? 'Save Updated Salary & Profile'
                : 'Update Session Salary'}
          </button>

          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <Check className="w-4 h-4" />
              {canPersistToCloud
                ? 'Saved to database. Future logins will use this salary.'
                : 'Updated for this session. Verify your email above to sync permanently.'}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
