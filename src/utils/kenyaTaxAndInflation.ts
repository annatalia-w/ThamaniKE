import { SalaryMode } from '../firebase';

export interface PayeBandBreakdown {
  bandLabel: string;
  ratePct: number;
  taxableSlice: number;
  taxAmount: number;
}

export interface PayrollCalculation {
  inputAmount: number;
  inputMode: SalaryMode;
  grossSalary: number;
  netSalary: number;
  nssfTier1: number;
  nssfTier2: number;
  nssfTotal: number;
  employerNssf: number;
  shif: number;
  housingLevy: number;
  employerHousingLevy: number;
  preTaxDeductionsTotal: number;
  taxableIncome: number;
  payeBands: PayeBandBreakdown[];
  grossPaye: number;
  personalReliefApplied: number;
  preTaxStatutoryTaxSaved: number;
  netPaye: number;
  totalEmployeeDeductions: number;
  effectiveDeductionRatePct: number;
}

// KRA 2025/2026 Statutory Payroll Constants
const NSSF_TIER_1_LIMIT = 9_000;
const NSSF_TIER_2_UPPER_LIMIT = 108_000;
const NSSF_RATE = 0.06;
const SHIF_RATE = 0.0275;
const SHIF_MINIMUM = 300;
const HOUSING_LEVY_RATE = 0.015;
const PERSONAL_RELIEF = 2_400;

function computeRawPaye(taxablePay: number): {
  bands: PayeBandBreakdown[];
  totalGrossPaye: number;
} {
  const bandsConfig = [
    { label: 'First KES 24,000', width: 24_000, rate: 0.1 },
    { label: 'Next KES 8,333 (24,001 – 32,333)', width: 8_333, rate: 0.25 },
    { label: 'Next KES 467,667 (32,334 – 500,000)', width: 467_667, rate: 0.3 },
    { label: 'Next KES 300,000 (500,001 – 800,000)', width: 300_000, rate: 0.325 },
    { label: 'Above KES 800,000', width: Number.POSITIVE_INFINITY, rate: 0.35 },
  ];

  let remaining = Math.max(0, taxablePay);
  let totalGrossPaye = 0;
  const bands: PayeBandBreakdown[] = [];

  for (const cfg of bandsConfig) {
    const slice = Math.min(remaining, cfg.width);
    const tax = slice * cfg.rate;
    bands.push({
      bandLabel: cfg.label,
      ratePct: cfg.rate * 100,
      taxableSlice: slice,
      taxAmount: tax,
    });
    totalGrossPaye += tax;
    remaining = Math.max(0, remaining - slice);
  }

  return { bands, totalGrossPaye };
}

export function calculateFromGross(
  grossInput: number,
  originMode: SalaryMode = 'gross'
): PayrollCalculation {
  const grossSalary = Math.max(0, grossInput);

  if (grossSalary === 0) {
    return {
      inputAmount: 0,
      inputMode: originMode,
      grossSalary: 0,
      netSalary: 0,
      nssfTier1: 0,
      nssfTier2: 0,
      nssfTotal: 0,
      employerNssf: 0,
      shif: 0,
      housingLevy: 0,
      employerHousingLevy: 0,
      preTaxDeductionsTotal: 0,
      taxableIncome: 0,
      payeBands: computeRawPaye(0).bands,
      grossPaye: 0,
      personalReliefApplied: 0,
      preTaxStatutoryTaxSaved: 0,
      netPaye: 0,
      totalEmployeeDeductions: 0,
      effectiveDeductionRatePct: 0,
    };
  }

  // 1. NSSF Tier I & Tier II (6% up to KES 108,000 pensionable earnings)
  const nssfTier1 = Math.min(grossSalary, NSSF_TIER_1_LIMIT) * NSSF_RATE;
  const tier2Earnings = Math.max(
    0,
    Math.min(grossSalary, NSSF_TIER_2_UPPER_LIMIT) - NSSF_TIER_1_LIMIT
  );
  const nssfTier2 = tier2Earnings * NSSF_RATE;
  const nssfTotal = nssfTier1 + nssfTier2;

  // 2. SHIF (2.75% of gross, minimum KES 300, capped at remaining gross if tiny)
  const shif = Math.min(grossSalary, Math.max(SHIF_MINIMUM, grossSalary * SHIF_RATE));

  // 3. Affordable Housing Levy (1.5% of gross)
  const housingLevy = grossSalary * HOUSING_LEVY_RATE;

  // 4. Pre-tax allowable statutory deductions (Tax Laws Amendment Act)
  const preTaxDeductionsTotal = nssfTotal + shif + housingLevy;
  const taxableIncome = Math.max(0, grossSalary - preTaxDeductionsTotal);

  // 5. KRA PAYE progressive bands + Personal Relief (KES 2,400/mo if taxable > 24,000; below 24,000 PAYE is fully relieved)
  const { bands: payeBands, totalGrossPaye: grossPaye } = computeRawPaye(taxableIncome);
  const personalReliefApplied = Math.min(grossPaye, PERSONAL_RELIEF);
  const netPaye = Math.max(0, grossPaye - personalReliefApplied);

  // Compare against hypothetical PAYE without pre-tax SHIF/AHL/NSSF deductibility to show exact tax shield
  const hypotheticalPayeWithoutShield = Math.max(
    0,
    computeRawPaye(grossSalary).totalGrossPaye - PERSONAL_RELIEF
  );
  const preTaxStatutoryTaxSaved = Math.max(0, hypotheticalPayeWithoutShield - netPaye);

  const totalEmployeeDeductions = preTaxDeductionsTotal + netPaye;
  const netSalary = Math.max(0, grossSalary - totalEmployeeDeductions);
  const effectiveDeductionRatePct =
    grossSalary > 0 ? (totalEmployeeDeductions / grossSalary) * 100 : 0;

  return {
    inputAmount: originMode === 'gross' ? grossSalary : netSalary,
    inputMode: originMode,
    grossSalary,
    netSalary,
    nssfTier1,
    nssfTier2,
    nssfTotal,
    employerNssf: nssfTotal,
    shif,
    housingLevy,
    employerHousingLevy: housingLevy,
    preTaxDeductionsTotal,
    taxableIncome,
    payeBands,
    grossPaye,
    personalReliefApplied,
    preTaxStatutoryTaxSaved,
    netPaye,
    totalEmployeeDeductions,
    effectiveDeductionRatePct,
  };
}

export function solveGrossFromNet(targetNet: number): PayrollCalculation {
  const cleanNet = Math.max(0, targetNet);
  if (cleanNet === 0) {
    return calculateFromGross(0, 'net');
  }

  let low = cleanNet;
  let high = Math.max(cleanNet * 2.2 + 1_000, 10_000);
  while (calculateFromGross(high, 'net').netSalary < cleanNet) {
    high *= 2;
  }

  for (let i = 0; i < 64; i++) {
    const mid = (low + high) / 2;
    const computed = calculateFromGross(mid, 'net');
    if (computed.netSalary < cleanNet) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const result = calculateFromGross((low + high) / 2, 'net');
  return {
    ...result,
    inputAmount: cleanNet,
    netSalary: cleanNet,
  };
}

export function computePayrollBreakdown(
  amount: number,
  mode: SalaryMode
): PayrollCalculation {
  return mode === 'gross' ? calculateFromGross(amount, 'gross') : solveGrossFromNet(amount);
}

// KNBS & Central Bank of Kenya Annual Average Inflation Rates (2021–2026)
export interface InflationYearDatum {
  year: number;
  annualInflationPct: number;
  cpiIndex2021Base: number;
  contextNote: string;
}

export const KENYA_INFLATION_SERIES: InflationYearDatum[] = [
  {
    year: 2021,
    annualInflationPct: 6.1,
    cpiIndex2021Base: 100.0,
    contextNote: 'Post-pandemic recovery & global freight cost rebound (Base Year = 100)',
  },
  {
    year: 2022,
    annualInflationPct: 7.7,
    cpiIndex2021Base: 107.7,
    contextNote: 'Global fuel/fertilizer shock & Horn of Africa drought food spike',
  },
  {
    year: 2023,
    annualInflationPct: 7.7,
    cpiIndex2021Base: 115.99,
    contextNote: 'KES depreciation pressures, electricity tariffs & transport costs',
  },
  {
    year: 2024,
    annualInflationPct: 4.5,
    cpiIndex2021Base: 121.21,
    contextNote: 'CBK monetary tightening, stronger shilling & harvest recovery',
  },
  {
    year: 2025,
    annualInflationPct: 4.1,
    cpiIndex2021Base: 126.18,
    contextNote: 'Inflation anchored inside CBK 2.5%–7.5% target band',
  },
  {
    year: 2026,
    annualInflationPct: 5.8,
    cpiIndex2021Base: 133.5,
    contextNote: 'Renewed EPRA pump price & staple food pressures into late 2026',
  },
];

export interface PurchasingPowerPoint {
  year: number;
  annualInflationPct: number;
  cpiIndex: number;
  nominalNetKes: number;
  realValue2021Kes: number;
  purchasingPowerLostKes: number;
  retainedValuePct: number;
  requiredNominalToMatch2021Kes: number;
  contextNote: string;
}

export function calculatePurchasingPowerSeries(
  netMonthlySalary: number
): PurchasingPowerPoint[] {
  const safeNet = Math.max(0, netMonthlySalary);
  return KENYA_INFLATION_SERIES.map((item) => {
    const ratio = 100 / item.cpiIndex2021Base;
    const realValue2021Kes = Math.round(safeNet * ratio);
    const purchasingPowerLostKes = Math.max(0, Math.round(safeNet - realValue2021Kes));
    const requiredNominalToMatch2021Kes = Math.round(
      safeNet * (item.cpiIndex2021Base / 100)
    );
    return {
      year: item.year,
      annualInflationPct: item.annualInflationPct,
      cpiIndex: item.cpiIndex2021Base,
      nominalNetKes: Math.round(safeNet),
      realValue2021Kes,
      purchasingPowerLostKes,
      retainedValuePct: Math.round(ratio * 1000) / 10,
      requiredNominalToMatch2021Kes,
      contextNote: item.contextNote,
    };
  });
}

export type SustainabilityTier = 'low' | 'medium' | 'good';

export interface SpendingBucket {
  category: string;
  sharePct: number;
  amountKes: number;
  guidance: string;
}

export interface SustainabilityAssessment {
  score: number;
  tier: SustainabilityTier;
  statusLabel: string;
  colorHex: string;
  dimensions: {
    label: string;
    score: number;
    maxScore: number;
    summary: string;
  }[];
  basicLifestyleVerdict: string;
  futureSustainabilityVerdict: string;
  povertyRiskVerdict: string;
  headlineAdvice: string;
  priorityGuidance: string;
  investmentRoadmap: string;
  spendingPlan: SpendingBucket[];
  actionRecommendations: {
    title: string;
    detail: string;
  }[];
}

// 2026 Urban / Peri-Urban Kenyan Monthly Cost Benchmarks (KES)
const KENYA_POVERTY_VULNERABILITY_LINE_2026 = 18_500;
const KENYA_BASIC_SINGLE_LIVING_BASKET_2026 = 38_500;
const KENYA_COMFORTABLE_RESILIENT_NET_2026 = 95_000;

export function evaluateFinancialSustainability(
  netMonthlySalary: number,
  real2021EquivalentKes: number
): SustainabilityAssessment {
  const net = Math.max(0, netMonthlySalary);

  // 1. Basic Lifestyle Affordability (0–35 pts)
  let basicScore = 0;
  if (net > 0) {
    if (net <= KENYA_POVERTY_VULNERABILITY_LINE_2026) {
      basicScore = (net / KENYA_POVERTY_VULNERABILITY_LINE_2026) * 12;
    } else if (net <= KENYA_BASIC_SINGLE_LIVING_BASKET_2026) {
      basicScore =
        12 +
        ((net - KENYA_POVERTY_VULNERABILITY_LINE_2026) /
          (KENYA_BASIC_SINGLE_LIVING_BASKET_2026 - KENYA_POVERTY_VULNERABILITY_LINE_2026)) *
          13;
    } else {
      const extraRatio = Math.min(
        1,
        (net - KENYA_BASIC_SINGLE_LIVING_BASKET_2026) / 45_000
      );
      basicScore = 25 + extraRatio * 10;
    }
  }

  // 2. Real Purchasing Power & Inflation Resilience (0–25 pts)
  // Evaluates whether 2026 salary in 2021 constant terms (after 33.5% cumulative price growth) sustains core living
  const realTarget2021 = 36_000;
  let inflationScore = 0;
  if (real2021EquivalentKes > 0) {
    if (real2021EquivalentKes <= realTarget2021) {
      inflationScore = (real2021EquivalentKes / realTarget2021) * 15;
    } else {
      inflationScore =
        15 + Math.min(1, (real2021EquivalentKes - realTarget2021) / 50_000) * 10;
    }
  }

  // 3. Future Savings & Wealth Capacity (0–25 pts)
  const monthlySurplusAboveBasic = Math.max(0, net - KENYA_BASIC_SINGLE_LIVING_BASKET_2026);
  const surplusShare = net > 0 ? monthlySurplusAboveBasic / net : 0;
  const savingsScore = Math.min(25, (surplusShare / 0.42) * 25);

  // 4. Poverty Risk Cushion (0–15 pts)
  let povertyShieldScore = 0;
  if (net > KENYA_POVERTY_VULNERABILITY_LINE_2026) {
    const multiple = net / KENYA_POVERTY_VULNERABILITY_LINE_2026;
    povertyShieldScore = Math.min(15, ((multiple - 1) / 3.5) * 15);
  } else if (net > 0) {
    povertyShieldScore = (net / KENYA_POVERTY_VULNERABILITY_LINE_2026) * 3;
  }

  const rawTotal = basicScore + inflationScore + savingsScore + povertyShieldScore;
  const score = net === 0 ? 0 : Math.min(100, Math.max(1, Math.round(rawTotal)));

  let tier: SustainabilityTier = 'low';
  let statusLabel = 'Low Sustainability · High Vulnerability';
  let colorHex = '#DC2626'; // Crimson Red

  if (score >= 70) {
    tier = 'good';
    statusLabel = 'Strong Sustainability · Future-Resilient';
    colorHex = '#16A34A'; // Emerald Green
  } else if (score >= 40) {
    tier = 'medium';
    statusLabel = 'Moderate Sustainability · Inflation-Pressured';
    colorHex = '#D97706'; // Amber / Yellow
  }

  const basicLifestyleVerdict =
    net >= KENYA_COMFORTABLE_RESILIENT_NET_2026
      ? 'Comfortably covers urban Kenyan housing, nutrition, utilities, and commuter transport with meaningful monthly margin.'
      : net >= KENYA_BASIC_SINGLE_LIVING_BASKET_2026
        ? 'Covers a modest single-household basic lifestyle in urban Kenya (~KES 38,500 benchmark), though family dependents or medical emergencies quickly tighten cash flow.'
        : 'Falls below the ~KES 38,500 urban basic needs benchmark once rent, food staples, tokens, and matatu fares are combined.';

  const futureSustainabilityVerdict =
    score >= 70
      ? 'Sustainable through 2026–2030 provided at least 25%–30% of net pay is compounded in inflation-beating Kenyan assets.'
      : score >= 40
        ? 'At risk of gradual lifestyle erosion if nominal salary stays flat while CPI rises 5%–7% annually; annual income growth or strict surplus investing is essential.'
        : 'Unsustainable long-term without income expansion or shared household cost reduction; cumulative 33.5% price growth since 2021 severely compresses real value.';

  const povertyRiskVerdict =
    net < KENYA_POVERTY_VULNERABILITY_LINE_2026
      ? 'Elevated vulnerability: a single rent hike, food price shock, or out-of-pocket clinic bill risks pushing household cash flow into distress debt.'
      : net < 55_000
        ? 'Low-to-moderate vulnerability: buffered above extreme poverty, but vulnerable to high-interest mobile credit traps without a 3-month emergency reserve.'
        : 'Low poverty risk: substantial cushion above the KNBS vulnerability line, provided fixed debt repayments stay under 30% of net income.';

  let headlineAdvice = '';
  let priorityGuidance = '';
  let investmentRoadmap = '';
  let spendingPlan: SpendingBucket[] = [];
  let actionRecommendations: { title: string; detail: string }[] = [];

  if (tier === 'low') {
    headlineAdvice =
      'Protect cash flow first: prioritize core shelter, nutrition, and transport while eliminating expensive mobile debt.';
    priorityGuidance =
      'Shift immediate priorities away from non-essential subscriptions and high-fee short-term credit (Fuliza, digital mobile loans). Focus on stabilizing fixed monthly costs—especially keeping rent below 30% of take-home pay—and building a starter KES 15,000–30,000 emergency cushion.';
    investmentRoadmap =
      'Before locking money in illiquid assets, direct 5%–10% of every paycheck automatically into a low-minimum CMA-licensed Money Market Fund (MMF starting from KES 100–1,000) so your emergency buffer earns ~11%–14% p.a. instead of losing value to inflation.';
    spendingPlan = [
      {
        category: 'Essential Living (Rent, Food Staples, Utilities, Commute)',
        sharePct: 75,
        amountKes: Math.round(net * 0.75),
        guidance: 'Cap housing + matatu transport under 45% of net pay; buy dry staples (unga, rice, cooking oil, pulses) wholesale.',
      },
      {
        category: 'Emergency Buffer & Debt Elimination',
        sharePct: 15,
        amountKes: Math.round(net * 0.15),
        guidance: 'Clear high-interest mobile overdrafts first, then sweep into a daily-compounding Kenyan MMF.',
      },
      {
        category: 'Personal & Family Necessities',
        sharePct: 10,
        amountKes: Math.round(net * 0.1),
        guidance: 'Strict weekly cash envelope for airtime, personal care, and dependents.',
      },
    ];
    actionRecommendations = [
      {
        title: 'Audit Rent-to-Transport Tradeoff',
        detail:
          'Compare combined rent + daily commuter fare; relocating along lower-fare commuter corridors or sharing housing can free 12%–18% of monthly net income.',
      },
      {
        title: 'Zero Out Roll-Over Mobile Overdrafts',
        detail:
          'Daily access fees on mobile overdrafts compound above 100% APR—wiping out more value than annual CPI inflation.',
      },
      {
        title: 'Automate Micro-MMF Transfers on Payday',
        detail:
          'Even KES 1,500–3,000 saved immediately on payday into a regulated Money Market Fund builds resilience against sudden medical or food spikes.',
      },
      {
        title: 'Focus on Skills & Income Step-Ups',
        detail:
          'Because inflation has raised living costs by 33.5% since 2021, negotiating annual cost-of-living adjustments (COLA) or side consulting is the fastest lever to lift your score above 50.',
      },
    ];
  } else if (tier === 'medium') {
    headlineAdvice =
      'Realign priorities to beat inflation: curb lifestyle creep and lock in a disciplined 20%–25% investment rate.';
    priorityGuidance =
      'Your net pay covers basic Kenyan urban living today, but 2021–2026 inflation has quietly absorbed roughly a quarter of a static salary’s real buying power. Avoid upgrading rent or car expenses when pay rises—channel incremental income into yield-bearing assets.';
    investmentRoadmap =
      'Split your monthly savings between a liquid CMA-regulated Money Market Fund (until you hold 4–6 months of core expenses) and a Tier-1 SASRA-regulated Deposit-Taking SACCO or CBK DhowCSD Treasury Bills to earn positive real returns above Kenya’s 5%–7% inflation.',
    spendingPlan = [
      {
        category: 'Core Essentials (Housing, Groceries, Power, Commute)',
        sharePct: 55,
        amountKes: Math.round(net * 0.55),
        guidance: 'Target rent at <= 28% of net pay and household utilities/food within 27%.',
      },
      {
        category: 'Future Wealth & Inflation Defense (MMF / SACCO)',
        sharePct: 25,
        amountKes: Math.round(net * 0.25),
        guidance: 'Automate payday standing orders into a regulated MMF and SACCO share deposits.',
      },
      {
        category: 'Discretionary Lifestyle & Family Support',
        sharePct: 20,
        amountKes: Math.round(net * 0.2),
        guidance: 'Set a fixed monthly ceiling for dining out, leisure, and extended-family black-tax support.',
      },
    ];
    actionRecommendations = [
      {
        title: 'Build a 4-Month Core Expense Shield',
        detail: `Target an emergency reserve of ~KES ${Math.round(net * 0.55 * 4).toLocaleString()} in a high-yield Money Market Fund so job transitions or medical gaps never force debt.`,
      },
      {
        title: 'Outpace CPI with CBK DhowCSD & SACCO Dividends',
        detail:
          'Idle current-account cash loses ~5%–7% of real value yearly. Regulated MMFs, Treasury Bills (from KES 50,000), and Tier-1 SACCOs preserve and grow real purchasing power.',
      },
      {
        title: 'Use KRA Tax-Exempt Pension Contributions',
        detail:
          'Voluntary registered pension contributions (up to KES 30,000/month inclusive of NSSF) are pre-tax deductible—legally lowering your monthly PAYE at the 30% bracket.',
      },
      {
        title: 'Benchmark Annual Salary Reviews Against Cumulative CPI',
        detail:
          'Track whether your salary raises since 2021 have matched the 33.5% cumulative KNBS CPI increase; bring hard purchasing-power figures to performance reviews.',
      },
    ];
  } else {
    headlineAdvice =
      'Strong financial footing: accelerate long-term wealth compounding and maximize KRA legal tax shelters.';
    priorityGuidance =
      'You comfortably clear Kenya’s basic and middle-income living benchmarks with low poverty risk. Your primary risk is not day-to-day survival, but lifestyle inflation (overspending on depreciating imports, luxury housing, or unbudgeted commitments) instead of converting high cash surplus into long-term income-producing assets.';
    investmentRoadmap =
      'Move beyond cash savings into multi-asset wealth building: maintain 6 months of expenses in a CMA Money Market Fund, allocate long-term capital into CBK Infrastructure Bonds (tax-free interest) & Treasury Bonds via DhowCSD, Tier-1 SACCO deposits, diversified global USD ETFs (to hedge KES currency cycles), and tax-deductible pension schemes.',
    spendingPlan = [
      {
        category: 'Core Lifestyle (Housing, Nutrition, Transport, Utilities)',
        sharePct: 45,
        amountKes: Math.round(net * 0.45),
        guidance: 'Keep fixed living overhead lean (<= 45%) so your lifestyle stays resilient even if inflation spikes.',
      },
      {
        category: 'Long-Term Investments & Asset Compounding',
        sharePct: 35,
        amountKes: Math.round(net * 0.35),
        guidance: 'Deploy across CBK Infrastructure Bonds, MMFs, global index ETFs, and registered retirement funds.',
      },
      {
        category: 'Flexible Lifestyle, Giving & Personal Goals',
        sharePct: 20,
        amountKes: Math.round(net * 0.2),
        guidance: 'Enjoy travel, family support, and personal goals guilt-free after investments clear on payday.',
      },
    ];
    actionRecommendations = [
      {
        title: 'Maximize the KES 30,000/Month Pension Tax Shield',
        detail:
          'Topping up an RBA-registered personal or occupational pension up to the KES 30,000/month statutory cap cuts your taxable pay at 30%–35%, saving thousands in PAYE monthly.',
      },
      {
        title: 'Lock In Tax-Free Real Yields via Infrastructure Bonds',
        detail:
          'Kenyan Infrastructure Bonds (IFBs) via CBK DhowCSD pay withholding-tax-exempt coupons that historically outperform headline KNBS inflation by 4%–7% p.a.',
      },
      {
        title: 'Hedge Currency & Local Inflation Exposure',
        detail:
          'Complement KES fixed-income holdings with USD money market funds or low-cost global equity ETFs to protect multi-decade purchasing power against shilling depreciation cycles.',
      },
      {
        title: 'Claim KRA Insurance Relief Where Eligible',
        detail:
          'Qualifying life, education (>=10 years), or private health policies earn 15% KRA Insurance Relief (up to KES 5,000/month off PAYE) while protecting against catastrophic medical bills beyond SHIF.',
      },
    ];
  }

  return {
    score,
    tier,
    statusLabel,
    colorHex,
    dimensions: [
      {
        label: 'Basic Lifestyle Affordability',
        score: Math.round(basicScore),
        maxScore: 35,
        summary: 'Capacity to cover urban Kenyan housing, food, utilities, and commute.',
      },
      {
        label: 'Inflation & Real-Value Retention',
        score: Math.round(inflationScore),
        maxScore: 25,
        summary: '2026 purchasing power measured in constant 2021 Kenyan Shillings.',
      },
      {
        label: 'Savings & Investment Capacity',
        score: Math.round(savingsScore),
        maxScore: 25,
        summary: 'Monthly investable surplus remaining after essential living costs.',
      },
      {
        label: 'Poverty Shock Cushion',
        score: Math.round(povertyShieldScore),
        maxScore: 15,
        summary: 'Safety margin above the KNBS household vulnerability threshold.',
      },
    ],
    basicLifestyleVerdict,
    futureSustainabilityVerdict,
    povertyRiskVerdict,
    headlineAdvice,
    priorityGuidance,
    investmentRoadmap,
    spendingPlan,
    actionRecommendations,
  };
}

export function formatKes(amount: number, showDecimals = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `KES ${safe.toLocaleString('en-KE', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`;
}
