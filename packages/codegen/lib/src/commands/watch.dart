import 'dart:io';

import 'package:args/command_runner.dart';
import 'package:watcher/watcher.dart';

class WatchCommand extends Command<int> {
  WatchCommand() {
    argParser
      ..addOption('ir', abbr: 'i', help: 'Directory containing IR JSON files.')
      ..addOption('out', abbr: 'o', help: 'Output directory under flutter_app/lib.');
  }

  @override
  String get name => 'watch';

  @override
  String get description => 'Watch IR dir and regenerate Dart on change.';

  @override
  Future<int> run() async {
    final irDir = argResults!['ir'] as String?;
    if (irDir == null) {
      stderr.writeln('Usage: tsxtoflutter watch --ir <dir> --out <dir>');
      return 64;
    }

    final watcher = DirectoryWatcher(irDir);
    stdout.writeln('Watching $irDir ...');
    await for (final event in watcher.events) {
      // TODO: debounce + dispatch to ConvertCommand for the changed file.
      stdout.writeln('${event.type} ${event.path}');
    }
    return 0;
  }
}
