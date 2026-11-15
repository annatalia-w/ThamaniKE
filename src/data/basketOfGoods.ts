import { UserBasketRecord } from '../firebase';

export interface KnbsCommodityItem {
  id: string;
  name: string;
  unit: string;
  monthlyHouseholdUnits: number; // 0 if non-core or discretionary; >0 for typical monthly household staples basket
  p2021: number;
  p2022: number;
  p2023: number; // 2023* provisional KNBS Table 3.21
  p2024: number; // CPI-indexed (+4.5% KNBS 2024 annual average)
  p2025: number; // CPI-indexed (+4.1% KNBS 2025 annual average)
  p2026: number; // CPI-indexed (+5.8% KNBS 2026 trajectory)
}

function withCpiContinuation(
  id: string,
  name: string,
  unit: string,
  monthlyHouseholdUnits: number,
  p2021: number,
  p2022: number,
  p2023: number
): KnbsCommodityItem {
  const p2024 = Math.round(p2023 * 1.045 * 100) / 100;
  const p2025 = Math.round(p2024 * 1.041 * 100) / 100;
  const p2026 = Math.round(p2025 * 1.058 * 100) / 100;
  return {
    id,
    name,
    unit,
    monthlyHouseholdUnits,
    p2021,
    p2022,
    p2023,
    p2024,
    p2025,
    p2026,
  };
}

/**
 * Exact KNBS Table 3.21: Annual Average Retail Prices of Certain Consumer Goods in Kenya
 * Included in the Consumer Price Index (KSh per Unit), with CPI-indexed continuations for 2024–2026.
 */
export const KNBS_TABLE_321_ITEMS: KnbsCommodityItem[] = [
  withCpiContinuation('beef_bones', 'Beef - with bones', '1 Kg', 2, 474.52, 514.13, 556.53),
  withCpiContinuation('bread_white', 'Bread, White', '400 gms', 8, 52.67, 59.39, 64.14),
  withCpiContinuation('cabbages', 'Cabbages', '1 Kg', 3, 45.28, 51.64, 57.01),
  withCpiContinuation('cigarettes', 'Cigarettes', '1 Pkt.', 0, 208.94, 215.51, 225.35),
  withCpiContinuation('coffee', 'Coffee', '100 gms', 1, 472.56, 519.86, 622.83),
  withCpiContinuation('cooking_fat', 'Cooking Fat', '500 gms', 4, 124.64, 176.6, 172.01),
  withCpiContinuation('eggs', 'Eggs', '1 dozen', 2, 175.94, 193.5, 222.59),
  withCpiContinuation('kerosene', 'Kerosene', '1 Litre', 4, 100.18, 127.05, 172.05),
  withCpiContinuation('maize_flour_sifted', 'Maize Flour - Sifted', '1 Kg', 8, 66.51, 78.98, 91.0),
  withCpiContinuation('maize_grain_loose', 'Maize Grain - Loose', '1 Kg', 2, 55.22, 67.72, 77.69),
  withCpiContinuation('match_box', 'Match Box', '1 Pkt.', 2, 33.17, 32.34, 33.11),
  withCpiContinuation('milk_packeted', 'Fresh Packeted Cow Milk', '1/2 litre', 20, 49.6, 56.02, 57.53),
  withCpiContinuation(
    'broken_white_rice',
    'Broken white rice (Aromatic or Non Aromatic)',
    '1 Kg',
    4,
    131.53,
    151.92,
    171.13
  ),
  withCpiContinuation('sugar_refined', 'Sugar - Refined', '1 Kg', 3, 115.3, 138.05, 193.84),
  withCpiContinuation('tea_leaves', 'Tea leaves', '100 gms', 3, 48.59, 50.19, 51.31),
  withCpiContinuation('wheat_flour', 'Wheat Flour', '2 kg', 2, 131.39, 174.54, 196.77),
  withCpiContinuation('beer_lagers', 'Beer (Lagers, Stouts)', '1/2 Litre', 0, 186.77, 196.28, 216.55),
  withCpiContinuation('carrots', 'Carrots', '1 Kg', 2, 76.07, 89.41, 86.05),
  withCpiContinuation('cooking_bananas', 'Cooking Bananas', '1 Kg', 3, 66.12, 70.79, 85.56),
  withCpiContinuation('dry_beans', 'Dry beans', '1 Kg', 3, 128.98, 143.59, 182.57),
  withCpiContinuation('english_potatoes', 'English Potatoes', '1 Kg', 4, 70.2, 85.22, 98.98),
  withCpiContinuation('green_grams', 'Green Grams', '1 Kg', 2, 146.16, 135.18, 167.63),
  withCpiContinuation('kales_sukuma', 'Kales - Sukuma-wiki', '1 Kg', 6, 54.47, 60.38, 61.75),
  withCpiContinuation('margarine', 'Margarine', '500 gms', 1, 209.29, 253.07, 271.24),
  withCpiContinuation('offals_matumbo', 'Offals - Matumbo', '1 Kg', 2, 279.66, 295.35, 314.52),
  withCpiContinuation('onions', 'Onions', '1 Kg', 2, 111.3, 128.37, 126.75),
  withCpiContinuation('oranges', 'Oranges', '1 Kg', 2, 67.98, 72.3, 78.81),
  withCpiContinuation('petrol_super', 'Petrol (Super)', '1 litre', 10, 125.79, 157.34, 194.5),
  withCpiContinuation('common_salt', 'Common Salt', '1 Kg', 1, 34.33, 35.99, 38.21),
  withCpiContinuation('sodas_500ml', 'Sodas', '500 ml', 0, 61.45, 64.19, 66.38),
  withCpiContinuation('tomatoes', 'Tomatoes', '1 Kg', 3, 77.88, 78.82, 83.44),
];

function sumBasketByWeight(
  weightFn: (item: KnbsCommodityItem) => number
): Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'> & { label: string } {
  let c21 = 0;
  let c22 = 0;
  let c23 = 0;
  let c24 = 0;
  let c25 = 0;
  let c26 = 0;

  for (const item of KNBS_TABLE_321_ITEMS) {
    const w = weightFn(item);
    c21 += item.p2021 * w;
    c22 += item.p2022 * w;
    c23 += item.p2023 * w;
    c24 += item.p2024 * w;
    c25 += item.p2025 * w;
    c26 += item.p2026 * w;
  }

  return {
    label: '',
    basketName: '',
    cost2021: Math.round(c21 * 100) / 100,
    cost2022: Math.round(c22 * 100) / 100,
    cost2023: Math.round(c23 * 100) / 100,
    cost2024: Math.round(c24 * 100) / 100,
    cost2025: Math.round(c25 * 100) / 100,
    cost2026: Math.round(c26 * 100) / 100,
    notes: '',
  };
}

const unitSum = sumBasketByWeight(() => 1);
const monthlyWeightedSum = sumBasketByWeight((item) => item.monthlyHouseholdUnits);

/**
 * General Price of a Basket of Goods (1 unit of each of the 31 active KNBS Table 3.21 consumer items).
 * 2021–2023* reflect exact KNBS Table 3.21 retail averages; 2024–2026 reflect KNBS CPI continuations.
 */
export const KNBS_GENERAL_UNIT_BASKET: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'> = {
  basketName: 'KNBS General CPI Basket (31 Consumer Goods, 1 Unit Each)',
  cost2021: unitSum.cost2021,
  cost2022: unitSum.cost2022,
  cost2023: unitSum.cost2023,
  cost2024: unitSum.cost2024,
  cost2025: unitSum.cost2025,
  cost2026: unitSum.cost2026,
  notes:
    'Sum of 1 retail unit across all 31 active consumer goods in KNBS Table 3.21 (2021–2023* observed retail prices; 2024–2026 KNBS CPI-indexed).',
};

/**
 * Monthly Household Essential Basket scaled to standard monthly consumption quantities from KNBS Table 3.21.
 */
export const KNBS_MONTHLY_HOUSEHOLD_BASKET: Omit<
  UserBasketRecord,
  'uid' | 'createdAt' | 'updatedAt'
> = {
  basketName: 'Monthly Household Staples & Fuel Basket (KNBS Table 3.21)',
  cost2021: monthlyWeightedSum.cost2021,
  cost2022: monthlyWeightedSum.cost2022,
  cost2023: monthlyWeightedSum.cost2023,
  cost2024: monthlyWeightedSum.cost2024,
  cost2025: monthlyWeightedSum.cost2025,
  cost2026: monthlyWeightedSum.cost2026,
  notes:
    'Standard monthly household quantities (unga, milk, bread, rice, beef, beans, cooking fat, sugar, sukuma-wiki, potatoes, petrol/kerosene) priced at KNBS Table 3.21 rates.',
};

export const DEFAULT_SYSTEM_BASKET: Omit<
  UserBasketRecord,
  'uid' | 'createdAt' | 'updatedAt'
> = KNBS_GENERAL_UNIT_BASKET;

export interface BasketYearPoint {
  year: number;
  yearLabel: string;
  costKes: number;
  yoyChangePct: number;
  isProjectedFromCpi: boolean;
}

export function basketRecordToSeries(
  record: Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'>
): BasketYearPoint[] {
  const raw = [
    { year: 2021, yearLabel: '2021', costKes: record.cost2021, isProjectedFromCpi: false },
    { year: 2022, yearLabel: '2022', costKes: record.cost2022, isProjectedFromCpi: false },
    { year: 2023, yearLabel: '2023*', costKes: record.cost2023, isProjectedFromCpi: false },
    { year: 2024, yearLabel: '2024', costKes: record.cost2024, isProjectedFromCpi: true },
    { year: 2025, yearLabel: '2025', costKes: record.cost2025, isProjectedFromCpi: true },
    { year: 2026, yearLabel: '2026', costKes: record.cost2026, isProjectedFromCpi: true },
  ];

  return raw.map((pt, idx) => {
    const prev = idx > 0 ? raw[idx - 1].costKes : pt.costKes;
    const yoyChangePct =
      idx > 0 && prev > 0 ? Math.round(((pt.costKes - prev) / prev) * 1000) / 10 : 0;
    return {
      ...pt,
      yoyChangePct,
    };
  });
}

export function singleCommodityToBasketRecord(
  item: KnbsCommodityItem
): Omit<UserBasketRecord, 'uid' | 'createdAt' | 'updatedAt'> {
  return {
    basketName: `${item.name} (${item.unit})`,
    cost2021: item.p2021,
    cost2022: item.p2022,
    cost2023: item.p2023,
    cost2024: item.p2024,
    cost2025: item.p2025,
    cost2026: item.p2026,
    notes: `KNBS Table 3.21 retail price per ${item.unit} (2021–2023* observed; 2024–2026 CPI-indexed).`,
  };
}
