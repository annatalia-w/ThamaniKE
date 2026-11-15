import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, RotateCcw, Save } from 'lucide-react';
import { SalaryMode, SCHEMA_LIMITS } from '../firebase';
import { formatKes, PayrollCalculation } from '../utils/kenyaTaxAndInflation';

interface SalaryCalculatorSectionProps {
  activeAmount: number;
  activeMode: SalaryMode;
  savedAmount: number;
  savedMode: SalaryMode;
  payroll: PayrollCalculation;
  canPersistToCloud: boolean;
  onChangeCalculator: (amount: number, mode: SalaryMode) => void;
  onSaveSalaryToProfile: (amount: number, mode: SalaryMode) => Promise<void>;
}

export function SalaryCalculatorSection({
  activeAmount,
  activeMode,
  savedAmount,
  savedMode,
  payroll,
  canPersistToCloud,
  onChangeCalculator,
  onSaveSalaryToProfile,
}: SalaryCalculatorSectionProps) {
  const [dropdownOpen, setDropdownOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasUnsavedAdjustment =
    Math.round(activeAmount) !== Math.round(savedAmount) || activeMode !== savedMode;

  const handleSaveSalary = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveSalaryToProfile(activeAmount, activeMode);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not update saved salary.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      id="calculator"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-500">
            KRA 2025/2026 Payroll Model · PAYE, SHIF, NSSF & Affordable Housing Levy
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Gross-to-Net Salary Calculator & Tax Remissions
          </h2>
        </div>

        {/* Interactive Mode Selector */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
          <button
            type="button"
            onClick={() => onChangeCalculator(Math.round(payroll.grossSalary), 'gross')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'gross'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Input Gross Salary
          </button>
          <button
            type="button"
            onClick={() => onChangeCalculator(Math.round(payroll.netSalary), 'net')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeMode === 'net'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Input Net Salary
          </button>
        </div>
      </div>

      {/* Input & Live Headline Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 items-end">
        <div className="lg:col-span-5 space-y-2">
          <label
            htmlFor="salary-calc-input"
            className="block text-xs font-semibold text-slate-700"
          >
            {activeMode === 'gross'
              ? 'Monthly Gross Salary (Before Tax, KES)'
              : 'Monthly Net Salary (Take-Home Pay, KES)'}
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-slate-400">
              KES
            </span>
            <input
              id="salary-calc-input"
              type="number"
              min="0"
              max={SCHEMA_LIMITS.SALARY_MAX}
              step="500"
              value={activeAmount || ''}
              onChange={(e) => {
                const val = Number(e.target.value);
                onChangeCalculator(Number.isFinite(val) && val >= 0 ? val : 0, activeMode);
              }}
              placeholder="0"
              className="w-full pl-13 pr-4 py-3 text-lg font-bold font-mono tabular-nums text-slate-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {hasUnsavedAdjustment && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {canPersistToCloud && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSalary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save as My Current Salary'}
                </button>
              )}
              <button
                type="button"
                onClick={() => onChangeCalculator(savedAmount, savedMode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Saved ({formatKes(savedAmount)})
              </button>
            </div>
          )}

          {saveSuccess && (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <Check className="w-3.5 h-3.5" />
              Saved to your profile for future logins.
            </p>
          )}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>

        {/* 3 Clean Output Figures Separated by Hairline Borders */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-0 sm:divide-x sm:divide-slate-200 pt-2 lg:pt-0">
          <div className="sm:pr-6">
            <p className="text-xs text-slate-500">Monthly Gross Pay</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatKes(Math.round(payroll.grossSalary))}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Taxable: <span className="font-mono tabular-nums">{formatKes(Math.round(payroll.taxableIncome))}</span>
            </p>
          </div>

          <div className="sm:px-6">
            <p className="text-xs text-slate-500">Total Deductions & PAYE</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {formatKes(Math.round(payroll.totalEmployeeDeductions))}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
              {payroll.effectiveDeductionRatePct.toFixed(1)}% effective rate
            </p>
          </div>

          <div className="sm:pl-6">
            <p className="text-xs font-semibold text-emerald-700">Net Take-Home Salary</p>
            <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
              {formatKes(Math.round(payroll.netSalary))}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Relief saved: <span className="font-mono tabular-nums">{formatKes(Math.round(payroll.personalReliefApplied + payroll.preTaxStatutoryTaxSaved))}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Dropdown Menu: Tax Remissions & Statutory Deductions Breakdown */}
      <div className="pt-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-expanded={dropdownOpen}
          className="w-full flex items-center justify-between gap-4 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors text-left cursor-pointer"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Tax Remissions & Statutory Deductions Breakdown
            </span>
            <span aria-hidden="true" className="text-slate-300">
              ·
            </span>
            <span className="text-xs text-slate-600 font-mono tabular-nums">
              PAYE {formatKes( payroll.netPaye, true )} · SHIF {formatKes( payroll.shif, true )} · AHL{' '}
              {formatKes( payroll.housingLevy, true )} · NSSF {formatKes( payroll.nssfTotal, true )}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0">
            {dropdownOpen ? 'Hide Breakdown' : 'Show Breakdown'}
            {dropdownOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </span>
        </button>

        {dropdownOpen && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
            {/* Left Half: Statutory Deductions & Tax Remissions */}
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                1. Pre-Tax Statutory Deductions & Tax Remissions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 text-left font-medium">Statutory Item</th>
                      <th className="py-2 text-left font-medium">Rate / Rule</th>
                      <th className="py-2 text-right font-medium">Monthly Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 text-slate-800 font-medium">
                        SHIF (Social Health Insurance Fund)
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">2.75% of Gross (min 300)</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        -{formatKes(payroll.shif, true)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 text-slate-800 font-medium">
                        Affordable Housing Levy (AHL)
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">1.50% of Gross</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        -{formatKes(payroll.housingLevy, true)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 text-slate-800 font-medium">
                        NSSF Pension (Tier I + Tier II)
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">6% capped at KES 108,000</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        -{formatKes(payroll.nssfTotal, true)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/70 font-semibold">
                      <td className="py-2.5 text-slate-900" colSpan={2}>
                        Taxable Income (Gross minus Pre-Tax Deductions)
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {formatKes(payroll.taxableIncome, true)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 text-emerald-800 font-medium">
                        KRA Personal Tax Relief (Remission)
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">Monthly statutory credit</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        +{formatKes(payroll.personalReliefApplied, true)}
                      </td>
                    </tr>
                    <tr className="hover:bg-slate-50/70">
                      <td className="py-2.5 text-emerald-800 font-medium">
                        Pre-Tax Deduction PAYE Shield
                      </td>
                      <td className="py-2.5 text-xs text-slate-500">Tax saved via SHIF/AHL/NSSF</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        +{formatKes(payroll.preTaxStatutoryTaxSaved, true)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Employer additionally remits matching NSSF ({formatKes(payroll.employerNssf, true)})
                and Employer Housing Levy ({formatKes(payroll.employerHousingLevy, true)}) to KRA by
                the 9th of the following month.
              </p>
            </div>

            {/* Right Half: KRA Progressive PAYE Bands */}
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                2. KRA PAYE Progressive Tax Band Calculation
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs text-slate-500">
                      <th className="py-2 text-left font-medium">Monthly Tax Band</th>
                      <th className="py-2 text-right font-medium">Rate</th>
                      <th className="py-2 text-right font-medium">Taxed Amount</th>
                      <th className="py-2 text-right font-medium">Band Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payroll.payeBands.map((band) => (
                      <tr key={band.bandLabel} className="hover:bg-slate-50/70">
                        <td className="py-2.5 text-slate-800">{band.bandLabel}</td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-500">
                          {band.ratePct}%
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-700">
                          {formatKes(band.taxableSlice, false)}
                        </td>
                        <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                          {formatKes(band.taxAmount, true)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-slate-200">
                      <td className="py-2 text-slate-600" colSpan={3}>
                        Gross PAYE Before Relief
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-slate-700">
                        {formatKes(payroll.grossPaye, true)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 text-emerald-700" colSpan={3}>
                        Less: Monthly Personal Relief
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-emerald-700">
                        -{formatKes(payroll.personalReliefApplied, true)}
                      </td>
                    </tr>
                    <tr className="bg-slate-50/80 font-bold">
                      <td className="py-2.5 text-slate-900" colSpan={3}>
                        Net PAYE Remitted to KRA
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-slate-900">
                        {formatKes(payroll.netPaye, true)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
