import 'package:flutter/material.dart';

part 'switch_row.g.dart';

class SwitchRow extends StatelessWidget {
  const SwitchRow({
    super.key,
    required this.label,
    required this.checked,
    required this.onToggle,
  });

  final String label;
  final bool checked;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) => _$SwitchRowBuild(this, context);
}
