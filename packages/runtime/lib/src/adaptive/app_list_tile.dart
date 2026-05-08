import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

/// Adaptive list tile.
///
/// Cupertino on iOS / macOS, Material `ListTile` everywhere else. The shim
/// keeps the call site identical so generated code never branches on platform.
class AppListTile extends StatelessWidget {
  const AppListTile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
  });

  final Widget title;
  final Widget? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final platform = Theme.of(context).platform;
    final isCupertino =
        platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;

    if (isCupertino) {
      return CupertinoListTile(
        title: title,
        subtitle: subtitle,
        leading: leading,
        trailing: trailing,
        onTap: onTap,
      );
    }

    return ListTile(
      title: title,
      subtitle: subtitle,
      leading: leading,
      trailing: trailing,
      onTap: onTap,
    );
  }
}
