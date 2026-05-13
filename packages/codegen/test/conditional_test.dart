// Codegen for IrConditional: should emit a Dart ternary, not always
// `const SizedBox.shrink()`. The alternate-less form falls back to
// `const SizedBox.shrink()` for the `else` branch.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/decoder/ir.dart';
import 'package:tsxtoflutter_codegen/src/mapping/widgets.dart';

IrComponent _component({required IrNode body}) {
  return IrComponent(id: 'x', name: 'X', params: const [], body: body);
}

IrElement _icon({String name = 'home'}) {
  return IrElement(
    tag: 'icon',
    sourceName: 'Icon',
    style: NormalizedStyle.fromJson(const {}),
    props: {'name': IrLiteral(name)},
    events: const [],
    children: const [],
  );
}

void main() {
  group('emitNode(IrConditional)', () {
    test('cond && <X/> renders as `test ? widget : const SizedBox.shrink()`',
        () {
      final cond = IrConditional(
        test: IrParamRef('checked'),
        consequent: _icon(name: 'check'),
      );
      final dart = emitNode(cond, _component(body: cond));
      expect(dart, contains('widget.checked'));
      expect(dart, contains('?'));
      expect(dart, contains('Icons.check'));
      expect(dart, contains('const SizedBox.shrink()'));
      // Order matters: test before `?`, consequent before `:`, alternate last.
      expect(dart.indexOf('widget.checked'), lessThan(dart.indexOf('?')));
      expect(dart.indexOf('Icons.check'), lessThan(dart.indexOf(':')));
      expect(dart.indexOf(':'),
          lessThan(dart.indexOf('const SizedBox.shrink()')));
    });

    test(
        'cond ? <A/> : <B/> renders both branches as widget expressions, not shrink',
        () {
      final cond = IrConditional(
        test: IrParamRef('checked'),
        consequent: _icon(name: 'check'),
        alternate: _icon(name: 'close'),
      );
      final dart = emitNode(cond, _component(body: cond));
      expect(dart, contains('Icons.check'));
      expect(dart, contains('Icons.close'));
      expect(dart, isNot(contains('SizedBox.shrink')));
    });

    test('emitted form is parenthesized so it composes inside child lists',
        () {
      // When dropped into Row(children: [..., <ternary>, ...]) the result must
      // remain a single expression. Wrapping in `(test ? a : b)` is the cheap
      // way to keep precedence sane.
      final cond = IrConditional(
        test: IrParamRef('checked'),
        consequent: _icon(),
      );
      final dart = emitNode(cond, _component(body: cond));
      expect(dart.startsWith('('), isTrue,
          reason: 'expected leading paren, got: $dart');
      expect(dart.endsWith(')'), isTrue,
          reason: 'expected trailing paren, got: $dart');
    });
  });
}
