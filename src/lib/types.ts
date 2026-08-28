export type Product = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  period: string;
  periodKey: string;
  rank: number;
  launchRank: number | null;
  votes: number;
  website: string;
  productHunt: string;
  preview: string;
};

export type PeriodSummary = {
  key: string;
  offset: number;
  label: string;
  shortLabel: string;
};

export type ProductsResponse = {
  products: Product[];
  periods: PeriodSummary[];
  activePeriod: PeriodSummary;
  scannedCount: number;
  sourceUrl: string;
  updatedAt: string;
};

export type ProductsErrorResponse = {
  error: string;
};
