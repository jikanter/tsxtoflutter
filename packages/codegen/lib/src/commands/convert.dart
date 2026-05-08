import 'dart:io';

import 'package:args/command_runner.dart';
import 'package:path/path.dart' as p;

import '../decoder/ir.dart';
import '../emitter/component_emitter.dart';

class ConvertCommand extends Command<int> {
  ConvertCommand() {
    argParser
      ..addOption('ir', abbr: 'i', help: 'Directory containing IR JSON files.')
      ..addOption('out', abbr: 'o', help: 'Output directory under flutter_app/lib.');
  }

  @override
  String get name => 'convert';

  @override
  String get description => 'Convert IR JSON → Dart files (one-shot).';

  @override
  Future<int> run() async {
    final irDir = argResults!['ir'] as String?;
    final outDir = argResults!['out'] as String?;
    if (irDir == null || outDir == null) {
      stderr.writeln('Usage: tsxtoflutter convert --ir <dir> --out <dir>');
      return 64;
    }

    const emitter = ComponentEmitter();
    final dir = Directory(irDir);
    if (!dir.existsSync()) {
      stderr.writeln('IR dir does not exist: $irDir');
      return 66;
    }

    var count = 0;
    await for (final entity in dir.list()) {
      if (entity is! File || !entity.path.endsWith('.json')) continue;
      final program = await IrProgram.readJson(entity);
      for (final component in program.components) {
        final emitted = emitter.emit(component);
        final base = p.join(outDir, emitted.basename);
        final shellPath = '$base.dart';
        // Only generate the hand-written shell when missing — otherwise the
        // developer's edits would get clobbered every regen. Bail out on
        // existing-but-mismatched part directives.
        final shell = File(shellPath);
        if (!shell.existsSync()) {
          await Directory(p.dirname(shellPath)).create(recursive: true);
          await shell.writeAsString(emitted.shellSource);
        } else {
          final body = await shell.readAsString();
          if (!body.contains("part '${emitted.basename}.g.dart';")) {
            stderr.writeln(
                "Warning: $shellPath exists but lacks `part '${emitted.basename}.g.dart';`");
          }
        }
        await File('$base.g.dart').writeAsString(emitted.generatedSource);
        count++;
      }
    }

    stdout.writeln('Generated $count widget(s).');
    return 0;
  }
}
