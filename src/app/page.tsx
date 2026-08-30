import HuntIdeasApp from '@/components/HuntIdeasApp';
import { getAllPeriods } from '@/lib/producthunt';
import { toPeriodSummary } from '@/lib/period';
import type { ProductsResponse } from '@/lib/types';

// This page does no data fetching of its own — see the note on
// HuntIdeasApp's initial-load effect for why. getAllPeriods() below is pure
// date math (no network), so this could be static, but force-dynamic is
// kept so the month list is always computed against the real current date
// rather than whatever date happened to be baked in at build time.
export const dynamic = 'force-dynamic';

export default function Home() {
  const now = new Date();
  const offset = 0;
  const periods = getAllPeriods(now).map(toPeriodSummary);

  // Deliberately empty: HuntIdeasApp fetches /api/products itself on mount,
  // the exact same way it already does when the visitor switches months.
  // An earlier version had this page fetch the first month's data directly
  // (server-side, via the same lib/producthunt.ts pipeline the API route
  // uses) so the page would arrive pre-populated. In production that
  // server-rendered path failed consistently while /api/products, called
  // moments apart with identical arguments, kept succeeding — two supposedly
  // identical code paths behaving differently in a way that pointed at a
  // caching/bundling discrepancy between the page and the route handler,
  // not at Product Hunt itself. Routing every load (including the first)
  // through the one HTTP endpoint that's actually proven reliable removes
  // that discrepancy by construction, at the cost of a brief skeleton flash
  // on first paint instead of pre-rendered product cards.
  const emptyData: ProductsResponse = {
    products: [],
    periods,
    activePeriod: periods[0],
    scannedCount: 0,
    sourceUrl: `https://www.producthunt.com/leaderboard/monthly/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}`,
    updatedAt: new Date().toISOString(),
  };

  return <HuntIdeasApp initialData={emptyData} initialError={null} initialOffset={offset} />;
}
