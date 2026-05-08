import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  group('AppNavBar', () {
    testWidgets('renders Material AppBar on Android', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.android),
          home: const Scaffold(
            appBar: AppNavBar(title: Text('hi')),
            body: SizedBox.shrink(),
          ),
        ),
      );
      expect(find.byType(AppBar), findsOneWidget);
      expect(find.byType(CupertinoNavigationBar), findsNothing);
      expect(find.text('hi'), findsOneWidget);
    });

    testWidgets('renders CupertinoNavigationBar on iOS', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.iOS),
          home: const Scaffold(
            appBar: AppNavBar(title: Text('hi')),
            body: SizedBox.shrink(),
          ),
        ),
      );
      expect(find.byType(CupertinoNavigationBar), findsOneWidget);
      expect(find.byType(AppBar), findsNothing);
    });

    test('preferred size is the standard toolbar height', () {
      const bar = AppNavBar(title: Text('x'));
      expect(bar.preferredSize.height, kToolbarHeight);
    });
  });
}
