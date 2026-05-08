/**
 * Tools for discovering and talking to the Flutter VM service that
 * `flutter run -d chrome` exposes.
 *
 * v0: scrape the URI from `flutter run` stdout, persist to disk so subsequent
 *     watcher launches don't have to relaunch Flutter to find it.
 * Later: `_reloadSources` POST + WebSocket lifecycle.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const URI_RE = /Debug service listening on (ws:\/\/\S+)/g;

/** Returns the most-recent VM-service URI in the given stdout, if any. */
export function extractVmServiceUri(stdout: string): string | undefined {
  let match: RegExpExecArray | null;
  let last: string | undefined;
  URI_RE.lastIndex = 0;
  while ((match = URI_RE.exec(stdout)) !== null) {
    last = match[1];
  }
  return last;
}

export interface VmServiceCache {
  uri: string;
  /** epoch ms when the URI was first discovered. */
  discoveredAt: number;
}

export async function loadVmServiceCache(
  path: string,
): Promise<VmServiceCache | undefined> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as VmServiceCache;
  } catch {
    return undefined;
  }
}

export async function saveVmServiceCache(
  path: string,
  cache: VmServiceCache,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2));
}

/**
 * Hot-restart by POSTing to the VM service `_reloadSources` JSON-RPC.
 * Times out after 3 s — Skwasm reloads can hang and we'd rather fall back
 * to file-only writes than block the watcher.
 */
export async function reloadSources(uri: string, timeoutMs = 3000): Promise<void> {
  const httpUri = uri.replace(/^ws:\/\//, 'http://').replace(/\/ws$/, '');
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(httpUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: '_reloadSources',
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`VM service responded ${res.status}`);
    }
  } finally {
    clearTimeout(t);
  }
}
