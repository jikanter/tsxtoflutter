// Entry point for the `tsxtoflutter` CLI: IR JSON → Dart files.
//
// Usage:
//   dart run tsxtoflutter:tsxtoflutter convert --ir <dir> --out <dir>
//   dart run tsxtoflutter:tsxtoflutter watch   --ir <dir> --out <dir>
import 'dart:io';

import 'package:args/command_runner.dart';
import 'package:tsxtoflutter_codegen/src/commands/convert.dart';
import 'package:tsxtoflutter_codegen/src/commands/watch.dart';

Future<void> main(List<String> args) async {
  final runner =
      CommandRunner<int>('tsxtoflutter', 'Generate Flutter widgets from IR JSON.')
        ..addCommand(ConvertCommand())
        ..addCommand(WatchCommand());

  final exitCode = await runner.run(args) ?? 0;
  exit(exitCode);
}
