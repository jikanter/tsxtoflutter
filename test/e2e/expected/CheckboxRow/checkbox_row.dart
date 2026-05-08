import 'package:flutter/material.dart';

part 'checkbox_row.g.dart';

class CheckboxRow extends StatelessWidget {
  const CheckboxRow({
    super.key,
    required this.label,
    required this.checked,
    required this.onToggle,
  });

  final String label;
  final bool checked;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) => _$CheckboxRowBuild(this, context);
}
