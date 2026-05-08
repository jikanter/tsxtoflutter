import 'dart:io';

import 'package:args/command_runner.dart';

import '../emitter/idempotent_writer.dart';

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

    if (!Directory(irDir).existsSync()) {
      stderr.writeln('IR dir does not exist: $irDir');
      return 66;
    }
    await Directory(outDir).create(recursive: true);

    final result = await emitAllInDir(
      irDir: irDir,
      outDir: outDir,
      log: stderr.writeln,
    );
    stdout.writeln(
        'Generated ${result.components} widget(s); ${result.filesWritten} file(s) written.');
    return 0;
  }
}
