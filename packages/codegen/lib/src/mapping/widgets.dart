// IR → Flutter widget expressions.
//
// Closed catalog: each [IrElement.tag] dispatches to a builder; unknown tags
// throw at decode time. Phase 1 covers `button`, `icon`, `text`, `text-inline`,
// `stack`, and `fragment`.
import '../decoder/ir.dart';
import 'tailwind.dart';

/// Public entry: render an IR node as a Dart widget expression string.
String emitNode(IrNode node, IrComponent component) {
  return switch (node) {
    IrElement() => emitElement(node, component),
    IrText() => 'Text(${_dartString(node.value)})',
    IrExpression() => emitExpressionAsWidget(node.expr),
    IrFragment() => emitChildList(node.children, component, gap: null),
    IrConditional() => 'const SizedBox.shrink()', // TODO(phase 2)
    IrList() => 'const SizedBox.shrink()', // TODO(phase 2)
    IrSlot() => emitChildList(node.children, component, gap: null),
  };
}

String emitElement(IrElement el, IrComponent component) {
  switch (el.tag) {
    case 'button':
      return _emitButton(el, component);
    case 'icon':
      return _emitIcon(el);
    case 'text':
    case 'text-inline':
      return _emitText(el, component);
    case 'stack':
      return _emitStack(el, component);
    case 'fragment':
      return emitChildList(el.children, component, gap: el.style.layout?.gap);
    default:
      // Closed catalog — but if a less-common tag slips through we render
      // its children inside a Column to keep emission lossless.
      return _emitStack(el, component);
  }
}

String _emitButton(IrElement el, IrComponent component) {
  final onPressed = _resolveOnPressed(el);
  final child =
      _wrapChildren(el.children, component, gap: el.style.layout?.gap);
  return 'FilledButton(onPressed: $onPressed, child: $child)';
}

String _emitIcon(IrElement el) {
  final iconProp = el.props['name'];
  final iconName = iconProp is IrLiteral && iconProp.value is String
      ? iconProp.value as String
      : 'help_outline';

  final size = el.style.box?.width?.value ?? el.style.box?.height?.value;
  final args = <String>['Icons.$iconName'];
  if (size != null) args.add('size: ${_num(size)}');
  return 'const Icon(${args.join(", ")})';
}

String _emitText(IrElement el, IrComponent component) {
  if (el.children.isEmpty) {
    return 'const Text(${_dartString("")})';
  }
  if (el.children.length == 1) {
    final c = el.children.first;
    if (c is IrText) return 'Text(${_dartString(c.value)})';
    if (c is IrExpression) {
      return 'Text(${_propValueAsString(c.expr)})';
    }
  }
  // Multi-child text — render as concatenated string expression.
  final pieces =
      el.children.map((c) => _textPiece(c, component)).toList(growable: false);
  return 'Text(${pieces.join(" ")})';
}

String _textPiece(IrNode c, IrComponent component) {
  if (c is IrText) return _dartString(c.value);
  if (c is IrExpression) return _propValueAsString(c.expr);
  return _dartString('');
}

String _emitStack(IrElement el, IrComponent component) {
  final inner =
      _wrapChildren(el.children, component, gap: el.style.layout?.gap);
  return wrapWithBox(el.style.box, inner);
}

String _wrapChildren(
  List<IrNode> children,
  IrComponent component, {
  required IrLength? gap,
}) {
  if (children.isEmpty) return 'const SizedBox.shrink()';
  if (children.length == 1) return emitNode(children.first, component);

  final list = children.map((c) => emitNode(c, component)).join(', ');
  final args = <String>['mainAxisSize: MainAxisSize.min'];
  if (gap != null && gap.value != null) {
    args.add('spacing: ${_num(gap.value!)}');
  }
  args.add('children: [$list]');
  return 'Row(${args.join(", ")})';
}

String emitChildList(
  List<IrNode> children,
  IrComponent component, {
  required IrLength? gap,
}) {
  return _wrapChildren(children, component, gap: gap);
}

String emitExpressionAsWidget(IrPropValue expr) {
  // For Phase 1 we assume an expression child renders as text.
  return 'Text(${_propValueAsString(expr)})';
}

String _propValueAsString(IrPropValue v) {
  return switch (v) {
    IrLiteral() => v.value is String
        ? _dartString(v.value as String)
        : '${v.value}',
    IrParamRef() => 'widget.${v.name}',
    IrMemberRef() => '${v.object}.${v.path.join(".")}',
    IrRawExpression() => v.raw,
  };
}

String _resolveOnPressed(IrElement el) {
  for (final ev in el.events) {
    if (ev.name != 'tap') continue;
    final h = ev.handler;
    if (h is IrEventParamRef) return 'widget.${h.name}';
    if (h is IrEventExpression) return h.raw;
  }
  return 'null';
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

String _num(num n) {
  if (n == n.toInt()) return '${n.toInt()}';
  return '$n';
}
