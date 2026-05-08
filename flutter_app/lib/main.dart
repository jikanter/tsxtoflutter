import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:tsxtoflutter_runtime/tsxtoflutter_runtime.dart';

void main() {
  runApp(const ProviderScope(child: App()));
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return DynamicColorBuilder(
      builder: (lightDynamic, darkDynamic) {
        final lightScheme = lightDynamic ??
            ColorScheme.fromSeed(seedColor: const Color(0xFF6750A4));
        final darkScheme = darkDynamic ??
            ColorScheme.fromSeed(
              seedColor: const Color(0xFF6750A4),
              brightness: Brightness.dark,
            );
        return MaterialApp(
          title: 'tsxtoflutter',
          debugShowCheckedModeBanner: false,
          theme: _build(lightScheme),
          darkTheme: _build(darkScheme),
          themeMode: ThemeMode.system,
          home: const _Placeholder(),
        );
      },
    );
  }

  ThemeData _build(ColorScheme scheme) {
    return ThemeData(
      colorScheme: scheme,
      useMaterial3: true,
      extensions: [
        AppTokens(
          surface: scheme.surface,
          surfaceContainer: scheme.surfaceContainerHigh,
          onSurface: scheme.onSurface,
          mutedForeground: scheme.onSurfaceVariant,
          primary: scheme.primary,
          onPrimary: scheme.onPrimary,
          destructive: scheme.error,
          onDestructive: scheme.onError,
          border: scheme.outlineVariant,
          text: const AppTextTokens(
            titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w600),
            titleMedium: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            bodyLarge: TextStyle(fontSize: 16),
            bodyMedium: TextStyle(fontSize: 14),
            bodySmall: TextStyle(fontSize: 12),
          ),
        ),
      ],
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder();

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      appBar: AppBar(title: const Text('tsxtoflutter')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.s6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            spacing: Spacing.s4,
            children: [
              Text(
                'Generated widgets will appear here.',
                style: context.tokens.text.titleMedium,
              ),
              Text(
                'Run `tsxf convert ./inputs --out flutter_app/lib/components` '
                'to populate this app.',
                style: context.tokens.text.bodyMedium.copyWith(
                  color: context.tokens.mutedForeground,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
