import 'package:flutter/material.dart';

/// Adaptive switch — `Switch.adaptive` on platforms that have a Cupertino
/// equivalent, regular `Switch` everywhere else.
class AppSwitch extends StatelessWidget {
  const AppSwitch({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Switch.adaptive(value: value, onChanged: onChanged);
  }
}
