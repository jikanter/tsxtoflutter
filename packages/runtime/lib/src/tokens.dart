import 'package:flutter/material.dart';

/// `ThemeExtension` carrying the design tokens emitted by `@tsxtoflutter/tokens`.
///
/// Generated widgets read tokens via `context.tokens.surface`, never via
/// hardcoded hex or `Theme.of(context).colorScheme.surface` directly.
///
/// The full Material 3 surface tonality (`surfaceContainer{Lowest,Low,High,Highest}`)
/// + outline + inverse + error roles are exposed so generated code can match
/// M3 widget expectations on Android 12+ Material You without round-tripping
/// through `ColorScheme`.
class AppTokens extends ThemeExtension<AppTokens> {
  const AppTokens({
    required this.surface,
    required this.surfaceContainer,
    required this.onSurface,
    required this.mutedForeground,
    required this.primary,
    required this.onPrimary,
    required this.destructive,
    required this.onDestructive,
    required this.border,
    required this.text,
    // M3 surface tonality (Phase 4 R5).
    required this.surfaceContainerLowest,
    required this.surfaceContainerLow,
    required this.surfaceContainerHigh,
    required this.surfaceContainerHighest,
    required this.outlineVariant,
    required this.inverseSurface,
    required this.inversePrimary,
    required this.errorContainer,
    required this.onErrorContainer,
  });

  /// Build an `AppTokens` from a Material 3 `ColorScheme`. Used both by
  /// `flutter_app/lib/main.dart` and by tests; the seed-color fallback path
  /// goes through this same constructor so we know it always produces a
  /// well-formed token set even when `DynamicColorBuilder` returns null.
  factory AppTokens.fromColorScheme(
    ColorScheme scheme, {
    required AppTextTokens text,
  }) {
    return AppTokens(
      surface: scheme.surface,
      surfaceContainer: scheme.surfaceContainerHigh,
      onSurface: scheme.onSurface,
      mutedForeground: scheme.onSurfaceVariant,
      primary: scheme.primary,
      onPrimary: scheme.onPrimary,
      destructive: scheme.error,
      onDestructive: scheme.onError,
      border: scheme.outlineVariant,
      text: text,
      surfaceContainerLowest: scheme.surfaceContainerLowest,
      surfaceContainerLow: scheme.surfaceContainerLow,
      surfaceContainerHigh: scheme.surfaceContainerHigh,
      surfaceContainerHighest: scheme.surfaceContainerHighest,
      outlineVariant: scheme.outlineVariant,
      inverseSurface: scheme.inverseSurface,
      inversePrimary: scheme.inversePrimary,
      errorContainer: scheme.errorContainer,
      onErrorContainer: scheme.onErrorContainer,
    );
  }

  final Color surface;
  final Color surfaceContainer;
  final Color onSurface;
  final Color mutedForeground;
  final Color primary;
  final Color onPrimary;
  final Color destructive;
  final Color onDestructive;
  final Color border;
  final AppTextTokens text;

  // M3 surface tonality + inverse + error roles.
  final Color surfaceContainerLowest;
  final Color surfaceContainerLow;
  final Color surfaceContainerHigh;
  final Color surfaceContainerHighest;
  final Color outlineVariant;
  final Color inverseSurface;
  final Color inversePrimary;
  final Color errorContainer;
  final Color onErrorContainer;

  @override
  AppTokens copyWith({
    Color? surface,
    Color? surfaceContainer,
    Color? onSurface,
    Color? mutedForeground,
    Color? primary,
    Color? onPrimary,
    Color? destructive,
    Color? onDestructive,
    Color? border,
    AppTextTokens? text,
    Color? surfaceContainerLowest,
    Color? surfaceContainerLow,
    Color? surfaceContainerHigh,
    Color? surfaceContainerHighest,
    Color? outlineVariant,
    Color? inverseSurface,
    Color? inversePrimary,
    Color? errorContainer,
    Color? onErrorContainer,
  }) {
    return AppTokens(
      surface: surface ?? this.surface,
      surfaceContainer: surfaceContainer ?? this.surfaceContainer,
      onSurface: onSurface ?? this.onSurface,
      mutedForeground: mutedForeground ?? this.mutedForeground,
      primary: primary ?? this.primary,
      onPrimary: onPrimary ?? this.onPrimary,
      destructive: destructive ?? this.destructive,
      onDestructive: onDestructive ?? this.onDestructive,
      border: border ?? this.border,
      text: text ?? this.text,
      surfaceContainerLowest:
          surfaceContainerLowest ?? this.surfaceContainerLowest,
      surfaceContainerLow: surfaceContainerLow ?? this.surfaceContainerLow,
      surfaceContainerHigh: surfaceContainerHigh ?? this.surfaceContainerHigh,
      surfaceContainerHighest:
          surfaceContainerHighest ?? this.surfaceContainerHighest,
      outlineVariant: outlineVariant ?? this.outlineVariant,
      inverseSurface: inverseSurface ?? this.inverseSurface,
      inversePrimary: inversePrimary ?? this.inversePrimary,
      errorContainer: errorContainer ?? this.errorContainer,
      onErrorContainer: onErrorContainer ?? this.onErrorContainer,
    );
  }

  @override
  AppTokens lerp(ThemeExtension<AppTokens>? other, double t) {
    if (other is! AppTokens) return this;
    return AppTokens(
      surface: Color.lerp(surface, other.surface, t)!,
      surfaceContainer: Color.lerp(surfaceContainer, other.surfaceContainer, t)!,
      onSurface: Color.lerp(onSurface, other.onSurface, t)!,
      mutedForeground: Color.lerp(mutedForeground, other.mutedForeground, t)!,
      primary: Color.lerp(primary, other.primary, t)!,
      onPrimary: Color.lerp(onPrimary, other.onPrimary, t)!,
      destructive: Color.lerp(destructive, other.destructive, t)!,
      onDestructive: Color.lerp(onDestructive, other.onDestructive, t)!,
      border: Color.lerp(border, other.border, t)!,
      text: text.lerp(other.text, t),
      surfaceContainerLowest: Color.lerp(
        surfaceContainerLowest,
        other.surfaceContainerLowest,
        t,
      )!,
      surfaceContainerLow:
          Color.lerp(surfaceContainerLow, other.surfaceContainerLow, t)!,
      surfaceContainerHigh:
          Color.lerp(surfaceContainerHigh, other.surfaceContainerHigh, t)!,
      surfaceContainerHighest: Color.lerp(
        surfaceContainerHighest,
        other.surfaceContainerHighest,
        t,
      )!,
      outlineVariant: Color.lerp(outlineVariant, other.outlineVariant, t)!,
      inverseSurface: Color.lerp(inverseSurface, other.inverseSurface, t)!,
      inversePrimary: Color.lerp(inversePrimary, other.inversePrimary, t)!,
      errorContainer: Color.lerp(errorContainer, other.errorContainer, t)!,
      onErrorContainer:
          Color.lerp(onErrorContainer, other.onErrorContainer, t)!,
    );
  }
}

class AppTextTokens {
  const AppTextTokens({
    required this.titleLarge,
    required this.titleMedium,
    required this.bodyLarge,
    required this.bodyMedium,
    required this.bodySmall,
  });

  final TextStyle titleLarge;
  final TextStyle titleMedium;
  final TextStyle bodyLarge;
  final TextStyle bodyMedium;
  final TextStyle bodySmall;

  AppTextTokens lerp(AppTextTokens other, double t) {
    return AppTextTokens(
      titleLarge: TextStyle.lerp(titleLarge, other.titleLarge, t)!,
      titleMedium: TextStyle.lerp(titleMedium, other.titleMedium, t)!,
      bodyLarge: TextStyle.lerp(bodyLarge, other.bodyLarge, t)!,
      bodyMedium: TextStyle.lerp(bodyMedium, other.bodyMedium, t)!,
      bodySmall: TextStyle.lerp(bodySmall, other.bodySmall, t)!,
    );
  }
}

extension TokensContext on BuildContext {
  AppTokens get tokens {
    final ext = Theme.of(this).extension<AppTokens>();
    assert(
      ext != null,
      'AppTokens not registered. Did you forget to add it to ThemeData.extensions?',
    );
    return ext!;
  }
}
