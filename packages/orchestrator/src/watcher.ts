/**
 * The TSX/MDX watcher (Phase 2 R1).
 *
 * Pipeline per change burst:
 *   1. chokidar fires → debounce 100 ms
 *   2. read all changed files → ingest → write IR JSON to `irOutDir`
 *   3. spawn `dart run tsxtoflutter:tsxtoflutter convert --ir <dir> --out <dir>`
 *      (kill any prior in-flight subprocess; never queue more than one)
 *   4. POST `_reloadSources` to the Flutter VM-service (if reachable;
 *      hard timeout, file-only fallback otherwise)
 *
 * Performance budget per Phase 2: save → both panes ≤ 2 s warm, ≤ 4 s cold.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import chokidar, { type FSWatcher } from 'chokidar';

import { ingest, type InputFile } from '@tsxtoflutter/ingest';

import { createDebouncer } from './debounce.js';
import { createRunController } from './run-controller.js';
import { reloadSources, writeVmServiceCache } from './vm-service.js';

export interface WatchOptions {
  /** Glob(s) to watch, usually `inputs/**\/*.{tsx,mdx}`. */
  patterns: string | string[];
  /** Where to write IR JSON files. */
  irOutDir: string;
  /** Dart codegen output dir (under `flutter_app/lib/components`). */
  outDir: string;
  /** Where the generated Flutter app lives (cwd for the codegen subprocess). */
  flutterAppDir: string;
  /** Flutter VM-service URI, if known up-front. */
  flutterVmServiceUri?: string;
  /** Path to persist the VM-service URI for next session. */
  vmServiceCachePath?: string;
  /** Debounce window in ms for batching rapid saves. Default 100 (Phase 2). */
  debounceMs?: number;
  /** Project root (cwd). Used to make relative paths in input files. */
  cwd?: string;
  /** Logger; defaults to console.log. */
  log?: (line: string) => void;
  /**
   * Optional cache hooks. Phase 2 R4 wires the parse cache here so a save
   * with unchanged TSX skips re-ingest entirely.
   */
  parseCacheStore?: (file: InputFile, ir: unknown) => Promise<void>;
}

export interface Orchestrator {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createOrchestrator(opts: WatchOptions): Orchestrator {
  const cwd = opts.cwd ?? process.cwd();
  const log = opts.log ?? ((line: string) => console.log(line));
  const debounceMs = opts.debounceMs ?? 100;
  const useFsPolling = pathLooksLikeNetworkVolume(cwd);
  const controller = createRunController();
  const vmServiceUri = opts.flutterVmServiceUri;
  let watcher: FSWatcher | null = null;

  const runOnce = async (changedPaths: string[]): Promise<void> => {
    await controller.submit(async (signal) => {
      if (signal.aborted) return null;
      log(`> change burst (${changedPaths.length}): ${changedPaths.join(', ')}`);

      const inputFiles: InputFile[] = await Promise.all(
        changedPaths.map(async (abs): Promise<InputFile> => {
          const contents = await fs.readFile(abs, 'utf8');
          return { path: path.relative(cwd, abs) || abs, contents };
        }),
      );

      let program;
      try {
        program = await ingest(inputFiles);
      } catch (err) {
        log(`  ingest failed: ${(err as Error).message}`);
        return null;
      }
      if (signal.aborted) return null;

      await fs.mkdir(opts.irOutDir, { recursive: true });
      for (const input of inputFiles) {
        const stem = input.path.replace(/[\\/]/g, '_').replace(/\.(tsx|mdx)$/i, '');
        const jsonPath = path.join(opts.irOutDir, `${stem}.json`);
        const components = program.components.filter(
          (c) => c.source.file === input.path,
        );
        const single = {
          version: program.version,
          inputHash: program.inputHash,
          rulesetVersion: program.rulesetVersion,
          components,
          diagnostics: program.diagnostics,
        };
        await fs.writeFile(jsonPath, JSON.stringify(single, null, 2));
        if (opts.parseCacheStore) {
          await opts.parseCacheStore(input, single);
        }
      }
      if (signal.aborted) return null;

      await fs.mkdir(opts.outDir, { recursive: true });
      const dartExit = await runDartCodegen(
        opts.flutterAppDir,
        opts.irOutDir,
        opts.outDir,
        signal,
        log,
      );
      if (dartExit !== 0) {
        log(`  dart codegen exited ${dartExit}`);
        return null;
      }

      if (vmServiceUri) {
        const result = await reloadSources(vmServiceUri);
        if (result.ok) log('  hot-reload: ok');
        else log(`  hot-reload: skipped (${result.reason}); file-only update committed`);
      } else {
        log('  hot-reload: no VM-service URI yet; file-only update committed');
      }
      return 0;
    });
  };

  const debouncer = createDebouncer<string>(
    async (paths) => {
      const unique = Array.from(new Set(paths));
      await runOnce(unique);
    },
    { windowMs: debounceMs, dedupe: true },
  );

  return {
    async start() {
      const patterns = typeof opts.patterns === 'string' ? [opts.patterns] : opts.patterns;
      log(`watching ${patterns.join(', ')} (debounce ${debounceMs}ms${useFsPolling ? ', polling' : ''})`);

      watcher = chokidar.watch(patterns, {
        ignoreInitial: false,
        usePolling: useFsPolling,
        awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
      });

      watcher.on('add', (p) => debouncer.notify(path.resolve(p)));
      watcher.on('change', (p) => debouncer.notify(path.resolve(p)));
      watcher.on('error', (err) => log(`watcher error: ${(err as Error).message}`));

      if (vmServiceUri && opts.vmServiceCachePath) {
        await writeVmServiceCache(opts.vmServiceCachePath, vmServiceUri);
      }
    },
    async stop() {
      debouncer.cancel();
      controller.cancelPending();
      controller.cancelInflight();
      await watcher?.close();
      watcher = null;
    },
  };
}

function pathLooksLikeNetworkVolume(p: string): boolean {
  // Phase 2 risk: chokidar misses events on `/Volumes/` (network mounts).
  return p.startsWith('/Volumes/') || p.startsWith('//') || /^[A-Z]:\\\\/.test(p);
}

function runDartCodegen(
  flutterAppDir: string,
  irDir: string,
  outDir: string,
  signal: AbortSignal,
  log: (line: string) => void,
): Promise<number> {
  return new Promise((resolveExit) => {
    const child: ChildProcess = spawn(
      'dart',
      [
        'run',
        'tsxtoflutter_codegen:tsxtoflutter',
        'convert',
        '--ir',
        irDir,
        '--out',
        outDir,
      ],
      { cwd: flutterAppDir, stdio: 'inherit' },
    );
    const onAbort = () => {
      log('  cancelling in-flight dart codegen');
      child.kill('SIGTERM');
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });

    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', (err) => {
      log(`  dart spawn error: ${err.message}`);
      resolveExit(127);
    });
  });
}
