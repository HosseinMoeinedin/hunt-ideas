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
  /**
   * Product Hunt's own launch-gallery image, kept alongside `preview` as a
   * client-side fallback: `preview` points thum.io at Product Hunt's
   * redirect link so it can screenshot wherever it actually leads, but
   * that's out of this app's control (thum.io's own capture infra, not our
   * server, is what's making that request) — if it ever fails to load,
   * ProductCard swaps to this instead of showing a broken image.
   */
  previewFallback: string | null;
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
