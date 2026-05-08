import 'package:dart_style/dart_style.dart';

/// Single formatter instance reused across the codegen run.
final DartFormatter formatter = DartFormatter(
  languageVersion: DartFormatter.latestLanguageVersion,
);

String formatDart(String source) => formatter.format(source);
