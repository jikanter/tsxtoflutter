/**
 * The orchestrator: chokidar → ingest → write IR JSON → spawn Dart codegen
 * → POST to Flutter VM-service `_reloadSources`.
 *
 * Save bursts coalesce via a 100 ms trailing debounce. The codegen subprocess
 * is single-flight: a new save while one is in flight kills the prior process
 * and starts a fresh run with the latest IR.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { basename, extname, isAbsolute, relative, resolve } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';

import { ingest as defaultIngest } from '@tsxtoflutter/ingest';

import { reloadSources } from './vm-service.js';

export interface WatchOptions {
  /** Glob(s) or path(s) to watch, usually `inputs/**\/*.{tsx,mdx}`. */
  patterns: string | string[];
  /** Where to write IR JSON files. */
  irOutDir: string;
  /** Where the Dart codegen should write `*.dart`/`*.g.dart`. */
  outDir: string;
  /** Where the Flutter app lives (cwd for the Dart codegen subprocess). */
  flutterAppDir: string;
  /** Debounce window in ms for batching rapid saves. Defaults to 100. */
  debounceMs?: number;
  /** Override for the ingest function (tests). */
  ingest?: IngestFn;
}

export interface IngestFn {
  (inputPaths: string[]): Promise<{
    programs: Array<{ path: string; json: string }>;
  }>;
}

export interface OrchestratorDeps {
  /** Run the Dart codegen subprocess. Resolves with the exit code. */
  runCodegen: (
    irDir: string,
    outDir: string,
    flutterAppDir: string,
  ) => Promise<number>;
  /** Hot-restart Flutter by hitting its VM service. Throws on failure. */
  reload: (vmServiceUri: string) => Promise<void>;
  /** Resolve the most-recent VM-service URI, if any. */
  vmServiceUri: () => string | undefined;
}

export interface Orchestrator extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Enqueue a change as if chokidar fired. Subject to the debounce window. */
  processChange(path: string): Promise<void>;
  /** Resolve once any in-flight or debounced run has fully completed. */
  awaitIdle(): Promise<void>;
}

export function createOrchestrator(
  opts: WatchOptions,
  deps: OrchestratorDeps = defaultDeps(),
): Orchestrator {
  const ee = new EventEmitter();
  const debounceMs = opts.debounceMs ?? 100;
  const ingest = opts.ingest ?? defaultIngestAdapter;

  let watcher: FSWatcher | null = null;
  let pending = new Set<string>();
  let inflight: Promise<void> | null = null;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingResolve: (() => void) | null = null;
  let pendingPromise: Promise<void> | null = null;

  function schedulePending(): Promise<void> {
    if (!pendingPromise) {
      pendingPromise = new Promise<void>((res) => {
        pendingResolve = res;
      });
    }
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pendingTimer = null;
      const paths = [...pending];
      pending = new Set();
      const resolveOuter = pendingResolve!;
      pendingPromise = null;
      pendingResolve = null;
      void runOnce(paths).finally(resolveOuter);
    }, debounceMs);
    return pendingPromise;
  }

  async function runOnce(paths: string[]): Promise<void> {
    // Single-flight: if a run is in flight, wait for it before starting the next.
    // Newer saves arrive on the next debounce window; we don't queue.
    if (inflight) {
      try {
        await inflight;
      } catch {
        // swallow — error already surfaced by the prior run
      }
    }
    inflight = (async () => {
      const t0 = Date.now();
      ee.emit('start', paths);
      try {
        const { programs } = await ingest(paths);
        await mkdir(opts.irOutDir, { recursive: true });
        for (const p of programs) {
          const stem = stemFor(p.path);
          await writeFile(resolve(opts.irOutDir, `${stem}.json`), p.json);
        }

        const code = await deps.runCodegen(
          opts.irOutDir,
          opts.outDir,
          opts.flutterAppDir,
        );
        if (code !== 0) {
          ee.emit('warning', `codegen exited with code ${code}`);
          return;
        }

        const uri = deps.vmServiceUri();
        if (uri) {
          try {
            await deps.reload(uri);
            ee.emit('reloaded', uri);
          } catch (err) {
            ee.emit(
              'warning',
              `VM service unreachable; wrote files only — ${(err as Error).message}`,
            );
          }
        } else {
          ee.emit(
            'info',
            'no VM service URI; wrote files only (re-run `r` in flutter run)',
          );
        }

        ee.emit('done', { paths, ms: Date.now() - t0 });
      } catch (err) {
        ee.emit('warning', `ingest failed — ${(err as Error).message}`);
      } finally {
        inflight = null;
      }
    })();
    await inflight;
  }

  async function processChange(path: string): Promise<void> {
    pending.add(path);
    schedulePending();
  }

  async function awaitIdle(): Promise<void> {
    if (pendingPromise) await pendingPromise;
    if (inflight) await inflight;
  }

  return Object.assign(ee, {
    async start() {
      const onVolumes = isOnNetworkVolume(opts.patterns);
      watcher = chokidar.watch(opts.patterns, {
        ignoreInitial: true,
        usePolling: onVolumes,
        awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
      });
      watcher.on('add', (p) => void processChange(p));
      watcher.on('change', (p) => void processChange(p));
      watcher.on('unlink', async (p) => {
        // Best-effort: clean up the matching IR JSON.
        await rm(resolve(opts.irOutDir, `${stemFor(p)}.json`), {
          force: true,
        });
      });
    },
    async stop() {
      await watcher?.close();
      watcher = null;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = null;
      if (inflight) {
        try {
          await inflight;
        } catch {
          /* surfaced via warning */
        }
      }
    },
    processChange,
    awaitIdle,
  });
}

function defaultDeps(): OrchestratorDeps {
  let currentChild: ChildProcess | null = null;
  return {
    runCodegen(irDir, outDir, flutterAppDir) {
      // Single-flight: kill any in-flight subprocess before starting a new one.
      if (currentChild && currentChild.exitCode === null) {
        currentChild.kill('SIGTERM');
      }
      return new Promise<number>((resolveExit) => {
        currentChild = spawn(
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
        currentChild.on('exit', (code) => resolveExit(code ?? 1));
        currentChild.on('error', () => resolveExit(127));
      });
    },
    reload(uri) {
      return reloadSources(uri);
    },
    vmServiceUri() {
      return process.env['TSXF_VM_SERVICE_URI'];
    },
  };
}

async function defaultIngestAdapter(
  paths: string[],
): Promise<{ programs: Array<{ path: string; json: string }> }> {
  const inputs = await Promise.all(
    paths.map(async (p) => ({
      path: relative(process.cwd(), p) || p,
      contents: await readFile(p, 'utf8'),
    })),
  );
  const program = await defaultIngest(inputs);
  // One IR JSON per input; partition components by source path.
  const programs = inputs.map((input) => {
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
    return { path: input.path, json: JSON.stringify(single, null, 2) };
  });
  return { programs };
}

function stemFor(path: string): string {
  const base = basename(path, extname(path));
  return base.replace(/[\\/]/g, '_');
}

function isOnNetworkVolume(patterns: string | string[]): boolean {
  const arr = Array.isArray(patterns) ? patterns : [patterns];
  return arr.some((p) => {
    const abs = isAbsolute(p) ? p : resolve(p);
    return abs.startsWith('/Volumes/') || abs.startsWith('/Network/');
  });
}
