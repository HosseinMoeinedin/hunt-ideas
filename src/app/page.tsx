import HuntIdeasApp from '@/components/HuntIdeasApp';
import { fetchMonthProducts, getAllPeriods } from '@/lib/producthunt';
import { toPeriodSummary } from '@/lib/period';
import type { ProductsResponse } from '@/lib/types';

// Force this route to render per-request rather than being statically
// generated. The Product Hunt fetch inside producthunt.ts is already cached
// (next: { revalidate: 3600 }), so this doesn't reintroduce the "hits
// Product Hunt on every view" problem — it just prevents a bad moment (an
// upstream failure) from ever getting frozen into a static page and served
// to everyone for the next hour regardless of whether Product Hunt has
// since recovered.
export const dynamic = 'force-dynamic';

// Give the initial server render enough headroom for GraphQL pagination plus
// concurrent website-redirect resolution (each inner fetch has its own
// timeout; this raises the platform's overall function duration ceiling).
export const maxDuration = 60;

const GENERIC_ERROR = 'Product Hunt could not be reached. Try again in a moment.';

export default async function Home() {
  const now = new Date();
  const offset = 0;
  const periods = getAllPeriods(now).map(toPeriodSummary);

  let initialData: ProductsResponse;
  let initialError: string | null = null;

  try {
    const { products, period, scannedCount, sourceUrl } = await fetchMonthProducts(offset, now);
    initialData = {
      products,
      periods,
      activePeriod: toPeriodSummary(period),
      scannedCount,
      sourceUrl,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    initialError = GENERIC_ERROR;
    initialData = {
      products: [],
      periods,
      activePeriod: periods[0],
      scannedCount: 0,
      sourceUrl: `https://www.producthunt.com/leaderboard/monthly/${now.getUTCFullYear()}/${now.getUTCMonth() + 1}`,
      updatedAt: new Date().toISOString(),
    };
  }

  return <HuntIdeasApp initialData={initialData} initialError={initialError} initialOffset={offset} />;
}
