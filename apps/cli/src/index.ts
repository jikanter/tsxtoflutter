import { Command } from 'commander';
import { ingest } from '@tsxtoflutter/ingest';

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
