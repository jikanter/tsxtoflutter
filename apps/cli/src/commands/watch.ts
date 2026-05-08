/**
 * `tsxf watch [dir]` — start the orchestrator and stream save→codegen
 * updates until interrupted.
 *
 * Phase 2 R1+R4: chokidar → ingest (with parse-cache lookup) → IR JSON →
 * spawn `dart run tsxtoflutter:tsxtoflutter convert`. Per-component cache
 * lookup short-circuits the ingest step when the TSX bytes are unchanged.
 */
import path from 'node:path';

import { CacheStore, parseKey } from '@tsxtoflutter/cache';
import { createOrchestrator } from '@tsxtoflutter/orchestrator';

const PARSER_VERSION = '0.1.0';

export interface WatchOptions {
  irOutDir: string;
  outDir: string;
  flutterAppDir: string;
  cacheDir: string;
  vmServiceUri?: string;
  cwd?: string;
}

export async function startWatch(
  inputDir: string,
  options: WatchOptions,
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const cache = new CacheStore(options.cacheDir);
  const vmServiceCachePath = path.join(options.cacheDir, '..', '.tsxtoflutter', 'vm-service.json');

  const orchestrator = createOrchestrator({
    patterns: path.resolve(cwd, inputDir, '**/*.{tsx,mdx}'),
    irOutDir: path.resolve(options.irOutDir),
    outDir: path.resolve(options.outDir),
    flutterAppDir: path.resolve(options.flutterAppDir),
    cwd,
    flutterVmServiceUri: options.vmServiceUri,
    vmServiceCachePath,
    parseCacheStore: async (file, ir) => {
      const key = parseKey({ source: file.contents, parserVersion: PARSER_VERSION });
      await cache.put('parse', key, ir);
    },
  });

  await orchestrator.start();

  const shutdown = async () => {
    process.stderr.write('\n  shutting down watcher...\n');
    await orchestrator.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Hold the process open. The watcher runs until the user kills it.
  await new Promise<void>(() => {});
  return 0;
}
