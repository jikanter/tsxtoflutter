import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Adaptive primary button.
///
/// Generated code targets this — never `Platform.isIOS ? ... : ...` ternaries.
/// The shim picks Cupertino on iOS/macOS and Material `FilledButton` elsewhere.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.style = AppButtonStyle.primary,
  });

  final VoidCallback? onPressed;
  final Widget child;
  final AppButtonStyle style;

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    if (isCupertino) {
      return CupertinoButton.filled(
        onPressed: onPressed,
        child: DefaultTextStyle.merge(
          style: const TextStyle(fontWeight: FontWeight.w600),
          child: child,
        ),
      );
    }

    switch (style) {
      case AppButtonStyle.primary:
        return FilledButton(onPressed: onPressed, child: child);
      case AppButtonStyle.secondary:
        return FilledButton.tonal(onPressed: onPressed, child: child);
      case AppButtonStyle.destructive:
        return FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: Theme.of(context).colorScheme.error,
            foregroundColor: Theme.of(context).colorScheme.onError,
          ),
          onPressed: onPressed,
          child: child,
        );
      case AppButtonStyle.ghost:
        return TextButton(onPressed: onPressed, child: child);
    }
  }
}

enum AppButtonStyle { primary, secondary, destructive, ghost }
