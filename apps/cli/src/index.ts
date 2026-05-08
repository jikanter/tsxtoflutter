import path from 'node:path';
import { Command } from 'commander';
import { ingest } from '@tsxtoflutter/ingest';
import { runDoctor } from './commands/doctor.js';
import { runCache } from './commands/cache.js';

const program = new Command();

program
  .name('tsxf')
  .description('Transform TSX/MDX from Claude Design into Flutter widgets.')
  .version('0.0.0');

program
  .command('init')
  .description('Scaffold the output Flutter project.')
  .action(() => {
    // TODO: copy the template skeleton into ./flutter_app and run `flutter create .`.
    console.log('TODO: tsxf init');
  });

program
  .command('convert <input...>')
  .description('Convert TSX/MDX inputs to Dart (one-shot).')
  .option('--out <dir>', 'IR output directory', '.tsxf-cache/ir')
  .option('--no-llm', 'deterministic codemods only (CI sanity)')
  .action(async (_inputs: string[], _opts) => {
    // TODO: read inputs, call `ingest`, write IR JSON, spawn `dart run tsxtoflutter convert`.
    const program = await ingest([]);
    console.log(`Generated IR for ${program.components.length} component(s).`);
  });

program
  .command('watch [dir]')
  .description('Watch inputs and hot-reload preview.')
  .action((_dir?: string) => {
    // TODO: orchestrator.start()
    console.log('TODO: tsxf watch');
  });

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
