import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// One action button on an [AppDialog].
class AppDialogAction<T> {
  const AppDialogAction({
    required this.label,
    this.value,
    this.isDestructive = false,
    this.isDefault = false,
  });

  final String label;
  final T? value;
  final bool isDestructive;
  final bool isDefault;
}

/// Adaptive dialog: `AlertDialog` on Material, `CupertinoAlertDialog` on
/// iOS / macOS.
///
/// Use [AppDialog.show] — the constructor exists only so the dialog can be
/// referenced as a widget when needed (e.g. inside a custom showDialog).
class AppDialog<T> extends StatelessWidget {
  const AppDialog({
    super.key,
    this.title,
    this.content,
    this.actions = const [],
  });

  final Widget? title;
  final Widget? content;
  final List<AppDialogAction<T>> actions;

  static Future<T?> show<T>({
    required BuildContext context,
    Widget? title,
    Widget? content,
    List<AppDialogAction<T>> actions = const [],
    bool barrierDismissible = true,
  }) {
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    if (isCupertino) {
      return showCupertinoDialog<T>(
        context: context,
        barrierDismissible: barrierDismissible,
        builder: (ctx) => CupertinoAlertDialog(
          title: title,
          content: content,
          actions: [
            for (final a in actions)
              CupertinoDialogAction(
                isDestructiveAction: a.isDestructive,
                isDefaultAction: a.isDefault,
                onPressed: () => Navigator.of(ctx).pop<T>(a.value),
                child: Text(a.label),
              ),
          ],
        ),
      );
    }

    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (ctx) => AlertDialog(
        title: title,
        content: content,
        actions: [
          for (final a in actions)
            TextButton(
              onPressed: () => Navigator.of(ctx).pop<T>(a.value),
              style: a.isDestructive
                  ? TextButton.styleFrom(
                      foregroundColor: Theme.of(ctx).colorScheme.error,
                    )
                  : null,
              child: Text(a.label),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    if (isCupertino) {
      return CupertinoAlertDialog(
        title: title,
        content: content,
        actions: [
          for (final a in actions)
            CupertinoDialogAction(
              isDestructiveAction: a.isDestructive,
              isDefaultAction: a.isDefault,
              onPressed: () => Navigator.of(context).pop<T>(a.value),
              child: Text(a.label),
            ),
        ],
      );
    }

    return AlertDialog(
      title: title,
      content: content,
      actions: [
        for (final a in actions)
          TextButton(
            onPressed: () => Navigator.of(context).pop<T>(a.value),
            child: Text(a.label),
          ),
      ],
    );
  }
}
