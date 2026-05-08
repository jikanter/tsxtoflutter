// Tests for the aria-* → Semantics mapping. Pure functional API; tests are
// straight string comparisons against expected Dart-source output.
import 'package:test/test.dart';
import 'package:tsxtoflutter_codegen/src/decoder/ir.dart';
import 'package:tsxtoflutter_codegen/src/mapping/semantics.dart';

// Pulls package config & helpers in via the public library above. The
// internal-path import on `mapping/semantics.dart` is intentional — Phase 4
// keeps the new mapping module out of the public API surface until the
// emitter integration lands.

IrPropValue _str(String s) => IrLiteral(s);
IrPropValue _bool(bool b) => IrLiteral(b);

void main() {
  group('SemanticsMapping.fromProps', () {
    test('returns no-op when no aria-* / role props are present', () {
      final result = SemanticsMapping.fromProps(const {});
      expect(result.isEmpty, isTrue);
      expect(result.wrap('child'), 'child');
    });

    test('aria-label → Semantics(label: ...)', () {
      final result = SemanticsMapping.fromProps({'aria-label': _str('Submit')});
      expect(result.isEmpty, isFalse);
      expect(result.wrap('FilledButton(...)'),
          "Semantics(label: 'Submit', child: FilledButton(...))");
    });

    test('aria-hidden=true → ExcludeSemantics wrap (highest priority)', () {
      final result = SemanticsMapping.fromProps({
        'aria-label': _str('ignored'),
        'aria-hidden': _bool(true),
      });
      expect(result.wrap('Icon(Icons.x)'),
          'ExcludeSemantics(child: Icon(Icons.x))');
    });

    test('aria-hidden=false is a no-op', () {
      final result = SemanticsMapping.fromProps({'aria-hidden': _bool(false)});
      expect(result.isEmpty, isTrue);
    });

    test('role="button" → Semantics(button: true)', () {
      final result = SemanticsMapping.fromProps({'role': _str('button')});
      expect(result.wrap('GestureDetector(...)'),
          'Semantics(button: true, child: GestureDetector(...))');
    });

    test('role="heading" → Semantics(header: true)', () {
      final result = SemanticsMapping.fromProps({'role': _str('heading')});
      expect(
          result.wrap('Text("Hi")'), 'Semantics(header: true, child: Text("Hi"))');
    });

    test('role="link" → Semantics(link: true)', () {
      final result = SemanticsMapping.fromProps({'role': _str('link')});
      expect(result.wrap('Text("More")'),
          'Semantics(link: true, child: Text("More"))');
    });

    test('aria-pressed=true → Semantics(toggled: true, button: true)', () {
      final result = SemanticsMapping.fromProps({
        'aria-pressed': _bool(true),
      });
      expect(result.wrap('IconButton(...)'),
          'Semantics(button: true, toggled: true, child: IconButton(...))');
    });

    test('aria-expanded=true → Semantics(expanded: true)', () {
      final result = SemanticsMapping.fromProps({
        'aria-expanded': _bool(true),
      });
      expect(result.wrap('Icon(Icons.x)'),
          'Semantics(expanded: true, child: Icon(Icons.x))');
    });

    test('aria-disabled=true → Semantics(enabled: false)', () {
      final result = SemanticsMapping.fromProps({
        'aria-disabled': _bool(true),
      });
      expect(result.wrap('child'), 'Semantics(enabled: false, child: child)');
    });

    test('aria-describedby → hint', () {
      final result = SemanticsMapping.fromProps({
        'aria-describedby': _str('Long description'),
      });
      expect(result.wrap('child'),
          "Semantics(hint: 'Long description', child: child)");
    });

    test('combines multiple aria attributes deterministically', () {
      final result = SemanticsMapping.fromProps({
        'role': _str('button'),
        'aria-label': _str('Open menu'),
        'aria-expanded': _bool(false),
        'aria-disabled': _bool(false),
      });
      expect(result.wrap('Foo()'),
          "Semantics(button: true, expanded: false, label: 'Open menu', child: Foo())");
    });

    test('ignores unsupported role values gracefully', () {
      final result = SemanticsMapping.fromProps({'role': _str('something-weird')});
      expect(result.isEmpty, isTrue);
    });

    test('non-literal aria values are ignored (no run-time eval)', () {
      final result = SemanticsMapping.fromProps({
        'aria-label': IrParamRef('dynamicLabel'),
      });
      expect(result.isEmpty, isTrue);
    });

    test('icon-only button needs tooltip — exposed via needsTooltip', () {
      // Icon-only buttons emit `tooltip:` so VoiceOver reads the tooltip as
      // the label. SemanticsMapping reports the recommended tooltip text
      // (from aria-label) so the caller can attach it to the widget.
      final result = SemanticsMapping.fromProps({'aria-label': _str('Close')});
      expect(result.tooltip, 'Close');
    });
  });
}
