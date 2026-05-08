import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/emitter/idempotent_writer.dart';

void main() {
  late Directory tempIr;
  late Directory tempOut;

  setUp(() async {
    tempIr = await Directory.systemTemp.createTemp('codegen-watch-ir-');
    tempOut = await Directory.systemTemp.createTemp('codegen-watch-out-');
    final fixture = File(p.join('test', 'fixtures', 'cta.ir.json'));
    await File(p.join(tempIr.path, 'cta.ir.json'))
        .writeAsString(await fixture.readAsString());
  });

  tearDown(() async {
    if (tempIr.existsSync()) await tempIr.delete(recursive: true);
    if (tempOut.existsSync()) await tempOut.delete(recursive: true);
  });

  test('emitAllInDir produces shell + generated pair on first run', () async {
    final result = await emitAllInDir(irDir: tempIr.path, outDir: tempOut.path);
    expect(result.components, 1);
    expect(result.filesWritten, 2);
    expect(File(p.join(tempOut.path, 'cta.dart')).existsSync(), isTrue);
    expect(File(p.join(tempOut.path, 'cta.g.dart')).existsSync(), isTrue);
  });

  test('second run with identical IR writes no files (idempotent)', () async {
    await emitAllInDir(irDir: tempIr.path, outDir: tempOut.path);
    final genFile = File(p.join(tempOut.path, 'cta.g.dart'));
    final mtimeBefore = await genFile.lastModified();

    // Sleep enough to outrun fs mtime resolution.
    await Future<void>.delayed(const Duration(milliseconds: 20));

    final second = await emitAllInDir(irDir: tempIr.path, outDir: tempOut.path);
    expect(second.components, 1);
    expect(second.filesWritten, 0);
    final mtimeAfter = await genFile.lastModified();
    expect(mtimeAfter, equals(mtimeBefore));
  });

  test('preserves a hand-edited shell file', () async {
    await emitAllInDir(irDir: tempIr.path, outDir: tempOut.path);
    final shell = File(p.join(tempOut.path, 'cta.dart'));
    final hand = await shell.readAsString();
    final modified = '$hand\n// hand edit\n';
    await shell.writeAsString(modified);

    final second = await emitAllInDir(irDir: tempIr.path, outDir: tempOut.path);
    expect(second.filesWritten, 0);
    expect(await shell.readAsString(), equals(modified));
  });

  test('writeIfChanged returns false when bytes match', () async {
    final f = p.join(tempOut.path, 'sample.txt');
    expect(await writeIfChanged(f, 'hello'), isTrue);
    expect(await writeIfChanged(f, 'hello'), isFalse);
    expect(await writeIfChanged(f, 'world'), isTrue);
  });
}
