import 'package:flutter/material.dart';

part 'ghost_button.g.dart';

class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, required this.onPress});

  final String label;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => _$GhostButtonBuild(this, context);
}
