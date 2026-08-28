import { NextRequest, NextResponse } from 'next/server';
import {
  fetchMonthProducts,
  getAllPeriods,
  TokenMissingError,
  ProductHuntUpstreamError,
} from '@/lib/producthunt';
import { toPeriodSummary } from '@/lib/period';
import type { ProductsResponse } from '@/lib/types';

// Cache guidance: fresh in the browser for a day, servable from the shared/CDN
// cache for up to a month, with a long stale-while-revalidate window — this is
// a monthly archive that only needs to be refreshed roughly once a month.
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=2592000';

// Give the request enough headroom for GraphQL pagination plus concurrent
// website-redirect resolution — each individual fetch inside has its own
// timeout, but the platform's default function duration is too tight for the
// combined worst case.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const offsetParam = searchParams.get('offset');
  const offsetRaw = offsetParam !== null ? Number.parseInt(offsetParam, 10) : 0;
  const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

  const now = new Date();

  try {
    const { products, period, scannedCount, sourceUrl } = await fetchMonthProducts(offset, now);
    const periods = getAllPeriods(now).map(toPeriodSummary);

    const body: ProductsResponse = {
      products,
      periods,
      activePeriod: toPeriodSummary(period),
      scannedCount,
      sourceUrl,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(body, {
      headers: { 'Cache-Control': CACHE_CONTROL },
    });
  } catch (err) {
    if (err instanceof TokenMissingError) {
      return NextResponse.json(
        { error: 'Product Hunt is not configured on this server.' },
        { status: 503 }
      );
    }

    if (err instanceof ProductHuntUpstreamError) {
      return NextResponse.json(
        { error: 'Product Hunt could not be reached. Try again in a moment.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Product Hunt could not be reached. Try again in a moment.' },
      { status: 502 }
    );
  }
}
