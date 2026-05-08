// Cross-platform smoke test. Renders the root App, asserts no exceptions
// and ≥1 frame. Catches the 80% case of "codegen emitted broken Dart" — see
// docs/research/04-ios-platform.md §10.
//
// CI matrix: this same file is executed by:
//   - macos-14 runner with iPhone 15 simulator (Phase 4 R9)
//   - ubuntu-latest with Android API 34 + 36 emulators (Phase 4 R9)
//   - flutter_app's flutter-web job (smoke only — no driver)
//
// Per-fixture / per-platform golden screenshots are emitted into
// `test/golden/{web,ios,android}/` by the codegen pipeline; verifying them
// is a separate test, not this one.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:flutter_app/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('App boots and renders ≥ 1 frame without exceptions',
      (tester) async {
    app.main();
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // The root MaterialApp must be present — proves the runApp() path
    // executed all the way through.
    expect(find.byType(MaterialApp), findsOneWidget);

    // No errors should have been logged to FlutterError. tester.takeException
    // returns null when none were captured.
    expect(tester.takeException(), isNull);
  });

  testWidgets('No semantics nodes flagged as button without label',
      (tester) async {
    // VoiceOver smoke (docs/research/04-ios-platform.md §5 / §10): every node that
    // claims to be a button MUST have a non-empty label. Catches icon-only
    // buttons that forgot a tooltip.
    app.main();
    await tester.pumpAndSettle();

    final handle = tester.ensureSemantics();
    addTearDown(handle.dispose);

    final unlabeledButtons = find.bySemanticsLabel(RegExp(r'^$'));
    final buttonNodes = tester
        .getSemantics(unlabeledButtons)
        .toString()
        .contains('isButton');
    expect(
      buttonNodes,
      isFalse,
      reason:
          'Found a Semantics node with isButton: true and an empty label. '
          'Add a tooltip / aria-label to the offending widget.',
    );
    // Enabled once a fixture-driven smoke harness lands (Phase 4 R10).
  }, skip: true,);
}
