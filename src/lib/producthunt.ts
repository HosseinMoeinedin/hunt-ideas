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
  const token = process.env.PRODUCT_HUNT_TOKEN;
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
        cache: 'no-store',
      },
      GRAPHQL_TIMEOUT_MS
    );

    if (!res.ok) {
      throw new Error(`Product Hunt responded with HTTP ${res.status}`);
    }

    const json = (await res.json()) as { data?: PostsPage; errors?: { message: string }[] };

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0]?.message ?? 'Product Hunt GraphQL error');
    }

    if (!json.data) {
      throw new Error('Product Hunt returned an empty response');
    }

    return json.data;
  };

  try {
    return await attempt();
  } catch {
    await sleep(RETRY_DELAY_MS);
    try {
      return await attempt();
    } catch {
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
 * Product Hunt redirect URLs are resolved with a manual-redirect GET request;
 * returns null when a direct destination cannot be determined.
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
    const res = await fetchWithTimeout(rawUrl, { method: 'GET', redirect: 'manual' }, REDIRECT_TIMEOUT_MS);
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

export async function fetchMonthProducts(offsetRaw: number, now: Date = new Date()): Promise<MonthlyProducts> {
  const period = getPeriod(offsetRaw, now);
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

  return { products, period, scannedCount, sourceUrl };
}

export { getAllPeriods };
