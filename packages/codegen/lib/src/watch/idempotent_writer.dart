import 'dart:io';

/// Result of an [IdempotentWriter.write] call. Used by the watcher to log
/// whether a tick produced any work.
enum IdempotentWriteResult { created, updated, unchanged }

/// Writes a file only when the new contents differ byte-for-byte from what's
/// already on disk.
///
/// Phase 2 leans on this for two things:
/// 1. Avoid the noise of touching mtimes on every regen — `flutter run`'s
///    own watcher fires hot-reloads on mtime change, so untouched files
///    should *stay* untouched.
/// 2. Keep emission idempotent: identical IR JSON → byte-identical Dart
///    output, no spurious diffs in `git status`.
class IdempotentWriter {
  IdempotentWriter();

  Future<IdempotentWriteResult> write(String path, String contents) async {
    final file = File(path);
    if (await file.exists()) {
      final existing = await file.readAsString();
      if (existing == contents) {
        return IdempotentWriteResult.unchanged;
      }
      await file.writeAsString(contents);
      return IdempotentWriteResult.updated;
    }
    await file.parent.create(recursive: true);
    await file.writeAsString(contents);
    return IdempotentWriteResult.created;
  }
}
