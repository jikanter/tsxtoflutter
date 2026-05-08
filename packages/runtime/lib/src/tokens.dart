import 'package:flutter/material.dart';

/// `ThemeExtension` carrying the design tokens emitted by `@tsxtoflutter/tokens`.
///
/// Generated widgets read tokens via `context.tokens.surface`, never via
/// hardcoded hex or `Theme.of(context).colorScheme.surface` directly.
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
  });

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
