// Integration tests for the widgets emitter ↔ SemanticsMapping wiring.
//
// Phase 4 R8 says every IRElement carrying `aria-*` / `role` must surface as a
// `Semantics(...)` (or `ExcludeSemantics(...)`) wrapper around the emitted
// widget. Phase 4 R2 additionally requires icon-only buttons to set `tooltip:`
// from the same aria-label.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/decoder/ir.dart';
import 'package:tsxtoflutter_codegen/src/mapping/widgets.dart';

IrComponent _component({required IrNode body}) {
  return IrComponent(id: 'x', name: 'X', params: const [], body: body);
}

IrElement _button({
  Map<String, IrPropValue> props = const {},
  List<IrNode> children = const [],
}) {
  return IrElement(
    tag: 'button',
    sourceName: 'button',
    style: NormalizedStyle.fromJson(const {}),
    props: props,
    events: const [],
    children: children,
  );
}

IrElement _icon({Map<String, IrPropValue> props = const {}}) {
  return IrElement(
    tag: 'icon',
    sourceName: 'Icon',
    style: NormalizedStyle.fromJson(const {}),
    props: {'name': IrLiteral('home'), ...props},
    events: const [],
    children: const [],
  );
}

void main() {
  group('emitNode wraps elements with Semantics from aria-*/role', () {
    test('button with aria-label gets Semantics(label:)', () {
      final el = _button(props: {'aria-label': IrLiteral('Submit form')});
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains("Semantics(label: 'Submit form'"));
      expect(dart, contains('FilledButton'));
      // Wrapper order: Semantics on the outside, FilledButton on the inside.
      expect(dart.indexOf('Semantics'), lessThan(dart.indexOf('FilledButton')));
    });

    test('button with role=button is idempotent (no double Semantics)', () {
      final el = _button(props: {'role': IrLiteral('button')});
      final dart = emitNode(el, _component(body: el));
      // role=button collapses with FilledButton's intrinsic semantics — only
      // one Semantics wrapper allowed.
      expect('Semantics('.allMatches(dart).length, 1);
      expect(dart, contains('button: true'));
    });

    test('aria-hidden=true wraps in ExcludeSemantics', () {
      final el = _button(props: {'aria-hidden': IrLiteral(true)});
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('ExcludeSemantics'));
      expect(dart, isNot(contains('Semantics(label:')));
    });

    test('button with no aria/role props emits unchanged FilledButton', () {
      // Existing fixtures must not regress — no Semantics wrapper when the
      // SemanticsMapping is empty.
      final el = _button();
      final dart = emitNode(el, _component(body: el));
      expect(dart, isNot(contains('Semantics')));
      expect(dart, isNot(contains('ExcludeSemantics')));
      expect(dart, contains('FilledButton'));
    });

    test('icon with aria-label is wrapped in Semantics', () {
      final el = _icon(props: {'aria-label': IrLiteral('Home page')});
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains("Semantics(label: 'Home page'"));
      expect(dart, contains('Icons.home'));
    });

    test('icon with aria-hidden=true is excluded', () {
      final el = _icon(props: {'aria-hidden': IrLiteral(true)});
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('ExcludeSemantics'));
    });

    test('aria-disabled=true emits Semantics(enabled: false) on a button', () {
      final el = _button(props: {'aria-disabled': IrLiteral(true)});
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('enabled: false'));
    });
  });
}
