import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Adaptive top nav bar.
///
/// On iOS / macOS the body delegates to `CupertinoNavigationBar`; everywhere
/// else it renders a Material `AppBar`. Implements `PreferredSizeWidget` so it
/// can plug into `AppScaffold`'s `appBar` slot uniformly.
class AppNavBar extends StatelessWidget implements PreferredSizeWidget {
  const AppNavBar({
    super.key,
    this.title,
    this.leading,
    this.actions,
    this.centerTitle,
  });

  final Widget? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool? centerTitle;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    if (isCupertino) {
      return CupertinoNavigationBar(
        leading: leading,
        middle: title,
        trailing: actions == null || actions!.isEmpty
            ? null
            : Row(mainAxisSize: MainAxisSize.min, children: actions!),
      );
    }

    return AppBar(
      leading: leading,
      title: title,
      actions: actions,
      centerTitle: centerTitle,
    );
  }
}
