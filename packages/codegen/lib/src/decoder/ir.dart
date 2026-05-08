// Dart-side IR decoder. JSON shape matches `packages/ir/src/types.ts` exactly.
//
// We deserialize what the TS side wrote; we never construct IR ourselves.
// Unknown semantic tags throw — the codegen targets a closed widget catalog.
import 'dart:convert';
import 'dart:io';

const Set<String> _semanticTags = {
  'stack',
  'box',
  'text',
  'text-inline',
  'image',
  'icon',
  'button',
  'link',
  'input',
  'textarea',
  'card',
  'divider',
  'list',
  'list-item',
  'avatar',
  'badge',
  'dialog',
  'sheet',
  'tabs',
  'tab',
  'fragment',
  'unknown',
};

class IrProgram {
  IrProgram({
    required this.version,
    required this.inputHash,
    required this.rulesetVersion,
    required this.components,
    required this.diagnostics,
  });

  final String version;
  final String inputHash;
  final String rulesetVersion;
  final List<IrComponent> components;
  final List<IrDiagnostic> diagnostics;

  static Future<IrProgram> readJson(File f) async {
    final raw = await f.readAsString();
    return fromJsonString(raw);
  }

  static IrProgram fromJsonString(String raw) {
    final json = jsonDecode(raw) as Map<String, dynamic>;
    return IrProgram._fromJson(json);
  }

  factory IrProgram._fromJson(Map<String, dynamic> json) {
    return IrProgram(
      version: json['version'] as String,
      inputHash: json['inputHash'] as String,
      rulesetVersion: json['rulesetVersion'] as String,
      components: (json['components'] as List)
          .cast<Map<String, dynamic>>()
          .map(IrComponent._fromJson)
          .toList(),
      diagnostics: (json['diagnostics'] as List)
          .cast<Map<String, dynamic>>()
          .map(IrDiagnostic._fromJson)
          .toList(),
    );
  }
}

class IrComponent {
  IrComponent({
    required this.id,
    required this.name,
    required this.params,
    required this.body,
  });

  final String id;
  final String name;
  final List<IrComponentParam> params;
  final IrNode body;

  factory IrComponent._fromJson(Map<String, dynamic> json) {
    return IrComponent(
      id: json['id'] as String,
      name: json['name'] as String,
      params: ((json['params'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(IrComponentParam._fromJson)
          .toList(),
      body: IrNode.fromJson(json['body'] as Map<String, dynamic>),
    );
  }
}

class IrComponentParam {
  IrComponentParam({
    required this.name,
    required this.type,
    this.optional = false,
  });

  final String name;
  final IrType type;
  final bool optional;

  factory IrComponentParam._fromJson(Map<String, dynamic> json) {
    return IrComponentParam(
      name: json['name'] as String,
      type: IrType.fromJson(json['type'] as Map<String, dynamic>),
      optional: (json['optional'] as bool?) ?? false,
    );
  }
}

class IrType {
  const IrType(this.kind, {this.of = const []});
  final String kind;
  final List<IrType> of;

  factory IrType.fromJson(Map<String, dynamic> json) {
    final kind = json['kind'] as String;
    if (kind == 'array') {
      return IrType(kind,
          of: [IrType.fromJson(json['of'] as Map<String, dynamic>)]);
    }
    if (kind == 'union') {
      return IrType(kind,
          of: (json['of'] as List)
              .cast<Map<String, dynamic>>()
              .map(IrType.fromJson)
              .toList());
    }
    return IrType(kind);
  }
}

class IrDiagnostic {
  IrDiagnostic({
    required this.severity,
    required this.code,
    required this.message,
  });

  final String severity;
  final String code;
  final String message;

  factory IrDiagnostic._fromJson(Map<String, dynamic> json) {
    return IrDiagnostic(
      severity: json['severity'] as String,
      code: json['code'] as String,
      message: json['message'] as String,
    );
  }
}

sealed class IrNode {
  static IrNode fromJson(Map<String, dynamic> json) {
    final kind = json['kind'] as String;
    return switch (kind) {
      'element' => IrElement._fromJson(json),
      'text' => IrText._fromJson(json),
      'expression' => IrExpression._fromJson(json),
      'conditional' => IrConditional._fromJson(json),
      'list' => IrList._fromJson(json),
      'fragment' => IrFragment._fromJson(json),
      'slot' => IrSlot._fromJson(json),
      _ => throw FormatException('Unknown IR node kind: $kind'),
    };
  }
}

class IrElement extends IrNode {
  IrElement({
    required this.tag,
    required this.sourceName,
    required this.style,
    required this.props,
    required this.events,
    required this.children,
  });

  final String tag;
  final String sourceName;
  final NormalizedStyle style;
  final Map<String, IrPropValue> props;
  final List<IrEventHandler> events;
  final List<IrNode> children;

  factory IrElement._fromJson(Map<String, dynamic> json) {
    final tag = json['tag'] as String;
    if (!_semanticTags.contains(tag)) {
      throw FormatException('Unsupported semantic tag: $tag');
    }
    return IrElement(
      tag: tag,
      sourceName: ((json['source'] as Map<String, dynamic>)['name']) as String,
      style: NormalizedStyle.fromJson(
          (json['style'] as Map<String, dynamic>?) ?? const {}),
      props: ((json['props'] as Map<String, dynamic>?) ?? const {})
          .map((k, v) =>
              MapEntry(k, IrPropValue.fromJson(v as Map<String, dynamic>))),
      events: ((json['events'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(IrEventHandler._fromJson)
          .toList(),
      children: ((json['children'] as List?) ?? const [])
          .cast<Map<String, dynamic>>()
          .map(IrNode.fromJson)
          .toList(),
    );
  }
}

class IrText extends IrNode {
  IrText(this.value);
  final String value;
  factory IrText._fromJson(Map<String, dynamic> json) =>
      IrText(json['value'] as String);
}

class IrExpression extends IrNode {
  IrExpression(this.expr);
  final IrPropValue expr;
  factory IrExpression._fromJson(Map<String, dynamic> json) =>
      IrExpression(IrPropValue.fromJson(json['expr'] as Map<String, dynamic>));
}

class IrConditional extends IrNode {
  IrConditional({required this.test, required this.consequent, this.alternate});
  final IrPropValue test;
  final IrNode consequent;
  final IrNode? alternate;
  factory IrConditional._fromJson(Map<String, dynamic> json) {
    return IrConditional(
      test: IrPropValue.fromJson(json['test'] as Map<String, dynamic>),
      consequent: IrNode.fromJson(json['consequent'] as Map<String, dynamic>),
      alternate: json['alternate'] == null
          ? null
          : IrNode.fromJson(json['alternate'] as Map<String, dynamic>),
    );
  }
}

class IrList extends IrNode {
  IrList({
    required this.items,
    required this.itemBinding,
    required this.body,
    this.indexBinding,
  });
  final IrPropValue items;
  final String itemBinding;
  final String? indexBinding;
  final IrNode body;
  factory IrList._fromJson(Map<String, dynamic> json) {
    return IrList(
      items: IrPropValue.fromJson(json['items'] as Map<String, dynamic>),
      itemBinding: json['itemBinding'] as String,
      indexBinding: json['indexBinding'] as String?,
      body: IrNode.fromJson(json['body'] as Map<String, dynamic>),
    );
  }
}

class IrFragment extends IrNode {
  IrFragment(this.children);
  final List<IrNode> children;
  factory IrFragment._fromJson(Map<String, dynamic> json) => IrFragment(
        ((json['children'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(IrNode.fromJson)
            .toList(),
      );
}

class IrSlot extends IrNode {
  IrSlot({required this.name, required this.children});
  final String name;
  final List<IrNode> children;
  factory IrSlot._fromJson(Map<String, dynamic> json) => IrSlot(
        name: json['name'] as String,
        children: ((json['children'] as List?) ?? const [])
            .cast<Map<String, dynamic>>()
            .map(IrNode.fromJson)
            .toList(),
      );
}

sealed class IrPropValue {
  static IrPropValue fromJson(Map<String, dynamic> json) {
    final kind = json['kind'] as String;
    return switch (kind) {
      'literal' => IrLiteral(json['value']),
      'paramRef' => IrParamRef(json['name'] as String),
      'memberRef' => IrMemberRef(
          object: json['object'] as String,
          path: (json['path'] as List).cast<String>(),
        ),
      'expression' => IrRawExpression(json['raw'] as String),
      _ => throw FormatException('Unknown IRPropValue kind: $kind'),
    };
  }
}

class IrLiteral extends IrPropValue {
  IrLiteral(this.value);
  final Object? value;
}

class IrParamRef extends IrPropValue {
  IrParamRef(this.name);
  final String name;
}

class IrMemberRef extends IrPropValue {
  IrMemberRef({required this.object, required this.path});
  final String object;
  final List<String> path;
}

class IrRawExpression extends IrPropValue {
  IrRawExpression(this.raw);
  final String raw;
}

class IrEventHandler {
  IrEventHandler({required this.name, required this.handler});
  final String name;
  final IrEventHandlerBody handler;
  factory IrEventHandler._fromJson(Map<String, dynamic> json) {
    return IrEventHandler(
      name: json['name'] as String,
      handler: IrEventHandlerBody.fromJson(
          json['handler'] as Map<String, dynamic>),
    );
  }
}

sealed class IrEventHandlerBody {
  static IrEventHandlerBody fromJson(Map<String, dynamic> json) {
    final kind = json['kind'] as String;
    return switch (kind) {
      'paramRef' => IrEventParamRef(json['name'] as String),
      'expression' => IrEventExpression(json['raw'] as String),
      _ => throw FormatException('Unknown IREventHandler kind: $kind'),
    };
  }
}

class IrEventParamRef extends IrEventHandlerBody {
  IrEventParamRef(this.name);
  final String name;
}

class IrEventExpression extends IrEventHandlerBody {
  IrEventExpression(this.raw);
  final String raw;
}

class NormalizedStyle {
  NormalizedStyle({this.layout, this.box, this.color, this.text});
  final StyleLayout? layout;
  final StyleBox? box;
  final StyleColor? color;
  final StyleText? text;

  factory NormalizedStyle.fromJson(Map<String, dynamic> json) {
    return NormalizedStyle(
      layout: json['layout'] == null
          ? null
          : StyleLayout.fromJson(json['layout'] as Map<String, dynamic>),
      box: json['box'] == null
          ? null
          : StyleBox.fromJson(json['box'] as Map<String, dynamic>),
      color: json['color'] == null
          ? null
          : StyleColor.fromJson(json['color'] as Map<String, dynamic>),
      text: json['text'] == null
          ? null
          : StyleText.fromJson(json['text'] as Map<String, dynamic>),
    );
  }
}

class StyleLayout {
  StyleLayout({
    this.display,
    this.direction,
    this.gap,
    this.align,
    this.justify,
    this.wrap,
  });
  final String? display;
  final String? direction;
  final IrLength? gap;
  final String? align;
  final String? justify;
  final bool? wrap;

  factory StyleLayout.fromJson(Map<String, dynamic> json) {
    return StyleLayout(
      display: json['display'] as String?,
      direction: json['direction'] as String?,
      gap: json['gap'] == null
          ? null
          : IrLength.fromJson(json['gap'] as Map<String, dynamic>),
      align: json['align'] as String?,
      justify: json['justify'] as String?,
      wrap: json['wrap'] as bool?,
    );
  }
}

class StyleBox {
  StyleBox({
    this.width,
    this.height,
    this.padding,
    this.margin,
    this.radius,
  });

  final IrLength? width;
  final IrLength? height;
  final IrEdgeInsets? padding;
  final IrEdgeInsets? margin;
  final IrRadius? radius;

  factory StyleBox.fromJson(Map<String, dynamic> json) {
    return StyleBox(
      width: _maybeLength(json['width']),
      height: _maybeLength(json['height']),
      padding: json['padding'] == null
          ? null
          : IrEdgeInsets.fromJson(json['padding'] as Map<String, dynamic>),
      margin: json['margin'] == null
          ? null
          : IrEdgeInsets.fromJson(json['margin'] as Map<String, dynamic>),
      radius: json['radius'] == null
          ? null
          : IrRadius.fromJson(json['radius'] as Map<String, dynamic>),
    );
  }
}

class StyleColor {
  StyleColor({this.bg, this.fg});
  final IrColorRef? bg;
  final IrColorRef? fg;
  factory StyleColor.fromJson(Map<String, dynamic> json) {
    return StyleColor(
      bg: json['bg'] == null
          ? null
          : IrColorRef.fromJson(json['bg'] as Map<String, dynamic>),
      fg: json['fg'] == null
          ? null
          : IrColorRef.fromJson(json['fg'] as Map<String, dynamic>),
    );
  }
}

class StyleText {
  StyleText({this.size, this.weight, this.align});
  final IrLength? size;
  final num? weight;
  final String? align;
  factory StyleText.fromJson(Map<String, dynamic> json) {
    return StyleText(
      size: _maybeLength(json['size']),
      weight: json['weight'] as num?,
      align: json['align'] as String?,
    );
  }
}

class IrLength {
  IrLength({required this.kind, this.value, this.path});
  final String kind;
  final num? value;
  final String? path;

  factory IrLength.fromJson(Map<String, dynamic> json) {
    return IrLength(
      kind: json['kind'] as String,
      value: json['value'] as num?,
      path: json['path'] as String?,
    );
  }
}

IrLength? _maybeLength(Object? raw) {
  if (raw == null) return null;
  return IrLength.fromJson(raw as Map<String, dynamic>);
}

class IrColorRef {
  IrColorRef({required this.kind, this.path, this.value});
  final String kind;
  final String? path;
  final String? value;
  factory IrColorRef.fromJson(Map<String, dynamic> json) {
    return IrColorRef(
      kind: json['kind'] as String,
      path: json['path'] as String?,
      value: json['value'] as String?,
    );
  }
}

class IrEdgeInsets {
  IrEdgeInsets({this.top, this.right, this.bottom, this.left, this.x, this.y});
  final IrLength? top;
  final IrLength? right;
  final IrLength? bottom;
  final IrLength? left;
  final IrLength? x;
  final IrLength? y;
  factory IrEdgeInsets.fromJson(Map<String, dynamic> json) {
    return IrEdgeInsets(
      top: _maybeLength(json['top']),
      right: _maybeLength(json['right']),
      bottom: _maybeLength(json['bottom']),
      left: _maybeLength(json['left']),
      x: _maybeLength(json['x']),
      y: _maybeLength(json['y']),
    );
  }
}

class IrRadius {
  IrRadius({this.tl, this.tr, this.bl, this.br, this.all});
  final IrLength? tl;
  final IrLength? tr;
  final IrLength? bl;
  final IrLength? br;
  final IrLength? all;
  factory IrRadius.fromJson(Map<String, dynamic> json) {
    return IrRadius(
      tl: _maybeLength(json['tl']),
      tr: _maybeLength(json['tr']),
      bl: _maybeLength(json['bl']),
      br: _maybeLength(json['br']),
      all: _maybeLength(json['all']),
    );
  }
}
