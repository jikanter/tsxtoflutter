import 'package:flutter_test/flutter_test.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  group('windowSizeClassFor', () {
    test('classifies sub-600 dp as compact', () {
      expect(windowSizeClassFor(0), WindowSizeClass.compact);
      expect(windowSizeClassFor(599), WindowSizeClass.compact);
    });

    test('classifies 600–839 dp as medium', () {
      expect(windowSizeClassFor(600), WindowSizeClass.medium);
      expect(windowSizeClassFor(839), WindowSizeClass.medium);
    });

    test('classifies 840–1199 dp as expanded', () {
      expect(windowSizeClassFor(840), WindowSizeClass.expanded);
      expect(windowSizeClassFor(1199), WindowSizeClass.expanded);
    });

    test('classifies 1200–1599 dp as large', () {
      expect(windowSizeClassFor(1200), WindowSizeClass.large);
      expect(windowSizeClassFor(1599), WindowSizeClass.large);
    });

    test('classifies ≥1600 dp as extraLarge', () {
      expect(windowSizeClassFor(1600), WindowSizeClass.extraLarge);
      expect(windowSizeClassFor(2560), WindowSizeClass.extraLarge);
    });
  });

  group('MaterialBreakpoints constants', () {
    test('match Material adaptive-design dp thresholds', () {
      expect(MaterialBreakpoints.compact, 0);
      expect(MaterialBreakpoints.medium, 600);
      expect(MaterialBreakpoints.expanded, 840);
      expect(MaterialBreakpoints.large, 1200);
      expect(MaterialBreakpoints.extraLarge, 1600);
    });
  });

  group('Tailwind Breakpoints unchanged (regression)', () {
    test('preserves the v4 px values', () {
      expect(Breakpoints.sm, 640);
      expect(Breakpoints.md, 768);
      expect(Breakpoints.lg, 1024);
      expect(Breakpoints.xl, 1280);
      expect(Breakpoints.xl2, 1536);
    });
  });
}
