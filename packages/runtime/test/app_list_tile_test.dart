import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  group('AppListTile', () {
    testWidgets('uses Material ListTile on Android', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.android),
          home: Material(
            child: AppListTile(
              title: const Text('row'),
              onTap: () => taps++,
            ),
          ),
        ),
      );
      expect(find.byType(ListTile), findsOneWidget);
      expect(find.byType(CupertinoListTile), findsNothing);
      await tester.tap(find.byType(ListTile));
      expect(taps, 1);
    });

    testWidgets('uses CupertinoListTile on iOS', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(platform: TargetPlatform.iOS),
          home: const Material(
            child: AppListTile(title: Text('row')),
          ),
        ),
      );
      expect(find.byType(CupertinoListTile), findsOneWidget);
      expect(find.byType(ListTile), findsNothing);
    });
  });
}
