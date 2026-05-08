import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/watch/idempotent_writer.dart';

void main() {
  group('IdempotentWriter', () {
    late Directory dir;
    setUp(() async {
      dir = await Directory.systemTemp.createTemp('idem_writer_');
    });
    tearDown(() async {
      await dir.delete(recursive: true);
    });

    test('writes a new file when missing', () async {
      final writer = IdempotentWriter();
      final target = p.join(dir.path, 'a.dart');
      final result = await writer.write(target, 'class A {}\n');
      expect(result, IdempotentWriteResult.created);
      expect(await File(target).readAsString(), 'class A {}\n');
    });

    test('skips writing when contents are byte-identical', () async {
      final writer = IdempotentWriter();
      final target = p.join(dir.path, 'a.dart');
      await writer.write(target, 'class A {}\n');
      final firstMtime = await File(target).lastModified();
      // Sleep just enough that mtime would differ if a write happened.
      await Future<void>.delayed(const Duration(milliseconds: 25));
      final result = await writer.write(target, 'class A {}\n');
      expect(result, IdempotentWriteResult.unchanged);
      expect(await File(target).lastModified(), firstMtime);
    });

    test('rewrites when contents differ', () async {
      final writer = IdempotentWriter();
      final target = p.join(dir.path, 'a.dart');
      await writer.write(target, 'class A {}\n');
      final result = await writer.write(target, 'class B {}\n');
      expect(result, IdempotentWriteResult.updated);
      expect(await File(target).readAsString(), 'class B {}\n');
    });

    test('creates parent directories on demand', () async {
      final writer = IdempotentWriter();
      final target = p.join(dir.path, 'nested', 'deeper', 'a.dart');
      final result = await writer.write(target, 'class A {}\n');
      expect(result, IdempotentWriteResult.created);
      expect(File(target).existsSync(), isTrue);
    });
  });
}
