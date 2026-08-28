import HuntIdeasApp from '@/components/HuntIdeasApp';
import { fetchMonthProducts, getAllPeriods } from '@/lib/producthunt';
import { toPeriodSummary } from '@/lib/period';
import type { ProductsResponse } from '@/lib/types';

// Revalidate periodically rather than on every single request — this is a
// monthly archive, so an hourly refresh keeps it fast while staying current.
export const revalidate = 3600;

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
