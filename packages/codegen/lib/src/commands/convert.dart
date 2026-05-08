import 'dart:io';

import 'package:args/command_runner.dart';
import 'package:path/path.dart' as p;

import '../emitter/component_emitter.dart';
import '../ir.dart';

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

    final emitter = const ComponentEmitter();
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
        final base = p.join(outDir, '${component.name.toLowerCase()}');
        await File('$base.dart').writeAsString(emitted.shellSource);
        await File('$base.g.dart').writeAsString(emitted.generatedSource);
        count++;
      }
    }

    stdout.writeln('Generated $count widget(s).');
    return 0;
  }
}
