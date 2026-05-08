import 'dart:async';
import 'dart:io';

import 'package:args/command_runner.dart';
import 'package:path/path.dart' as p;
import 'package:watcher/watcher.dart';

import '../emitter/idempotent_writer.dart';

/// `tsxtoflutter watch --ir <dir> --out <dir>` (Phase 2 R2).
///
/// Watches the IR JSON output directory and re-emits the corresponding Dart
/// pair when a file changes. Debounce window matches the JS-side orchestrator
/// (50 ms here — the JS side already coalesced the editor save burst by the
/// time IR JSON lands on disk; this debouncer just covers atomic-rename
/// double-fires from `package:watcher`). Idempotent: identical IR → no Dart
/// write, no mtime bump.
class WatchCommand extends Command<int> {
  WatchCommand() {
    argParser
      ..addOption('ir', abbr: 'i', help: 'Directory containing IR JSON files.')
      ..addOption('out', abbr: 'o', help: 'Output directory under flutter_app/lib.')
      ..addOption('debounce-ms', defaultsTo: '50', help: 'Debounce window for FS events.');
  }

  @override
  String get name => 'watch';

  @override
  String get description => 'Watch IR dir and regenerate Dart on change.';

  @override
  Future<int> run() async {
    final irDir = argResults!['ir'] as String?;
    final outDir = argResults!['out'] as String?;
    final debounceMs = int.tryParse(argResults!['debounce-ms'] as String) ?? 50;

    if (irDir == null || outDir == null) {
      stderr.writeln('Usage: tsxtoflutter watch --ir <dir> --out <dir>');
      return 64;
    }
    if (!Directory(irDir).existsSync()) {
      stderr.writeln('IR dir does not exist: $irDir');
      return 66;
    }
    await Directory(outDir).create(recursive: true);

    // Initial pass so the developer doesn't need to save once for state to
    // converge.
    try {
      final initial = await emitAllInDir(
        irDir: irDir,
        outDir: outDir,
        log: stderr.writeln,
      );
      stdout.writeln(
          'initial: ${initial.components} component(s), ${initial.filesWritten} file(s) written');
    } on FileSystemException catch (e) {
      stderr.writeln('initial scan failed: ${e.message}');
    }

    final watcher = DirectoryWatcher(irDir);
    final pending = <String>{};
    Timer? debounceTimer;

    void fire() {
      final batch = pending.toList()..sort();
      pending.clear();
      for (final path in batch) {
        if (!path.endsWith('.json')) continue;
        final f = File(path);
        if (!f.existsSync()) continue;
        try {
          final stopwatch = Stopwatch()..start();
          // Emit just this program file.
          unawaited(() async {
            try {
              final n = await emitProgramFile(
                irFile: f,
                outDir: outDir,
                log: stderr.writeln,
              );
              stopwatch.stop();
              stdout.writeln(
                  '${p.basename(path)} → $n file(s) (${stopwatch.elapsedMilliseconds}ms)');
            } catch (e) {
              stderr.writeln('emit failed for $path: $e');
            }
          }());
        } catch (e) {
          stderr.writeln('emit failed for $path: $e');
        }
      }
    }

    stdout.writeln('watching $irDir → $outDir (debounce ${debounceMs}ms)');
    await for (final event in watcher.events) {
      if (event.type == ChangeType.REMOVE) continue;
      pending.add(event.path);
      debounceTimer?.cancel();
      debounceTimer = Timer(Duration(milliseconds: debounceMs), fire);
    }
    return 0;
  }
}
