// Dart-side mirror of the IR types shipped by `@tsxtoflutter/ir`.
//
// We deserialize JSON the TS side wrote; we never construct IR ourselves.
// Keep these types in lock-step with `packages/ir/src/types.ts`.
import 'dart:convert';
import 'dart:io';

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
    required this.body,
  });

  final String id;
  final String name;
  final Map<String, dynamic> body;

  factory IrComponent._fromJson(Map<String, dynamic> json) {
    return IrComponent(
      id: json['id'] as String,
      name: json['name'] as String,
      body: json['body'] as Map<String, dynamic>,
    );
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
