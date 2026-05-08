import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);

export type Tool = 'node' | 'pnpm' | 'bun' | 'flutter' | 'dart';

interface Requirement {
  minimum: string;
  install: string;
}

export const REQUIREMENTS: Record<Tool, Requirement> = {
  node: { minimum: '22.0.0', install: 'https://nodejs.org/' },
  pnpm: { minimum: '10.0.0', install: 'corepack enable && corepack prepare pnpm@10 --activate' },
  bun: { minimum: '1.2.0', install: 'curl -fsSL https://bun.sh/install | bash' },
  flutter: { minimum: '3.27.0', install: 'https://docs.flutter.dev/get-started/install' },
  dart: { minimum: '3.6.0', install: 'bundled with Flutter; verify `dart --version`' },
};

export interface ProbeResult {
  ok: boolean;
  raw: string;
  version: string | null;
}

export type Probe = (tool: Tool) => Promise<ProbeResult>;

export interface Check {
  tool: Tool | 'flutter_app';
  ok: boolean;
  message: string;
}

export interface DoctorReport {
  ok: boolean;
  checks: Check[];
}

export function parseSemverLike(s: string): string | null {
  const m = s.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

export function parseFlutterVersion(s: string): string | null {
  const m = s.match(/Flutter\s+(\d+\.\d+\.\d+)/);
  return m ? m[1]! : null;
}

export function parseDartVersion(s: string): string | null {
  const m = s.match(/Dart SDK version:\s*(\d+\.\d+\.\d+)/);
  return m ? m[1]! : null;
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10));
  const pb = b.split('.').map((x) => parseInt(x, 10));
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

export async function defaultProbe(tool: Tool): Promise<ProbeResult> {
  const cmd = tool === 'flutter' || tool === 'dart' ? tool : tool;
  const args = tool === 'dart' ? ['--version'] : ['--version'];
  try {
    const { stdout, stderr } = await execFileP(cmd, args, { timeout: 10_000 });
    const raw = (stdout + stderr).trim();
    let version: string | null = null;
    if (tool === 'flutter') version = parseFlutterVersion(raw);
    else if (tool === 'dart') version = parseDartVersion(raw);
    else version = parseSemverLike(raw);
    return { ok: version !== null, raw, version };
  } catch {
    return { ok: false, raw: '', version: null };
  }
}

export async function defaultFlutterAppReady(repoRoot: string): Promise<boolean> {
  const dartTool = path.join(repoRoot, 'flutter_app', '.dart_tool');
  try {
    const stat = await fs.stat(dartTool);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

export async function evaluateChecks(
  probe: Probe,
  flutterAppReady: () => Promise<boolean>,
): Promise<DoctorReport> {
  const checks: Check[] = [];

  for (const tool of Object.keys(REQUIREMENTS) as Tool[]) {
    const req = REQUIREMENTS[tool];
    const result = await probe(tool);
    if (!result.ok || !result.version) {
      checks.push({
        tool,
        ok: false,
        message: `${tool}: not found. Install: ${req.install}`,
      });
      continue;
    }
    const cmp = compareSemver(result.version, req.minimum);
    if (cmp < 0) {
      checks.push({
        tool,
        ok: false,
        message: `${tool} ${result.version} found, need >= ${req.minimum}. Upgrade: ${req.install}`,
      });
    } else {
      checks.push({ tool, ok: true, message: `${tool} ${result.version}` });
    }
  }

  const faReady = await flutterAppReady();
  checks.push({
    tool: 'flutter_app',
    ok: faReady,
    message: faReady
      ? 'flutter_app: pub-get artifacts present'
      : 'flutter_app: missing .dart_tool — run `flutter pub get` in flutter_app/',
  });

  return { ok: checks.every((c) => c.ok), checks };
}

export async function runDoctor(repoRoot: string): Promise<number> {
  const report = await evaluateChecks(defaultProbe, () => defaultFlutterAppReady(repoRoot));
  for (const c of report.checks) {
    const tag = c.ok ? 'ok ' : 'FAIL';
    console.log(`[${tag}] ${c.message}`);
  }
  if (!report.ok) {
    console.log('');
    console.log('tsxf doctor found issues — fix the FAIL lines above.');
  }
  return report.ok ? 0 : 1;
}
