import { NextRequest, NextResponse } from 'next/server';

// TEMPORARY diagnostic route — not part of the app's feature set. Lets us
// see the actual raw HTTP response Product Hunt's /r/ redirect links give
// back (status, headers, whether a Location is present) from outside this
// sandbox's network restrictions, since Vercel logs aren't otherwise
// readable from here. Delete once website-redirect resolution is confirmed
// working end-to-end.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get('url');
  if (!target) {
    return NextResponse.json({ error: 'pass ?url=<product hunt redirect url>' }, { status: 400 });
  }

  const attempts: Record<string, unknown>[] = [];

  for (const [label, init] of [
    ['manual-no-ua', { method: 'GET', redirect: 'manual' as const }],
    [
      'manual-with-ua',
      {
        method: 'GET',
        redirect: 'manual' as const,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
    ],
    [
      'follow-with-ua',
      {
        method: 'GET',
        redirect: 'follow' as const,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
    ],
  ] as const) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const start = Date.now();
      const res = await fetch(target, { ...init, signal: controller.signal });
      clearTimeout(timer);
      const elapsedMs = Date.now() - start;
      const headersObj: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
      attempts.push({
        label,
        status: res.status,
        statusText: res.statusText,
        url: res.url,
        redirected: res.redirected,
        elapsedMs,
        headers: headersObj,
      });
    } catch (err) {
      attempts.push({ label, error: (err as Error)?.message ?? String(err) });
    }
  }

  return NextResponse.json({ target, attempts });
}
