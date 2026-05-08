import { collectStats, clearCache, gcCache, type CacheStats } from '../cache/store.js';

export interface CacheCommandOptions {
  cacheDir: string;
  maxAgeDays: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function printStats(stats: CacheStats): void {
  const tiers: (keyof CacheStats)[] = ['parse', 'xlate', 'build'];
  console.log('Tier   Entries    Size');
  for (const t of tiers) {
    const s = stats[t];
    console.log(`${t.padEnd(6)} ${String(s.entries).padStart(7)}    ${formatBytes(s.bytes)}`);
  }
}

export async function runCache(sub: string, opts: CacheCommandOptions): Promise<number> {
  switch (sub) {
    case 'stats': {
      const stats = await collectStats(opts.cacheDir);
      printStats(stats);
      return 0;
    }
    case 'clear': {
      await clearCache(opts.cacheDir);
      console.log(`Cleared ${opts.cacheDir}`);
      return 0;
    }
    case 'gc': {
      const removed = await gcCache(opts.cacheDir, { maxAgeDays: opts.maxAgeDays });
      console.log(`Removed ${removed} entr${removed === 1 ? 'y' : 'ies'} older than ${opts.maxAgeDays} day(s)`);
      return 0;
    }
    default:
      console.error(`Unknown subcommand: ${sub}. Expected: stats | clear | gc.`);
      return 2;
  }
}
