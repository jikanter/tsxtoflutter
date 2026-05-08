import path from 'node:path';
import { Command } from 'commander';

import { convert } from './commands/convert.js';
import { runDoctor } from './commands/doctor.js';
import { runCache } from './commands/cache.js';
import { startWatch } from './commands/watch.js';

const program = new Command();

program
  .name('tsxf')
  .description('Transform TSX/MDX from Claude Design into Flutter widgets.')
  .version('0.0.0');

program
  .command('init')
  .description('Scaffold the output Flutter project.')
  .action(() => {
    // TODO(phase 4): copy template + run `flutter create .` for each platform.
    console.log('TODO: tsxf init');
  });

program
  .command('convert <input...>')
  .description('Convert TSX/MDX inputs to Dart (one-shot).')
  .option(
    '--out <dir>',
    'Output directory for generated Dart files',
    'flutter_app/lib/components',
  )
  .option('--no-llm', 'Deterministic codemods only (CI sanity).')
  .action(async (inputs: string[], opts: { out: string; llm?: boolean }) => {
    const code = await convert(inputs, { out: opts.out, llm: opts.llm });
    if (code !== 0) process.exit(code);
  });

program
  .command('watch [dir]')
  .description('Watch inputs and hot-reload preview.')
  .option('--ir-out <dir>', 'IR JSON output dir', '.tsxtoflutter/ir')
  .option('--out <dir>', 'Generated Dart output dir', 'flutter_app/lib/components')
  .option('--flutter-app <dir>', 'Flutter app dir', 'flutter_app')
  .option('--cache-dir <dir>', 'Cache root', '.tsxf-cache')
  .option('--vm-service-uri <uri>', 'Flutter VM-service URI for hot-reload')
  .action(
    async (
      dir: string | undefined,
      opts: {
        irOut: string;
        out: string;
        flutterApp: string;
        cacheDir: string;
        vmServiceUri?: string;
      },
    ) => {
      const code = await startWatch(dir ?? './inputs', {
        irOutDir: opts.irOut,
        outDir: opts.out,
        flutterAppDir: opts.flutterApp,
        cacheDir: opts.cacheDir,
        ...(opts.vmServiceUri !== undefined ? { vmServiceUri: opts.vmServiceUri } : {}),
      });
      process.exit(code);
    },
  );

program
  .command('preview')
  .description('Spin up `flutter run -d chrome`.')
  .action(() => {
    console.log('TODO: tsxf preview');
  });

program
  .command('cache')
  .description('Inspect or clear the parse/translate/build cache.')
  .argument('<sub>', 'stats | clear | gc')
  .option('--cache-dir <dir>', 'cache root', '.tsxf-cache')
  .option('--max-age-days <n>', 'gc threshold', '30')
  .action(async (sub: string, opts: { cacheDir: string; maxAgeDays: string }) => {
    const code = await runCache(sub, {
      cacheDir: path.resolve(opts.cacheDir),
      maxAgeDays: Number(opts.maxAgeDays),
    });
    process.exit(code);
  });

program
  .command('eval')
  .description('Run the golden-corpus quality eval.')
  .option('--corpus <dir>', 'fixture directory')
  .action((_opts) => {
    console.log('TODO: tsxf eval');
  });

program
  .command('doctor')
  .description('Check that flutter, dart, bun, and required env vars are present.')
  .option('--repo-root <dir>', 'project root used for flutter_app discovery', process.cwd())
  .action(async (opts: { repoRoot: string }) => {
    const code = await runDoctor(path.resolve(opts.repoRoot));
    process.exit(code);
  });

export function run(argv: string[]): void {
  program.parse(argv, { from: 'user' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2));
}
