import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_app/components/cta.dart';

void main() {
  testWidgets('generated Cta button renders its label and fires onGo',
      (WidgetTester tester) async {
    var taps = 0;
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: Center(
              child: Cta(label: 'Get started', onGo: () => taps++),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Get started'), findsOneWidget);
    expect(find.byIcon(Icons.chevron_right), findsOneWidget);

    await tester.tap(find.byType(Cta));
    expect(taps, 1);
  });
}
