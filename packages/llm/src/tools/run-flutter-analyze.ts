import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export interface AnalyzerDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
  column?: number;
}

export interface AnalyzeResult {
  errors: AnalyzerDiagnostic[];
  warnings: AnalyzerDiagnostic[];
  infos: AnalyzerDiagnostic[];
}

export interface AnalyzeOptions {
  /** Override path to the `flutter` binary; defaults to PATH lookup. */
  flutterBin?: string;
  /** Override the sandbox parent dir (defaults to OS tmp). */
  sandboxRoot?: string;
}

/**
 * Run `flutter analyze` on a Dart snippet inside a freshly-scaffolded sandbox
 * project. The snippet is written into `lib/main.dart`. Output is parsed from
 * the analyzer's machine-readable form (`flutter analyze --no-pub --no-fatal-warnings --no-fatal-infos`).
 *
 * This is the killer tool: the model sees its own lint errors and fixes them.
 */
export async function runFlutterAnalyze(
  dartSource: string,
  opts: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const sandbox = await fs.mkdtemp(
    path.join(opts.sandboxRoot ?? os.tmpdir(), 'tsxf-analyze-'),
  );
  try {
    await scaffoldSandbox(sandbox);
    await fs.writeFile(path.join(sandbox, 'lib', 'main.dart'), dartSource);
    const { stdout } = await runFlutter(sandbox, opts.flutterBin ?? 'flutter');
    return parseAnalyzerOutput(stdout);
  } finally {
    await fs.rm(sandbox, { recursive: true, force: true }).catch(() => {
      /* sandbox cleanup is best-effort */
    });
  }
}

async function scaffoldSandbox(dir: string): Promise<void> {
  await fs.mkdir(path.join(dir, 'lib'), { recursive: true });
  await fs.writeFile(
    path.join(dir, 'pubspec.yaml'),
    [
      'name: tsxf_sandbox',
      'description: tsxtoflutter analyzer sandbox.',
      'publish_to: none',
      'environment:',
      '  sdk: ^3.6.0',
      '  flutter: ^3.27.0',
      'dependencies:',
      '  flutter:',
      '    sdk: flutter',
      '',
    ].join('\n'),
  );
  await fs.writeFile(
    path.join(dir, 'analysis_options.yaml'),
    'include: package:flutter_lints/flutter.yaml\n',
  );
}

async function runFlutter(cwd: string, bin: string): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, ['analyze', '--no-pub'], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      // Non-zero is expected when there are diagnostics; only reject on spawn errors.
      if (stderr && code !== 0 && stdout.length === 0) {
        reject(new Error(`flutter analyze failed: ${stderr}`));
        return;
      }
      resolve({ stdout });
    });
  });
}

const LINE_RE =
  /^\s*(error|warning|info)\s+•\s+(.+?)\s+•\s+(.+?):(\d+):(\d+)\s+•\s+(\w+)\s*$/;

export function parseAnalyzerOutput(stdout: string): AnalyzeResult {
  const result: AnalyzeResult = { errors: [], warnings: [], infos: [] };
  for (const raw of stdout.split('\n')) {
    const m = LINE_RE.exec(raw);
    if (!m) continue;
    const [, sev, message, , lineStr, colStr, code] = m as unknown as [
      string,
      'error' | 'warning' | 'info',
      string,
      string,
      string,
      string,
      string,
    ];
    const diag: AnalyzerDiagnostic = {
      severity: sev,
      code,
      message,
      line: Number(lineStr),
      column: Number(colStr),
    };
    if (sev === 'error') result.errors.push(diag);
    else if (sev === 'warning') result.warnings.push(diag);
    else result.infos.push(diag);
  }
  return result;
}
