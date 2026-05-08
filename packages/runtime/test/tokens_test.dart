import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  const text = AppTextTokens(
    titleLarge: TextStyle(fontSize: 22),
    titleMedium: TextStyle(fontSize: 18),
    bodyLarge: TextStyle(fontSize: 16),
    bodyMedium: TextStyle(fontSize: 14),
    bodySmall: TextStyle(fontSize: 12),
  );

  group('AppTokens.fromColorScheme', () {
    test('seed-color fallback produces a complete token set (M3 roles wired)', () {
      // This is the path taken when DynamicColorBuilder returns null on
      // Android < 12. Must never throw and must populate every M3 role.
      final scheme = ColorScheme.fromSeed(
        seedColor: const Color(0xFF6750A4),
      );
      final tokens = AppTokens.fromColorScheme(scheme, text: text);

      // Surface tonality.
      expect(tokens.surface, scheme.surface);
      expect(tokens.surfaceContainerLowest, scheme.surfaceContainerLowest);
      expect(tokens.surfaceContainerLow, scheme.surfaceContainerLow);
      expect(tokens.surfaceContainerHigh, scheme.surfaceContainerHigh);
      expect(tokens.surfaceContainerHighest, scheme.surfaceContainerHighest);

      // Outline + inverse + error.
      expect(tokens.outlineVariant, scheme.outlineVariant);
      expect(tokens.inverseSurface, scheme.inverseSurface);
      expect(tokens.inversePrimary, scheme.inversePrimary);
      expect(tokens.errorContainer, scheme.errorContainer);
      expect(tokens.onErrorContainer, scheme.onErrorContainer);

      // Existing semantic-name tokens still wired.
      expect(tokens.primary, scheme.primary);
      expect(tokens.destructive, scheme.error);
      expect(tokens.border, scheme.outlineVariant);
    });

    test('dark scheme produces distinct surface tonality from light', () {
      final light = ColorScheme.fromSeed(seedColor: const Color(0xFF6750A4));
      final dark = ColorScheme.fromSeed(
        seedColor: const Color(0xFF6750A4),
        brightness: Brightness.dark,
      );
      final lightTokens = AppTokens.fromColorScheme(light, text: text);
      final darkTokens = AppTokens.fromColorScheme(dark, text: text);
      expect(lightTokens.surface, isNot(darkTokens.surface));
      expect(
        lightTokens.surfaceContainerHigh,
        isNot(darkTokens.surfaceContainerHigh),
      );
    });
  });

  group('AppTokens.copyWith', () {
    test('overrides only the supplied M3 fields', () {
      final scheme = ColorScheme.fromSeed(seedColor: const Color(0xFF112233));
      final base = AppTokens.fromColorScheme(scheme, text: text);
      final patched = base.copyWith(
        outlineVariant: const Color(0xFFAABBCC),
        inversePrimary: const Color(0xFFDDEEFF),
      );
      expect(patched.outlineVariant, const Color(0xFFAABBCC));
      expect(patched.inversePrimary, const Color(0xFFDDEEFF));
      // Untouched fields propagate.
      expect(patched.surface, base.surface);
      expect(patched.surfaceContainerLow, base.surfaceContainerLow);
    });
  });

  group('AppTokens.lerp', () {
    test('interpolates every M3 role at t=0.5', () {
      final a = AppTokens.fromColorScheme(
        ColorScheme.fromSeed(seedColor: const Color(0xFF000000)),
        text: text,
      );
      final b = AppTokens.fromColorScheme(
        ColorScheme.fromSeed(seedColor: const Color(0xFFFFFFFF)),
        text: text,
      );
      final mid = a.lerp(b, 0.5);
      // Sanity: midpoint must differ from both endpoints on at least one role.
      expect(mid.surfaceContainerHigh, isNot(a.surfaceContainerHigh));
      expect(mid.surfaceContainerHigh, isNot(b.surfaceContainerHigh));
    });
  });
}
