// Codegen for IrElement{tag:'icon', scaffold:'svg'}: the SVG-shaped icon must
// emit a SizedBox-with-Placeholder *scaffold* plus a developer-facing block
// comment listing the three best-practice paths (Icons.*, vector_graphics,
// flutter_svg). The bare `tag:'icon'` path (lucide-mapped name) is unaffected.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/decoder/ir.dart';
import 'package:tsxtoflutter_codegen/src/mapping/widgets.dart';

IrComponent _component({required IrNode body}) {
  return IrComponent(id: 'x', name: 'X', params: const [], body: body);
}

IrElement _svgScaffold({
  Map<String, IrPropValue> extraProps = const {},
}) {
  return IrElement(
    tag: 'icon',
    sourceName: 'svg',
    style: NormalizedStyle.fromJson(const {}),
    props: {
      'scaffold': IrLiteral('svg'),
      ...extraProps,
    },
    events: const [],
    children: const [],
  );
}

void main() {
  group('emitNode(IrElement icon with scaffold="svg")', () {
    test('emits SizedBox(child: Placeholder()) as the scaffold widget', () {
      final el = _svgScaffold();
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('SizedBox('));
      expect(dart, contains('Placeholder()'));
      // Must NOT route to the regular Icon emitter (which would emit
      // `const Icon(...)`). The TODO comment may still reference `Icons.<name>`
      // as best-practice guidance, so we check the widget shape, not substring.
      expect(dart, isNot(contains('const Icon(')));
    });

    test('includes a block comment with the three best-practice paths', () {
      final el = _svgScaffold();
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('/*'));
      expect(dart, contains('*/'));
      expect(dart, contains('TODO'));
      // Each best-practice path should be referenced by name.
      expect(dart, contains('Icons.'));
      expect(dart, contains('vector_graphics'));
      expect(dart, contains('flutter_svg'));
    });

    test('uses width/height literal props for the SizedBox dimensions', () {
      final el = _svgScaffold(extraProps: {
        'width': IrLiteral(12),
        'height': IrLiteral(20),
      });
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('width: 12'));
      expect(dart, contains('height: 20'));
    });

    test('falls back to a default size when width/height are missing', () {
      final el = _svgScaffold();
      final dart = emitNode(el, _component(body: el));
      // Default chosen so the scaffold renders visibly without 0×0 collapse.
      expect(dart, contains('width: 24'));
      expect(dart, contains('height: 24'));
    });

    test('non-svg icons (lucide map) still use the regular Icon emitter', () {
      // Regression guard: the new branch must not swallow the existing path.
      final el = IrElement(
        tag: 'icon',
        sourceName: 'ChevronRight',
        style: NormalizedStyle.fromJson(const {}),
        props: {'name': IrLiteral('chevron_right')},
        events: const [],
        children: const [],
      );
      final dart = emitNode(el, _component(body: el));
      expect(dart, contains('Icons.chevron_right'));
      expect(dart, isNot(contains('Placeholder')));
      expect(dart, isNot(contains('TODO')));
    });
  });
}
