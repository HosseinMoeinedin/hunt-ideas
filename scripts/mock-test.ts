/**
 * Standalone integration test that exercises fetchMonthProducts() against a
 * mocked fetch implementation, since this sandbox's network egress does not
 * allow reaching api.producthunt.com directly. This proves out pagination,
 * dedup, filtering, sorting, and screenshot/fallback-URL construction before
 * deploying to a host with normal internet access.
 *
 * This app no longer tries to resolve Product Hunt's redirect links to a
 * real destination server-side (Product Hunt's Cloudflare protection
 * blocks that outright — see the comment above buildScreenshotUrl in
 * lib/producthunt.ts) — so there's no redirect-following fetch left to
 * mock; `website` is used exactly as Product Hunt's API returns it.
 */
process.env.PRODUCT_HUNT_TOKEN = 'test-token';

type FakeNode = {
  id: string;
  name: string;
  tagline: string;
  url: string | null;
  website: string | null;
  votesCount: number;
  dailyRank: number | null;
  media: { url: string }[];
  topics: { edges: { node: { name: string } }[] };
};

function makeNode(overrides: Partial<FakeNode> & { id: string; votesCount: number }): FakeNode {
  return {
    name: `Product ${overrides.id}`,
    tagline: `Tagline for ${overrides.id}`,
    url: `https://www.producthunt.com/posts/${overrides.id}`,
    website: `https://direct-${overrides.id}.example.com`,
    dailyRank: 3,
    media: [{ url: `https://ph-media.example.com/${overrides.id}.png` }],
    topics: { edges: [{ node: { name: 'Productivity' } }] },
    ...overrides,
  };
}

// --- page 1: 20 posts, one missing a website (should be filtered) ---
const page1Nodes: FakeNode[] = Array.from({ length: 20 }, (_, i) => {
  const id = `p${i + 1}`;
  if (id === 'p5') {
    return makeNode({ id, votesCount: 100 - i, website: null });
  }
  if (id === 'p1') {
    // Product Hunt redirect-style URL — kept as-is now, handed straight to
    // thum.io rather than resolved server-side first.
    return makeNode({ id, votesCount: 100 - i, website: 'https://redirect.producthunt.com/r/p1' });
  }
  return makeNode({ id, votesCount: 100 - i });
});

// --- page 2: 15 posts, including 2 duplicates of page 1 (should dedupe) ---
const page2Nodes: FakeNode[] = [
  ...Array.from({ length: 13 }, (_, i) => makeNode({ id: `p${21 + i}`, votesCount: 60 - i })),
  makeNode({ id: 'p1', votesCount: 999 }), // duplicate id, different votes — first-seen should win
  makeNode({ id: 'p3', votesCount: 999 }),
];

let requestCount = 0;

async function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  if (url === 'https://api.producthunt.com/v2/api/graphql') {
    requestCount += 1;
    const body = JSON.parse((init?.body as string) ?? '{}');
    const after = body.variables?.after ?? null;

    if (init?.headers && (init.headers as Record<string, string>)['Authorization'] !== 'Bearer test-token') {
      throw new Error('missing bearer token');
    }

    const nodes = after === 'cursor-1' ? page2Nodes : page1Nodes;
    const hasNextPage = after !== 'cursor-1';

    return new Response(
      JSON.stringify({
        data: {
          posts: {
            pageInfo: { hasNextPage, endCursor: hasNextPage ? 'cursor-1' : null },
            edges: nodes.map((node) => ({ node })),
          },
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  throw new Error(`Unexpected fetch to ${url}`);
}

// @ts-expect-error - overriding global fetch for this test run
globalThis.fetch = mockFetch;

async function main() {
  const { fetchMonthProductsForTesting } = await import('../src/lib/producthunt.ts');
  const now = new Date('2026-08-15T12:00:00.000Z');

  const result = await fetchMonthProductsForTesting(0, now);

  const assertions: [string, boolean][] = [
    ['made exactly 2 paginated requests', requestCount === 2],
    ['scannedCount is 35 (20 + 15 raw edges)', result.scannedCount === 35],
    ['product count is <= 30', result.products.length <= 30],
    [
      'products are sorted by votes descending',
      result.products.every((p, i) => i === 0 || result.products[i - 1].votes >= p.votes),
    ],
    ['p5 (no website) was filtered out', !result.products.some((p) => p.id === 'p5')],
    [
      'duplicate p1 kept first-seen votes (100), not the page-2 duplicate (999)',
      result.products.find((p) => p.id === 'p1')?.votes === 100,
    ],
    [
      'duplicate p3 kept first-seen votes (98), not the page-2 duplicate (999)',
      result.products.find((p) => p.id === 'p3')?.votes === 98,
    ],
    [
      'p1 (a Product Hunt redirect link) is kept as-is, not resolved server-side',
      result.products.find((p) => p.id === 'p1')?.website === 'https://redirect.producthunt.com/r/p1',
    ],
    [
      'p1 preview is a thum.io screenshot URL built directly from that redirect link',
      result.products.find((p) => p.id === 'p1')?.preview ===
        'https://image.thum.io/get/width/1200/crop/720/noanimate/https://redirect.producthunt.com/r/p1',
    ],
    [
      "p1's previewFallback carries Product Hunt's own launch image, for ProductCard to fall back to client-side",
      result.products.find((p) => p.id === 'p1')?.previewFallback === 'https://ph-media.example.com/p1.png',
    ],
    [
      'a normal direct-website product builds a thum.io preview from its own website',
      result.products.find((p) => p.id === 'p10')?.preview ===
        'https://image.thum.io/get/width/1200/crop/720/noanimate/https://direct-p10.example.com',
    ],
    ['category falls back to the first topic name', result.products.find((p) => p.id === 'p10')?.category === 'Productivity'],
    ['sourceUrl points at the August 2026 monthly leaderboard', result.sourceUrl === 'https://www.producthunt.com/leaderboard/monthly/2026/8'],
    ['period label is "August 2026"', result.period.label === 'August 2026'],
    ['rank number is present but not meant for display (internal only)', result.products[0]?.rank === 1],
  ];

  let failed = 0;
  for (const [label, ok] of assertions) {
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
    if (!ok) failed += 1;
  }

  console.log(`\n${assertions.length - failed}/${assertions.length} assertions passed.`);
  if (failed > 0) {
    console.log('\nFull result for debugging:');
    console.dir(result, { depth: 4 });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test script threw:', err);
  process.exit(1);
});
