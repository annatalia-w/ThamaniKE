import React from 'react';
import { AlertCircle, CheckCircle2, TriangleAlert } from 'lucide-react';
import { formatKes, SustainabilityAssessment } from '../utils/kenyaTaxAndInflation';

interface SustainabilityAndAdviceProps {
  assessment: SustainabilityAssessment;
  netMonthlySalary: number;
}

export function SustainabilityAndAdvice({
  assessment,
  netMonthlySalary,
}: SustainabilityAndAdviceProps) {
  const radius = 62;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (assessment.score / 100) * circumference;

  const StatusIcon =
    assessment.tier === 'good'
      ? CheckCircle2
      : assessment.tier === 'medium'
        ? TriangleAlert
        : AlertCircle;

  const statusTextColorClass =
    assessment.tier === 'good'
      ? 'text-green-700'
      : assessment.tier === 'medium'
        ? 'text-amber-700'
        : 'text-red-700';

  const scoreNumColorClass =
    assessment.tier === 'good'
      ? 'text-green-600'
      : assessment.tier === 'medium'
        ? 'text-amber-600'
        : 'text-red-600';

  const barFillClass =
    assessment.tier === 'good'
      ? 'fill-green-600'
      : assessment.tier === 'medium'
        ? 'fill-amber-600'
        : 'fill-red-600';

  const ringStrokeClass =
    assessment.tier === 'good'
      ? 'stroke-green-600'
      : assessment.tier === 'medium'
        ? 'stroke-amber-600'
        : 'stroke-red-600';

  return (
    <div className="space-y-6">
      {/* Module 4: Financial Sustainability / Salary Score (0–100) */}
      <section
        id="score"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-medium text-slate-500">
              Kenyan Cost-of-Living & Purchasing Power Diagnostic
            </p>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              Financial Sustainability Score
            </h2>
            <p className="text-sm text-slate-600">
              Evaluates basic lifestyle affordability, real 2021–2026 purchasing power retention,
              investable monthly surplus, and household poverty shock protection.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
            <span className="text-red-700 font-medium">0–39 Low (Red)</span>
            <span aria-hidden="true">·</span>
            <span className="text-amber-700 font-medium">40–69 Medium (Yellow)</span>
            <span aria-hidden="true">·</span>
            <span className="text-green-700 font-medium">70–100 Good (Green)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          {/* Color-Coded Circular Gauge */}
          <div className="lg:col-span-4 flex flex-col items-center text-center space-y-3">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="w-40 h-40 -rotate-90" viewBox="0 0 148 148" aria-hidden="true">
                <circle
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  className="stroke-slate-100"
                  strokeWidth="12"
                />
                <circle
                  cx="74"
                  cy="74"
                  r={radius}
                  fill="none"
                  className={ringStrokeClass}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold font-mono tabular-nums ${scoreNumColorClass}`}>
                  {assessment.score}
                </span>
                <span className="text-xs font-mono text-slate-400">/ 100</span>
              </div>
            </div>

            <div className={`inline-flex items-center gap-1.5 text-sm font-bold ${statusTextColorClass}`}>
              <StatusIcon className="w-4 h-4 shrink-0" />
              <span>{assessment.statusLabel}</span>
            </div>
          </div>

          {/* 4 Sub-Dimensions Breakdown */}
          <div className="lg:col-span-8 space-y-4">
            {assessment.dimensions.map((dim) => {
              const pct = Math.min(100, Math.round((dim.score / dim.maxScore) * 100));
              return (
                <div key={dim.label} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-900">{dim.label}</span>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
                      {dim.score} / {dim.maxScore} pts
                    </span>
                  </div>
                  <svg
                    className="w-full h-2 rounded-full overflow-hidden block"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <rect x="0" y="0" width="100" height="8" className="fill-slate-100" />
                    <rect x="0" y="0" width={pct} height="8" className={barFillClass} />
                  </svg>
                  <p className="text-xs text-slate-500">{dim.summary}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Direct Diagnostic Answers Separated by Hairline Dividers */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-slate-200">
          <div className="md:pr-6 space-y-1.5">
            <h3 className="text-xs font-bold text-slate-900">
              Can you afford a basic lifestyle?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {assessment.basicLifestyleVerdict}
            </p>
          </div>
          <div className="md:px-6 space-y-1.5">
            <h3 className="text-xs font-bold text-slate-900">
              Will this sustain your lifestyle in the future?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {assessment.futureSustainabilityVerdict}
            </p>
          </div>
          <div className="md:pl-6 space-y-1.5">
            <h3 className="text-xs font-bold text-slate-900">Poverty & Vulnerability Risk</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              {assessment.povertyRiskVerdict}
            </p>
          </div>
        </div>
      </section>

      {/* Module 5: Tailored Financial Advice & Kenyan Spending Guidance */}
      <section
        id="advice"
        className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8"
      >
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs font-medium text-slate-500">
            Personalized Guidance Based on {formatKes(Math.round(netMonthlySalary))} Monthly Net
            Pay & Score ({assessment.score}/100)
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {assessment.headlineAdvice}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Recommended Monthly Spending Allocation Table */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Recommended Monthly Spending Allocation
            </h3>
            <div className="divide-y divide-slate-200 border-t border-b border-slate-200">
              {assessment.spendingPlan.map((bucket) => (
                <div key={bucket.category} className="py-4 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-semibold text-slate-900">{bucket.category}</span>
                    <span className="text-sm font-bold font-mono tabular-nums text-slate-900 shrink-0">
                      {formatKes(bucket.amountKes)}{' '}
                      <span className="text-xs font-normal text-slate-500">
                        ({bucket.sharePct}%)
                      </span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{bucket.guidance}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-slate-900">
                Should You Shift Spending Priorities?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {assessment.priorityGuidance}
              </p>
            </div>
          </div>

          {/* Right: Savings, Investments & Concrete Action Plan */}
          <div className="lg:col-span-6 space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-900">
                Saving & Investing for the Future in Kenya
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {assessment.investmentRoadmap}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                Priority Action Steps for Your Income Bracket
              </h3>
              <div className="space-y-4">
                {assessment.actionRecommendations.map((step, idx) => (
                  <div key={step.title} className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      0{idx + 1}. {step.title}
                    </p>
                    <p className="text-xs text-slate-600 leading-relaxed">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
