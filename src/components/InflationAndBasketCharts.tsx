import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown, ChevronUp, Edit3, RotateCcw, Search, X } from 'lucide-react';
import {
  basketRecordToSeries,
  BasketYearPoint,
  KNBS_GENERAL_UNIT_BASKET,
  KNBS_MONTHLY_HOUSEHOLD_BASKET,
  KNBS_TABLE_321_ITEMS,
  singleCommodityToBasketRecord,
} from '../data/basketOfGoods';
import { SCHEMA_LIMITS, UserBasketRecord } from '../firebase';
import { formatKes, PurchasingPowerPoint } from '../utils/kenyaTaxAndInflation';

interface InflationAndBasketChartsProps {
  purchasingPowerSeries: PurchasingPowerPoint[];
  netMonthlySalary: number;
  basketRecord: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'> | null;
  hasCustomSavedBasket: boolean;
  onSaveBasket: (
    payload: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onClearBasket: () => Promise<void>;
}

function formatCompactKesAxis(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(val >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(val));
}

export function InflationAndBasketCharts({
  purchasingPowerSeries,
  netMonthlySalary,
  basketRecord,
  hasCustomSavedBasket,
  onSaveBasket,
  onClearBasket,
}: InflationAndBasketChartsProps) {
  const [chartView, setChartView] = useState<'erosion' | 'required'>('erosion');
  const [basketMode, setBasketMode] = useState<'general' | 'household' | 'item' | 'custom'>(
    hasCustomSavedBasket ? 'custom' : 'general'
  );
  const [selectedItemId, setSelectedItemId] = useState<string>('maize_flour_sifted');
  const [showItemTable, setShowItemTable] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  const [basketModalOpen, setBasketModalOpen] = useState(false);
  const [basketName, setBasketName] = useState(
    basketRecord?.basketName || KNBS_GENERAL_UNIT_BASKET.basketName
  );
  const [cost2021, setCost2021] = useState(
    String(basketRecord?.cost2021 ?? KNBS_GENERAL_UNIT_BASKET.cost2021)
  );
  const [cost2022, setCost2022] = useState(
    String(basketRecord?.cost2022 ?? KNBS_GENERAL_UNIT_BASKET.cost2022)
  );
  const [cost2023, setCost2023] = useState(
    String(basketRecord?.cost2023 ?? KNBS_GENERAL_UNIT_BASKET.cost2023)
  );
  const [cost2024, setCost2024] = useState(
    String(basketRecord?.cost2024 ?? KNBS_GENERAL_UNIT_BASKET.cost2024)
  );
  const [cost2025, setCost2025] = useState(
    String(basketRecord?.cost2025 ?? KNBS_GENERAL_UNIT_BASKET.cost2025)
  );
  const [cost2026, setCost2026] = useState(
    String(basketRecord?.cost2026 ?? KNBS_GENERAL_UNIT_BASKET.cost2026)
  );
  const [notes, setNotes] = useState(basketRecord?.notes || KNBS_GENERAL_UNIT_BASKET.notes);
  const [savingBasket, setSavingBasket] = useState(false);
  const [basketError, setBasketError] = useState<string | null>(null);

  const activeBasketRecord = useMemo(() => {
    if (basketMode === 'custom' && basketRecord) {
      return basketRecord;
    }
    if (basketMode === 'household') {
      return KNBS_MONTHLY_HOUSEHOLD_BASKET;
    }
    if (basketMode === 'item') {
      const found =
        KNBS_TABLE_321_ITEMS.find((i) => i.id === selectedItemId) || KNBS_TABLE_321_ITEMS[0];
      return singleCommodityToBasketRecord(found);
    }
    return KNBS_GENERAL_UNIT_BASKET;
  }, [basketMode, basketRecord, selectedItemId]);

  const basketSeries = useMemo(
    () => basketRecordToSeries(activeBasketRecord),
    [activeBasketRecord]
  );

  const cumulativeBasketRisePct = useMemo(() => {
    if (activeBasketRecord.cost2021 <= 0) return 0;
    return (
      Math.round(
        ((activeBasketRecord.cost2026 - activeBasketRecord.cost2021) /
          activeBasketRecord.cost2021) *
          1000
      ) / 10
    );
  }, [activeBasketRecord]);

  const filteredTableItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return KNBS_TABLE_321_ITEMS;
    return KNBS_TABLE_321_ITEMS.filter(
      (item) => item.name.toLowerCase().includes(q) || item.unit.toLowerCase().includes(q)
    );
  }, [itemSearch]);

  const latest2026 = purchasingPowerSeries[purchasingPowerSeries.length - 1];

  const openEditorWithCurrent = () => {
    setBasketName(activeBasketRecord.basketName);
    setCost2021(String(activeBasketRecord.cost2021));
    setCost2022(String(activeBasketRecord.cost2022));
    setCost2023(String(activeBasketRecord.cost2023));
    setCost2024(String(activeBasketRecord.cost2024));
    setCost2025(String(activeBasketRecord.cost2025));
    setCost2026(String(activeBasketRecord.cost2026));
    setNotes(activeBasketRecord.notes);
    setBasketError(null);
    setBasketModalOpen(true);
  };

  const handleBasketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBasketError(null);
    const values = [cost2021, cost2022, cost2023, cost2024, cost2025, cost2026].map((v) =>
      Number(v)
    );
    if (values.some((n) => !Number.isFinite(n) || n < 0)) {
      setBasketError('Please enter valid non-negative KES amounts for all years (2021–2026).');
      return;
    }

    setSavingBasket(true);
    try {
      await onSaveBasket({
        basketName: basketName.trim() || 'Custom Household Basket',
        cost2021: values[0],
        cost2022: values[1],
        cost2023: values[2],
        cost2024: values[3],
        cost2025: values[4],
        cost2026: values[5],
        notes: notes.trim(),
      });
      setBasketMode('custom');
      setBasketModalOpen(false);
    } catch (err) {
      setBasketError(err instanceof Error ? err.message : 'Unable to save basket data.');
    } finally {
      setSavingBasket(false);
    }
  };

  return (
    <section id="graphs" className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        {/* Graph 1: Net Purchasing Power / Real Money Value (2021–2026) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  KNBS & CBK CPI Inflation Series · 2021 Base Year
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Net Purchasing Power & Real Money Value (2021–2026)
                </h2>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0">
                <button
                  type="button"
                  onClick={() => setChartView('erosion')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'erosion'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Real Value (2021 KES)
                </button>
                <button
                  type="button"
                  onClick={() => setChartView('required')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartView === 'required'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Salary Needed
                </button>
              </div>
            </div>

            {latest2026 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                <span>
                  2026 Nominal Net:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {formatKes(latest2026.nominalNetKes)}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>
                  2026 Real Buying Power (2021 KES):{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {formatKes(latest2026.realValue2021Kes)}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span>
                  Value Retained:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {latest2026.retainedValuePct}%
                  </strong>
                </span>
              </div>
            )}
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={purchasingPowerSeries}
                margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="realValueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#047857" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="requiredSalaryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#475569', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompactKesAxis}
                  tick={{ fill: '#475569', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const pt = payload[0].payload as PurchasingPowerPoint;
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-lg shadow-lg text-xs space-y-1.5 max-w-xs">
                        <div className="flex items-center justify-between gap-4 font-semibold border-b border-slate-700 pb-1.5">
                          <span>Year {pt.year}</span>
                          <span className="font-mono tabular-nums text-emerald-300">
                            Inflation: {pt.annualInflationPct}%
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Nominal Net Salary:</span>
                          <span className="font-mono tabular-nums font-semibold">
                            {formatKes(pt.nominalNetKes)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Real Value (2021 KES):</span>
                          <span className="font-mono tabular-nums font-semibold text-emerald-300">
                            {formatKes(pt.realValue2021Kes)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Inflation Erosion:</span>
                          <span className="font-mono tabular-nums text-red-300">
                            -{formatKes(pt.purchasingPowerLostKes)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Pay Needed to Match 2021:</span>
                          <span className="font-mono tabular-nums text-amber-300">
                            {formatKes(pt.requiredNominalToMatch2021Kes)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                          {pt.contextNote}
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend iconType="plainline" />
                <Line
                  type="monotone"
                  dataKey="nominalNetKes"
                  name="Nominal Net Salary (KES)"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
                {chartView === 'erosion' ? (
                  <Area
                    type="monotone"
                    dataKey="realValue2021Kes"
                    name="Real Purchasing Power (2021 Constant KES)"
                    stroke="#047857"
                    strokeWidth={2.5}
                    fill="url(#realValueGradient)"
                    activeDot={{ r: 5 }}
                  />
                ) : (
                  <Area
                    type="monotone"
                    dataKey="requiredNominalToMatch2021Kes"
                    name="Net Pay Needed to Match 2021 Value (KES)"
                    stroke="#D97706"
                    strokeWidth={2.5}
                    fill="url(#requiredSalaryGradient)"
                    activeDot={{ r: 5 }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
            Annual average KNBS CPI inflation rates applied: 2021 (6.1%) · 2022 (7.7%) · 2023 (7.7%)
            · 2024 (4.5%) · 2025 (4.1%) · 2026 (5.8%).
          </p>
        </div>

        {/* Graph 2: Cost of a Basket of Goods (2021–2026) — KNBS Table 3.21 */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-slate-500">
                  KNBS Table 3.21 Retail CPI Goods · 2021–2026
                </p>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  Cost of a Basket of Goods (2021–2026)
                </h2>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={openEditorWithCurrent}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Customize
                </button>
                {hasCustomSavedBasket && (
                  <button
                    type="button"
                    onClick={async () => {
                      await onClearBasket();
                      setBasketMode('general');
                    }}
                    title="Reset to KNBS Table 3.21 Default"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Segmented Basket Lens Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setBasketMode('general')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    basketMode === 'general'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  General Basket (31 Goods)
                </button>
                <button
                  type="button"
                  onClick={() => setBasketMode('household')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    basketMode === 'household'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Monthly Household
                </button>
                <button
                  type="button"
                  onClick={() => setBasketMode('item')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    basketMode === 'item'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Single Item
                </button>
                {hasCustomSavedBasket && (
                  <button
                    type="button"
                    onClick={() => setBasketMode('custom')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      basketMode === 'custom'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Saved Custom
                  </button>
                )}
              </div>

              {basketMode === 'item' && (
                <select
                  aria-label="Select consumer good from KNBS Table 3.21"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 max-w-[230px] truncate"
                >
                  {KNBS_TABLE_321_ITEMS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Clean Unboxed Metadata Strip */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>
                2021:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatKes(activeBasketRecord.cost2021, basketMode === 'item')}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>
                2023*:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatKes(activeBasketRecord.cost2023, basketMode === 'item')}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>
                2026:{' '}
                <strong className="font-mono tabular-nums text-slate-900">
                  {formatKes(activeBasketRecord.cost2026, basketMode === 'item')}
                </strong>
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>
                2021–26 Change:{' '}
                <strong className="font-mono tabular-nums text-red-600">
                  +{cumulativeBasketRisePct}%
                </strong>
              </span>
              {netMonthlySalary > 0 && basketMode !== 'item' && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span>
                    2026 Share of Net Pay:{' '}
                    <strong className="font-mono tabular-nums text-emerald-700">
                      {((activeBasketRecord.cost2026 / netMonthlySalary) * 100).toFixed(1)}%
                    </strong>
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={basketSeries} margin={{ top: 10, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis
                  dataKey="yearLabel"
                  tick={{ fill: '#475569', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatCompactKesAxis}
                  tick={{ fill: '#475569', fontSize: 12, fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const entry = payload[0].payload as BasketYearPoint;
                    return (
                      <div className="bg-slate-900 text-white p-3.5 rounded-lg shadow-lg text-xs space-y-1.5 max-w-xs">
                        <div className="flex items-center justify-between gap-4 font-semibold border-b border-slate-700 pb-1.5">
                          <span>Year {entry.yearLabel}</span>
                          <span className="text-[11px] font-normal text-slate-300">
                            {entry.isProjectedFromCpi ? 'CPI-Indexed' : 'KNBS Table 3.21'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Basket Price:</span>
                          <span className="font-mono tabular-nums font-semibold text-emerald-300">
                            {formatKes(entry.costKes, true)}
                          </span>
                        </div>
                        {entry.year > 2021 && (
                          <div className="flex justify-between gap-4">
                            <span className="text-slate-300">YoY Price Change:</span>
                            <span className="font-mono tabular-nums text-amber-300">
                              {entry.yoyChangePct >= 0 ? '+' : ''}
                              {entry.yoyChangePct}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend />
                <Bar
                  dataKey="costKes"
                  name={`${activeBasketRecord.basketName} (KES)`}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={46}
                >
                  {basketSeries.map((entry) => (
                    <Cell
                      key={entry.year}
                      fill={entry.isProjectedFromCpi ? '#047857' : '#0F172A'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
            <span className="truncate">
              Dark bars: KNBS Table 3.21 retail averages (2021–2023*) · Green bars: CPI-indexed
              (2024–2026)
            </span>
            <button
              type="button"
              onClick={() => setShowItemTable((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showItemTable ? 'Hide 31-Item Table' : 'View All 31 Goods'}
              {showItemTable ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable KNBS Table 3.21 Reference Ledger */}
      {showItemTable && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                KNBS Table 3.21 Consumer Goods Retail Prices (2021–2026, KSh per Unit)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                2021–2023* are direct KNBS annual average retail prices; 2024–2026 apply annual KNBS
                CPI rates (+4.5%, +4.1%, +5.8%).
              </p>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Filter 31 consumer goods..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[420px] overflow-y-auto border-t border-slate-200">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 pr-4 text-left font-semibold">Consumer Good</th>
                  <th className="py-2.5 px-3 text-left font-semibold">Unit</th>
                  <th className="py-2.5 px-3 text-right font-semibold font-mono">2021</th>
                  <th className="py-2.5 px-3 text-right font-semibold font-mono">2022</th>
                  <th className="py-2.5 px-3 text-right font-semibold font-mono">2023*</th>
                  <th className="py-2.5 px-3 text-right font-semibold font-mono text-emerald-800">
                    2024
                  </th>
                  <th className="py-2.5 px-3 text-right font-semibold font-mono text-emerald-800">
                    2025
                  </th>
                  <th className="py-2.5 pl-3 text-right font-semibold font-mono text-emerald-800">
                    2026
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTableItems.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setBasketMode('item');
                    }}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-900">{item.name}</td>
                    <td className="py-2 px-3 text-slate-500">{item.unit}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.p2021.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700">
                      {item.p2022.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 font-semibold">
                      {item.p2023.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {item.p2024.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-emerald-700">
                      {item.p2025.toFixed(2)}
                    </td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums text-emerald-800 font-semibold">
                      {item.p2026.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                <tr>
                  <td className="py-2.5 pr-4">General Basket Total (All 31 Active Goods)</td>
                  <td className="py-2.5 px-3 text-slate-500 font-normal">1 unit each</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {KNBS_GENERAL_UNIT_BASKET.cost2021.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {KNBS_GENERAL_UNIT_BASKET.cost2022.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {KNBS_GENERAL_UNIT_BASKET.cost2023.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                    {KNBS_GENERAL_UNIT_BASKET.cost2024.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-800">
                    {KNBS_GENERAL_UNIT_BASKET.cost2025.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-emerald-800">
                    {KNBS_GENERAL_UNIT_BASKET.cost2026.toLocaleString('en-KE', {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Modal to Customize / Override 2021–2026 Basket of Goods Data */}
      {basketModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="basket-modal-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="basket-modal-title" className="text-lg font-bold text-slate-900">
                  Customize Basket of Goods (2021–2026)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust yearly KES totals to save a personalized household basket alongside the KNBS
                  Table 3.21 presets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBasketModalOpen(false)}
                aria-label="Close modal"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {basketError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {basketError}
              </div>
            )}

            <form onSubmit={handleBasketSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Basket Label
                </label>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.BASKET_NAME_MAX}
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { year: 2021, val: cost2021, set: setCost2021 },
                  { year: 2022, val: cost2022, set: setCost2022 },
                  { year: 2023, val: cost2023, set: setCost2023 },
                  { year: 2024, val: cost2024, set: setCost2024 },
                  { year: 2025, val: cost2025, set: setCost2025 },
                  { year: 2026, val: cost2026, set: setCost2026 },
                ].map((entry) => (
                  <div key={entry.year}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 font-mono">
                      {entry.year} (KES)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={SCHEMA_LIMITS.BASKET_COST_MAX}
                      step="any"
                      required
                      value={entry.val}
                      onChange={(e) => entry.set(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Items Included (Optional)
                </label>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.NOTES_MAX}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBasketModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBasket}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {savingBasket ? 'Saving...' : 'Save Custom Basket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
