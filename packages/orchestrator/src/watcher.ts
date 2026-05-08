import chokidar, { type FSWatcher } from 'chokidar';

export interface WatchOptions {
  /** Glob(s) to watch, usually `inputs/**\/*.{tsx,mdx}`. */
  patterns: string | string[];
  /** Where to write IR JSON files. */
  irOutDir: string;
  /** Where the generated Flutter app lives (for the codegen subprocess). */
  flutterAppDir: string;
  /** Flutter VM-service URL exposed by `flutter run -d chrome`. */
  flutterVmServiceUri?: string;
  /** Debounce window in ms for batching rapid saves. */
  debounceMs?: number;
}

export interface Orchestrator {
  start(): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Stand up the watch loop:
 *   1. chokidar watches TSX/MDX inputs
 *   2. on change → run ingest → write IR JSON to `irOutDir`
 *   3. spawn `dart run tsxtoflutter` to regenerate `*.g.dart`
 *   4. POST to Flutter's VM-service `_reloadSources` endpoint
 */
export function createOrchestrator(_opts: WatchOptions): Orchestrator {
  let watcher: FSWatcher | null = null;

  return {
    async start() {
      // TODO: wire up chokidar → ingest → codegen → hot-restart.
      watcher = chokidar.watch([], { ignoreInitial: false });
    },
    async stop() {
      await watcher?.close();
      watcher = null;
    },
  };
}
