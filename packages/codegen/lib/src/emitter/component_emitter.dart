import 'package:code_builder/code_builder.dart';

import '../format.dart';
import '../ir.dart';

/// Emits a `<component>.dart` (handwritten shell) and `<component>.g.dart`
/// (regenerated widget tree) pair from a single [IrComponent].
///
/// The split exists so developers can hand-edit the shell file freely; only
/// `*.g.dart` is overwritten on every codegen run.
class ComponentEmitter {
  const ComponentEmitter();

  EmittedComponent emit(IrComponent component) {
    // TODO: walk component.body, map IR nodes to widget expressions via
    // `lib/src/mapping/widgets.dart` and `lib/src/mapping/tailwind.dart`.
    final shellLib = Library((b) => b
      ..directives.add(Directive.partOf('${component.name.toLowerCase()}.g.dart')));

    final genLib = Library((b) => b
      ..directives.add(Directive.partOf('${component.name.toLowerCase()}.dart')));

    return EmittedComponent(
      shellSource: formatDart(shellLib.accept(DartEmitter()).toString()),
      generatedSource: formatDart(genLib.accept(DartEmitter()).toString()),
    );
  }
}

class EmittedComponent {
  const EmittedComponent({
    required this.shellSource,
    required this.generatedSource,
  });

  final String shellSource;
  final String generatedSource;
}
