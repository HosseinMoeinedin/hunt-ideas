import { unstable_cache } from 'next/cache';
import { getPeriod, getAllPeriods, type Period } from './period';
import type { Product } from './types';

export class TokenMissingError extends Error {
  constructor(message = 'PRODUCT_HUNT_TOKEN is not configured') {
    super(message);
    this.name = 'TokenMissingError';
  }
}

export class ProductHuntUpstreamError extends Error {
  constructor(message = 'Unable to reach Product Hunt') {
    super(message);
    this.name = 'ProductHuntUpstreamError';
  }
}

const PH_ENDPOINT = 'https://api.producthunt.com/v2/api/graphql';
const PAGE_SIZE = 20;
const MAX_PAGES = 50;
const MAX_PRODUCTS = 30;
const REDIRECT_CONCURRENCY = 4;
const RETRY_DELAY_MS = 300;
const GRAPHQL_TIMEOUT_MS = 8000;
const REDIRECT_TIMEOUT_MS = 4000;
// Sent on the website-redirect-resolution request. Without a browser-like
// User-Agent, Product Hunt's /r/ redirect links were returning a response
// with no way to tell where they actually go — every single resolution was
// silently failing and falling back to Product Hunt's own thumbnail. A
// normal browser UA is the fix.
const REDIRECT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// How long Next.js may serve a cached raw Product Hunt GraphQL response
// before re-fetching, as a defensive backstop. The real protection for the
// rate limit is the application-level cache below (unstable_cache), which
// caches the ENTIRE result — GraphQL data plus resolved websites — as one
// unit, so a cache hit makes zero outbound requests at all, not just zero
// GraphQL requests.
const GRAPHQL_CACHE_SECONDS = 3600;

// Current month: its cache key changes every UTC hour (period.ts rounds the
// "end" boundary down to the hour), so this just has to be long enough to
// span at least one hour without expiring mid-hour and forcing an extra
// refetch of an identical query.
const CURRENT_MONTH_CACHE_SECONDS = 3600;
// Past months: the query window (postedAfter/postedBefore) is fixed and
// never changes once the month is over, so there is nothing to "get fresh"
// by refetching — the same 30ish products with (very occasionally) a vote
// count that ticked up. Cache these for a month.
const PAST_MONTH_CACHE_SECONDS = 60 * 60 * 24 * 30;

// Bump this when a code change alters what a cache HIT would have returned
// (e.g. fixing resolveWebsite). Vercel's Data Cache (what unstable_cache
// uses) persists across deployments — a new deploy does NOT itself
// invalidate the old cached output — so without this, a fix like that would
// silently sit unused behind the old cached result for up to
// PAST_MONTH_CACHE_SECONDS (30 days) before anyone actually saw it.
const CACHE_VERSION = 'v2';

/** fetch() with a hard timeout so one slow/hanging request can't stall the whole serverless invocation. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const POSTS_QUERY = `
  query MonthlyFeaturedPosts($postedAfter: DateTime!, $postedBefore: DateTime!, $after: String) {
    posts(
      order: RANKING
      featured: true
      postedAfter: $postedAfter
      postedBefore: $postedBefore
      first: ${PAGE_SIZE}
      after: $after
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          tagline
          url
          website
          votesCount
          dailyRank
          media {
            url
          }
          topics(first: 3) {
            edges {
              node {
                name
              }
            }
          }
        }
      }
    }
  }
`;

type RawTopicEdge = { node: { name: string } | null } | null;

type RawPost = {
  id: string;
  name: string;
  tagline: string | null;
  url: string | null;
  website: string | null;
  votesCount: number | null;
  dailyRank: number | null;
  media: { url: string | null }[] | null;
  topics: { edges: RawTopicEdge[] | null } | null;
};

type PostsPage = {
  posts: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: RawPost | null }[];
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function phRequest(variables: Record<string, unknown>): Promise<PostsPage> {
  // Trim defensively — a stray trailing newline/space from copy-pasting the
  // token into a host's environment-variable UI is a common, hard-to-spot
  // cause of "worked once, fails after" style bugs.
  const token = process.env.PRODUCT_HUNT_TOKEN?.trim();
  if (!token) {
    throw new TokenMissingError();
  }

  const attempt = async (): Promise<PostsPage> => {
    const res = await fetchWithTimeout(
      PH_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query: POSTS_QUERY, variables }),
        // Let Next.js cache this response for a while instead of hitting
        // Product Hunt on every page view — see GRAPHQL_CACHE_SECONDS.
        next: { revalidate: GRAPHQL_CACHE_SECONDS },
      },
      GRAPHQL_TIMEOUT_MS
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '<unreadable body>');
      const rateLimitInfo = [
        res.headers.get('x-rate-limit-remaining') && `remaining=${res.headers.get('x-rate-limit-remaining')}`,
        res.headers.get('x-rate-limit-reset') && `reset=${res.headers.get('x-rate-limit-reset')}`,
        res.headers.get('retry-after') && `retry-after=${res.headers.get('retry-after')}`,
      ]
        .filter(Boolean)
        .join(' ');
      console.error(
        `[producthunt] HTTP ${res.status} ${res.statusText}${rateLimitInfo ? ` (${rateLimitInfo})` : ''} — body: ${bodyText.slice(0, 500)}`
      );
      const err = new Error(`Product Hunt responded with HTTP ${res.status}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const json = (await res.json()) as { data?: PostsPage; errors?: { message: string }[] };

    if (json.errors && json.errors.length > 0) {
      console.error(`[producthunt] GraphQL errors: ${JSON.stringify(json.errors).slice(0, 500)}`);
      throw new Error(json.errors[0]?.message ?? 'Product Hunt GraphQL error');
    }

    if (!json.data) {
      throw new Error('Product Hunt returned an empty response');
    }

    return json.data;
  };

  try {
    return await attempt();
  } catch (firstErr) {
    const status = (firstErr as Error & { status?: number })?.status;
    console.error(`[producthunt] first attempt failed: ${(firstErr as Error)?.message ?? firstErr}`);

    // A 4xx (rate limit, bad auth, etc.) won't be fixed by retrying 300ms
    // later — it just burns another request against the same limit. Only
    // retry on transient failures (network errors, 5xx, timeouts).
    if (status && status >= 400 && status < 500) {
      throw new ProductHuntUpstreamError();
    }

    await sleep(RETRY_DELAY_MS);
    try {
      return await attempt();
    } catch (secondErr) {
      console.error(`[producthunt] retry failed: ${(secondErr as Error)?.message ?? secondErr}`);
      throw new ProductHuntUpstreamError();
    }
  }
}

async function fetchRawPosts(period: Period): Promise<{ posts: RawPost[]; scannedCount: number }> {
  const postedAfter = period.start.toISOString();
  const postedBefore = period.end.toISOString();

  let after: string | null = null;
  let page = 0;
  let scannedCount = 0;
  const byId = new Map<string, RawPost>();

  while (page < MAX_PAGES) {
    const data = await phRequest({ postedAfter, postedBefore, after });
    const edges = data.posts?.edges ?? [];
    scannedCount += edges.length;

    for (const edge of edges) {
      const node = edge?.node;
      if (node?.id && !byId.has(node.id)) {
        byId.set(node.id, node);
      }
    }

    page += 1;
    const pageInfo = data.posts?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) {
      break;
    }
    after = pageInfo.endCursor;
  }

  return { posts: Array.from(byId.values()), scannedCount };
}

/**
 * Resolves a single website URL. Non-Product-Hunt URLs are returned unchanged.
 * Product Hunt redirect URLs are resolved by reading the `Location` header
 * off a single manual (not followed) request to Product Hunt's own /r/
 * link — never the destination site — so this only ever waits on Product
 * Hunt's own server, not on however fast or slow ~30 different real
 * third-party websites happen to be. Returns null when a direct destination
 * can't be determined.
 *
 * Two earlier versions of this tried to reach the ACTUAL destination site
 * (GET then HEAD with `redirect: 'follow'`) to be tolerant of multi-hop
 * redirect chains. Both were caught live turning offset=0 into consistent
 * 502s on a cold cache: waiting on ~30 real websites' response times,
 * even batched, was too slow for the function's time budget. This
 * single-hop version is a smaller fix than that — it won't follow a
 * SECOND redirect hop if Product Hunt's own link chains through one — but
 * it's the version that was actually reliable in production; the User-Agent
 * header below is the real fix for why resolution was failing at all.
 */
async function resolveWebsite(rawUrl: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!parsed.hostname.endsWith('producthunt.com')) {
    return rawUrl;
  }

  try {
    const res = await fetchWithTimeout(
      rawUrl,
      {
        method: 'GET',
        redirect: 'manual',
        headers: {
          'User-Agent': REDIRECT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      REDIRECT_TIMEOUT_MS
    );
    const location = res.headers.get('location');
    if (!location) return null;

    const resolved = new URL(location, rawUrl);
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}

/** Resolves a list of website URLs with at most `REDIRECT_CONCURRENCY` requests in flight at once. */
async function resolveWebsitesConcurrently(urls: (string | null)[]): Promise<(string | null)[]> {
  const results = new Array<string | null>(urls.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const index = cursor;
      cursor += 1;
      const url = urls[index];
      results[index] = url ? await resolveWebsite(url) : null;
    }
  }

  const workerCount = Math.min(REDIRECT_CONCURRENCY, urls.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function buildScreenshotUrl(websiteUrl: string): string {
  return `https://image.thum.io/get/width/1200/crop/720/noanimate/${websiteUrl}`;
}

export type MonthlyProducts = {
  products: Product[];
  period: Period;
  scannedCount: number;
  sourceUrl: string;
};

/**
 * The cache-friendly return shape: `period.start`/`period.end` are Dates,
 * which do not round-trip through the cache's JSON serialization as Dates —
 * they'd come back as plain strings on a cache hit, silently breaking
 * anything that called `.toISOString()` on them. Nothing downstream needs
 * those two fields (only `toPeriodSummary`'s key/offset/label/shortLabel
 * are used outside this module), so the cached shape just omits them and
 * `fetchMonthProducts` reattaches the real Date objects the caller passed
 * in before returning.
 */
type CachedMonthlyProducts = {
  products: Product[];
  period: Omit<Period, 'start' | 'end'>;
  scannedCount: number;
  sourceUrl: string;
};

/**
 * Does the actual work: paginate Product Hunt, filter/sort/cap, resolve
 * every product's real website (the ~20-30 extra HTTP round-trips that were
 * previously NOT cached at all and re-run on every single page view). Takes
 * only plain serializable arguments — not a `Period` with `Date` fields —
 * because these arguments are exactly what `unstable_cache` hashes into the
 * cache key, and they need to be deterministic and cache-friendly.
 */
async function fetchMonthProductsUncached(
  periodKey: string,
  startISO: string,
  endISO: string,
  year: number,
  month: number,
  label: string,
  shortLabel: string,
  offset: number
): Promise<CachedMonthlyProducts> {
  // Only runs on a genuine cache MISS (unstable_cache short-circuits this
  // entirely on a hit) — logging it lets a cache-hit vs. cache-miss
  // discrepancy between routes (e.g. "/" failing while "/api/products"
  // succeeds for the identical period) actually be seen in the logs instead
  // of guessed at.
  console.log(`[producthunt] cache MISS — running full pipeline for ${periodKey} (${startISO} to ${endISO})`);
  const period: Period = {
    key: periodKey,
    offset,
    label,
    shortLabel,
    year,
    month,
    start: new Date(startISO),
    end: new Date(endISO),
  };

  const { posts, scannedCount } = await fetchRawPosts(period);

  const withUrls = posts.filter((post): post is RawPost & { url: string; website: string } =>
    Boolean(post.url && post.website)
  );

  withUrls.sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0));
  const top = withUrls.slice(0, MAX_PRODUCTS);

  const resolvedWebsites = await resolveWebsitesConcurrently(top.map((post) => post.website));

  const products: Product[] = top.map((post, index) => {
    const officialWebsite = resolvedWebsites[index];
    const finalWebsite = officialWebsite ?? post.website;
    const fallbackMedia = post.media?.[0]?.url ?? null;

    const preview = officialWebsite
      ? buildScreenshotUrl(officialWebsite)
      : fallbackMedia ?? buildScreenshotUrl(finalWebsite);

    const topicEdges = post.topics?.edges ?? [];
    const category = topicEdges[0]?.node?.name || 'Other';

    return {
      id: post.id,
      name: post.name,
      tagline: post.tagline ?? '',
      category,
      period: period.label,
      periodKey: period.key,
      rank: index + 1,
      launchRank: post.dailyRank ?? null,
      votes: post.votesCount ?? 0,
      website: finalWebsite,
      productHunt: post.url,
      preview,
    };
  });

  const sourceUrl = `https://www.producthunt.com/leaderboard/monthly/${period.year}/${period.month}`;

  return { products, period: { key: periodKey, offset, label, shortLabel, year, month }, scannedCount, sourceUrl };
}

// Two separate `unstable_cache` instances (rather than one shared instance
// with a variable `revalidate`) so the current month and past months can
// have different cache lifetimes — see CURRENT_MONTH_CACHE_SECONDS /
// PAST_MONTH_CACHE_SECONDS above. Each one is Next's explicit,
// application-level cache: a cache hit runs none of this module's code at
// all (no GraphQL request, no website-redirect resolution), which is what
// actually delivers "fetch once, then serve everyone from cache."
const getCachedCurrentMonth = unstable_cache(
  fetchMonthProductsUncached,
  ['hunt-ideas-month-products', 'current', CACHE_VERSION],
  { revalidate: CURRENT_MONTH_CACHE_SECONDS }
);
const getCachedPastMonth = unstable_cache(
  fetchMonthProductsUncached,
  ['hunt-ideas-month-products', 'past', CACHE_VERSION],
  { revalidate: PAST_MONTH_CACHE_SECONDS }
);

export async function fetchMonthProducts(offsetRaw: number, now: Date = new Date()): Promise<MonthlyProducts> {
  const period = getPeriod(offsetRaw, now);
  const getCached = period.offset === 0 ? getCachedCurrentMonth : getCachedPastMonth;

  const cached = await getCached(
    period.key,
    period.start.toISOString(),
    period.end.toISOString(),
    period.year,
    period.month,
    period.label,
    period.shortLabel,
    period.offset
  );

  // Reattach the real Date objects (see CachedMonthlyProducts) rather than
  // relying on whatever the cache handed back for them.
  return { ...cached, period: { ...cached.period, start: period.start, end: period.end } };
}

/**
 * Bypasses the `unstable_cache` wrapper and runs the pipeline directly.
 * `unstable_cache` requires a live Next.js request context (it throws
 * "incrementalCache missing" outside one), which standalone test scripts
 * don't have — so tests exercise this instead of `fetchMonthProducts`. It
 * runs the exact same pipeline; the only thing it skips is the caching.
 */
export async function fetchMonthProductsForTesting(offsetRaw: number, now: Date = new Date()): Promise<MonthlyProducts> {
  const period = getPeriod(offsetRaw, now);
  const result = await fetchMonthProductsUncached(
    period.key,
    period.start.toISOString(),
    period.end.toISOString(),
    period.year,
    period.month,
    period.label,
    period.shortLabel,
    period.offset
  );
  return { ...result, period: { ...result.period, start: period.start, end: period.end } };
}

export { getAllPeriods };
