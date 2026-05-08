import 'package:flutter/material.dart';

part 'primary_button.g.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({super.key, required this.label, required this.onPress});

  final String label;
  final VoidCallback onPress;

  @override
  Widget build(BuildContext context) => _$PrimaryButtonBuild(this, context);
}
