import 'dart:io';

import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/tsxtoflutter_codegen.dart';

void main() {
  group('ComponentEmitter (Cta golden)', () {
    final fixture = File('test/fixtures/cta.ir.json');
    final shellGolden = File('test/golden/cta.dart');
    final genGolden = File('test/golden/cta.g.dart');

    late EmittedComponent emitted;

    setUpAll(() async {
      final program = IrProgram.fromJsonString(await fixture.readAsString());
      expect(program.components, hasLength(1));
      const emitter = ComponentEmitter();
      emitted = emitter.emit(program.components.first);

      // Bootstrap: if the goldens are missing, write them. The follow-up test
      // run will then assert byte-for-byte equality.
      if (!shellGolden.existsSync()) {
        await shellGolden.parent.create(recursive: true);
        await shellGolden.writeAsString(emitted.shellSource);
      }
      if (!genGolden.existsSync()) {
        await genGolden.writeAsString(emitted.generatedSource);
      }
    });

    test('basename is snake_case of the component name', () {
      expect(emitted.basename, 'cta');
    });

    test('shell file matches the golden', () async {
      expect(emitted.shellSource, await shellGolden.readAsString());
    });

    test('generated file matches the golden', () async {
      expect(emitted.generatedSource, await genGolden.readAsString());
    });

    test('generated file declares the do-not-modify banner', () {
      expect(emitted.generatedSource,
          contains('GENERATED CODE - DO NOT MODIFY BY HAND'));
    });

    test('shell declares the part directive for the .g.dart pair', () {
      expect(emitted.shellSource, contains("part 'cta.g.dart';"));
    });

    test('generated file is `part of` the shell', () {
      expect(emitted.generatedSource, contains("part of 'cta.dart';"));
    });

    test('generated file references the param-ref onPressed', () {
      expect(emitted.generatedSource, contains('widget.onGo'));
    });

    test('generated file resolves Tailwind gap-2 to Row spacing 8', () {
      expect(emitted.generatedSource, contains('spacing: 8'));
    });

    test('lucide ChevronRight maps to Icons.chevron_right', () {
      expect(emitted.generatedSource, contains('Icons.chevron_right'));
    });
  });

  test('IR decoder rejects unknown semantic tags', () {
    const badJson = '''
{
  "version": "0.1",
  "inputHash": "x",
  "rulesetVersion": "0.1.0",
  "components": [{
    "kind": "component",
    "id": "x",
    "name": "Bad",
    "source": {"file": "x", "line": 0, "col": 0},
    "params": [],
    "body": {
      "kind": "element",
      "tag": "marquee",
      "source": {"name": "marquee", "loc": {"file":"x","line":0,"col":0}},
      "style": {},
      "props": {},
      "events": [],
      "children": []
    }
  }],
  "diagnostics": []
}
''';
    expect(() => IrProgram.fromJsonString(badJson), throwsFormatException);
  });
}
