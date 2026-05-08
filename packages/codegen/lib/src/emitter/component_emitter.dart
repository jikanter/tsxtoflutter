// Emits the `<component>.dart` (handwritten shell) and `<component>.g.dart`
// (regenerated widget tree) pair from a single [IrComponent].
//
// The split exists so developers can hand-edit the shell file freely; only
// `*.g.dart` is overwritten on every codegen run.
import '../decoder/ir.dart';
import '../format.dart';
import '../mapping/widgets.dart';

class ComponentEmitter {
  const ComponentEmitter();

  EmittedComponent emit(IrComponent component) {
    final base = _toSnake(component.name);
    final shellSource = formatDart(_buildShell(component, base));
    final generatedSource = formatDart(_buildGenerated(component, base));
    return EmittedComponent(
      basename: base,
      shellSource: shellSource,
      generatedSource: generatedSource,
    );
  }

  String _buildShell(IrComponent component, String base) {
    final fields = component.params.map(_paramField).toList();
    final ctorParams = component.params.map(_paramCtor).toList();
    final fieldDecls = fields.join('\n  ');
    final ctorList = ctorParams.isEmpty
        ? 'const ${component.name}({super.key})'
        : 'const ${component.name}({super.key, ${ctorParams.join(", ")}})';

    return '''
import 'package:flutter/material.dart';

part '$base.g.dart';

class ${component.name} extends StatelessWidget {
  $ctorList;

  ${fieldDecls.isEmpty ? '' : fieldDecls}

  @override
  Widget build(BuildContext context) => _\$${component.name}Build(this, context);
}
''';
  }

  String _buildGenerated(IrComponent component, String base) {
    final widgetExpr = emitNode(component.body, component);
    return '''
// GENERATED CODE - DO NOT MODIFY BY HAND
part of '$base.dart';

Widget _\$${component.name}Build(${component.name} widget, BuildContext context) {
  return $widgetExpr;
}
''';
  }

  String _paramField(IrComponentParam p) {
    final type = _dartType(p.type, optional: p.optional);
    return 'final $type ${p.name};';
  }

  String _paramCtor(IrComponentParam p) {
    return p.optional ? 'this.${p.name}' : 'required this.${p.name}';
  }

  String _dartType(IrType t, {required bool optional}) {
    final base = switch (t.kind) {
      'string' => 'String',
      'number' => 'num',
      'boolean' => 'bool',
      'callback' => 'VoidCallback',
      'node' => 'Widget',
      'array' => 'List<${_dartType(t.of.first, optional: false)}>',
      _ => 'Object',
    };
    return optional ? '$base?' : base;
  }
}

class EmittedComponent {
  const EmittedComponent({
    required this.basename,
    required this.shellSource,
    required this.generatedSource,
  });

  final String basename;
  final String shellSource;
  final String generatedSource;
}

String _toSnake(String s) {
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    final c = s[i];
    final isUpper = c == c.toUpperCase() && c != c.toLowerCase();
    if (isUpper && i > 0) buf.write('_');
    buf.write(c.toLowerCase());
  }
  return buf.toString();
}
