// `aria-*` and `role` → Flutter `Semantics` mapping.
//
// Pure functional module. Reads the `props` map of an `IrElement` and produces
// a `SemanticsMapping` that wraps a child Dart expression in a `Semantics`
// (or `ExcludeSemantics`) node when needed.
//
// Source of the mapping rules: docs/research/03-android-platform.md §1.6 and
// docs/research/04-ios-platform.md §5.
//
// Coverage:
//   aria-label, aria-labelledby, aria-describedby, aria-hidden,
//   aria-pressed, aria-expanded, aria-disabled,
//   role="button" | role="heading" | role="link"
//
// `aria-hidden="true"` takes priority over every other attribute — if a node
// is hidden from assistive tech, no other Semantics field is emitted.
//
// Non-literal attribute values (variable refs, expressions) are intentionally
// ignored: Semantics flags must be evaluable at codegen time. A future phase
// can add IR-level dynamic-value support; for now we silently skip them.
import '../decoder/ir.dart';

class SemanticsMapping {
  const SemanticsMapping._({
    required this.exclude,
    required this.fields,
    required this.tooltip,
  });

  /// Wrap [child] in `ExcludeSemantics(child: ...)` regardless of other args.
  final bool exclude;

  /// Ordered map of `Semantics(...)` constructor args (e.g. `{'button': 'true'}`).
  /// Insertion order is preserved so that emitted output is deterministic.
  final Map<String, String> fields;

  /// `aria-label` text suitable for use as a widget `tooltip:` (icon-only
  /// buttons especially). `null` when no string label was provided.
  final String? tooltip;

  /// True when the mapping is a no-op — caller can skip wrapping entirely.
  bool get isEmpty => !exclude && fields.isEmpty;

  /// Wrap the given Dart child expression with the Semantics node, or return
  /// it unchanged when [isEmpty].
  String wrap(String child) {
    if (exclude) return 'ExcludeSemantics(child: $child)';
    if (fields.isEmpty) return child;
    final args = [
      for (final entry in fields.entries) '${entry.key}: ${entry.value}',
      'child: $child',
    ];
    return 'Semantics(${args.join(", ")})';
  }

  static SemanticsMapping fromProps(Map<String, IrPropValue> props) {
    // 1. aria-hidden short-circuit.
    final hidden = _bool(props['aria-hidden']);
    if (hidden == true) {
      return const SemanticsMapping._(
          exclude: true, fields: {}, tooltip: null);
    }

    // 2. Fields are emitted in a stable, alphabetical-by-Dart-name order so
    //    output is deterministic across runs and formatter passes.
    final fields = <String, String>{};

    // role=button | heading | link
    final role = _str(props['role']);
    switch (role) {
      case 'button':
        fields['button'] = 'true';
      case 'heading':
        fields['header'] = 'true';
      case 'link':
        fields['link'] = 'true';
      case _:
        // Unknown roles silently ignored — the closed catalog only honors
        // the three above.
        break;
    }

    // aria-disabled → enabled: false (only emitted when explicitly true).
    final disabled = _bool(props['aria-disabled']);
    if (disabled == true) fields['enabled'] = 'false';

    // aria-expanded → expanded: <bool>
    final expanded = _bool(props['aria-expanded']);
    if (expanded != null) fields['expanded'] = expanded.toString();

    // aria-describedby → hint
    final describedBy =
        _str(props['aria-describedby']) ?? _str(props['aria-labelledby']);
    if (describedBy != null) fields['hint'] = _dartString(describedBy);

    // aria-label → label
    final label = _str(props['aria-label']);
    if (label != null) fields['label'] = _dartString(label);

    // aria-pressed implies a toggle button.
    final pressed = _bool(props['aria-pressed']);
    if (pressed != null) {
      fields.putIfAbsent('button', () => 'true');
      fields['toggled'] = pressed.toString();
    }

    return SemanticsMapping._(
      exclude: false,
      fields: fields,
      tooltip: label,
    );
  }
}

bool? _bool(IrPropValue? v) {
  if (v is IrLiteral && v.value is bool) return v.value as bool;
  return null;
}

String? _str(IrPropValue? v) {
  if (v is IrLiteral && v.value is String) return v.value as String;
  return null;
}

String _dartString(String s) {
  final escaped = s
      .replaceAll(r'\', r'\\')
      .replaceAll("'", r"\'")
      .replaceAll('\n', r'\n')
      .replaceAll('\r', r'\r')
      .replaceAll(r'$', r'\$');
  return "'$escaped'";
}
