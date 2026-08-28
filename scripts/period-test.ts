import { getAllPeriods, clampOffset, getMinOffset } from '../src/lib/period';
import { fetchMonthProducts, TokenMissingError, ProductHuntUpstreamError } from '../src/lib/producthunt';

async function main() {
  const assertions: [string, boolean][] = [];
  const check = (label: string, ok: boolean) => assertions.push([label, ok]);

  // --- August 2026 (month index 7): Jan..Aug = 8 periods, offsets 0..-7 ---
  {
    const now = new Date('2026-08-15T12:00:00.000Z');
    const periods = getAllPeriods(now);
    check('August: 8 periods (Jan..Aug)', periods.length === 8);
    check('August: first period is offset 0 / "August"', periods[0].offset === 0 && periods[0].shortLabel === 'August');
    check('August: last period is offset -7 / "January"', periods[7].offset === -7 && periods[7].shortLabel === 'January');
    check('August: min offset is -7', getMinOffset(now) === -7);
    check('August: offset clamps future (5) down to 0', clampOffset(5, now) === 0);
    check('August: offset clamps past (-99) up to -7', clampOffset(-99, now) === -7);
    check('August: key format is "monthly:-3"', periods[3].key === 'monthly:-3');
    check('August: full label "August 2026"', periods[0].label === 'August 2026');
  }

  // --- January (month index 0): only 1 period, no negative offsets possible ---
  {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const periods = getAllPeriods(now);
    check('January: exactly 1 period', periods.length === 1);
    check('January: min offset is 0', getMinOffset(now) === 0);
    check('January: offset -3 clamps to 0', clampOffset(-3, now) === 0);
  }

  // --- missing token -> TokenMissingError ---
  {
    delete process.env.PRODUCT_HUNT_TOKEN;
    try {
      await fetchMonthProducts(0, new Date('2026-08-15T00:00:00.000Z'));
      check('missing token throws TokenMissingError', false);
    } catch (err) {
      check('missing token throws TokenMissingError', err instanceof TokenMissingError);
    }
  }

  // --- upstream failure (even after retry) -> ProductHuntUpstreamError ---
  {
    process.env.PRODUCT_HUNT_TOKEN = 'test-token';
    let calls = 0;
    const start = Date.now();
    // @ts-expect-error overriding global fetch for this test
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error('network down');
    };
    try {
      await fetchMonthProducts(0, new Date('2026-08-15T00:00:00.000Z'));
      check('upstream failure throws ProductHuntUpstreamError', false);
    } catch (err) {
      const elapsed = Date.now() - start;
      check('upstream failure throws ProductHuntUpstreamError', err instanceof ProductHuntUpstreamError);
      check('retried exactly once (2 attempts total)', calls === 2);
      check('retried after ~300ms (waited at least 250ms)', elapsed >= 250);
    }
  }

  let failed = 0;
  for (const [label, ok] of assertions) {
    console.log(`${ok ? 'PASS' : 'FAIL'} - ${label}`);
    if (!ok) failed += 1;
  }
  console.log(`\n${assertions.length - failed}/${assertions.length} assertions passed.`);
  if (failed > 0) process.exit(1);
}

main();
