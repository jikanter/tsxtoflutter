import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  group('AppDialog.show', () {
    testWidgets('emits a Material AlertDialog on Android', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.android),
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () => AppDialog.show<void>(
                  context: context,
                  title: const Text('confirm'),
                  content: const Text('really?'),
                  actions: const [
                    AppDialogAction(label: 'OK'),
                  ],
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.byType(CupertinoAlertDialog), findsNothing);
      expect(find.text('confirm'), findsOneWidget);
      expect(find.text('OK'), findsOneWidget);
    });

    testWidgets('emits a CupertinoAlertDialog on iOS', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.iOS),
          home: Builder(
            builder: (context) => Scaffold(
              body: CupertinoButton(
                onPressed: () => AppDialog.show<void>(
                  context: context,
                  title: const Text('confirm'),
                  content: const Text('really?'),
                  actions: const [
                    AppDialogAction(label: 'OK'),
                  ],
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.byType(CupertinoAlertDialog), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
    });

    testWidgets('returns the action value when an action is tapped',
        (tester) async {
      String? result;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.android),
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () async {
                  result = await AppDialog.show<String>(
                    context: context,
                    title: const Text('pick'),
                    actions: const [
                      AppDialogAction(label: 'cancel', value: 'cancelled'),
                      AppDialogAction(label: 'confirm', value: 'confirmed'),
                    ],
                  );
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('confirm'));
      await tester.pumpAndSettle();
      expect(result, 'confirmed');
    });
  });
}
