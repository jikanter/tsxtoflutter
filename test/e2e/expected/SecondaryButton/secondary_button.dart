import 'package:flutter/material.dart';

part 'secondary_button.g.dart';

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    required this.onPress,
  });

  final String label;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => _$SecondaryButtonBuild(this, context);
}
