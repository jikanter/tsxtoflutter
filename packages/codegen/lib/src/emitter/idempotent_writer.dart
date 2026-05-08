import 'dart:io';

import 'package:path/path.dart' as p;

import '../decoder/ir.dart';
import 'component_emitter.dart';

/// Writes [contents] to [filePath] only if the existing file's bytes differ.
///
/// Skipping no-op writes preserves mtime — downstream watchers (the JS
/// orchestrator's chokidar instance, `flutter run`'s file watcher) avoid
/// spurious reload cycles.
Future<bool> writeIfChanged(String filePath, String contents) async {
  final file = File(filePath);
  if (file.existsSync()) {
    final existing = await file.readAsString();
    if (existing == contents) return false;
  } else {
    await Directory(p.dirname(filePath)).create(recursive: true);
  }
  await file.writeAsString(contents);
  return true;
}

/// Writes the shell + generated pair for a single component.
///
/// Returns the number of files actually written (0, 1, or 2). Idempotent:
/// running twice with the same IR yields zero writes the second time.
Future<int> emitComponentToDir({
  required IrComponent component,
  required String outDir,
  ComponentEmitter emitter = const ComponentEmitter(),
  void Function(String)? log,
}) async {
  final emitted = emitter.emit(component);
  final base = p.join(outDir, emitted.basename);
  final shellPath = '$base.dart';
  final genPath = '$base.g.dart';

  var written = 0;

  // Shell: only generated when missing — preserves hand edits.
  final shell = File(shellPath);
  if (!shell.existsSync()) {
    await Directory(p.dirname(shellPath)).create(recursive: true);
    await shell.writeAsString(emitted.shellSource);
    written++;
  } else {
    final body = await shell.readAsString();
    if (!body.contains("part '${emitted.basename}.g.dart';")) {
      log?.call(
          'Warning: $shellPath exists but lacks `part \'${emitted.basename}.g.dart\';`');
    }
  }

  if (await writeIfChanged(genPath, emitted.generatedSource)) {
    written++;
  }

  return written;
}

/// Reads every `*.json` IR program in [irDir] and emits all components.
///
/// Returns the total component count and the number of files written.
Future<({int components, int filesWritten})> emitAllInDir({
  required String irDir,
  required String outDir,
  ComponentEmitter emitter = const ComponentEmitter(),
  void Function(String)? log,
}) async {
  final dir = Directory(irDir);
  if (!dir.existsSync()) {
    throw FileSystemException('IR dir does not exist', irDir);
  }
  var components = 0;
  var filesWritten = 0;
  await for (final entity in dir.list()) {
    if (entity is! File || !entity.path.endsWith('.json')) continue;
    final program = await IrProgram.readJson(entity);
    for (final component in program.components) {
      filesWritten += await emitComponentToDir(
        component: component,
        outDir: outDir,
        emitter: emitter,
        log: log,
      );
      components++;
    }
  }
  return (components: components, filesWritten: filesWritten);
}

/// Emits a single IR program file (used by the watch loop on per-file change).
Future<int> emitProgramFile({
  required File irFile,
  required String outDir,
  ComponentEmitter emitter = const ComponentEmitter(),
  void Function(String)? log,
}) async {
  final program = await IrProgram.readJson(irFile);
  var filesWritten = 0;
  for (final component in program.components) {
    filesWritten += await emitComponentToDir(
      component: component,
      outDir: outDir,
      emitter: emitter,
      log: log,
    );
  }
  return filesWritten;
}
