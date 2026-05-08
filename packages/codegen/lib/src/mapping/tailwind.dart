// `NormalizedStyle` → Flutter widget wrappers.
//
// Phase 1 scope: gap (used by Row.spacing/Column.spacing), width/height,
// padding (EdgeInsets), radius. Wraps an inner expression with the chain
// of widgets the style demands and returns the resulting Dart expression
// as a string.
import '../decoder/ir.dart';

String wrapWithBox(StyleBox? box, String inner) {
  if (box == null) return inner;
  var out = inner;

  if (box.padding != null) {
    final pad = _edgeInsetsExpression(box.padding!);
    if (pad != null) out = 'Padding(padding: $pad, child: $out)';
  }

  final w = box.width?.value;
  final h = box.height?.value;
  if (w != null || h != null) {
    final args = <String>[
      if (w != null) 'width: ${_num(w)}',
      if (h != null) 'height: ${_num(h)}',
      'child: $out',
    ];
    out = 'SizedBox(${args.join(", ")})';
  }

  return out;
}

String? _edgeInsetsExpression(IrEdgeInsets ei) {
  final hasXY = ei.x != null || ei.y != null;
  if (hasXY &&
      ei.top == null &&
      ei.bottom == null &&
      ei.left == null &&
      ei.right == null) {
    final parts = <String>[
      if (ei.x != null) 'horizontal: ${_num(ei.x!.value!)}',
      if (ei.y != null) 'vertical: ${_num(ei.y!.value!)}',
    ];
    return 'const EdgeInsets.symmetric(${parts.join(", ")})';
  }

  if (ei.top != null ||
      ei.right != null ||
      ei.bottom != null ||
      ei.left != null) {
    final parts = <String>[
      'top: ${_num((ei.top?.value ?? ei.y?.value) ?? 0)}',
      'right: ${_num((ei.right?.value ?? ei.x?.value) ?? 0)}',
      'bottom: ${_num((ei.bottom?.value ?? ei.y?.value) ?? 0)}',
      'left: ${_num((ei.left?.value ?? ei.x?.value) ?? 0)}',
    ];
    return 'const EdgeInsets.only(${parts.join(", ")})';
  }
  return null;
}

String _num(num n) {
  if (n == n.toInt()) return '${n.toInt()}';
  return '$n';
}
