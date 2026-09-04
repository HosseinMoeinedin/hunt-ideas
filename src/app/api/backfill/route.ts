import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import type { ProductsResponse } from '@/lib/types';

// TEMPORARY — one-time backfill helper, not part of the app's feature set.
// Captures a permanent screenshot (via the free, keyless WordPress mshots
// service) for a batch of products from an already-known-good month
// (reuses /api/products for the source list, so it inherits that route's
// caching and Product Hunt handling rather than re-implementing pagination)
// and stores each image in this project's Vercel Blob store. Returns only
// small JSON (URLs + text), never image bytes, so it's safe to read back
// through a tool that isn't built for binary payloads.
//
// Protected by a shared-secret query param since it does real work (calls
// Product Hunt, mshots, and writes to Blob storage) — not a real secret,
// just enough friction that this isn't triggered by accident while it's
// live. Delete this route once the backfill is complete.
const BACKFILL_SECRET = 'hi-backfill-8f2k1m';

function buildMshotsUrl(websiteUrl: string): string {
  return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(websiteUrl)}?w=1200&h=720`;
}

// mshots returns a small "still generating" placeholder image immediately
// on a cache miss, then the real screenshot once it's rendered. There's no
// status field to check — the only signal is that the placeholder is
// small and a real 1200x720 screenshot isn't — so poll a few times and
// keep whatever's biggest once the size clears this threshold.
const PLACEHOLDER_MAX_BYTES = 15_000;
const POLL_ATTEMPTS = 5;
const POLL_DELAY_MS = 4000;

async function captureScreenshot(websiteUrl: string): Promise<{ buffer: Buffer; isPlaceholder: boolean } | null> {
  const url = buildMshotsUrl(websiteUrl);
  let best: Buffer | null = null;

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; hunt-ideas-backfill/1.0)' },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > 0) best = buf;
        if (buf.byteLength > PLACEHOLDER_MAX_BYTES) {
          return { buffer: buf, isPlaceholder: false };
        }
      }
    } catch {
      // network hiccup — fall through and try again
    }
    if (attempt < POLL_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
    }
  }

  return best ? { buffer: best, isPlaceholder: true } : null;
}

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== BACKFILL_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const offset = Number.parseInt(searchParams.get('offset') ?? '-1', 10);
  const start = Number.parseInt(searchParams.get('start') ?? '0', 10);
  const count = Number.parseInt(searchParams.get('count') ?? '10', 10);

  const productsRes = await fetch(`${request.nextUrl.origin}/api/products?offset=${offset}`, { cache: 'no-store' });
  if (!productsRes.ok) {
    return NextResponse.json(
      { error: 'failed to load source product list', status: productsRes.status },
      { status: 502 }
    );
  }
  const data = (await productsRes.json()) as ProductsResponse;
  const slice = data.products.slice(start, start + count);

  const items = await Promise.all(
    slice.map(async (product) => {
      const captured = await captureScreenshot(product.website);
      let storedUrl: string | null = null;

      if (captured) {
        const safeKey = data.activePeriod.key.replace(/[^a-z0-9-]/gi, '-');
        const blob = await put(`product-thumbnails/${safeKey}-${product.id}.jpg`, captured.buffer, {
          access: 'public',
          contentType: 'image/jpeg',
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        storedUrl = blob.url;
      }

      return {
        id: product.id,
        name: product.name,
        tagline: product.tagline,
        category: product.category,
        rank: product.rank,
        launchRank: product.launchRank,
        votes: product.votes,
        website: product.website,
        productHunt: product.productHunt,
        preview: storedUrl ?? product.previewFallback ?? product.preview,
        previewFallback: product.previewFallback,
        capturedOk: Boolean(storedUrl) && !captured?.isPlaceholder,
      };
    })
  );

  return NextResponse.json({
    period: data.activePeriod,
    sourceUrl: data.sourceUrl,
    scannedCount: data.scannedCount,
    totalProducts: data.products.length,
    batchStart: start,
    batchCount: slice.length,
    items,
  });
}
