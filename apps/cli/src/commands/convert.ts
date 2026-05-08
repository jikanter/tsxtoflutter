/**
 * `tsxf convert <input...>` — drives the TS → IR → Dart pipeline.
 *
 * 1. Read each input file.
 * 2. Run `@tsxtoflutter/ingest` to produce an IRProgram.
 * 3. Write IR JSON to a temp dir under `.tsxtoflutter/ir/`.
 * 4. Spawn `dart run tsxtoflutter:tsxtoflutter convert --ir <dir> --out <dir>`
 *    from `flutter_app/` and surface its exit code.
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { ingest, type InputFile } from '@tsxtoflutter/ingest';

export interface ConvertOptions {
  /** Where the Dart side should write `*.dart`/`*.g.dart`. */
  out: string;
  /** When false, skip the LLM fallback path. Phase 1 has no LLM, so wired but unused. */
  llm: boolean | undefined;
  /** Project root; defaults to `process.cwd()`. */
  cwd?: string;
}

export async function convert(
  inputs: string[],
  options: ConvertOptions,
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  if (inputs.length === 0) {
    process.stderr.write('tsxf convert: no input files given\n');
    return 64;
  }

  const inputFiles: InputFile[] = await Promise.all(
    inputs.map(async (p): Promise<InputFile> => {
      const abs = isAbsolute(p) ? p : resolve(cwd, p);
      const contents = await readFile(abs, 'utf8');
      return { path: relative(cwd, abs) || abs, contents };
    }),
  );

  let program;
  try {
    program = await ingest(inputFiles);
  } catch (err) {
    process.stderr.write(
      `tsxf convert: ingest failed — ${(err as Error).message}\n`,
    );
    return 65;
  }

  const irDir = resolve(cwd, '.tsxtoflutter/ir');
  await rm(irDir, { recursive: true, force: true });
  await mkdir(irDir, { recursive: true });

  // One IR JSON per input file, named after the input's basename.
  for (let i = 0; i < inputFiles.length; i++) {
    const input = inputFiles[i]!;
    const stem = input.path.replace(/[\\/]/g, '_').replace(/\.(tsx|mdx)$/i, '');
    const jsonPath = resolve(irDir, `${stem}.json`);
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
    await writeFile(jsonPath, JSON.stringify(single, null, 2));
  }

  const outDir = isAbsolute(options.out)
    ? options.out
    : resolve(cwd, options.out);
  await mkdir(outDir, { recursive: true });

  const flutterAppDir = resolve(cwd, 'flutter_app');
  return spawnDart(
    [
      'run',
      'tsxtoflutter_codegen:tsxtoflutter',
      'convert',
      '--ir',
      irDir,
      '--out',
      outDir,
    ],
    flutterAppDir,
  );
}

function spawnDart(args: string[], cwd: string): Promise<number> {
  return new Promise((resolveExit) => {
    const child = spawn('dart', args, { cwd, stdio: 'inherit' });
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', (err) => {
      process.stderr.write(`tsxf convert: dart failed — ${err.message}\n`);
      resolveExit(127);
    });
  });
}

