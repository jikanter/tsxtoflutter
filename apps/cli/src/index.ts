import { Command } from 'commander';

import { convert } from './commands/convert.js';

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
  .action((_dir?: string) => {
    // TODO(phase 2): orchestrator.start()
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
  .action((sub: string) => {
    console.log(`TODO: tsxf cache ${sub}`);
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
  .action(() => {
    console.log('TODO: tsxf doctor');
  });

export function run(argv: string[]): void {
  program.parse(argv, { from: 'user' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2));
}
