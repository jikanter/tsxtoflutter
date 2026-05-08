/**
 * Flutter VM-service utilities.
 *
 * `flutter run -d chrome` writes its VM-service URI to stdout; we parse it
 * out and POST `_reloadSources` to trigger a hot restart on each codegen
 * tick. If the WS handshake fails or the call times out, we fall back to
 * file-only writes so the user can still re-run `r` manually.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const VM_SERVICE_LINE = /(https?|wss?):\/\/[^\s]+/;
const VM_SERVICE_HINTS = [
  /Dart VM Service.*available at:\s*(\S+)/i,
  /Debug service listening on\s+(\S+)/i,
  /Observatory listening on\s+(\S+)/i,
];

export function parseVmServiceUri(line: string): string | null {
  for (const re of VM_SERVICE_HINTS) {
    const m = line.match(re);
    if (m) return m[1] ?? null;
  }
  // Fall through: any line containing a bare URL with the trailing /=/.
  const generic = line.match(VM_SERVICE_LINE);
  if (generic && /\/=?\/?$/.test(generic[0])) return generic[0];
  return null;
}

export function vmServiceWsUrl(uri: string): string {
  if (uri.startsWith('ws://') || uri.startsWith('wss://')) return uri;
  const replaced = uri.replace(/^http(s?):\/\//, 'ws$1://');
  if (replaced.endsWith('/ws')) return replaced;
  if (replaced.endsWith('/')) return `${replaced}ws`;
  return `${replaced}/ws`;
}

export interface VmServiceCache {
  uri: string;
  recordedAt: string;
}

export async function readVmServiceCache(cachePath: string): Promise<VmServiceCache | null> {
  try {
    const raw = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(raw) as VmServiceCache;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function writeVmServiceCache(cachePath: string, uri: string): Promise<void> {
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const payload: VmServiceCache = { uri, recordedAt: new Date().toISOString() };
  await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf8');
}

export interface ReloadResult {
  ok: boolean;
  reason?: string;
}

/**
 * POST `_reloadSources` to the VM-service over WebSocket with a hard timeout.
 *
 * On Skwasm builds the WS handshake can hang; the timeout (default 3 s per
 * Phase 2 risk register) ensures the watcher never blocks user edits.
 */
export async function reloadSources(
  vmServiceUri: string,
  options: { timeoutMs?: number } = {},
): Promise<ReloadResult> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const wsUrl = vmServiceWsUrl(vmServiceUri);

  let WSCtor: typeof WebSocket | null = null;
  if (typeof WebSocket !== 'undefined') {
    WSCtor = WebSocket;
  } else {
    return { ok: false, reason: 'WebSocket not available in runtime' };
  }

  return new Promise<ReloadResult>((resolveResult) => {
    let settled = false;
    const finish = (r: ReloadResult) => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
      resolveResult(r);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    const ws = new WSCtor!(wsUrl);
    ws.addEventListener('open', () => {
      const msg = JSON.stringify({
        jsonrpc: '2.0',
        method: '_reloadSources',
        params: {},
        id: 1,
      });
      try {
        ws.send(msg);
      } catch (err) {
        clearTimeout(timer);
        finish({ ok: false, reason: `send failed: ${(err as Error).message}` });
      }
    });
    ws.addEventListener('message', () => {
      clearTimeout(timer);
      finish({ ok: true });
    });
    ws.addEventListener('error', (ev) => {
      clearTimeout(timer);
      const message = (ev as { message?: string }).message;
      finish({ ok: false, reason: message ?? 'ws error' });
    });
  });
}
